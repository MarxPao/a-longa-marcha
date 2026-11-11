import * as THREE from 'three';
import { PALETA_MAPA } from '../config/layout';
import type { Projeto, UUID } from '../domain';
import type { DerivadosProjeto, ResultadoFase } from '../engine';
import {
  construirGeometriasCidades,
  criarGeometriaGeneralTotalWar,
  type NivelMaturidadeVisual,
} from './cidadesGeometria';
import { obterMaterialEdificiosCampanha } from './materiaisAvancados';
import {
  calcularCorCidadePorLente,
  type DadosContextoLente,
} from './lentesCores';

export interface InfoInstanciaCidade {
  projetoId: UUID;
  nivel: NivelMaturidadeVisual;
  indiceInstancia: number;
  x: number;
  y: number;
  z: number;
}

export class GerenciadorCidadesInstanciadas {
  private readonly cena: THREE.Scene;
  private readonly geometrias: Record<NivelMaturidadeVisual, THREE.BufferGeometry>;
  private readonly materialCidades: THREE.MeshStandardMaterial;
  private malhasInstanciadas: Map<NivelMaturidadeVisual, THREE.InstancedMesh> = new Map();
  private capacidades: Map<NivelMaturidadeVisual, number> = new Map();

  // Mapeamento bidirecional para seleção e raycasting O(1)
  private instanciasPorProjetoId: Map<UUID, InfoInstanciaCidade> = new Map();
  private projetosPorChaveMalha: Map<string, UUID> = new Map();

  // Indicador visual de cidade selecionada (Anel luminoso de jade/ouro)
  private indicadorSelecao: THREE.Mesh | null = null;

  // Luz azul de P&D em InstancedMesh para cidades com tecnologias aplicadas (Fase 7)
  private malhaLuzesPd: THREE.InstancedMesh | null = null;
  private capacidadeLuzesPd = 64;

  // Redundância por forma para estado de saúde (Seções 4.4 e 6.8: bandeira erguida, caída ou fumaça)
  private malhaBandeirasErguidas: THREE.InstancedMesh | null = null;
  private malhaBandeirasCaidas: THREE.InstancedMesh | null = null;
  private malhaFumacaCritica: THREE.InstancedMesh | null = null;

  // Generais / Comandantes 3D de guarnição (estilo Total War: Three Kingdoms)
  private malhaGenerais: THREE.InstancedMesh | null = null;
  private capacidadeGenerais = 64;

  // Placas de identificação flutuantes estratégicas (Total War Billboard Banners)
  private readonly grupoPlacasEstrategicas: THREE.Group;
  private spritesPlacas = new Map<UUID, THREE.Sprite>();
  private cacheTexturasPlacas = new Map<string, THREE.CanvasTexture>();

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.geometrias = construirGeometriasCidades();

    this.materialCidades = obterMaterialEdificiosCampanha();

    this.grupoPlacasEstrategicas = new THREE.Group();
    this.grupoPlacasEstrategicas.name = 'grupo-placas-estrategicas-total-war';
    this.cena.add(this.grupoPlacasEstrategicas);

