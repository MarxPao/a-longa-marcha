import * as THREE from 'three';
import { LAYOUT_PADRAO, PALETA_MAPA } from '../config/layout';
import type { Fluxo, LenteMapa, UUID } from '../domain';
import { gerarSementeRotaSemana, type Ponto2D } from '../engine/trade';

export type QualidadeEfetivaMapa = 'baixa' | 'media' | 'alta';

export type TipoCargaNpc =
  | 'sacos'
  | 'barris'
  | 'caixas'
  | 'pergaminhos'
  | 'moedas_insumos';

interface SegmentoPreCalculado {
  x0: number;
  z0: number;
  dx: number;
  dz: number;
  comprimento: number;
  acumuladoInicio: number;
  anguloY: number;
}

interface RotaPreCalculada {
  fluxoId: string;
  tipoFluxo: Fluxo['tipo'];
  origemId: string;
  destinoId: string;
  setorOrigemId: string;
  produtoIds: string[];
  comprimentoTotal: number;
  segmentos: SegmentoPreCalculado[];
}

interface AgenteNpcAtivo {
  rotaIdx: number;
  tInicial: number;
  velocidadeUnidadesPorSeg: number;
  corSetor: THREE.Color;
  tipoCarga: TipoCargaNpc;
  ehCarroca: boolean;
}

export interface EstadoNpcsFluxo {
  totalNpcsAtivos: number;
  totalRotasComFluxo: number;
  modoRenderizacao: 'modelos_completos' | 'particulas_distantes';
  contagemPorCarga: Record<TipoCargaNpc, number>;
}

/**
 * Gerenciador de NPCs, Cargas e Carroças em InstancedMesh com balanço de caminhada
 * no vertex shader e transição para partículas em câmera distante (Seções 4.5 e 6).
 */
export class GerenciadorNpcsFluxo {
  private readonly cena: THREE.Scene;
  private readonly grupoNpcs: THREE.Group;

  private malhaCorpoNpc!: THREE.InstancedMesh;
  private malhaBandeirolaNpc!: THREE.InstancedMesh;
  private malhaCarrocaNpc!: THREE.InstancedMesh;
  private readonly malhasCarga = new Map<TipoCargaNpc, THREE.InstancedMesh>();
  private pontosParticulasDistantes!: THREE.Points;

  private readonly uTempoShader = { value: 0 };
  private rotasPreCalculadas: RotaPreCalculada[] = [];
  private agentes: AgenteNpcAtivo[] = [];
  private tempoSimuladoSegundos = 0;
  private reduzirMovimento = false;
  private modoDistanteParticulas = false;
  private contagemPorCargaAtual: Record<TipoCargaNpc, number> = {
    sacos: 0,
    barris: 0,
    caixas: 0,
    pergaminhos: 0,
    moedas_insumos: 0,
  };
  private obterAlturaTerreno?: (x: number, z: number) => number;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.grupoNpcs = new THREE.Group();
    this.grupoNpcs.name = 'grupo-npcs-fluxo-mercado';
    this.cena.add(this.grupoNpcs);

