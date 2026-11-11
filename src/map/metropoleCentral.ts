import * as THREE from 'three';
import {
  LAYOUT_PADRAO,
  PALETA_MAPA,
  obterMedidaLojaPorTamanho,
} from '../config/layout';
import type { LenteMapa, Loja, UUID } from '../domain';
import type { ResultadoLayoutMundo } from '../engine/trade';
import { RegistroModelosLoja, normalizarGeometria } from './shopRegistry';
import { criarEdificioModularProcedural } from './arquiteturaModular';
import {
  criarTexturaPavimentoRuas,
  obterMaterialEdificiosCampanha,
} from './materiaisAvancados';

export interface EstadoVisualMetropole {
  nivel: 0 | 1 | 2 | 3 | 4;
  raio: number;
  totalPortoes: number;
  totalLojasVisiveis: number;
  lojasAbertas: number;
  lojasFechadas: number;
  lojasAbrindo: number;
  cunhasRenderizadas: number;
}

export class GerenciadorMetropoleCentral {
  private readonly cena: THREE.Scene;
  public readonly shopRegistry: RegistroModelosLoja;

  private readonly grupoCunhas: THREE.Group;
  private readonly grupoMetropole: THREE.Group;
  private readonly grupoLojas: THREE.Group;

  private readonly malhasPorTipoLoja = new Map<string, THREE.InstancedMesh>();
  private readonly capacidadePorTipoLoja = new Map<string, number>();
  private readonly materialLojas: THREE.MeshStandardMaterial;

  // Malhas auxiliares de ciclo de vida das lojas e placas sobre a porta
  private malhaAndaimes: THREE.InstancedMesh | null = null;
  private malhaPersianas: THREE.InstancedMesh | null = null;
  private malhaPlacasPorta: THREE.InstancedMesh | null = null;
  private malhaCasasBairro: THREE.InstancedMesh | null = null;

  // Controle de animação de nascimento (2s andaime -> construção) e desmontagem
  private readonly instanteNascimentoPorLoja = new Map<string, number>();
  private lojasAtuais: Loja[] = [];
  private assinaturaEstrutura = '';
  private ultimoEstadoResumo: EstadoVisualMetropole = {
    nivel: 0,
    raio: LAYOUT_PADRAO.metropoleRaioBase,
    totalPortoes: 0,
    totalLojasVisiveis: 0,
    lojasAbertas: 0,
    lojasFechadas: 0,
    lojasAbrindo: 0,
    cunhasRenderizadas: 0,
  };

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.shopRegistry = new RegistroModelosLoja();

    this.grupoCunhas = new THREE.Group();
    this.grupoCunhas.name = 'grupo-cunhas-setores-plano';
    this.cena.add(this.grupoCunhas);

    this.grupoMetropole = new THREE.Group();
    this.grupoMetropole.name = 'grupo-metropole-central-estrutura';
    this.cena.add(this.grupoMetropole);

    this.grupoLojas = new THREE.Group();
    this.grupoLojas.name = 'grupo-metropole-lojas-instanciadas';
    this.cena.add(this.grupoLojas);

    this.materialLojas = obterMaterialEdificiosCampanha();