    this.inicializarMalhas();
    this.criarIndicadorSelecao();
    this.criarMalhaLuzesPd(this.capacidadeLuzesPd);
    this.criarMalhasFormasSaude(512);
    this.criarMalhaGenerais(this.capacidadeGenerais);
  }

  private inicializarMalhas(): void {
    const niveis: NivelMaturidadeVisual[] = [1, 2, 3, 4, 5, 6, 7, 0];
    const capacidadePadrao = 64;

    for (const nivel of niveis) {
      const geo = this.geometrias[nivel];
      const instMesh = new THREE.InstancedMesh(geo, this.materialCidades, capacidadePadrao);
      instMesh.name = `cidades-instanciadas-nivel-${nivel}`;
      instMesh.count = 0;
      instMesh.frustumCulled = false;
      instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (instMesh.instanceColor) {
        instMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }

      this.cena.add(instMesh);
      this.malhasInstanciadas.set(nivel, instMesh);
      this.capacidades.set(nivel, capacidadePadrao);
    }
  }

  private criarIndicadorSelecao(): void {
    const geoAnel = new THREE.TorusGeometry(3.6, 0.28, 8, 32);
    geoAnel.rotateX(Math.PI / 2);

    const matAnel = new THREE.MeshBasicMaterial({
      color: '#B8923A',
      transparent: true,
      opacity: 0.9,
    });

    this.indicadorSelecao = new THREE.Mesh(geoAnel, matAnel);
    this.indicadorSelecao.name = 'indicador-selecao-cidade';
    this.indicadorSelecao.visible = false;
    this.cena.add(this.indicadorSelecao);
  }

  private criarMalhaLuzesPd(capacidade: number): void {
    if (this.malhaLuzesPd) {
      this.cena.remove(this.malhaLuzesPd);
      this.malhaLuzesPd.geometry.dispose();
      (this.malhaLuzesPd.material as THREE.Material).dispose();
    }

    const geoHalo = new THREE.TorusGeometry(2.6, 0.22, 8, 24);
    geoHalo.rotateX(Math.PI / 2);

    const matHalo = new THREE.MeshBasicMaterial({
      color: '#3182CE',
      transparent: true,
      opacity: 0.9,
    });

    this.malhaLuzesPd = new THREE.InstancedMesh(geoHalo, matHalo, capacidade);
    this.malhaLuzesPd.name = 'luzes-azuis-pd-cidades';
    this.malhaLuzesPd.count = 0;
    this.malhaLuzesPd.frustumCulled = false;
    this.malhaLuzesPd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaLuzesPd);
    this.capacidadeLuzesPd = capacidade;
  }

  private criarMalhasFormasSaude(capacidade: number): void {
    // 1. Bandeira Erguida (Saudável >= 70)
    const geoErguida = new THREE.ConeGeometry(0.42, 1.35, 4);
    geoErguida.translate(0, 3.3, 0);
    const matErguida = new THREE.MeshBasicMaterial({ color: '#3E7C68' });
    this.malhaBandeirasErguidas = new THREE.InstancedMesh(
      geoErguida,
      matErguida,
      capacidade
    );
    this.malhaBandeirasErguidas.name = 'forma-saude-bandeira-erguida';
    this.malhaBandeirasErguidas.count = 0;
    this.malhaBandeirasErguidas.frustumCulled = false;
    this.malhaBandeirasErguidas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaBandeirasErguidas);

    // 2. Bandeira Caída / Inclinada (Atenção 40..69)
    const geoCaida = new THREE.ConeGeometry(0.42, 1.25, 4);
    geoCaida.rotateZ(Math.PI * 0.35);
    geoCaida.translate(0.5, 2.7, 0);
    const matCaida = new THREE.MeshBasicMaterial({ color: '#D09B2C' });
    this.malhaBandeirasCaidas = new THREE.InstancedMesh(
      geoCaida,
      matCaida,
      capacidade
    );
    this.malhaBandeirasCaidas.name = 'forma-saude-bandeira-caida';
    this.malhaBandeirasCaidas.count = 0;
    this.malhaBandeirasCaidas.frustumCulled = false;
    this.malhaBandeirasCaidas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaBandeirasCaidas);

    // 3. Coluna de Fumaça / Alerta Crítico (< 40)
    const geoFumaca = new THREE.OctahedronGeometry(0.68, 0);
    geoFumaca.translate(0, 3.6, 0);
    const matFumaca = new THREE.MeshBasicMaterial({
      color: '#8E1F1A',
      transparent: true,
      opacity: 0.9,
    });
    this.malhaFumacaCritica = new THREE.InstancedMesh(
      geoFumaca,
      matFumaca,
      capacidade
    );
    this.malhaFumacaCritica.name = 'forma-saude-fumaca-critica';
    this.malhaFumacaCritica.count = 0;
    this.malhaFumacaCritica.frustumCulled = false;
    this.malhaFumacaCritica.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaFumacaCritica);
  }

  private criarMalhaGenerais(capacidade: number): void {
    const geoGen = criarGeometriaGeneralTotalWar();
    const matGen = obterMaterialEdificiosCampanha();
    this.malhaGenerais = new THREE.InstancedMesh(geoGen, matGen, capacidade);
    this.malhaGenerais.name = 'generais-total-war-instanciados';
    this.malhaGenerais.count = 0;
    this.malhaGenerais.frustumCulled = false;
    this.malhaGenerais.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaGenerais.instanceColor) {
      this.malhaGenerais.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.cena.add(this.malhaGenerais);
  }

  private obterOuCriarTexturaPlaca(
    nome: string,
    nivel: number,
    saude: number,
    corSetorHex: string
  ): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;

    const chave = `${nome}:${nivel}:${Math.round(saude)}:${corSetorHex}`;
    const existente = this.cacheTexturasPlacas.get(chave);
    if (existente) return existente;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fundo em laca escura com pergaminho envelhecido
    ctx.fillStyle = 'rgba(26, 23, 20, 0.92)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 112, 12);
    ctx.fill();

    // Moldura dupla de bronze e ouro
    ctx.strokeStyle = '#B8923A';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(184, 146, 58, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, 484, 100);

    // Brasão do setor à esquerda
    ctx.fillStyle = corSetorHex || '#3E7C68';
    ctx.beginPath();
    ctx.arc(58, 64, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FAF3E0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FAF3E0';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('漢', 58, 64);

    // Título da Cidade (Nome em caixa alta)
    ctx.fillStyle = '#FAF3E0';
    ctx.font = 'bold 30px "Cinzel", "Georgia", "Noto Serif", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const nomeExibicao = nome.length > 16 ? nome.slice(0, 15) + '…' : nome.toUpperCase();
    ctx.fillText(nomeExibicao, 106, 56);

    // Subtítulo: Nível e Fase
    const nomesFase: Record<number, string> = {
      1: 'FAÍSCA',
      2: 'EXPEDIÇÃO',
      3: 'ASSENTAMENTO',
      4: 'VILA',
      5: 'CIDADE',
      6: 'METRÓPOLE',
      7: 'LEGADO',
      0: 'RUÍNAS',
    };
    const faseTexto = nomesFase[nivel] ?? 'PROJETO';
    ctx.fillStyle = '#D6C29E';
    ctx.font = '600 18px "Cinzel", "Segoe UI", sans-serif';
    ctx.fillText(`NÍVEL ${nivel} • ${faseTexto}`, 106, 92);

    // Indicador de Saúde / Eficiência à direita
    const corSaude = saude >= 70 ? '#3E7C68' : saude >= 40 ? '#D09B2C' : '#8E1F1A';
    ctx.fillStyle = corSaude;
    ctx.beginPath();
    ctx.roundRect(406, 36, 82, 54, 8);
    ctx.fill();
    ctx.strokeStyle = '#FAF3E0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FAF3E0';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(saude)}%`, 447, 63);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    this.cacheTexturasPlacas.set(chave, tex);
    return tex;
  }

  private garantirCapacidade(nivel: NivelMaturidadeVisual, quantidadeNecessaria: number): void {
    const capAtual = this.capacidades.get(nivel) ?? 64;
    if (quantidadeNecessaria <= capAtual) return;

    let novaCap = capAtual;
    while (novaCap < quantidadeNecessaria) {
      novaCap *= 2;
    }

    const malhaAntiga = this.malhasInstanciadas.get(nivel);
    if (malhaAntiga) {
      this.cena.remove(malhaAntiga);
      malhaAntiga.dispose();
    }

    const geo = this.geometrias[nivel];
    const novaMalha = new THREE.InstancedMesh(geo, this.materialCidades, novaCap);
    novaMalha.name = `cidades-instanciadas-nivel-${nivel}`;
    novaMalha.count = 0;
    novaMalha.frustumCulled = false;
    novaMalha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (novaMalha.instanceColor) {
      novaMalha.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }

    this.cena.add(novaMalha);
    this.malhasInstanciadas.set(nivel, novaMalha);
    this.capacidades.set(nivel, novaCap);
  }

  public mapearFaseParaNivel(
    fase: ResultadoFase | undefined,
    estaArquivado: boolean
  ): NivelMaturidadeVisual {
    if (estaArquivado) return 0;
    const num = fase?.fase;
    if (
      num === 1 ||
      num === 2 ||
      num === 3 ||
      num === 4 ||
      num === 5 ||
      num === 6 ||
      num === 7
    ) {
      return num;
    }
    return 1;
  }

  public atualizarCidades(
    projetos: Projeto[],
    derivados: Map<UUID, DerivadosProjeto>,
    obterAlturaTerreno: (x: number, z: number) => number,
    projetoSelecionadoId: UUID | null,
    contextoLente?: DadosContextoLente,
    projetosDestacadosFiltro?: ReadonlySet<UUID> | null
  ): void {
    this.instanciasPorProjetoId.clear();
    this.projetosPorChaveMalha.clear();

    // Agrupa projetos ativos pelo nível visual
    const grupos = new Map<NivelMaturidadeVisual, Projeto[]>();
    const niveis: NivelMaturidadeVisual[] = [1, 2, 3, 4, 5, 6, 7, 0];
    for (const n of niveis) grupos.set(n, []);

    for (const proj of projetos) {
      const infoDerivado = derivados.get(proj.id);
      const nivel = this.mapearFaseParaNivel(infoDerivado?.fase, proj.arquivadoEm !== null);
      grupos.get(nivel)?.push(proj);
    }

    const matrixTemp = new THREE.Matrix4();
    const posTemp = new THREE.Vector3();
    const rotTemp = new THREE.Euler();
    const quatTemp = new THREE.Quaternion();
    const scaleTemp = new THREE.Vector3(1, 1, 1);
    const corTemp = new THREE.Color();

    let posSelecionado: { x: number; y: number; z: number } | null = null;

    for (const nivel of niveis) {
      const listaProjetos = grupos.get(nivel) || [];
      this.garantirCapacidade(nivel, listaProjetos.length);
      const malha = this.malhasInstanciadas.get(nivel);
      if (!malha) continue;

      malha.count = listaProjetos.length;

      for (let i = 0; i < listaProjetos.length; i++) {
        const p = listaProjetos[i]!;
        const y = obterAlturaTerreno(p.x, p.z);

        // Variação determinística por instância pelo hash do ID (Seção 4 - H1)
        let hash = 0;
        for (let c = 0; c < p.id.length; c++) {
          hash = (hash * 31 + p.id.charCodeAt(c)) & 0xffffff;
        }

        // 1. Rotação em múltiplos de 90° mais jitter de ±3°
        const quadrante90 = (hash % 4) * (Math.PI / 2);
        const jitterRotRad = (((hash >> 4) % 100) / 100 - 0.5) * (6 * Math.PI / 180);
        const anguloRotacao = quadrante90 + jitterRotRad;

        // 2. Variação de escala de ±8%
        const jitterEscala = 1.0 + (((hash >> 8) % 100) / 100 - 0.5) * 0.16;

        posTemp.set(p.x, y, p.z);
        rotTemp.set(0, anguloRotacao, 0);
        quatTemp.setFromEuler(rotTemp);

        const atenuadaPorFiltro =
          projetosDestacadosFiltro !== undefined &&
          projetosDestacadosFiltro !== null &&
          !projetosDestacadosFiltro.has(p.id);
        // Escala modular proporcional ao nível da cidade (mantendo coerência com o kit arquitetural)
        const escalaBase = Math.max(0.9, 0.72 + nivel * 0.16) * jitterEscala * (atenuadaPorFiltro ? 0.78 : 1.0);
        scaleTemp.set(escalaBase, escalaBase, escalaBase);

        matrixTemp.compose(posTemp, quatTemp, scaleTemp);
        malha.setMatrixAt(i, matrixTemp);

        // Determinação da cor pela lente ativa (Seção 4.6)
        if (atenuadaPorFiltro) {
          corTemp.set('#9E9689');
        } else if (contextoLente) {
          const corHex = calcularCorCidadePorLente(p, contextoLente);
          corTemp.set(corHex);
        } else {
          const saude = derivados.get(p.id)?.saude.pontuacao ?? 100;
          if (nivel === 0) {
            corTemp.set('#5A554E'); // Ruínas
          } else if (saude >= 70) {
            corTemp.set('#3E7C68'); // Saudável: Jade
          } else if (saude >= 40) {
            corTemp.set('#D09B2C'); // Atenção: Âmbar
          } else {
            corTemp.set('#8E1F1A'); // Crítico: Laca
          }
        }

        // 3. Jitter HSL por instância: matiz ±4%, saturação ±8%, luminância ±10% (Seção 4 - H1)
        if (!atenuadaPorFiltro) {
          const hsl = { h: 0, s: 0, l: 0 };
          corTemp.getHSL(hsl);
          const jitterH = (((hash >> 12) % 100) / 100 - 0.5) * 0.08; // ±4%
          const jitterS = (((hash >> 16) % 100) / 100 - 0.5) * 0.16; // ±8%
          const jitterL = (((hash >> 20) % 100) / 100 - 0.5) * 0.20; // ±10%
          hsl.h = (hsl.h + jitterH + 1.0) % 1.0;
          hsl.s = Math.max(0.1, Math.min(1.0, hsl.s + jitterS));
          hsl.l = Math.max(0.2, Math.min(0.85, hsl.l + jitterL));
          corTemp.setHSL(hsl.h, hsl.s, hsl.l);
        }

        malha.setColorAt(i, corTemp);

        // Registro de consulta
        const info: InfoInstanciaCidade = {
          projetoId: p.id,
          nivel,
          indiceInstancia: i,
          x: p.x,
          y,
          z: p.z,
        };
        this.instanciasPorProjetoId.set(p.id, info);
        this.projetosPorChaveMalha.set(`${nivel}:${i}`, p.id);

        if (p.id === projetoSelecionadoId) {
          posSelecionado = { x: p.x, y, z: p.z };
        }
      }

      malha.instanceMatrix.needsUpdate = true;
      if (malha.instanceColor) {
        malha.instanceColor.needsUpdate = true;
      }
    }

    // Atualiza anel indicador de seleção
    if (this.indicadorSelecao) {
      if (posSelecionado) {
        this.indicadorSelecao.position.set(
          posSelecionado.x,
          posSelecionado.y + 0.15,
          posSelecionado.z
        );
        this.indicadorSelecao.visible = true;
      } else {
        this.indicadorSelecao.visible = false;
      }
    }

    // Atualiza luz azul de P&D nas cidades com tecnologias aplicadas (Fase 7)
    const idsComPd = new Set<UUID>();
    for (const ap of contextoLente?.aplicacoes ?? []) {
      if (ap.arquivadoEm === null) {
        idsComPd.add(ap.projetoId);
      }
    }

    const projetosComPd = projetos.filter(
      (p) => p.arquivadoEm === null && idsComPd.has(p.id)
    );
    if (projetosComPd.length > this.capacidadeLuzesPd) {
      let novaCap = this.capacidadeLuzesPd;
      while (novaCap < projetosComPd.length) novaCap *= 2;
      this.criarMalhaLuzesPd(novaCap);
    }

    if (this.malhaLuzesPd) {
      this.malhaLuzesPd.count = projetosComPd.length;
      const matLuz = new THREE.Matrix4();
      for (let i = 0; i < projetosComPd.length; i++) {
        const p = projetosComPd[i]!;
        const y = obterAlturaTerreno(p.x, p.z);
        matLuz.makeTranslation(p.x, y + 3.2, p.z);
        this.malhaLuzesPd.setMatrixAt(i, matLuz);
      }
      this.malhaLuzesPd.instanceMatrix.needsUpdate = true;
    }

    // Atualiza formas redundantes de saúde (Seções 4.4 e 6.8: cor nunca sozinha)
    if (
      this.malhaBandeirasErguidas &&
      this.malhaBandeirasCaidas &&
      this.malhaFumacaCritica
    ) {
      let cErguida = 0;
      let cCaida = 0;
      let cFumaca = 0;
      const matForma = new THREE.Matrix4();

      for (const p of projetos) {
        if (p.arquivadoEm !== null) continue;
        const saude = derivados.get(p.id)?.saude.pontuacao ?? 100;
        const y = obterAlturaTerreno(p.x, p.z);
        matForma.makeTranslation(p.x, y, p.z);

        if (saude >= 70 && cErguida < 512) {
          this.malhaBandeirasErguidas.setMatrixAt(cErguida++, matForma);
        } else if (saude >= 40 && cCaida < 512) {
          this.malhaBandeirasCaidas.setMatrixAt(cCaida++, matForma);
        } else if (saude < 40 && cFumaca < 512) {
          this.malhaFumacaCritica.setMatrixAt(cFumaca++, matForma);
        }
      }

      this.malhaBandeirasErguidas.count = cErguida;
      this.malhaBandeirasCaidas.count = cCaida;
      this.malhaFumacaCritica.count = cFumaca;

      this.malhaBandeirasErguidas.instanceMatrix.needsUpdate = true;
      this.malhaBandeirasCaidas.instanceMatrix.needsUpdate = true;
      this.malhaFumacaCritica.instanceMatrix.needsUpdate = true;
    }

    // Atualiza Generais 3D Total War ao lado de cada cidade ativa
    if (this.malhaGenerais) {
      const matrizGen = new THREE.Matrix4();
      const posGen = new THREE.Vector3();
      const rotGen = new THREE.Euler();
      const quatGen = new THREE.Quaternion();
      const scaleGen = new THREE.Vector3(2.4, 2.4, 2.4);
      let countGen = 0;

      for (const proj of projetos) {
        if (proj.arquivadoEm !== null) continue;
        if (countGen >= this.capacidadeGenerais) break;

        const infoDerivado = derivados.get(proj.id);
        const nivel = this.mapearFaseParaNivel(infoDerivado?.fase, false);
        const raioVisual = Math.max(5.5, 4.2 + nivel * 1.1);
        const offsetGenX = raioVisual * 1.15;
        const offsetGenZ = raioVisual * 0.45;
        const gx = proj.x + offsetGenX;
        const gz = proj.z + offsetGenZ;
        const gy = obterAlturaTerreno(gx, gz);

        const altGen = Math.max(1.8, 1.3 + nivel * 0.28);
        scaleGen.set(altGen, altGen, altGen);

        posGen.set(gx, gy, gz);
        rotGen.set(0, Math.atan2(offsetGenZ, offsetGenX) + Math.PI * 0.5, 0);
        quatGen.setFromEuler(rotGen);
        matrizGen.compose(posGen, quatGen, scaleGen);

        this.malhaGenerais.setMatrixAt(countGen, matrizGen);
        if (this.malhaGenerais.instanceColor) {
          const corGen = new THREE.Color(
            contextoLente ? calcularCorCidadePorLente(proj, contextoLente) : PALETA_MAPA.ouro
          );
          this.malhaGenerais.setColorAt(countGen, corGen);
        }
        countGen++;
      }

      this.malhaGenerais.count = countGen;
      this.malhaGenerais.instanceMatrix.needsUpdate = true;
      if (this.malhaGenerais.instanceColor) {
        this.malhaGenerais.instanceColor.needsUpdate = true;
      }
    }

    // Atualiza Placas Estratégicas Flutuantes estilo Total War
    const idsAtivos = new Set<UUID>();
    for (const proj of projetos) {
      if (proj.arquivadoEm !== null) continue;
      idsAtivos.add(proj.id);

      const infoDerivado = derivados.get(proj.id);
      const nivel = this.mapearFaseParaNivel(infoDerivado?.fase, false);
      const saude = infoDerivado?.saude.pontuacao ?? 100;
      const corSetorHex = contextoLente
        ? calcularCorCidadePorLente(proj, contextoLente)
        : PALETA_MAPA.jade;

      const textura = this.obterOuCriarTexturaPlaca(proj.nome, nivel, saude, corSetorHex);
      if (!textura) continue;

      let sprite = this.spritesPlacas.get(proj.id);
      if (!sprite) {
        const matSprite = new THREE.SpriteMaterial({
          map: textura,
          transparent: true,
          depthTest: false,
        });
        sprite = new THREE.Sprite(matSprite);
        sprite.name = `placa-estrategica-${proj.id}`;
        this.grupoPlacasEstrategicas.add(sprite);
        this.spritesPlacas.set(proj.id, sprite);
      } else {
        sprite.material.map = textura;
        sprite.material.needsUpdate = true;
      }

      const y = obterAlturaTerreno(proj.x, proj.z);
      const ehSelecionado = proj.id === projetoSelecionadoId;
      const escalaL = ehSelecionado ? 15 : 12;
      const escalaA = ehSelecionado ? 3.75 : 3.0;

      const altPlaca = Math.max(7.0, 5.0 + nivel * 1.2);
      sprite.scale.set(escalaL, escalaA, 1);
      sprite.position.set(proj.x, y + altPlaca, proj.z);
      sprite.visible = true;
    }

    // Remove sprites de cidades arquivadas ou excluídas
    for (const [id, sp] of this.spritesPlacas.entries()) {
      if (!idsAtivos.has(id)) {
        this.grupoPlacasEstrategicas.remove(sp);
        sp.material.dispose();
        this.spritesPlacas.delete(id);
      }
    }
  }

  public obterContagemFormasSaude(): {
    bandeirasErguidas: number;
    bandeirasCaidas: number;
    fumacaCritica: number;
  } {
    return {
      bandeirasErguidas: this.malhaBandeirasErguidas?.count ?? 0,
      bandeirasCaidas: this.malhaBandeirasCaidas?.count ?? 0,
      fumacaCritica: this.malhaFumacaCritica?.count ?? 0,
    };
  }

  public obterTotalLuzesPdAtivas(): number {
    return this.malhaLuzesPd?.count ?? 0;
  }

  public obterProjetoPorInstancia(
    nivel: NivelMaturidadeVisual,
    indiceInstancia: number
  ): UUID | undefined {
    return this.projetosPorChaveMalha.get(`${nivel}:${indiceInstancia}`);
  }

  public obterInfoInstancia(projetoId: UUID): InfoInstanciaCidade | undefined {
    return this.instanciasPorProjetoId.get(projetoId);
  }

  public destruir(): void {
    for (const malha of this.malhasInstanciadas.values()) {
      this.cena.remove(malha);
      malha.dispose();
    }
    this.malhasInstanciadas.clear();

    if (this.indicadorSelecao) {
      this.cena.remove(this.indicadorSelecao);
      this.indicadorSelecao.geometry.dispose();
      (this.indicadorSelecao.material as THREE.Material).dispose();
      this.indicadorSelecao = null;
    }

    if (this.malhaLuzesPd) {
      this.cena.remove(this.malhaLuzesPd);
      this.malhaLuzesPd.geometry.dispose();
      (this.malhaLuzesPd.material as THREE.Material).dispose();
      this.malhaLuzesPd = null;
    }

    for (const malhaForma of [
      this.malhaBandeirasErguidas,
      this.malhaBandeirasCaidas,
      this.malhaFumacaCritica,
    ]) {
      if (malhaForma) {
        this.cena.remove(malhaForma);
        malhaForma.geometry.dispose();
        (malhaForma.material as THREE.Material).dispose();
      }
    }

    if (this.malhaGenerais) {
      this.cena.remove(this.malhaGenerais);
      this.malhaGenerais.geometry.dispose();
      (this.malhaGenerais.material as THREE.Material).dispose();
      this.malhaGenerais = null;
    }

    for (const sp of this.spritesPlacas.values()) {
      this.grupoPlacasEstrategicas.remove(sp);
      sp.material.dispose();
    }
    this.spritesPlacas.clear();

    for (const tex of this.cacheTexturasPlacas.values()) {
      tex.dispose();
    }
    this.cacheTexturasPlacas.clear();
    this.cena.remove(this.grupoPlacasEstrategicas);

    for (const geo of Object.values(this.geometrias)) {
      geo.dispose();
    }
    this.materialCidades.dispose();
  }
}