    this.inicializarMalhasInstanciadas(LAYOUT_PADRAO.tetoGlobalNpcs);
  }

  private inicializarMalhasInstanciadas(capacidadeMax: number): void {
    const hBase = LAYOUT_PADRAO.npcAlturaBase;
    const escVisual = LAYOUT_PADRAO.NPC_VISUAL_SCALE;
    const hVisual = hBase * escVisual; // 1.6 * 2 = 3.2 u

    // 1. Corpo do NPC com vertex shader de balanço de caminhada
    const geoCorpo = new THREE.CapsuleGeometry(0.38 * escVisual, hVisual * 0.55, 4, 8);
    geoCorpo.translate(0, hVisual * 0.5, 0);

    const matCorpo = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.pergaminho,
      roughness: 0.7,
      metalness: 0.1,
    });
    matCorpo.onBeforeCompile = (shader) => {
      shader.uniforms.uTempo = this.uTempoShader;
      shader.vertexShader =
        `uniform float uTempo;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float faseNpc = float(gl_InstanceID) * 1.37;
          transformed.y += abs(sin(uTempo * 9.0 + faseNpc)) * 0.28;
          transformed.x += sin(uTempo * 4.5 + faseNpc) * 0.12;`
        );
    };

    this.malhaCorpoNpc = new THREE.InstancedMesh(geoCorpo, matCorpo, capacidadeMax);
    this.malhaCorpoNpc.name = 'npcs-corpo-instanciado';
    this.malhaCorpoNpc.count = 0;
    this.malhaCorpoNpc.frustumCulled = false;
    this.malhaCorpoNpc.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaCorpoNpc.instanceColor) {
      this.malhaCorpoNpc.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.grupoNpcs.add(this.malhaCorpoNpc);

    // 2. Bandeirola nas costas do NPC com a cor do setor de origem
    const geoBandeirola = new THREE.ConeGeometry(0.36 * escVisual, 0.95 * escVisual, 3);
    geoBandeirola.rotateX(Math.PI);
    geoBandeirola.translate(0, hVisual * 1.15, -0.25 * escVisual);
    const matBandeirola = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

    this.malhaBandeirolaNpc = new THREE.InstancedMesh(
      geoBandeirola,
      matBandeirola,
      capacidadeMax
    );
    this.malhaBandeirolaNpc.name = 'npcs-bandeirola-setor';
    this.malhaBandeirolaNpc.count = 0;
    this.malhaBandeirolaNpc.frustumCulled = false;
    this.malhaBandeirolaNpc.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaBandeirolaNpc.instanceColor) {
      this.malhaBandeirolaNpc.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.grupoNpcs.add(this.malhaBandeirolaNpc);

    // 3. Carroça (3 u * NPC_VISUAL_SCALE) para rotas de maior volume
    const compCarroca = LAYOUT_PADRAO.carrocaComprimento * 1.25;
    const geoCarroca = new THREE.BoxGeometry(compCarroca * 0.55, 0.9, compCarroca);
    geoCarroca.translate(0, 0.55, -compCarroca * 0.35);
    const matCarroca = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.bronze,
      roughness: 0.8,
    });
    this.malhaCarrocaNpc = new THREE.InstancedMesh(
      geoCarroca,
      matCarroca,
      capacidadeMax
    );
    this.malhaCarrocaNpc.name = 'npcs-carrocas-instanciadas';
    this.malhaCarrocaNpc.count = 0;
    this.malhaCarrocaNpc.frustumCulled = false;
    this.malhaCarrocaNpc.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grupoNpcs.add(this.malhaCarrocaNpc);

    // 4. Modelos de carga por tipo de produto (sacos, barris, caixas, pergaminhos, moedas_insumos)
    const tiposCarga: Array<{
      tipo: TipoCargaNpc;
      geo: THREE.BufferGeometry;
      cor: string;
    }> = [
      {
        tipo: 'sacos',
        geo: new THREE.SphereGeometry(0.45 * escVisual, 8, 6),
        cor: '#E8DCC0',
      },
      {
        tipo: 'barris',
        geo: new THREE.CylinderGeometry(
          0.36 * escVisual,
          0.36 * escVisual,
          0.75 * escVisual,
          8
        ),
        cor: '#7B2D3A',
      },
      {
        tipo: 'caixas',
        geo: new THREE.BoxGeometry(
          0.62 * escVisual,
          0.55 * escVisual,
          0.62 * escVisual
        ),
        cor: '#B07A4A',
      },
      {
        tipo: 'pergaminhos',
        geo: new THREE.CylinderGeometry(
          0.24 * escVisual,
          0.24 * escVisual,
          0.82 * escVisual,
          8
        ),
        cor: '#6FA3C7',
      },
      {
        tipo: 'moedas_insumos',
        geo: new THREE.OctahedronGeometry(0.44 * escVisual, 0),
        cor: PALETA_MAPA.ouro,
      },
    ];

    for (const item of tiposCarga) {
      item.geo.translate(0, hVisual * 0.68, 0.38 * escVisual);
      const matCarga = new THREE.MeshStandardMaterial({
        color: item.cor,
        roughness: 0.55,
        metalness: item.tipo === 'moedas_insumos' ? 0.35 : 0.1,
      });
      const malha = new THREE.InstancedMesh(item.geo, matCarga, capacidadeMax);
      malha.name = `npcs-carga-${item.tipo}`;
      malha.count = 0;
      malha.frustumCulled = false;
      malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.grupoNpcs.add(malha);
      this.malhasCarga.set(item.tipo, malha);
    }

    // 5. Partículas fluindo na estrada para câmera distante
    const posicoesParticulas = new Float32Array(capacidadeMax * 3);
    const coresParticulas = new Float32Array(capacidadeMax * 3);
    const geoParticulas = new THREE.BufferGeometry();
    geoParticulas.setAttribute(
      'position',
      new THREE.BufferAttribute(posicoesParticulas, 3)
    );
    geoParticulas.setAttribute('color', new THREE.BufferAttribute(coresParticulas, 3));

    const matParticulas = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    this.pontosParticulasDistantes = new THREE.Points(geoParticulas, matParticulas);
    this.pontosParticulasDistantes.frustumCulled = false;
    this.pontosParticulasDistantes.name = 'npcs-particulas-fluxo-distante';
    this.pontosParticulasDistantes.visible = false;
    this.grupoNpcs.add(this.pontosParticulasDistantes);
  }

  private preCalcularRota(fluxo: Fluxo): RotaPreCalculada | null {
    const pts: readonly Ponto2D[] = fluxo.rota;
    if (pts.length < 2) return null;

    const segmentos: SegmentoPreCalculado[] = [];
    let acumulado = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const comp = Math.hypot(dx, dz);
      if (comp < 1e-3) continue;

      segmentos.push({
        x0: p0.x,
        z0: p0.z,
        dx,
        dz,
        comprimento: comp,
        acumuladoInicio: acumulado,
        anguloY: Math.atan2(dx, dz),
      });
      acumulado += comp;
    }

    if (acumulado < 1 || segmentos.length === 0) return null;

    return {
      fluxoId: fluxo.id,
      tipoFluxo: fluxo.tipo,
      origemId: fluxo.origemId,
      destinoId: fluxo.destinoId,
      setorOrigemId: fluxo.setorOrigemId ?? '',
      produtoIds: fluxo.produtoIds,
      comprimentoTotal: acumulado,
      segmentos,
    };
  }

  private amostrarPosicaoNaRota(
    rota: RotaPreCalculada,
    tNormalizado: number
  ): { x: number; z: number; anguloY: number } {
    const distAlvo = Math.max(0, Math.min(1, tNormalizado)) * rota.comprimentoTotal;
    const segs = rota.segmentos;

    // Busca binária rápida no vetor de segmentos pré-calculados
    let ini = 0;
    let fim = segs.length - 1;
    let escolhido = segs[0]!;

    while (ini <= fim) {
      const meio = (ini + fim) >> 1;
      const s = segs[meio]!;
      if (distAlvo >= s.acumuladoInicio && distAlvo <= s.acumuladoInicio + s.comprimento) {
        escolhido = s;
        break;
      }
      if (distAlvo < s.acumuladoInicio) {
        fim = meio - 1;
      } else {
        escolhido = s;
        ini = meio + 1;
      }
    }

    const fracLocal =
      escolhido.comprimento > 1e-4
        ? (distAlvo - escolhido.acumuladoInicio) / escolhido.comprimento
        : 0;
    return {
      x: escolhido.x0 + escolhido.dx * fracLocal,
      z: escolhido.z0 + escolhido.dz * fracLocal,
      anguloY: escolhido.anguloY,
    };
  }

  /**
   * Reconstrói a lista de rotas pré-calculadas e agentes NPC a partir dos fluxos derivados,
   * respeitando o limite de qualidade gráfica (400 / 900 / 1.500) e os filtros ativos.
   */
  public atualizarFluxos(
    fluxos: readonly Fluxo[],
    qualidade: QualidadeEfetivaMapa = 'alta',
    lenteAtiva: LenteMapa = 'padrao',
    filtroSetorId: UUID | null = null,
    filtroProdutoId: UUID | null = null,
    semana = '2026-11-01',
    obterAlturaTerreno?: (x: number, z: number) => number
  ): void {
    if (obterAlturaTerreno) {
      this.obterAlturaTerreno = obterAlturaTerreno;
    }
    this.rotasPreCalculadas = [];
    this.agentes = [];
    this.contagemPorCargaAtual = {
      sacos: 0,
      barris: 0,
      caixas: 0,
      pergaminhos: 0,
      moedas_insumos: 0,
    };

    const limiteQualidade = LAYOUT_PADRAO.limiteNpcsPorQualidade[qualidade];

    // Filtra fluxos de acordo com lente e filtro de setor/produto
    const fluxosVisiveis = fluxos.filter((f) => {
      if (f.volumeMensal <= 0 || (f.quantidadeNpcs ?? 0) <= 0) return false;
      if (lenteAtiva === 'rede' && f.tipo !== 'ligacao') return false;
      if (filtroSetorId !== null && f.setorOrigemId !== filtroSetorId) return false;
      if (filtroProdutoId !== null && !f.produtoIds.includes(filtroProdutoId)) {
        return false;
      }
      return true;
    });

    let somaDesejada = 0;
    for (const f of fluxosVisiveis) {
      somaDesejada += f.quantidadeNpcs ?? 1;
    }

    const fatorQualidade =
      somaDesejada > limiteQualidade && somaDesejada > 0
        ? limiteQualidade / somaDesejada
        : 1.0;

    for (const f of fluxosVisiveis) {
      const rota = this.preCalcularRota(f);
      if (!rota) continue;
      const rotaIdx = this.rotasPreCalculadas.length;
      this.rotasPreCalculadas.push(rota);

      // Garante espaçamento mínimo entre NPCs na mesma estrada
      const maxPorEspacamento = Math.max(
        1,
        Math.floor(rota.comprimentoTotal / LAYOUT_PADRAO.espacamentoMinimoNpcUnidades)
      );
      const qtdAlvo = Math.max(
        1,
        Math.min(
          maxPorEspacamento,
          Math.round((f.quantidadeNpcs ?? 1) * fatorQualidade)
        )
      );

      const semente = gerarSementeRotaSemana(f.id, semana);
      const offsetRota = ((semente & 0xffff) / 65535) % 1;
      const corSetor = new THREE.Color(f.corSetorOrigem ?? PALETA_MAPA.ouro);
      const tipoCarga = (
        ['sacos', 'barris', 'caixas', 'pergaminhos', 'moedas_insumos'].includes(
          f.tipoCarga ?? ''
        )
          ? f.tipoCarga
          : 'caixas'
      ) as TipoCargaNpc;

      for (let k = 0; k < qtdAlvo; k++) {
        if (this.agentes.length >= limiteQualidade) break;

        // Espaçamento uniforme ao longo da rota [0, 1) para nunca sobrepor
        const tInicial = (offsetRota + k / qtdAlvo) % 1;
        const variacaoVel =
          1 + ((((semente >> ((k % 8) * 2)) & 0xf) / 15 - 0.5) * 0.08);
        const ehCarroca = k === 0 && (f.quantidadeNpcs ?? 1) >= 4;

        this.agentes.push({
          rotaIdx,
          tInicial,
          velocidadeUnidadesPorSeg:
            LAYOUT_PADRAO.velocidadeNpcUnidadesPorSegundo * variacaoVel,
          corSetor,
          tipoCarga,
          ehCarroca,
        });
        this.contagemPorCargaAtual[tipoCarga]++;
      }
    }

    this.atualizarMatrizesQuadro(0, 220);
  }

  public definirReduzirMovimento(reduzir: boolean): void {
    this.reduzirMovimento = reduzir;
  }

  /**
   * Avança todos os NPCs ao longo das polilinhas pré-calculadas (6 u/s) e atualiza as InstancedMeshes
   * ou partículas de fluxo conforme a distância da câmera.
   */
  public atualizarMatrizesQuadro(
    deltaSegundos: number,
    distanciaCamera: number
  ): void {
    if (!this.reduzirMovimento && deltaSegundos > 0) {
      this.tempoSimuladoSegundos += Math.min(0.1, deltaSegundos);
    }
    this.uTempoShader.value = this.tempoSimuladoSegundos;

    const total = this.agentes.length;
    const usarParticulas =
      distanciaCamera > LAYOUT_PADRAO.distanciaCameraParticulasNpc;
    this.modoDistanteParticulas = usarParticulas;

    if (total === 0) {
      this.malhaCorpoNpc.count = 0;
      this.malhaBandeirolaNpc.count = 0;
      this.malhaCarrocaNpc.count = 0;
      for (const m of this.malhasCarga.values()) m.count = 0;
      this.pontosParticulasDistantes.visible = false;
      return;
    }

    if (usarParticulas) {
      this.malhaCorpoNpc.visible = false;
      this.malhaBandeirolaNpc.visible = false;
      this.malhaCarrocaNpc.visible = false;
      for (const m of this.malhasCarga.values()) m.visible = false;
      this.pontosParticulasDistantes.visible = true;

      const attrPos = this.pontosParticulasDistantes.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      const attrCor = this.pontosParticulasDistantes.geometry.getAttribute(
        'color'
      ) as THREE.BufferAttribute;

      for (let i = 0; i < attrPos.count; i++) {
        if (i >= total) {
          attrPos.setXYZ(i, 0, -999, 0);
          continue;
        }
        const ag = this.agentes[i]!;
        const rota = this.rotasPreCalculadas[ag.rotaIdx]!;
        const avancoT =
          (this.tempoSimuladoSegundos * ag.velocidadeUnidadesPorSeg) /
          rota.comprimentoTotal;
        const t = (ag.tInicial + avancoT) % 1;
        const pos = this.amostrarPosicaoNaRota(rota, t);
        const hTerreno = this.obterAlturaTerreno?.(pos.x, pos.z) ?? 0;
        attrPos.setXYZ(i, pos.x, hTerreno + 1.4, pos.z);
        attrCor.setXYZ(i, ag.corSetor.r, ag.corSetor.g, ag.corSetor.b);
      }
      attrPos.needsUpdate = true;
      attrCor.needsUpdate = true;
      return;
    }

    // Modo próximo/médio: modelos instanciados completos com carga e carroça
    this.pontosParticulasDistantes.visible = false;
    this.malhaCorpoNpc.visible = true;
    this.malhaBandeirolaNpc.visible = true;
    this.malhaCarrocaNpc.visible = true;
    for (const m of this.malhasCarga.values()) m.visible = true;

    const mat = new THREE.Matrix4();
    const posV = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const esc = new THREE.Vector3();
    const eixoY = new THREE.Vector3(0, 1, 0);

    let countCarrocas = 0;
    const countCarga: Record<TipoCargaNpc, number> = {
      sacos: 0,
      barris: 0,
      caixas: 0,
      pergaminhos: 0,
      moedas_insumos: 0,
    };

    for (let i = 0; i < total; i++) {
      const ag = this.agentes[i]!;
      const rota = this.rotasPreCalculadas[ag.rotaIdx]!;
      const avancoT =
        (this.tempoSimuladoSegundos * ag.velocidadeUnidadesPorSeg) /
        rota.comprimentoTotal;
      const t = (ag.tInicial + avancoT) % 1;

      // Fade curto (escala suave) ao entrar/sair do portão ou porta da loja (t < 0.06 ou t > 0.94)
      let fatorFade = 1.0;
      if (t < 0.06) {
        fatorFade = Math.max(0.15, t / 0.06);
      } else if (t > 0.94) {
        fatorFade = Math.max(0.15, (1 - t) / 0.06);
      }

      const amostragem = this.amostrarPosicaoNaRota(rota, t);
      const hTerreno = this.obterAlturaTerreno?.(amostragem.x, amostragem.z) ?? 0;
      posV.set(amostragem.x, hTerreno + 0.15, amostragem.z);
      quat.setFromAxisAngle(eixoY, amostragem.anguloY);
      esc.set(fatorFade, fatorFade, fatorFade);
      mat.compose(posV, quat, esc);

      this.malhaCorpoNpc.setMatrixAt(i, mat);
      this.malhaCorpoNpc.setColorAt(i, ag.corSetor);

      this.malhaBandeirolaNpc.setMatrixAt(i, mat);
      this.malhaBandeirolaNpc.setColorAt(i, ag.corSetor);

      if (ag.ehCarroca) {
        this.malhaCarrocaNpc.setMatrixAt(countCarrocas++, mat);
      }

      const malhaCarga = this.malhasCarga.get(ag.tipoCarga);
      if (malhaCarga) {
        const idxCarga = countCarga[ag.tipoCarga]++;
        malhaCarga.setMatrixAt(idxCarga, mat);
      }
    }

    this.malhaCorpoNpc.count = total;
    this.malhaCorpoNpc.instanceMatrix.needsUpdate = true;
    if (this.malhaCorpoNpc.instanceColor) {
      this.malhaCorpoNpc.instanceColor.needsUpdate = true;
    }

    this.malhaBandeirolaNpc.count = total;
    this.malhaBandeirolaNpc.instanceMatrix.needsUpdate = true;
    if (this.malhaBandeirolaNpc.instanceColor) {
      this.malhaBandeirolaNpc.instanceColor.needsUpdate = true;
    }

    this.malhaCarrocaNpc.count = countCarrocas;
    this.malhaCarrocaNpc.instanceMatrix.needsUpdate = true;

    for (const [tipo, malha] of this.malhasCarga.entries()) {
      malha.count = countCarga[tipo];
      malha.instanceMatrix.needsUpdate = true;
    }
  }

  public obterEstadoNpcs(): EstadoNpcsFluxo {
    return {
      totalNpcsAtivos: this.agentes.length,
      totalRotasComFluxo: this.rotasPreCalculadas.length,
      modoRenderizacao: this.modoDistanteParticulas
        ? 'particulas_distantes'
        : 'modelos_completos',
      contagemPorCarga: { ...this.contagemPorCargaAtual },
    };
  }

  public destruir(): void {
    this.malhaCorpoNpc.dispose();
    this.malhaBandeirolaNpc.dispose();
    this.malhaCarrocaNpc.dispose();
    for (const m of this.malhasCarga.values()) m.dispose();
    this.pontosParticulasDistantes.geometry.dispose();
    (this.pontosParticulasDistantes.material as THREE.Material).dispose();
    this.cena.remove(this.grupoNpcs);
  }
}