    this.inicializarMalhasLojas(128);
    this.inicializarMalhasAuxiliares(256);
  }

  private inicializarMalhasLojas(capacidadeInicial: number): void {
    for (const def of this.shopRegistry.listarTodos()) {
      const malha = new THREE.InstancedMesh(
        def.geometria,
        this.materialLojas,
        capacidadeInicial
      );
      malha.name = `lojas-instanciadas-${def.chave}`;
      malha.count = 0;
      malha.frustumCulled = false;
      malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (malha.instanceColor) {
        malha.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      this.grupoLojas.add(malha);
      this.malhasPorTipoLoja.set(def.chave, malha);
      this.capacidadePorTipoLoja.set(def.chave, capacidadeInicial);
    }
  }

  private inicializarMalhasAuxiliares(capacidade: number): void {
    // 1. Andaimes para lojas abrindo (primeiros 2s)
    const geoAndaime = new THREE.BoxGeometry(1.06, 1.05, 1.02);
    geoAndaime.translate(0, 0.52, 0);
    const matAndaime = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.bronze,
      wireframe: true,
    });
    this.malhaAndaimes = new THREE.InstancedMesh(geoAndaime, matAndaime, capacidade);
    this.malhaAndaimes.name = 'lojas-andaimes-construcao';
    this.malhaAndaimes.count = 0;
    this.malhaAndaimes.frustumCulled = false;
    this.malhaAndaimes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grupoLojas.add(this.malhaAndaimes);

    // 2. Persianas fechadas para lojas sem receita há >= 60 dias
    const geoPersiana = new THREE.BoxGeometry(0.62, 0.38, 0.08);
    geoPersiana.translate(0, 0.24, 0.45);
    const matPersiana = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.tinta,
    });
    this.malhaPersianas = new THREE.InstancedMesh(geoPersiana, matPersiana, capacidade);
    this.malhaPersianas.name = 'lojas-persianas-fechadas';
    this.malhaPersianas.count = 0;
    this.malhaPersianas.frustumCulled = false;
    this.malhaPersianas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grupoLojas.add(this.malhaPersianas);

    // 3. Placa com ícone/cor sobre a porta da loja (sempre legível)
    const geoPlaca = new THREE.BoxGeometry(0.48, 0.26, 0.08);
    geoPlaca.translate(0, 0.62, 0.48);
    const matPlaca = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
    });
    this.malhaPlacasPorta = new THREE.InstancedMesh(geoPlaca, matPlaca, capacidade);
    this.malhaPlacasPorta.name = 'lojas-placas-porta';
    this.malhaPlacasPorta.count = 0;
    this.malhaPlacasPorta.frustumCulled = false;
    this.malhaPlacasPorta.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaPlacasPorta.instanceColor) {
      this.malhaPlacasPorta.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.grupoLojas.add(this.malhaPlacasPorta);

    // 4. Edifícios comuns modulares estáticos nos bairros da metrópole (Fase 2c)
    const geoCasaComum = normalizarGeometria(
      criarEdificioModularProcedural('comum', 0, 1.0),
      2.5,
      2.4
    );
    const matCasaComum = obterMaterialEdificiosCampanha();
    this.malhaCasasBairro = new THREE.InstancedMesh(geoCasaComum, matCasaComum, 320);
    this.malhaCasasBairro.name = 'metropole-edificios-comuns';
    this.malhaCasasBairro.count = 0;
    this.malhaCasasBairro.frustumCulled = false;
    this.malhaCasasBairro.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaCasasBairro.instanceColor) {
      this.malhaCasasBairro.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.grupoMetropole.add(this.malhaCasasBairro);
  }

  private limparGrupo(grupo: THREE.Group, preservarInstanced = false): void {
    const remover: THREE.Object3D[] = [];
    for (const child of grupo.children) {
      if (preservarInstanced && child === this.malhaCasasBairro) continue;
      remover.push(child);
    }
    for (const obj of remover) {
      grupo.remove(obj);
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          for (const m of mesh.material) m.dispose();
        } else {
          mesh.material.dispose();
        }
      }
    }
  }

  /**
   * Reconstrói a geometria estática das cunhas de setores, fronteiras de tinta e estrutura da Metrópole Central
   * sempre que o layout estrutural mudar.
   */
  public atualizarEstruturaECunhas(
    layout: ResultadoLayoutMundo,
    filtroSetorId: UUID | null = null
  ): void {
    const novaAssinatura = [
      layout.metropole.nivel,
      layout.metropole.raio,
      layout.raioMapa,
      filtroSetorId ?? '',
      layout.cunhas
        .map(
          (c) =>
            `${c.setorId}:${c.cor}:${c.anguloInicioRad.toFixed(3)}:${c.anguloFimRad.toFixed(3)}:${c.vazia ? 1 : 0}`
        )
        .join('|'),
    ].join('::');

    if (novaAssinatura === this.assinaturaEstrutura) return;
    this.assinaturaEstrutura = novaAssinatura;

    this.limparGrupo(this.grupoCunhas, false);
    this.limparGrupo(this.grupoMetropole, true);

    const rMapa = layout.raioMapa;
    const rMetropole = layout.metropole.raio;
    const rPraca = layout.metropole.raioPracaCentral;

    // 1. Cunhas radiais no chão plano (cor do setor a 12% de opacidade + linha de tinta na fronteira)
    for (const cunha of layout.cunhas) {
      const angSpan = cunha.anguloFimRad - cunha.anguloInicioRad;
      const atenuado = filtroSetorId !== null && filtroSetorId !== cunha.setorId;

      // Chão colorido da cunha (de rPraca até rMapa)
      const geoCunha = new THREE.RingGeometry(
        rPraca,
        rMapa,
        Math.max(8, Math.ceil((cunha.anguloGraus / 360) * 64)),
        1,
        cunha.anguloInicioRad,
        angSpan
      );
      geoCunha.rotateX(-Math.PI / 2);
      // Nota: RingGeometry no plano XY rotacionado -PI/2 em X mapeia theta para (cos(theta), 0, -sin(theta)).
      // Para coincidir exatamente com (cos(theta), 0, sin(theta)), invertemos a escala Z:
      geoCunha.scale(1, 1, -1);

      const opacidadeCunha = atenuado
        ? LAYOUT_PADRAO.opacidadeChaoCunhaSetor * 0.35
        : cunha.vazia
          ? 0.26
          : LAYOUT_PADRAO.opacidadeChaoCunhaSetor;

      const matCunha = new THREE.MeshBasicMaterial({
        color: cunha.vazia ? PALETA_MAPA.nevoa : cunha.cor,
        transparent: true,
        opacity: opacidadeCunha,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const malhaCunha = new THREE.Mesh(geoCunha, matCunha);
      malhaCunha.position.y = 0.05;
      malhaCunha.name = `cunha-setor-${cunha.setorId}`;
      malhaCunha.visible = false; // Setores pintados diretamente no relevo 3D para evitar z-fighting e sumiço de cidades
      this.grupoCunhas.add(malhaCunha);

      // Linha de fronteira em tinta (#1F1B16) ao longo de anguloInicioRad
      const comprimentoFronteira = rMapa - rPraca;
      const geoFronteira = new THREE.PlaneGeometry(comprimentoFronteira, 1.8);
      geoFronteira.rotateX(-Math.PI / 2);
      geoFronteira.translate(rPraca + comprimentoFronteira * 0.5, 0, 0);
      geoFronteira.rotateY(-cunha.anguloInicioRad);

      const matTinta = new THREE.MeshBasicMaterial({
        color: PALETA_MAPA.tinta,
        transparent: true,
        opacity: atenuado ? 0.25 : 0.72,
        depthWrite: false,
      });
      const malhaFronteira = new THREE.Mesh(geoFronteira, matTinta);
      malhaFronteira.position.y = 0.09;
      malhaFronteira.name = `fronteira-tinta-${cunha.setorId}`;
      malhaFronteira.visible = false; // Fronteiras de tinta também incorporadas no relevo
      this.grupoCunhas.add(malhaFronteira);
    }

    // 2. Praça Central da Metrópole em (0, 0) com calçamento pavimentado e Monumento Imperial
    const geoPraca = new THREE.CircleGeometry(rPraca, 48);
    geoPraca.rotateX(-Math.PI / 2);
    const texPavimento = criarTexturaPavimentoRuas(256);
    texPavimento.repeat.set(8, 8);
    const matPraca = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.terraClara,
      roughness: 0.75,
      metalness: 0.08,
      map: texPavimento,
      roughnessMap: texPavimento,
    });
    const malhaPraca = new THREE.Mesh(geoPraca, matPraca);
    malhaPraca.position.y = 0.12;
    malhaPraca.name = 'metropole-praca-central';
    this.grupoMetropole.add(malhaPraca);

    // Anel de jade da praça central
    const geoAnelJade = new THREE.RingGeometry(rPraca - 2.2, rPraca, 48);
    geoAnelJade.rotateX(-Math.PI / 2);
    const matAnelJade = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.jade,
      side: THREE.DoubleSide,
    });
    const malhaAnelJade = new THREE.Mesh(geoAnelJade, matAnelJade);
    malhaAnelJade.position.y = 0.16;
    this.grupoMetropole.add(malhaAnelJade);

    // Monumento Central escalonado pelo nível da Metrópole (0 a 4)
    const rMon = LAYOUT_PADRAO.monumentoCentralRaioBase;
    const altFator = layout.metropole.fatorAlturaEdificios;
    const geoPedestal = new THREE.CylinderGeometry(rMon * 0.85, rMon, 4.5 * altFator, 8);
    geoPedestal.translate(0, 2.25 * altFator, 0);
    const matPedestal = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.ouro,
      roughness: 0.4,
      metalness: 0.35,
    });
    const malhaMonumento = new THREE.Mesh(geoPedestal, matPedestal);
    malhaMonumento.name = 'metropole-monumento-central';
    this.grupoMetropole.add(malhaMonumento);

    const geoTopoMon = new THREE.ConeGeometry(rMon * 0.7, 5.5 * altFator, 8);
    geoTopoMon.translate(0, 7.2 * altFator, 0);
    const matTopoMon = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.laca,
      roughness: 0.5,
      metalness: 0.2,
    });
    this.grupoMetropole.add(new THREE.Mesh(geoTopoMon, matTopoMon));

    // 3. Anéis concêntricos de ruas internas
    for (let idxAnel = 0; idxAnel < layout.metropole.aneisRuas.length; idxAnel++) {
      const rAnel = layout.metropole.aneisRuas[idxAnel]!;
      const geoRua = new THREE.RingGeometry(rAnel - 1.6, rAnel + 1.6, 64);
      geoRua.rotateX(-Math.PI / 2);
      const matRua = new THREE.MeshBasicMaterial({
        color: PALETA_MAPA.bronze,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const malhaRua = new THREE.Mesh(geoRua, matRua);
      malhaRua.position.y = 0.11;
      malhaRua.name = `metropole-anel-rua-${idxAnel}`;
      this.grupoMetropole.add(malhaRua);
    }

    // 4. Muralha Baixa externa da Metrópole Central com aberturas para os portões
    const espMuralha = LAYOUT_PADRAO.muralhaEspessura;
    const altMuralha = LAYOUT_PADRAO.muralhaAlturaBase * (0.85 + layout.metropole.nivel * 0.12);
    for (const cunha of layout.cunhas) {
      const aberturaRad = Math.atan2(LAYOUT_PADRAO.portaoLargura * 0.65, rMetropole);
      const trechos: Array<[number, number]> = [
        [cunha.anguloInicioRad + 0.01, Math.max(cunha.anguloInicioRad + 0.02, cunha.anguloCentralRad - aberturaRad)],
        [Math.min(cunha.anguloFimRad - 0.02, cunha.anguloCentralRad + aberturaRad), cunha.anguloFimRad - 0.01],
      ];

      for (const [aIni, aFim] of trechos) {
        if (aFim <= aIni + 0.01) continue;
        const passos = Math.max(4, Math.ceil(((aFim - aIni) / (Math.PI * 2)) * 48));
        for (let s = 0; s < passos; s++) {
          const a1 = aIni + ((aFim - aIni) * s) / passos;
          const a2 = aIni + ((aFim - aIni) * (s + 1)) / passos;
          const aMeio = (a1 + a2) * 0.5;
          const compSeg = rMetropole * (a2 - a1) * 1.04;

          const geoSeg = new THREE.BoxGeometry(espMuralha, altMuralha, compSeg);
          geoSeg.translate(0, altMuralha * 0.5, 0);
          const matSeg = new THREE.MeshStandardMaterial({
            color: PALETA_MAPA.tinta,
            roughness: 0.82,
            metalness: 0.08,
          });
          const segMesh = new THREE.Mesh(geoSeg, matSeg);
          segMesh.position.set(
            Math.cos(aMeio) * rMetropole,
            0,
            Math.sin(aMeio) * rMetropole
          );
          segMesh.rotation.y = -aMeio;
          this.grupoMetropole.add(segMesh);
        }
      }
    }

    // 5. Portões dos Setores (um por setor, voltado para a direção da cunha)
    for (const portao of layout.metropole.portoes) {
      const cunha = layout.cunhasPorSetorId.get(portao.setorId);
      const corSetor = cunha?.cor ?? PALETA_MAPA.ouro;

      const grupoPortao = new THREE.Group();
      grupoPortao.name = `metropole-portao-${portao.setorId}`;
      grupoPortao.position.set(portao.x, 0, portao.z);
      grupoPortao.rotation.y = -portao.anguloRad;

      const altP = portao.altura;
      const largP = portao.largura;

      const matPilar = new THREE.MeshStandardMaterial({
        color: PALETA_MAPA.laca,
        roughness: 0.55,
      });
      const geoPilar = new THREE.CylinderGeometry(1.1, 1.3, altP, 8);
      geoPilar.translate(0, altP * 0.5, 0);

      const pilarEsq = new THREE.Mesh(geoPilar, matPilar);
      pilarEsq.position.set(0, 0, -largP * 0.42);
      const pilarDir = new THREE.Mesh(geoPilar, matPilar);
      pilarDir.position.set(0, 0, largP * 0.42);

      const geoViga = new THREE.BoxGeometry(4.2, 2.2, largP * 1.12);
      const matViga = new THREE.MeshStandardMaterial({
        color: corSetor,
        roughness: 0.45,
        metalness: 0.25,
      });
      const vigaTopo = new THREE.Mesh(geoViga, matViga);
      vigaTopo.position.set(0, altP + 0.8, 0);

      grupoPortao.add(pilarEsq, pilarDir, vigaTopo);
      this.grupoMetropole.add(grupoPortao);
    }

    // 6. Edifícios comuns estáticos nos bairros (4 a 8 u)
    if (this.malhaCasasBairro) {
      const mat = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const esc = new THREE.Vector3();
      const cor = new THREE.Color();
      let idxCasa = 0;

      const rBairroExt = rMetropole - espMuralha - 7;
      for (const cunha of layout.cunhas) {
        if (cunha.vazia) continue;
        const qtdCasas = Math.min(18, 4 + layout.metropole.nivel * 3);
        const span = Math.max(0.12, cunha.anguloFimRad - cunha.anguloInicioRad - 0.16);
        for (let k = 0; k < qtdCasas && idxCasa < 320; k++) {
          const frac = (k + 0.5) / qtdCasas;
          if (Math.abs(frac - 0.5) < 0.12) continue; // deixa livre a avenida central do portão
          const ang = cunha.anguloInicioRad + 0.08 + frac * span;
          const r = rBairroExt - (k % 2) * 8;
          pos.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
          const rotJitter = ((k * 31) % 9 - 4) * 0.03;
          quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang + Math.PI * 0.5 + rotJitter);

          // Escala proporcional aos anéis e ruas (largura de 2.3 u a 2.9 u, sem colisões)
          const jitterEscala = 0.92 + ((k * 13) % 7) * 0.04;
          esc.set(jitterEscala, jitterEscala * layout.metropole.fatorAlturaEdificios, jitterEscala);
          mat.compose(pos, quat, esc);
          this.malhaCasasBairro.setMatrixAt(idxCasa, mat);

          cor.set(cunha.cor).lerp(new THREE.Color(PALETA_MAPA.pergaminho), 0.65);
          this.malhaCasasBairro.setColorAt(idxCasa, cor);
          idxCasa++;
        }
      }
      this.malhaCasasBairro.count = idxCasa;
      this.malhaCasasBairro.instanceMatrix.needsUpdate = true;
      if (this.malhaCasasBairro.instanceColor) {
        this.malhaCasasBairro.instanceColor.needsUpdate = true;
      }
    }
  }

  private garantirCapacidadeTipoLoja(chave: string, necessario: number): void {
    const capAtual = this.capacidadePorTipoLoja.get(chave) ?? 128;
    if (necessario <= capAtual) return;

    let novaCap = capAtual;
    while (novaCap < necessario) novaCap *= 2;

    const antiga = this.malhasPorTipoLoja.get(chave);
    if (antiga) {
      this.grupoLojas.remove(antiga);
      antiga.dispose();
    }

    const def = this.shopRegistry.obter(chave);
    const nova = new THREE.InstancedMesh(def.geometria, this.materialLojas, novaCap);
    nova.name = `lojas-instanciadas-${chave}`;
    nova.count = 0;
    nova.frustumCulled = false;
    nova.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (nova.instanceColor) {
      nova.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.grupoLojas.add(nova);
    this.malhasPorTipoLoja.set(chave, nova);
    this.capacidadePorTipoLoja.set(chave, novaCap);
  }

  /**
   * Atualiza todas as lojas da Metrópole Central a partir de `deriveShops`.
   */
  public atualizarLojas(
    layout: ResultadoLayoutMundo,
    lojas: Loja[],
    lenteAtiva: LenteMapa = 'padrao',
    filtroSetorId: UUID | null = null,
    filtroProdutoId: UUID | null = null,
    agoraMs = performance.now()
  ): void {
    this.lojasAtuais = lojas;

    // Registra instante de nascimento para lojas vistas pela primeira vez ou marcadas como 'abrindo'
    for (const l of lojas) {
      if (!this.instanteNascimentoPorLoja.has(l.produtoId)) {
        // Se estado === 'abrindo', inicia do zero; caso contrário já nasceu construída
        this.instanteNascimentoPorLoja.set(
          l.produtoId,
          l.estado === 'abrindo' ? agoraMs : agoraMs - 10_000
        );
      }
    }

    // Agrupa por chave válida do shopRegistry
    const porModelo = new Map<string, Loja[]>();
    for (const def of this.shopRegistry.listarTodos()) {
      porModelo.set(def.chave, []);
    }

    for (const l of lojas) {
      const def = this.shopRegistry.obter(l.tipoLoja ?? 'banca_generica');
      porModelo.get(def.chave)?.push(l);
    }

    const matrixTemp = new THREE.Matrix4();
    const posTemp = new THREE.Vector3();
    const quatTemp = new THREE.Quaternion();
    const escTemp = new THREE.Vector3();
    const corTemp = new THREE.Color();
    const eixoY = new THREE.Vector3(0, 1, 0);

    let countAndaimes = 0;
    let countPersianas = 0;
    let countPlacas = 0;
    let countAbertas = 0;
    let countFechadas = 0;
    let countAbrindo = 0;

    const duracaoConstrucaoMs = LAYOUT_PADRAO.tempoConstrucaoLojaSegundos * 1000;

    for (const [chaveModelo, lista] of porModelo.entries()) {
      this.garantirCapacidadeTipoLoja(chaveModelo, lista.length);
      const malha = this.malhasPorTipoLoja.get(chaveModelo);
      if (!malha) continue;

      malha.count = lista.length;

      for (let i = 0; i < lista.length; i++) {
        const loja = lista[i]!;
        const x = loja.x ?? 0;
        const z = loja.z ?? 0;
        const ang = loja.anguloRad ?? 0;
        const medidaBase =
          loja.medidaUnidades ?? obterMedidaLojaPorTamanho(loja.tamanho);

        const nascMs = this.instanteNascimentoPorLoja.get(loja.produtoId) ?? 0;
        const idadeMs = Math.max(0, agoraMs - nascMs);
        const emConstrucao =
          loja.estado === 'abrindo' || idadeMs < duracaoConstrucaoMs;

        const progressoConstrucao = emConstrucao
          ? Math.min(1, 0.28 + 0.72 * (idadeMs / Math.max(1, duracaoConstrucaoMs)))
          : loja.estado === 'sumindo'
            ? 0.45
            : 1.0;

        // Na lente Finanças, destaca visualmente o tamanho pela receita
        const fatorLenteFinancas =
          lenteAtiva === 'financas'
            ? loja.tamanho === 'G'
              ? 1.22
              : loja.tamanho === 'M'
                ? 1.05
                : 0.85
            : 1.0;

        const atenuadaPorFiltro =
          (filtroSetorId !== null && loja.setorId !== filtroSetorId) ||
          (filtroProdutoId !== null && loja.produtoId !== filtroProdutoId);

        const FATOR_ESCALA_MUNDO_LOJA = 0.45;
        const escalaXZ =
          medidaBase *
          FATOR_ESCALA_MUNDO_LOJA *
          fatorLenteFinancas *
          (atenuadaPorFiltro ? 0.75 : 1.0);
        const escalaY =
          medidaBase *
          FATOR_ESCALA_MUNDO_LOJA *
          fatorLenteFinancas *
          progressoConstrucao *
          layout.metropole.fatorAlturaEdificios *
          (atenuadaPorFiltro ? 0.65 : 1.0);

        posTemp.set(x, 0, z);
        // Orienta a porta da loja voltada para a praça central
        quatTemp.setFromAxisAngle(eixoY, -ang - Math.PI * 0.5);
        escTemp.set(escalaXZ, escalaY, escalaXZ);
        matrixTemp.compose(posTemp, quatTemp, escTemp);
        malha.setMatrixAt(i, matrixTemp);

        // Cor da loja: viva quando aberta, desbotada quando fechada ou atenuada
        const cunha = layout.cunhasPorSetorId.get(loja.setorId);
        const corSetor = cunha?.cor ?? PALETA_MAPA.ouro;

        if (loja.estado === 'fechada') {
          corTemp.set('#8B8478');
          countFechadas++;
        } else if (atenuadaPorFiltro) {
          corTemp.set('#9E978B');
        } else {
          corTemp.set('#FFFFFF').lerp(new THREE.Color(corSetor), 0.25);
          if (emConstrucao) countAbrindo++;
          else countAbertas++;
        }
        malha.setColorAt(i, corTemp);

        // Andaime durante construção (2 s)
        if (emConstrucao && this.malhaAndaimes && countAndaimes < 256) {
          escTemp.set(escalaXZ * 1.05, escalaY * 1.04, escalaXZ * 1.05);
          matrixTemp.compose(posTemp, quatTemp, escTemp);
          this.malhaAndaimes.setMatrixAt(countAndaimes++, matrixTemp);
        }

        // Persianas fechadas quando sem receita há >= 60 dias
        if (loja.estado === 'fechada' && this.malhaPersianas && countPersianas < 256) {
          escTemp.set(escalaXZ, escalaY, escalaXZ);
          matrixTemp.compose(posTemp, quatTemp, escTemp);
          this.malhaPersianas.setMatrixAt(countPersianas++, matrixTemp);
        }

        // Placa sobre a porta com a cor do setor/produto
        if (this.malhaPlacasPorta && countPlacas < 256) {
          escTemp.set(escalaXZ, escalaY, escalaXZ);
          matrixTemp.compose(posTemp, quatTemp, escTemp);
          this.malhaPlacasPorta.setMatrixAt(countPlacas, matrixTemp);
          corTemp.set(
            loja.bancaSemProduto
              ? PALETA_MAPA.laca
              : loja.estado === 'fechada'
                ? PALETA_MAPA.bronze
                : corSetor
          );
          this.malhaPlacasPorta.setColorAt(countPlacas, corTemp);
          countPlacas++;
        }
      }

      malha.instanceMatrix.needsUpdate = true;
      if (malha.instanceColor) {
        malha.instanceColor.needsUpdate = true;
      }
    }

    if (this.malhaAndaimes) {
      this.malhaAndaimes.count = countAndaimes;
      this.malhaAndaimes.visible = countAndaimes > 0;
      this.malhaAndaimes.instanceMatrix.needsUpdate = true;
    }

    if (this.malhaPersianas) {
      this.malhaPersianas.count = countPersianas;
      this.malhaPersianas.visible = countPersianas > 0;
      this.malhaPersianas.instanceMatrix.needsUpdate = true;
    }

    if (this.malhaPlacasPorta) {
      this.malhaPlacasPorta.count = countPlacas;
      this.malhaPlacasPorta.visible = countPlacas > 0;
      this.malhaPlacasPorta.instanceMatrix.needsUpdate = true;
      if (this.malhaPlacasPorta.instanceColor) {
        this.malhaPlacasPorta.instanceColor.needsUpdate = true;
      }
    }

    this.ultimoEstadoResumo = {
      nivel: layout.metropole.nivel,
      raio: layout.metropole.raio,
      totalPortoes: layout.metropole.portoes.length,
      totalLojasVisiveis: lojas.length,
      lojasAbertas: countAbertas,
      lojasFechadas: countFechadas,
      lojasAbrindo: countAbrindo,
      cunhasRenderizadas: layout.cunhas.length,
    };
  }

  /**
   * Localiza a loja sob o ponto (x, z) do mundo plano.
   */
  public encontrarLojaEmPonto(x: number, z: number): Loja | null {
    let melhor: Loja | null = null;
    let menorDist = Infinity;

    const FATOR_ESCALA_MUNDO_LOJA = 0.45;
    for (const l of this.lojasAtuais) {
      if (typeof l.x !== 'number' || typeof l.z !== 'number') continue;
      const raioHit =
        (l.medidaUnidades ?? obterMedidaLojaPorTamanho(l.tamanho)) *
        FATOR_ESCALA_MUNDO_LOJA *
        0.85;
      const dist = Math.hypot(x - l.x, z - l.z);
      if (dist <= raioHit && dist < menorDist) {
        menorDist = dist;
        melhor = l;
      }
    }
    return melhor;
  }

  public obterLojasAtuais(): readonly Loja[] {
    return this.lojasAtuais;
  }

  public obterEstadoVisualMetropole(): EstadoVisualMetropole {
    return this.ultimoEstadoResumo;
  }

  public destruir(): void {
    this.limparGrupo(this.grupoCunhas, false);
    this.limparGrupo(this.grupoMetropole, false);
    for (const m of this.malhasPorTipoLoja.values()) {
      this.grupoLojas.remove(m);
      m.dispose();
    }
    this.malhasPorTipoLoja.clear();
    this.malhaAndaimes?.dispose();
    this.malhaPersianas?.dispose();
    this.malhaPlacasPorta?.dispose();
    this.shopRegistry.destruir();
    this.cena.remove(this.grupoCunhas);
    this.cena.remove(this.grupoMetropole);
    this.cena.remove(this.grupoLojas);
  }
}
