import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { LAYOUT_PADRAO, PALETA_MAPA, obterRaioCidadePorNivel } from '../config/layout';
import type {
  Aplicacao,
  Cliente,
  Fluxo,
  Item,
  ItemDeLista,
  Lancamento,
  LenteMapa,
  Ligacao,
  Loja,
  MetricasTerrenoGerado,
  Produto,
  Projeto,
  SementeTerreno,
  Setor,
  TipoLigacao,
  UUID,
  VinculoCliente,
} from '../domain';
import {
  amostrarTerrenoComPlateaus,
  deriveFlows,
  deriveShops,
  gerarHashSemente,
  layoutWorld,
  recalcularEstradasDaCidade,
  routeRoads,
  type DerivadosProjeto,
  type EstradaRoteada,
  type PlateauAssentamento,
  type ResultadoEstradasMundo,
  type ResultadoLayoutMundo,
} from '../engine';
import { GerenciadorAtmosferaMapa } from './atmosferaTerreno';
import {
  GerenciadorLuzAtmosfera,
  type PresetHoraDia,
} from './luzAtmosferaPos';
import {
  criarMaterialAguaRio,
  criarMaterialTerrenoTotalWar,
} from './materiaisAvancados';
import {
  criarPropsEParticulasMercado,
  type PropsMercado,
} from './propsEParticulas';
import {
  GradeBlocosEspaciais128,
  MonitorDesempenhoEDpr,
} from './infraRenderer';
import {
  calcularBarraEscalaHud,
  calcularDistFitMapa,
  calcularDuracaoVooSegundos,
  calcularInclinacaoSuaveCameraGraus,
  calcularTrapezioFrustumNoChao,
  construirTrilhaBreadcrumbCamera,
  normalizarDeltaRoda,
  obterNivelSemanticoCamera,
  obterRotuloNivelSemantico,
  type EstadoPilhaCamera,
  type InfoHudEscalaCamera,
  type NivelSemanticoCamera,
} from './cameraContinua';
import { GerenciadorCidadesInstanciadas } from './cidadesInstanciadas';
import { GerenciadorEstradasMapa, type InfoHoverEstrada } from './estradasMapa';
import { GradeEspacial } from './gradeEspacial';
import { type DadosContextoLente, type InfoResumoDerivadoLente } from './lentesCores';
import {
  GerenciadorMetropoleCentral,
  type EstadoVisualMetropole,
} from './metropoleCentral';
import { GerenciadorNpcsFluxo, type EstadoNpcsFluxo } from './npcsFluxo';
import { GerenciadorVegetacaoLOD } from './vegetacaoLod';

export type QualidadeGraficaMapa = 'automatica' | 'baixa' | 'media' | 'alta';
export type QualidadeEfetivaMapa = 'baixa' | 'media' | 'alta';

export interface InfoHoverMapa {
  tipo: 'loja' | 'estrada' | 'cidade';
  titulo: string;
  subtitulo: string;
  receitaOuVolumeCentavos: number;
  nomesProdutos: string[];
  loja?: Loja;
  estrada?: InfoHoverEstrada;
  projetoId?: UUID;
}

export type InfoHoverElementoMapa = InfoHoverMapa;

export interface DadosEstadoMapa {
  projetos: Projeto[];
  setores: Setor[];
  produtos?: Produto[];
  lancamentos?: Lancamento[];
  ligacoes: Ligacao[];
  tiposLigacao?: TipoLigacao[];
  derivadosPorProjeto: Map<UUID, DerivadosProjeto>;
  projetoSelecionadoId: UUID | null;
  sementeTerreno: SementeTerreno;
  lenteAtiva?: LenteMapa;
  qualidadeGrafica?: QualidadeGraficaMapa;
  clientes?: Cliente[];
  vinculosCliente?: VinculoCliente[];
  itens?: Item[];
  itensLista?: ItemDeLista[];
  aplicacoes?: Aplicacao[];
  horasRegistradasPorProjeto?: Map<UUID, number>;
  hoje?: string;
  filtroSetorId?: UUID | null;
  filtroProdutoId?: UUID | null;
  produtosRecemCriadosIds?: ReadonlySet<UUID>;
  produtosRecemArquivadosIds?: ReadonlySet<UUID>;
}

export interface MetricasDesempenhoMapa {
  fpsMedio: number;
  p95TempoQuadroMs: number;
  totalInstancias: number;
  totalVerticesTerreno: number;
  qualidadeEfetiva: QualidadeEfetivaMapa;
  drawCallsRotas: number;
  totalLojasVisiveis?: number;
  totalNpcsAtivos?: number;
}

export interface OpcoesMapView {
  container: HTMLElement;
  sementeInicial: SementeTerreno;
  aoAtualizarTerreno?: (
    metricas: Partial<
      Pick<MetricasTerrenoGerado, 'vertices' | 'cotaMinima' | 'cotaMaxima' | 'rotaTerreno'>
    >
  ) => void;
  aoSelecionarProjeto?: (projetoId: UUID | null) => void;
  aoClicarLoja?: (loja: Loja) => void;
  aoHoverElementoMapa?: (info: InfoHoverMapa | null) => void;
  aoMoverProjeto?: (projetoId: UUID, novoX: number, novoZ: number) => void;
  aoLigarProjetos?: (origemId: UUID, destinoId: UUID) => void;
  aoFundarProjeto?: (x: number, z: number, setorId?: UUID) => void;
  aoAtualizarHudCamera?: (hud: InfoHudEscalaCamera) => void;
  aoAtualizarLayout?: (layout: ResultadoLayoutMundo) => void;
}

/**
 * Classe MapView em Three.js puro (sem react-three-fiber).
 * Renderiza o mapa estratégico plano com Metrópole Central (CentralHub) em (0, 0),
 * cunhas radiais de setores, lojas do mercado vivo, estradas Catmull-Rom e fluxo de NPCs.
 */
export class MapView {
  private readonly container: HTMLElement;
  private readonly cena: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private renderizador: THREE.WebGLRenderer | null = null;
  private malhaTerreno: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null;
  private malhaAguaRio: THREE.Mesh | null = null;
  private plateausAtuais: PlateauAssentamento[] = [];
  private tempoAnimacaoTotal = 0;
  private quadroAnimacaoId: number | null = null;
  private relogio = new THREE.Clock();
  private destruido = false;
  private sementeAtual: SementeTerreno;

  // Submódulos gráficos especializados
  private gradeEspacial = new GradeEspacial<Projeto>(48);
  private cidadesInstanciadas: GerenciadorCidadesInstanciadas;
  private metropoleCentral: GerenciadorMetropoleCentral;
  private estradas: GerenciadorEstradasMapa;
  private npcsFluxo: GerenciadorNpcsFluxo;
  private vegetacaoLod: GerenciadorVegetacaoLOD;
  private atmosfera: GerenciadorAtmosferaMapa;
  private luzAtmosfera: GerenciadorLuzAtmosfera;
  private propsMercado: PropsMercado | null = null;
  private monitorDpr: MonitorDesempenhoEDpr | null = null;
  public gradeBlocos128 = new GradeBlocosEspaciais128<Projeto>();

  // Cache de estado derivado do mundo plano
  private projetosPorId: Map<UUID, Projeto> = new Map();
  private layoutAtual: ResultadoLayoutMundo | null = null;
  private lojasAtuais: Loja[] = [];
  private fluxosAtuais: Fluxo[] = [];
  private estradasAtuais: ResultadoEstradasMundo | null = null;

  private lenteAtual: LenteMapa = 'padrao';
  private filtroSetorId: UUID | null = null;
  private filtroProdutoId: UUID | null = null;
  private ultimoDadosEstado: DadosEstadoMapa | null = null;
  private qualidadeConfigurada: QualidadeGraficaMapa = 'automatica';
  private qualidadeEfetiva: QualidadeEfetivaMapa = 'alta';

  // Animação de voo suave da câmera (Seção 3.2)
  private intervaloVooId: number | null = null;
  private animacaoVoo: {
    inicioX: number;
    inicioZ: number;
    inicioDistancia: number;
    destinoX: number;
    destinoZ: number;
    destinoDistancia: number;
    tempoInicio: number;
    duracaoMs: number;
    amplitudeArco: number;
    aoConcluir?: () => void;
  } | null = null;

  // Callbacks para a store / UI
  private readonly aoAtualizarTerreno?: OpcoesMapView['aoAtualizarTerreno'];
  private readonly aoSelecionarProjeto?: OpcoesMapView['aoSelecionarProjeto'];
  private readonly aoClicarLoja?: OpcoesMapView['aoClicarLoja'];
  private readonly aoHoverElementoMapa?: OpcoesMapView['aoHoverElementoMapa'];
  private readonly aoMoverProjeto?: OpcoesMapView['aoMoverProjeto'];
  private readonly aoLigarProjetos?: OpcoesMapView['aoLigarProjetos'];
  private readonly aoFundarProjeto?: OpcoesMapView['aoFundarProjeto'];
  private readonly aoAtualizarHudCamera?: OpcoesMapView['aoAtualizarHudCamera'];
  private readonly aoAtualizarLayout?: OpcoesMapView['aoAtualizarLayout'];

  // Câmera contínua em escala logarítmica (Seção 3.1 e 3.2)
  private alvoCamera = new THREE.Vector3(0, 0, 0);
  private distanciaCamera = 340;
  private distFitAtual = 1400;
  private anguloAzimute = Math.PI * 0.25;
  private anguloElevacao = (42 * Math.PI) / 180;
  private reduzirMovimento = false;
  private pilhaEstadosCamera: EstadoPilhaCamera[] = [];

  // Suavização exponencial do zoom ao cursor (~120 ms) e inércia curta do pan
  private zoomSuave: {
    distanciaAlvo: number;
    clientX: number;
    clientY: number;
    pontoMundoAncora: THREE.Vector3;
  } | null = null;
  private pontoAncoraPan: THREE.Vector3 | null = null;
  private velocidadePan = { vx: 0, vz: 0 };
  private listenerTecladoWindow: ((ev: KeyboardEvent) => void) | null = null;

  // Estado de interação do mouse
  private modoOperacao:
    | 'nenhum'
    | 'camera_pan'
    | 'camera_orbita'
    | 'arrastando_cidade'
    | 'ligando' = 'nenhum';
  private ultimoMouse = { x: 0, y: 0 };
  private mousePressionadoEm = { x: 0, y: 0, tempo: 0 };
  private projetoEmArrastoId: UUID | null = null;
  private posicaoInicialArrasto = { x: 0, z: 0 };
  private projetoOrigemLigacaoId: UUID | null = null;

  private raycaster = new THREE.Raycaster();
  private mouseVetor = new THREE.Vector2();
  private historicoQuadros: number[] = [];

  constructor(opcoes: OpcoesMapView) {
    this.container = opcoes.container;
    this.sementeAtual = opcoes.sementeInicial;
    this.aoAtualizarTerreno = opcoes.aoAtualizarTerreno;
    this.aoSelecionarProjeto = opcoes.aoSelecionarProjeto;
    this.aoClicarLoja = opcoes.aoClicarLoja;
    this.aoHoverElementoMapa = opcoes.aoHoverElementoMapa;
    this.aoMoverProjeto = opcoes.aoMoverProjeto;
    this.aoLigarProjetos = opcoes.aoLigarProjetos;
    this.aoFundarProjeto = opcoes.aoFundarProjeto;
    this.aoAtualizarHudCamera = opcoes.aoAtualizarHudCamera;
    this.aoAtualizarLayout = opcoes.aoAtualizarLayout;

    this.cena = new THREE.Scene();
    // Céu pergaminho e névoa de distância amarelada suave (Seção 3)
    this.cena.background = new THREE.Color(PALETA_MAPA.pergaminho);
    this.cena.fog = new THREE.FogExp2(PALETA_MAPA.pergaminho, 0.00042);

    const largura = Math.max(1, this.container.clientWidth || 960);
    const altura = Math.max(1, this.container.clientHeight || 600);
    this.distFitAtual = calcularDistFitMapa(
      LAYOUT_PADRAO.raioMinimoMapaAbsoluto,
      largura / altura
    );
    // FOV constante (30° a 35°, lente longa) conforme Seção 3.1
    this.camera = new THREE.PerspectiveCamera(
      LAYOUT_PADRAO.cameraFovGraus,
      largura / altura,
      2,
      8500
    );
    this.anguloElevacao =
      (calcularInclinacaoSuaveCameraGraus(this.distanciaCamera, this.distFitAtual) *
        Math.PI) /
      180;
    this.atualizarPosicaoCamera();

    this.inicializarRenderizador(largura, altura);
    this.luzAtmosfera = new GerenciadorLuzAtmosfera(this.cena);
    if (this.renderizador) {
      this.monitorDpr = new MonitorDesempenhoEDpr(this.renderizador);
      this.renderizador.shadowMap.enabled = true;
      this.renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderizador.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderizador.toneMappingExposure = 1.05;
    }
    this.criarChaoPlanoPergaminho(LAYOUT_PADRAO.raioMinimoMapaAbsoluto * 2.5);

    this.cidadesInstanciadas = new GerenciadorCidadesInstanciadas(this.cena);
    this.metropoleCentral = new GerenciadorMetropoleCentral(this.cena);
    this.estradas = new GerenciadorEstradasMapa(this.cena);
    this.npcsFluxo = new GerenciadorNpcsFluxo(this.cena);
    this.vegetacaoLod = new GerenciadorVegetacaoLOD(this.cena);
    this.atmosfera = new GerenciadorAtmosferaMapa(this.cena);

    this.vegetacaoLod.gerarVegetacaoPorSemente(
      opcoes.sementeInicial,
      this.obterAlturaTerreno
    );
    this.vegetacaoLod.atualizarLodPorDistancia(
      this.camera.position,
      this.distanciaCamera,
      this.qualidadeEfetiva
    );

    void this.aplicarSemente(opcoes.sementeInicial);
    this.propsMercado = criarPropsEParticulasMercado(this.cena);
    this.registrarEventosInteracao();
    this.iniciarLoop();
  }

  

  private inicializarRenderizador(largura: number, altura: number): void {
    try {
      const renderizador = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderizador.setSize(largura, altura);
      renderizador.domElement.dataset.testid = 'canvas-terreno-3d';
      this.container.innerHTML = '';
      this.container.appendChild(renderizador.domElement);
      this.renderizador = renderizador;
    } catch {
      const canvasFallback = document.createElement('canvas');
      canvasFallback.width = largura;
      canvasFallback.height = altura;
      canvasFallback.dataset.testid = 'canvas-terreno-3d';
      this.container.innerHTML = '';
      this.container.appendChild(canvasFallback);
      this.renderizador = null;
    }
  }

  /**
   * Cria a malha de relevo 3D Shanshui com splatting de rochas, pastos de outono e rio serpenteante
   * estilo Total War: Three Kingdoms (conforme especificações visuais e imagens de referência).
   */
  private criarChaoPlanoPergaminho(tamanho: number): void {
    if (this.malhaTerreno) {
      this.cena.remove(this.malhaTerreno);
      this.malhaTerreno.geometry.dispose();
      this.malhaTerreno.material.dispose();
      this.malhaTerreno = null;
    }
    if (this.malhaAguaRio) {
      this.cena.remove(this.malhaAguaRio);
      this.malhaAguaRio.geometry.dispose();
      (this.malhaAguaRio.material as THREE.Material).dispose();
      this.malhaAguaRio = null;
    }

    const segmentos = 128;
    const geometria = new THREE.PlaneGeometry(tamanho, tamanho, segmentos, segmentos);
    geometria.rotateX(-Math.PI / 2);

    const rMapa = this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto;
    const material = criarMaterialTerrenoTotalWar({ raioMapa: rMapa });

    this.malhaTerreno = new THREE.Mesh(geometria, material);
    this.malhaTerreno.name = 'terreno-campanha';
    this.malhaTerreno.position.y = 0;
    this.malhaTerreno.receiveShadow = true;
    this.malhaTerreno.castShadow = true;
    this.cena.add(this.malhaTerreno);

    // Rio serpenteante no vale principal (conforme Screenshot 1 e 2 de Total War)
    const geoAgua = new THREE.PlaneGeometry(tamanho * 0.95, tamanho * 0.45, 64, 32);
    geoAgua.rotateX(-Math.PI / 2);
    const matAgua = criarMaterialAguaRio();
    this.malhaAguaRio = new THREE.Mesh(geoAgua, matAgua);
    this.malhaAguaRio.name = 'rio-campanha-total-war';
    this.malhaAguaRio.position.set(0, -0.45, 0);
    this.malhaAguaRio.receiveShadow = true;
    this.cena.add(this.malhaAguaRio);
  }

  /**
   * Amostra a cota Y do relevo considerando os platôs de assentamento das cidades e da Metrópole Central.
   */
  public obterAlturaTerreno = (x: number, z: number): number => {
    return amostrarTerrenoComPlateaus(x, z, this.sementeAtual, this.plateausAtuais).altura;
  };

  public async aplicarSemente(semente: SementeTerreno): Promise<void> {
    if (this.destruido) return;
    this.sementeAtual = semente;
    this.pintarChaoPergaminhoPlano(semente);
    this.vegetacaoLod?.gerarVegetacaoPorSemente(
      semente,
      this.obterAlturaTerreno,
      this.layoutAtual?.raioMapa ?? 520
    );
    this.vegetacaoLod?.atualizarLodPorDistancia(
      this.camera.position,
      this.distanciaCamera,
      this.qualidadeEfetiva
    );
  }

  private pintarChaoPergaminhoPlano(semente: SementeTerreno): void {
    if (!this.malhaTerreno) return;
    const geometria = this.malhaTerreno.geometry;
    const posicoes = geometria.attributes.position;
    if (!posicoes) return;

    let atributoCor = geometria.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!atributoCor || atributoCor.count !== posicoes.count) {
      atributoCor = new THREE.BufferAttribute(new Float32Array(posicoes.count * 3), 3);
      geometria.setAttribute('color', atributoCor);
    }

    // Coleta platôs de assentamento para terraplanagem natural
    const novosPlateaus: PlateauAssentamento[] = [];

    // 1. Platô da Metrópole Central em (0, 0)
    const rMetropole = this.layoutAtual?.metropole?.raio ?? LAYOUT_PADRAO.metropoleRaioBase;
    novosPlateaus.push({
      x: 0,
      z: 0,
      raio: rMetropole * 1.05,
      alturaAlvo: 0,
    });

    // 2. Platôs das cidades ativas
    for (const p of this.projetosPorId.values()) {
      if (p.arquivadoEm !== null) continue;
      const deriv = this.ultimoDadosEstado?.derivadosPorProjeto.get(p.id);
      const nivel = deriv?.fase?.fase ?? 1;
      const raioCidade = obterRaioCidadePorNivel(nivel);
      novosPlateaus.push({
        x: p.x,
        z: p.z,
        raio: raioCidade + 10,
        alturaAlvo: 0.5,
      });
    }
    this.plateausAtuais = novosPlateaus;

    this.obterAlturaTerreno = (x: number, z: number): number => {
      return amostrarTerrenoComPlateaus(x, z, this.sementeAtual, this.plateausAtuais).altura;
    };

    const hash = gerarHashSemente(semente);
    const corGramaVerde = new THREE.Color('#5E7842');
    const corCampoDourado = new THREE.Color('#B8923A');
    const corSoloFertil = new THREE.Color('#4A3E31');
    const corRochaKarst = new THREE.Color('#5E5A54');
    const corBordaTinta = new THREE.Color(PALETA_MAPA.tinta);
    const corVertice = new THREE.Color();

    const rMapa = this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto;
    const rPraca =
      this.layoutAtual?.metropole?.raioPracaCentral ??
      LAYOUT_PADRAO.metropoleRaioBase * 0.45;
    let cotaMin = Infinity;
    let cotaMax = -Infinity;

    for (let i = 0; i < posicoes.count; i++) {
      const vx = posicoes.getX(i);
      const vz = posicoes.getZ(i);

      // Amostra relevo Shanshui com Karst e vales de rios preservando platôs das cidades
      const amostra = amostrarTerrenoComPlateaus(vx, vz, semente, this.plateausAtuais);
      posicoes.setY(i, amostra.altura);

      if (amostra.altura < cotaMin) cotaMin = amostra.altura;
      if (amostra.altura > cotaMax) cotaMax = amostra.altura;

      // 1. Textura procedural de pasto e campos dourados estilo Total War
      const onda1 = Math.sin(vx * 0.012 + (hash & 0xff) * 0.04) * Math.cos(vz * 0.012);
      const onda2 = Math.sin((vx + vz) * 0.025 + ((hash >> 8) & 0xff) * 0.03);
      const fatorPasto = Math.max(0, Math.min(1, (onda1 + onda2 * 0.5 + 1) * 0.5));

      corVertice.copy(corGramaVerde).lerp(corCampoDourado, fatorPasto);

      // 2. Vales férteis e margens de rios
      if (amostra.altura < 1.2) {
        const tVale = 1.0 - Math.max(0, amostra.altura / 1.2);
        corVertice.lerp(corSoloFertil, tVale * 0.45);
      }

      // 3. Picos de Karst calcário em elevações altas
      if (amostra.altura > 8.0) {
        const tRocha = Math.min(1.0, (amostra.altura - 8.0) / 16.0);
        corVertice.lerp(corRochaKarst, tRocha * 0.85);
      }

      // 4. Zonas de influência dos setores pintadas no relevo (sem z-fighting nem cintilação)
      const distCentro = Math.hypot(vx, vz);
      const anguloP = Math.atan2(vz, vx);
      const infoSetor = this.obterInfoSetorPorPonto(anguloP, distCentro, rPraca, rMapa);
      if (infoSetor) {
        if (infoSetor.ehBorda) {
          corVertice.lerp(corBordaTinta, 0.72);
        } else {
          corVertice.lerp(infoSetor.cor, 0.18);
        }
      }

      // 5. Escurecimento de tinta aguada nas bordas externas do mapa de campanha
      if (distCentro > rMapa * 0.92) {
        const tBorda = Math.min(1, (distCentro - rMapa * 0.92) / (rMapa * 0.35));
        corVertice.lerp(corBordaTinta, tBorda * 0.55);
      }

      atributoCor.setXYZ(i, corVertice.r, corVertice.g, corVertice.b);
    }

    posicoes.needsUpdate = true;
    atributoCor.needsUpdate = true;
    geometria.computeVertexNormals();

    this.aoAtualizarTerreno?.({
      vertices: posicoes.count,
      cotaMinima: cotaMin === Infinity ? 0 : cotaMin,
      cotaMaxima: cotaMax === -Infinity ? 0 : cotaMax,
      rotaTerreno: 'rota-a-pacote',
    });
  }

  private obterInfoSetorPorPonto(
    anguloRad: number,
    distCentro: number,
    rPraca: number,
    rMapa: number
  ): { cor: THREE.Color; ehBorda: boolean } | null {
    const cunhas = this.layoutAtual?.cunhas;
    if (!cunhas || cunhas.length === 0 || distCentro < rPraca || distCentro > rMapa) {
      return null;
    }
    let ang = anguloRad;
    while (ang < 0) ang += Math.PI * 2;
    while (ang >= Math.PI * 2) ang -= Math.PI * 2;

    for (const c of cunhas) {
      let inicio = c.anguloInicioRad;
      let fim = c.anguloFimRad;
      while (inicio < 0) inicio += Math.PI * 2;
      while (fim < 0) fim += Math.PI * 2;

      const contido =
        inicio <= fim ? ang >= inicio && ang < fim : ang >= inicio || ang < fim;

      if (contido) {
        let diffBorda = Math.abs(ang - inicio);
        if (diffBorda > Math.PI) diffBorda = Math.PI * 2 - diffBorda;
        const ehBorda = diffBorda < 0.018;
        return { cor: new THREE.Color(c.cor), ehBorda };
      }
    }
    return null;
  }

  public exportarTerrenoGlb(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.malhaTerreno) {
        reject(new Error('Malha do terreno não inicializada.'));
        return;
      }
      const exportador = new GLTFExporter();
      exportador.parse(
        this.malhaTerreno,
        (resultado) => {
          if (resultado instanceof ArrayBuffer) {
            resolve(resultado);
          } else {
            const json = JSON.stringify(resultado);
            resolve(new TextEncoder().encode(json).buffer);
          }
        },
        (erro) => reject(erro),
        { binary: true }
      );
    });
  }

  /**
   * Sincroniza o estado derivado com a cena Three.js (Metrópole Central, cunhas, cidades, lojas, estradas e NPCs).
   */
  public sincronizarEstado(dados: DadosEstadoMapa): void {
    if (this.destruido) return;

    const estadoAnterior = this.ultimoDadosEstado;
    this.ultimoDadosEstado = dados;
    if (dados.lenteAtiva) {
      this.lenteAtual = dados.lenteAtiva;
    }
    if (dados.filtroSetorId !== undefined) {
      this.filtroSetorId = dados.filtroSetorId;
    }
    if (dados.filtroProdutoId !== undefined) {
      this.filtroProdutoId = dados.filtroProdutoId;
    }

    if (dados.qualidadeGrafica) {
      this.definirQualidadeGrafica(dados.qualidadeGrafica, dados.projetos.length);
    } else if (this.qualidadeConfigurada === 'automatica') {
      this.definirQualidadeGrafica('automatica', dados.projetos.length);
    }

    if (dados.sementeTerreno !== this.sementeAtual) {
      void this.aplicarSemente(dados.sementeTerreno);
    }

    // Se apenas 1 projeto mudou sua posição manual (arrasto de cidade) e o restante da campanha é igual,
    // aplica atualização incremental de 400ms sem mover nenhuma outra cidade (Seção 4.6 e Seção 6)
    if (
      estadoAnterior &&
      this.layoutAtual &&
      this.estradasAtuais &&
      estadoAnterior.projetos.length === dados.projetos.length &&
      estadoAnterior.setores.length === dados.setores.length &&
      (estadoAnterior.produtos?.length ?? 0) === (dados.produtos?.length ?? 0) &&
      (estadoAnterior.lancamentos?.length ?? 0) === (dados.lancamentos?.length ?? 0) &&
      estadoAnterior.ligacoes.length === dados.ligacoes.length &&
      estadoAnterior.hoje === dados.hoje &&
      estadoAnterior.lenteAtiva === dados.lenteAtiva &&
      estadoAnterior.filtroSetorId === dados.filtroSetorId &&
      estadoAnterior.filtroProdutoId === dados.filtroProdutoId
    ) {
      let projetoMovido: Projeto | null = null;
      let totalDiferentes = 0;
      for (let i = 0; i < dados.projetos.length; i++) {
        const pAnt = estadoAnterior.projetos[i];
        const pNov = dados.projetos[i];
        if (!pAnt || !pNov || pAnt.id !== pNov.id) {
          totalDiferentes = 99;
          break;
        }
        const xAnt = pAnt.posicao?.x ?? pAnt.x;
        const zAnt = pAnt.posicao?.z ?? pAnt.z;
        const xNov = pNov.posicao?.x ?? pNov.x;
        const zNov = pNov.posicao?.z ?? pNov.z;
        if (Math.abs(xAnt - xNov) > 1e-4 || Math.abs(zAnt - zNov) > 1e-4) {
          projetoMovido = pNov;
          totalDiferentes++;
        } else if (
          pAnt.setorId !== pNov.setorId ||
          pAnt.arquivadoEm !== pNov.arquivadoEm
        ) {
          totalDiferentes = 99;
          break;
        }
      }
      if (totalDiferentes === 1 && projetoMovido) {
        const novoX = projetoMovido.posicao?.x ?? projetoMovido.x;
        const novoZ = projetoMovido.posicao?.z ?? projetoMovido.z;
        this.moverCidadeIncremental(projetoMovido.id, novoX, novoZ);
        return;
      }
    }

    const hoje = dados.hoje ?? '2026-11-01';

    // 1. Calcula o layout determinístico do mundo plano (cunhas, posições polares e Metrópole Central)
    const layout = layoutWorld({
      setores: dados.setores,
      projetos: dados.projetos,
      produtos: dados.produtos ?? [],
      lancamentos: dados.lancamentos ?? [],
      derivadosPorProjeto: dados.derivadosPorProjeto,
      hoje,
    });
    this.layoutAtual = layout;
    this.aoAtualizarLayout?.(layout);
    const larguraTela = Math.max(1, this.container.clientWidth || 960);
    const alturaTela = Math.max(1, this.container.clientHeight || 600);
    this.distFitAtual = calcularDistFitMapa(layout.raioMapa, larguraTela / alturaTela);

    // 2. Deriva as lojas da Metrópole Central e os fluxos econômicos reais
    const lojas = deriveShops(
      {
        setores: dados.setores,
        projetos: dados.projetos,
        produtos: dados.produtos ?? [],
        lancamentos: dados.lancamentos ?? [],
        derivadosPorProjeto: dados.derivadosPorProjeto,
        hoje,
      },
      {
        hoje,
        layout,
        produtosRecemCriadosIds: dados.produtosRecemCriadosIds,
        produtosRecemArquivadosIds: dados.produtosRecemArquivadosIds,
      }
    );
    this.lojasAtuais = lojas;

    const fluxos = deriveFlows(
      {
        setores: dados.setores,
        projetos: dados.projetos,
        produtos: dados.produtos ?? [],
        lancamentos: dados.lancamentos ?? [],
        ligacoes: dados.ligacoes,
        tiposLigacao: dados.tiposLigacao,
        itens: dados.itens,
        itensDeLista: dados.itensLista,
        vinculosCliente: dados.vinculosCliente,
        derivadosPorProjeto: dados.derivadosPorProjeto,
        hoje,
      },
      {
        hoje,
        layout,
        lojas,
      }
    );
    this.fluxosAtuais = fluxos;

    const estradasMundo = routeRoads(layout, fluxos, undefined, lojas);
    this.estradasAtuais = estradasMundo;

    // 3. Atualiza coordenadas posicionadas pelo layoutWorld nos projetos exibidos no mapa
    this.projetosPorId.clear();
    this.gradeEspacial.limpar();

    const projetosPosicionados: Projeto[] = dados.projetos.map((p) => {
      const cidLayout = layout.cidadesPorProjetoId.get(p.id);
      const xEfetivo = cidLayout ? cidLayout.x : p.x;
      const zEfetivo = cidLayout ? cidLayout.z : p.z;
      const projPosicionado: Projeto = {
        ...p,
        x: xEfetivo,
        z: zEfetivo,
      };
      this.projetosPorId.set(p.id, projPosicionado);
      if (p.arquivadoEm === null) {
        this.gradeEspacial.inserir(p.id, xEfetivo, zEfetivo, projPosicionado);
      }
      return projPosicionado;
    });

    // Determina quais projetos ficam destacados caso haja filtro de setor ou produto
    let projetosDestacadosFiltro: Set<UUID> | null = null;
    if (this.filtroSetorId !== null || this.filtroProdutoId !== null) {
      projetosDestacadosFiltro = new Set<UUID>();
      for (const p of projetosPosicionados) {
        if (this.filtroSetorId !== null && p.setorId === this.filtroSetorId) {
          projetosDestacadosFiltro.add(p.id);
        }
      }
      if (this.filtroProdutoId !== null) {
        projetosDestacadosFiltro.clear();
        for (const l of lojas) {
          if (l.produtoId === this.filtroProdutoId) {
            projetosDestacadosFiltro.add(l.projetoId);
          }
        }
      }
    }

    const resumoDerivados = new Map<UUID, InfoResumoDerivadoLente>();
    for (const [id, d] of dados.derivadosPorProjeto.entries()) {
      resumoDerivados.set(id, {
        pontuacaoSaude: d.saude.pontuacao,
        liquidoMesCentavos: d.fluxoMes?.liquidoCentavos ?? 0,
        horasRegistradasSemana: dados.horasRegistradasPorProjeto?.get(id) ?? d.horasJanela / 2,
        concentracaoRisco: d.bloqueios.total > 0 ? 0.6 : d.tarefasVencidas > 2 ? 0.4 : 0.1,
      });
    }

    const contextoLente: DadosContextoLente = {
      lente: this.lenteAtual,
      derivadosPorProjeto: resumoDerivados,
      ligacoes: dados.ligacoes,
      clientes: dados.clientes,
      vinculosCliente: dados.vinculosCliente,
      itensLista: dados.itensLista,
      aplicacoes: dados.aplicacoes,
      horasRegistradasPorProjeto: dados.horasRegistradasPorProjeto,
      hoje,
    };

    // Atualiza relevo 3D considerando as posições das cidades para os platôs
    this.pintarChaoPergaminhoPlano(this.sementeAtual);

    // 4. Atualiza Cidades Instanciadas, Metrópole Central, Estradas e NPCs
    this.cidadesInstanciadas.atualizarCidades(
      projetosPosicionados,
      dados.derivadosPorProjeto,
      this.obterAlturaTerreno,
      dados.projetoSelecionadoId,
      contextoLente,
      projetosDestacadosFiltro
    );

    this.metropoleCentral.atualizarEstruturaECunhas(layout, this.filtroSetorId);
    this.metropoleCentral.atualizarLojas(
      layout,
      lojas,
      this.lenteAtual,
      this.filtroSetorId,
      this.filtroProdutoId
    );

    const clienteDominantePorProjeto = new Map<UUID, UUID>();
    for (const f of fluxos) {
      if (f.clienteIdDominante && f.origemId !== 'metropole-central') {
        clienteDominantePorProjeto.set(f.origemId, f.clienteIdDominante);
      }
    }

    this.estradas.atualizarEstradas(
      estradasMundo.estradas,
      this.lenteAtual,
      this.filtroSetorId,
      this.filtroProdutoId,
      clienteDominantePorProjeto,
      undefined,
      this.obterAlturaTerreno
    );

    this.npcsFluxo.atualizarFluxos(
      fluxos,
      this.qualidadeEfetiva,
      this.lenteAtual,
      this.filtroSetorId,
      this.filtroProdutoId,
      hoje,
      this.obterAlturaTerreno
    );

    if (this.propsMercado && this.lojasAtuais.length > 0) {
      const matrizTemp = new THREE.Matrix4();
      const posTemp = new THREE.Vector3();
      const rotTemp = new THREE.Quaternion();
      const escTemp = new THREE.Vector3();

      let bIdx = 0;
      let cIdx = 0;
      let tIdx = 0;
      for (const loja of this.lojasAtuais) {
        if (loja.x === undefined || loja.z === undefined) continue;
        const ang = Math.atan2(loja.z, loja.x);

        if (bIdx < 120) {
          posTemp.set(loja.x + Math.cos(ang + 0.35) * 3.2, 0.8, loja.z + Math.sin(ang + 0.35) * 3.2);
          rotTemp.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
          escTemp.set(1, 1, 1);
          matrizTemp.compose(posTemp, rotTemp, escTemp);
          this.propsMercado.barrisInstancias.setMatrixAt(bIdx++, matrizTemp);
        }

        if (cIdx < 160) {
          posTemp.set(loja.x + Math.cos(ang - 0.35) * 3.4, 0.6, loja.z + Math.sin(ang - 0.35) * 3.4);
          rotTemp.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + 0.2);
          escTemp.set(1, 1, 1);
          matrizTemp.compose(posTemp, rotTemp, escTemp);
          this.propsMercado.caixasInstancias.setMatrixAt(cIdx++, matrizTemp);
        }

        if (tIdx < 80) {
          posTemp.set(loja.x * 0.94, 3.2, loja.z * 0.94);
          rotTemp.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + Math.PI);
          escTemp.set(1, 1, 1);
          matrizTemp.compose(posTemp, rotTemp, escTemp);
          this.propsMercado.toldosInstancias.setMatrixAt(tIdx++, matrizTemp);
        }
      }
      this.propsMercado.barrisInstancias.count = bIdx;
      this.propsMercado.barrisInstancias.instanceMatrix.needsUpdate = true;
      this.propsMercado.caixasInstancias.count = cIdx;
      this.propsMercado.caixasInstancias.instanceMatrix.needsUpdate = true;
      this.propsMercado.toldosInstancias.count = tIdx;
      this.propsMercado.toldosInstancias.instanceMatrix.needsUpdate = true;
    }

    this.vegetacaoLod.atualizarLodPorDistancia(
      this.camera.position,
      this.distanciaCamera,
      this.qualidadeEfetiva
    );

    const moralMap = new Map<string, number>();
    const faseMap = new Map<string, number>();
    for (const [id, d] of dados.derivadosPorProjeto.entries()) {
      moralMap.set(id, d.moral.moral);
      faseMap.set(id, d.fase.fase);
    }
    this.atmosfera.atualizarEstadoAtmosfera(
      projetosPosicionados.filter((p) => p.arquivadoEm === null),
      moralMap,
      faseMap,
      this.obterAlturaTerreno,
      layout.raioMapa
    );
  }

  /**
   * Move uma única cidade incrementalmente (sem mover nenhuma outra cidade e recalculando
   * apenas as estradas que a tocam, com transição suave de 400 ms).
   */
  public moverCidadeIncremental(
    projetoId: UUID,
    novoX: number,
    novoZ: number
  ): string[] {
    if (!this.layoutAtual || !this.estradasAtuais) return [];

    const estradasAnteriores = new Map(this.estradasAtuais.estradasPorId);
    const resultado = recalcularEstradasDaCidade(
      this.layoutAtual,
      this.estradasAtuais,
      this.fluxosAtuais,
      projetoId,
      novoX,
      novoZ,
      undefined,
      this.lojasAtuais
    );

    this.layoutAtual = resultado.layout;
    this.estradasAtuais = resultado.estradas;
    this.fluxosAtuais = resultado.estradas.fluxosRoteados;

    const projExistente = this.projetosPorId.get(projetoId);
    if (projExistente) {
      const atualizado: Projeto = {
        ...projExistente,
        x: Math.round(novoX * 100) / 100,
        z: Math.round(novoZ * 100) / 100,
        posicao: {
          x: Math.round(novoX * 100) / 100,
          z: Math.round(novoZ * 100) / 100,
        },
      };
      this.projetosPorId.set(projetoId, atualizado);

      // Re-insere na grade espacial e atualiza matriz da instância da cidade
      this.gradeEspacial.limpar();
      const todosProjetos: Projeto[] = [];
      for (const p of this.projetosPorId.values()) {
        todosProjetos.push(p);
        if (p.arquivadoEm === null) {
          this.gradeEspacial.inserir(p.id, p.x, p.z, p);
        }
      }

      if (this.ultimoDadosEstado) {
        this.cidadesInstanciadas.atualizarCidades(
          todosProjetos,
          this.ultimoDadosEstado.derivadosPorProjeto,
          this.obterAlturaTerreno,
          this.ultimoDadosEstado.projetoSelecionadoId
        );
      }
    }

    this.estradas.iniciarTransicaoArrasto(
      estradasAnteriores,
      resultado.estradas,
      resultado.idsEstradasRecalculadas
    );

    this.npcsFluxo.atualizarFluxos(
      this.fluxosAtuais,
      this.qualidadeEfetiva,
      this.lenteAtual,
      this.filtroSetorId,
      this.filtroProdutoId,
      this.ultimoDadosEstado?.hoje ?? '2026-11-01'
    );

    return resultado.idsEstradasRecalculadas;
  }

  public definirQualidadeGrafica(
    qualidade: QualidadeGraficaMapa,
    totalProjetos = this.projetosPorId.size
  ): void {
    this.qualidadeConfigurada = qualidade;
    let novaEfetiva: QualidadeEfetivaMapa = 'alta';

    if (qualidade === 'automatica') {
      if (totalProjetos >= 250) {
        novaEfetiva = 'media';
      } else {
        novaEfetiva = 'alta';
      }
      if (this.historicoQuadros.length >= 10) {
        const ordenado = [...this.historicoQuadros].sort((a, b) => a - b);
        const p95 = ordenado[Math.floor(ordenado.length * 0.95)] ?? 0;
        if (p95 > 16.7) {
          novaEfetiva = novaEfetiva === 'alta' ? 'media' : 'baixa';
        }
      }
    } else {
      novaEfetiva = qualidade;
    }

    this.qualidadeEfetiva = novaEfetiva;
    if (this.renderizador) {
      const ratioMax = novaEfetiva === 'alta' ? 2 : 1;
      this.renderizador.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, ratioMax)
      );
    }

    this.vegetacaoLod?.atualizarLodPorDistancia(
      this.camera.position,
      this.distanciaCamera,
      novaEfetiva
    );
    if (this.fluxosAtuais.length > 0) {
      this.npcsFluxo.atualizarFluxos(
        this.fluxosAtuais,
        novaEfetiva,
        this.lenteAtual,
        this.filtroSetorId,
        this.filtroProdutoId,
        this.ultimoDadosEstado?.hoje ?? '2026-11-01'
      );
    }
  }

  public obterEstadoQualidade(): {
    configurada: QualidadeGraficaMapa;
    efetiva: QualidadeEfetivaMapa;
    lodVegetacao: ReturnType<GerenciadorVegetacaoLOD['obterEstadoLod']>;
    drawCallsRotas: number;
  } {
    return {
      configurada: this.qualidadeConfigurada,
      efetiva: this.qualidadeEfetiva,
      lodVegetacao: this.vegetacaoLod.obterEstadoLod(),
      drawCallsRotas: this.estradas.obterTotalDrawCalls(),
    };
  }

  public definirPresetHoraDia(preset: PresetHoraDia): void {
    this.luzAtmosfera.aplicarPreset(preset);
  }

  public obterPresetHoraDia(): PresetHoraDia {
    return this.luzAtmosfera.obterPresetAtual();
  }

  public definirLente(lente: LenteMapa): void {
    this.lenteAtual = lente;
    if (this.ultimoDadosEstado) {
      this.sincronizarEstado({
        ...this.ultimoDadosEstado,
        lenteAtiva: lente,
      });
    }
  }

  public definirFiltrosMapa(
    filtroSetorId: UUID | null,
    filtroProdutoId: UUID | null
  ): void {
    this.filtroSetorId = filtroSetorId;
    this.filtroProdutoId = filtroProdutoId;
    if (this.ultimoDadosEstado) {
      this.sincronizarEstado({
        ...this.ultimoDadosEstado,
        filtroSetorId,
        filtroProdutoId,
      });
    }
  }

  public obterLenteAtual(): LenteMapa {
    return this.lenteAtual;
  }

  public obterUuidCena(): string {
    return this.cena.uuid;
  }

  public obterTotalLuzesPdAtivas(): number {
    return this.cidadesInstanciadas.obterTotalLuzesPdAtivas();
  }

  public obterContagemFormasSaude(): ReturnType<
    GerenciadorCidadesInstanciadas['obterContagemFormasSaude']
  > {
    return this.cidadesInstanciadas.obterContagemFormasSaude();
  }

  public obterEstadoAtmosfera(): ReturnType<
    GerenciadorAtmosferaMapa['obterEstadoAtmosfera']
  > {
    return this.atmosfera.obterEstadoAtmosfera();
  }

  public obterResumoMundoPlano(): {
    metropole: EstadoVisualMetropole;
    npcs: EstadoNpcsFluxo;
    totalEstradasAtivas: number;
    raioMapa: number;
  } {
    return {
      metropole: this.metropoleCentral.obterEstadoVisualMetropole(),
      npcs: this.npcsFluxo.obterEstadoNpcs(),
      totalEstradasAtivas: this.estradas.obterTotalEstradasAtivas(),
      raioMapa: this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto,
    };
  }

  public obterLojasAtuais(): readonly Loja[] {
    return this.lojasAtuais;
  }

  public obterLojas(): readonly Loja[] {
    return this.lojasAtuais;
  }

  public obterFluxosAtuais(): readonly Fluxo[] {
    return this.fluxosAtuais;
  }

  public obterFluxos(): readonly Fluxo[] {
    return this.fluxosAtuais;
  }

  public obterLayoutAtual(): ResultadoLayoutMundo | null {
    return this.layoutAtual;
  }

  public obterLayoutMundo(): ResultadoLayoutMundo | null {
    return this.layoutAtual;
  }

  public obterEstradas(): readonly EstradaRoteada[] {
    return this.estradas.obterEstradasAtuais();
  }

  public obterEstadoMetropole(): EstadoVisualMetropole {
    return this.metropoleCentral.obterEstadoVisualMetropole();
  }

  public obterEstadoNpcs(): EstadoNpcsFluxo {
    return this.npcsFluxo.obterEstadoNpcs();
  }

  public obterEstadoEstradas(): {
    transicoesAtivas: number;
    totalEstradasAtivas: number;
    drawCallsRotas: number;
  } {
    return {
      transicoesAtivas: this.estradas.obterTotalTransicoesAtivas(),
      totalEstradasAtivas: this.estradas.obterTotalEstradasAtivas(),
      drawCallsRotas: this.estradas.obterTotalDrawCalls(),
    };
  }

  public obterDistFit(): number {
    return this.distFitAtual;
  }

  public obterNivelSemantico(): NivelSemanticoCamera {
    return obterNivelSemanticoCamera(this.distanciaCamera, this.distFitAtual);
  }

  public obterHudEscalaCamera(): InfoHudEscalaCamera {
    const largura = Math.max(1, this.container.clientWidth || 960);
    const nivel = obterNivelSemanticoCamera(this.distanciaCamera, this.distFitAtual);
    const barra = calcularBarraEscalaHud(
      this.distanciaCamera,
      LAYOUT_PADRAO.cameraFovGraus,
      largura
    );
    const setores = this.ultimoDadosEstado?.setores ?? [];
    const projetos = Array.from(this.projetosPorId.values());
    const trilha = construirTrilhaBreadcrumbCamera(
      nivel,
      this.alvoCamera.x,
      this.alvoCamera.z,
      this.layoutAtual,
      setores,
      projetos,
      this.lojasAtuais
    );
    const rMapa = this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto;
    const trapezio = calcularTrapezioFrustumNoChao(
      this.camera,
      { x: this.alvoCamera.x, z: this.alvoCamera.z },
      rMapa
    );

    return {
      nivelSemantico: nivel,
      rotuloNivel: obterRotuloNivelSemantico(nivel),
      distancia: Math.round(this.distanciaCamera * 100) / 100,
      distFit: Math.round(this.distFitAtual * 100) / 100,
      razaoDistFit:
        Math.round((this.distanciaCamera / Math.max(1, this.distFitAtual)) * 10000) /
        10000,
      anguloElevacaoGraus: Math.round(((this.anguloElevacao * 180) / Math.PI) * 10) / 10,
      anguloAzimuteGraus: Math.round(((this.anguloAzimute * 180) / Math.PI) * 10) / 10,
      unidadesBarraEscala: barra.unidades,
      larguraPxBarraEscala: barra.larguraPx,
      trilhaBreadcrumb: trilha,
      trapezioMinimapa: trapezio,
    };
  }

  public empilharEstadoCamera(): void {
    const topo = this.pilhaEstadosCamera[this.pilhaEstadosCamera.length - 1];
    const elevGraus = (this.anguloElevacao * 180) / Math.PI;
    if (
      topo &&
      Math.hypot(topo.alvoX - this.alvoCamera.x, topo.alvoZ - this.alvoCamera.z) < 2 &&
      Math.abs(topo.distancia - this.distanciaCamera) < 2
    ) {
      return;
    }
    this.pilhaEstadosCamera.push({
      alvoX: this.alvoCamera.x,
      alvoZ: this.alvoCamera.z,
      distancia: this.distanciaCamera,
      azimuteRad: this.anguloAzimute,
      elevacaoGraus: elevGraus,
    });
    if (this.pilhaEstadosCamera.length > 25) {
      this.pilhaEstadosCamera.shift();
    }
  }

  public voltarEstadoCameraAnterior(): boolean {
    const anterior = this.pilhaEstadosCamera.pop();
    if (!anterior) return false;
    this.anguloAzimute = anterior.azimuteRad;
    this.voarAte(anterior.alvoX, anterior.alvoZ, anterior.distancia);
    return true;
  }

  public enquadrarImperio(): void {
    this.empilharEstadoCamera();
    this.voarAte(0, 0, this.distFitAtual * 0.65);
  }

  public definirPoseCamera(
    x: number,
    z: number,
    distancia: number,
    elevacaoGraus?: number
  ): void {
    this.zoomSuave = null;
    this.velocidadePan = { vx: 0, vz: 0 };
    this.alvoCamera.set(x, 0, z);
    const maxDist = Math.max(
      this.distFitAtual * LAYOUT_PADRAO.cameraFatorMaxDistFit,
      (this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto) *
        LAYOUT_PADRAO.cameraDistanciaMaxFatorRaioMapa
    );
    this.distanciaCamera = Math.max(
      LAYOUT_PADRAO.cameraDistanciaMin,
      Math.min(maxDist, distancia)
    );
    if (typeof elevacaoGraus === 'number') {
      this.anguloElevacao = (elevacaoGraus * Math.PI) / 180;
    } else {
      const incSuave = calcularInclinacaoSuaveCameraGraus(
        this.distanciaCamera,
        this.distFitAtual
      );
      this.anguloElevacao = (incSuave * Math.PI) / 180;
    }
    this.atualizarPosicaoCamera();
    this.npcsFluxo.atualizarMatrizesQuadro(0, this.distanciaCamera);
    this.renderizador?.render(this.cena, this.camera);
  }

  public definirReduzirMovimento(reduzir: boolean): void {
    this.reduzirMovimento = reduzir;
    this.atmosfera.definirReduzirMovimento(reduzir);
    this.npcsFluxo.definirReduzirMovimento(reduzir);
  }

  /**
   * Posiciona a câmera em níveis semânticos de zoom ('proximo' | 'medio' | 'distante' | 'imperio' | 'setor' | 'cidade' | 'rua')
   */
  public definirNivelZoom(
    nivel: 'proximo' | 'medio' | 'distante' | NivelSemanticoCamera
  ): void {
    if (nivel === 'rua') {
      this.definirPoseCamera(this.alvoCamera.x, this.alvoCamera.z, Math.min(62, this.distFitAtual * 0.032));
    } else if (nivel === 'proximo' || nivel === 'cidade') {
      this.definirPoseCamera(this.alvoCamera.x, this.alvoCamera.z, Math.min(155, this.distFitAtual * 0.09));
    } else if (nivel === 'medio' || nivel === 'setor') {
      this.definirPoseCamera(this.alvoCamera.x, this.alvoCamera.z, this.distFitAtual * 0.26);
    } else {
      this.definirPoseCamera(0, 0, this.distFitAtual * 0.62);
    }
  }

  /**
   * Zoom contínuo ao cursor com fator por passo entre 1.12 e 1.18 (1.15),
   * mantendo o ponto do mundo sob o cursor com erro < 2 px (Seção 3.2).
   */
  public aplicarZoomAoCursor(
    clientX: number,
    clientY: number,
    deltaY: number,
    deltaMode = 0,
    imediato = false
  ): void {
    const passos = normalizarDeltaRoda(deltaY, deltaMode);
    if (Math.abs(passos) < 1e-4) return;

    const pontoAncora =
      this.zoomSuave?.pontoMundoAncora?.clone() ??
      this.obterPontoTerreno(clientX, clientY);

    const fatorPasso = Math.pow(LAYOUT_PADRAO.zoomFatorPassoRoda, passos);
    const maxDist = Math.max(
      this.distFitAtual * LAYOUT_PADRAO.cameraFatorMaxDistFit,
      (this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto) *
        LAYOUT_PADRAO.cameraDistanciaMaxFatorRaioMapa
    );
    const distBase = this.zoomSuave
      ? this.zoomSuave.distanciaAlvo
      : this.distanciaCamera;
    const novaDistAlvo = Math.max(
      LAYOUT_PADRAO.cameraDistanciaMin,
      Math.min(maxDist, distBase * fatorPasso)
    );

    if (imediato || this.reduzirMovimento) {
      this.zoomSuave = null;
      this.definirDistanciaAncoradaNoCursor(novaDistAlvo, clientX, clientY, pontoAncora);
      this.renderizador?.render(this.cena, this.camera);
      return;
    }

    // Aplica parcela imediata ancorada ao cursor e agenda suavização exponencial (~120 ms)
    const distIntermediaria =
      this.distanciaCamera * Math.pow(novaDistAlvo / Math.max(1, this.distanciaCamera), 0.38);
    this.definirDistanciaAncoradaNoCursor(
      distIntermediaria,
      clientX,
      clientY,
      pontoAncora
    );

    if (pontoAncora) {
      this.zoomSuave = {
        distanciaAlvo: novaDistAlvo,
        clientX,
        clientY,
        pontoMundoAncora: pontoAncora.clone(),
      };
    }
  }

  private definirDistanciaAncoradaNoCursor(
    novaDistancia: number,
    clientX: number,
    clientY: number,
    pontoAncora: THREE.Vector3 | null
  ): void {
    this.distanciaCamera = novaDistancia;
    const incGraus = calcularInclinacaoSuaveCameraGraus(
      this.distanciaCamera,
      this.distFitAtual
    );
    this.anguloElevacao = (incGraus * Math.PI) / 180;
    this.atualizarPosicaoCamera(false);
    this.camera.updateMatrixWorld(true);

    if (pontoAncora) {
      const novoPontoSobCursor = this.obterPontoTerreno(clientX, clientY);
      if (novoPontoSobCursor) {
        this.alvoCamera.x += pontoAncora.x - novoPontoSobCursor.x;
        this.alvoCamera.z += pontoAncora.z - novoPontoSobCursor.z;
        this.limitarAlvoDentroDoMundo();
      }
    }
    this.atualizarPosicaoCamera(true);
    this.camera.updateMatrixWorld(true);
  }

  private limitarAlvoDentroDoMundo(): void {
    const rMapa = this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto;
    const limite = rMapa * 1.05;
    const distCentro = Math.hypot(this.alvoCamera.x, this.alvoCamera.z);
    if (distCentro > limite && distCentro > 0) {
      const escala = limite / distCentro;
      this.alvoCamera.x *= escala;
      this.alvoCamera.z *= escala;
    }
  }

  public voarAte(
    x: number,
    z: number,
    distancia = 210,
    duracaoMs?: number,
    aoConcluir?: () => void
  ): void {
    this.empilharEstadoCamera();
    this.zoomSuave = null;
    this.velocidadePan = { vx: 0, vz: 0 };

    if (this.intervaloVooId !== null) {
      window.clearInterval(this.intervaloVooId);
      this.intervaloVooId = null;
    }

    // Com prefers-reduced-motion, a transição é instantânea (Seção 3.2)
    if (this.reduzirMovimento) {
      this.definirPoseCamera(x, z, distancia);
      aoConcluir?.();
      return;
    }

    const inicioX = this.alvoCamera.x;
    const inicioZ = this.alvoCamera.z;
    const inicioDistancia = Math.max(LAYOUT_PADRAO.cameraDistanciaMin, this.distanciaCamera);
    const destinoDistancia = Math.max(LAYOUT_PADRAO.cameraDistanciaMin, distancia);
    const distHoriz = Math.hypot(x - inicioX, z - inicioZ);
    const distTotal = Math.hypot(distHoriz, destinoDistancia - inicioDistancia);

    // Fórmula da Seção 3.2: clamp(0.6 + 0.35 * log2(1 + dist / d_rua), 0.6, 2.2) s
    const duracaoCalculadaMs = calcularDuracaoVooSegundos(distTotal) * 1000;
    const duracaoReal =
      typeof duracaoMs === 'number' ? Math.max(80, duracaoMs) : duracaoCalculadaMs;
    const amplitudeArco =
      LAYOUT_PADRAO.vooArcoMaxFator *
      Math.max(0, Math.min(1, distHoriz / Math.max(120, this.distFitAtual * 0.45)));
    const tempoInicio = performance.now();

    this.animacaoVoo = {
      inicioX,
      inicioZ,
      inicioDistancia,
      destinoX: x,
      destinoZ: z,
      destinoDistancia,
      tempoInicio,
      duracaoMs: duracaoReal,
      amplitudeArco,
      aoConcluir,
    };

    const aplicarPassoVoo = (agora: number): boolean => {
      if (this.destruido || !this.animacaoVoo) return true;
      const decorrido = Math.max(0, agora - this.animacaoVoo.tempoInicio);
      const progresso = Math.min(1, decorrido / this.animacaoVoo.duracaoMs);
      // Curva ease-in-out cúbica suave
      const e =
        progresso < 0.5
          ? 4 * progresso * progresso * progresso
          : 1 - Math.pow(-2 * progresso + 2, 3) / 2;

      this.alvoCamera.x =
        this.animacaoVoo.inicioX +
        (this.animacaoVoo.destinoX - this.animacaoVoo.inicioX) * e;
      this.alvoCamera.z =
        this.animacaoVoo.inicioZ +
        (this.animacaoVoo.destinoZ - this.animacaoVoo.inicioZ) * e;

      // Interpolação em log-distância + leve arco no meio do voo (até 40% em saltos longos)
      const logIni = Math.log(this.animacaoVoo.inicioDistancia);
      const logFim = Math.log(this.animacaoVoo.destinoDistancia);
      const distLog = Math.exp(logIni + (logFim - logIni) * e);
      const fatorArco = 1 + this.animacaoVoo.amplitudeArco * Math.sin(Math.PI * progresso);
      this.distanciaCamera = distLog * fatorArco;

      const incGraus = calcularInclinacaoSuaveCameraGraus(
        this.distanciaCamera,
        this.distFitAtual
      );
      this.anguloElevacao = (incGraus * Math.PI) / 180;
      this.atualizarPosicaoCamera();

      if (progresso >= 1) {
        this.alvoCamera.set(this.animacaoVoo.destinoX, 0, this.animacaoVoo.destinoZ);
        this.distanciaCamera = this.animacaoVoo.destinoDistancia;
        const incFinal = calcularInclinacaoSuaveCameraGraus(
          this.distanciaCamera,
          this.distFitAtual
        );
        this.anguloElevacao = (incFinal * Math.PI) / 180;
        this.atualizarPosicaoCamera();
        const cb = this.animacaoVoo.aoConcluir;
        this.animacaoVoo = null;
        cb?.();
        return true;
      }
      return false;
    };

    // Avança primeiro passo imediatamente para feedback instantâneo
    aplicarPassoVoo(tempoInicio + Math.min(24, duracaoReal * 0.12));

    this.intervaloVooId = window.setInterval(() => {
      if (aplicarPassoVoo(performance.now())) {
        if (this.intervaloVooId !== null) {
          window.clearInterval(this.intervaloVooId);
          this.intervaloVooId = null;
        }
      }
    }, 16);
  }

  public centralizarEm(x: number, z: number): void {
    this.alvoCamera.x = x;
    this.alvoCamera.z = z;
    this.limitarAlvoDentroDoMundo();
    this.atualizarPosicaoCamera();
  }

  public obterEstadoCamera(): {
    alvo: { x: number; z: number };
    posicao: { x: number; y: number; z: number };
    distancia: number;
    distFit: number;
    razaoDistFit: number;
    nivelSemantico: NivelSemanticoCamera;
    anguloElevacaoGraus: number;
    anguloAzimuteGraus: number;
    tamanhoPilhaCamera: number;
  } {
    return {
      alvo: { x: this.alvoCamera.x, z: this.alvoCamera.z },
      posicao: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      distancia: this.distanciaCamera,
      distFit: this.distFitAtual,
      razaoDistFit: this.distanciaCamera / Math.max(1, this.distFitAtual),
      nivelSemantico: obterNivelSemanticoCamera(this.distanciaCamera, this.distFitAtual),
      anguloElevacaoGraus: Math.round(((this.anguloElevacao * 180) / Math.PI) * 10) / 10,
      anguloAzimuteGraus: Math.round(((this.anguloAzimute * 180) / Math.PI) * 10) / 10,
      tamanhoPilhaCamera: this.pilhaEstadosCamera.length,
    };
  }

  private atualizarPosicaoCamera(notificarHud = true): void {
    const minRad = (LAYOUT_PADRAO.cameraElevacaoMinGraus * Math.PI) / 180;
    const maxRad = (LAYOUT_PADRAO.cameraElevacaoMaxGraus * Math.PI) / 180;
    const elevacao = Math.max(minRad, Math.min(maxRad, this.anguloElevacao));
    this.anguloElevacao = elevacao;

    const raioHorizontal = this.distanciaCamera * Math.cos(elevacao);
    const y = this.distanciaCamera * Math.sin(elevacao);
    const x = this.alvoCamera.x + raioHorizontal * Math.cos(this.anguloAzimute);
    const z = this.alvoCamera.z + raioHorizontal * Math.sin(this.anguloAzimute);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.alvoCamera);
    this.vegetacaoLod?.atualizarLodPorDistancia(
      this.camera.position,
      this.distanciaCamera,
      this.qualidadeEfetiva
    );
    if (notificarHud && this.aoAtualizarHudCamera) {
      this.aoAtualizarHudCamera(this.obterHudEscalaCamera());
    }
  }

  public obterPontoTerreno(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!this.container) return null;
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.camera.updateMatrixWorld(true);
    this.mouseVetor.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVetor.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVetor, this.camera);

    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plano, hit);
  }

  public projetarMundoParaTela(x: number, y: number, z: number): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, rect.width || this.container.clientWidth || 960);
    const h = Math.max(1, rect.height || this.container.clientHeight || 600);
    this.camera.updateMatrixWorld(true);
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: rect.left + (v.x * 0.5 + 0.5) * w,
      y: rect.top + (-v.y * 0.5 + 0.5) * h,
    };
  }

  private buscarCidadeNoPonto(x: number, z: number): Projeto | null {
    const hit = this.gradeEspacial.buscarMaisProximo(x, z, LAYOUT_PADRAO.cidadeRaioMaximo);
    if (!hit) return null;
    const cidLayout = this.layoutAtual?.cidadesPorProjetoId.get(hit.item.id);
    const raioHit = Math.max(16, cidLayout?.raio ?? LAYOUT_PADRAO.cidadeRaioMinimo);
    if (hit.distancia <= raioHit) {
      return hit.item.dados;
    }
    return null;
  }

  private registrarEventosInteracao(): void {
    const aoRedimensionar = (): void => {
      if (this.destruido || !this.renderizador) return;
      const w = Math.max(1, this.container.clientWidth || 960);
      const h = Math.max(1, this.container.clientHeight || 600);
      const rMapa = this.layoutAtual?.raioMapa ?? LAYOUT_PADRAO.raioMinimoMapaAbsoluto;
      this.distFitAtual = calcularDistFitMapa(rMapa, w / h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderizador.setSize(w, h);
      this.atualizarPosicaoCamera();
    };

    const aoPressionarMouse = (ev: MouseEvent): void => {
      this.ultimoMouse = { x: ev.clientX, y: ev.clientY };
      this.mousePressionadoEm = {
        x: ev.clientX,
        y: ev.clientY,
        tempo: performance.now(),
      };
      this.velocidadePan = { vx: 0, vz: 0 };

      const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);

      if (ev.button === 0) {
        if (ponto) {
          const cidade = this.buscarCidadeNoPonto(ponto.x, ponto.z);
          if (cidade) {
            if (ev.shiftKey) {
              this.modoOperacao = 'ligando';
              this.projetoOrigemLigacaoId = cidade.id;
            } else {
              this.modoOperacao = 'arrastando_cidade';
              this.projetoEmArrastoId = cidade.id;
              this.posicaoInicialArrasto = { x: cidade.x, z: cidade.z };
            }
            return;
          }
        }
        this.modoOperacao = 'camera_pan';
        this.pontoAncoraPan = ponto ? ponto.clone() : null;
      } else if (ev.button === 2 || ev.button === 1) {
        this.modoOperacao = 'camera_orbita';
      }
    };

    const aoMoverMouse = (ev: MouseEvent): void => {
      const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);

      if (this.modoOperacao === 'nenhum') {
        if (ponto) {
          this.processarHoverNoPonto(ponto.x, ponto.z);
        }
        return;
      }

      const dx = ev.clientX - this.ultimoMouse.x;
      const dy = ev.clientY - this.ultimoMouse.y;
      this.ultimoMouse = { x: ev.clientX, y: ev.clientY };

      if (this.modoOperacao === 'camera_pan') {
        // Pan "agarra o chão" (o ponto sob o cursor acompanha o cursor) com inércia curta (Seção 3.2)
        if (this.pontoAncoraPan && ponto) {
          const deltaX = this.pontoAncoraPan.x - ponto.x;
          const deltaZ = this.pontoAncoraPan.z - ponto.z;
          this.alvoCamera.x += deltaX;
          this.alvoCamera.z += deltaZ;
          this.velocidadePan = {
            vx: deltaX * 14,
            vz: deltaZ * 14,
          };
          this.limitarAlvoDentroDoMundo();
          this.atualizarPosicaoCamera();
          this.camera.updateMatrixWorld(true);
        } else {
          const fatorPan = this.distanciaCamera * 0.0018;
          const cosA = Math.cos(this.anguloAzimute);
          const sinA = Math.sin(this.anguloAzimute);
          const dMundoX = (-dx * sinA - dy * cosA) * fatorPan;
          const dMundoZ = (dx * cosA - dy * sinA) * fatorPan;
          this.alvoCamera.x += dMundoX;
          this.alvoCamera.z += dMundoZ;
          this.velocidadePan = { vx: dMundoX * 12, vz: dMundoZ * 12 };
          this.limitarAlvoDentroDoMundo();
          this.atualizarPosicaoCamera();
        }
      } else if (this.modoOperacao === 'camera_orbita') {
        this.anguloAzimute += dx * 0.006;
        const minRad = (LAYOUT_PADRAO.cameraElevacaoMinGraus * Math.PI) / 180;
        const maxRad = (LAYOUT_PADRAO.cameraElevacaoMaxGraus * Math.PI) / 180;
        this.anguloElevacao = Math.max(
          minRad,
          Math.min(maxRad, this.anguloElevacao + dy * 0.005)
        );
        this.atualizarPosicaoCamera();
      } else if (this.modoOperacao === 'ligando' && this.projetoOrigemLigacaoId) {
        const pOrigem = this.projetosPorId.get(this.projetoOrigemLigacaoId);
        if (pOrigem && ponto) {
          this.estradas.exibirPreviaLigacao(
            pOrigem.x,
            0,
            pOrigem.z,
            ponto.x,
            0,
            ponto.z
          );
        }
      }
    };

    const aoSoltarMouse = (ev: MouseEvent): void => {
      const tempoDecorrido = performance.now() - this.mousePressionadoEm.tempo;
      const dxArrasto = ev.clientX - this.mousePressionadoEm.x;
      const dyArrasto = ev.clientY - this.mousePressionadoEm.y;
      const distArrastoPx = Math.hypot(dxArrasto, dyArrasto);
      const ehCliqueSimples = distArrastoPx < 5 && tempoDecorrido < 400;

      if (ehCliqueSimples && ev.button === 0) {
        this.velocidadePan = { vx: 0, vz: 0 };
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (ponto) {
          // 1. Verifica clique em loja da Metrópole Central
          const lojaClicada = this.metropoleCentral.encontrarLojaEmPonto(ponto.x, ponto.z);
          if (lojaClicada) {
            this.aoClicarLoja?.(lojaClicada);
            this.aoSelecionarProjeto?.(lojaClicada.projetoId);
            this.modoOperacao = 'nenhum';
            this.pontoAncoraPan = null;
            return;
          }

          // 2. Verifica clique em cidade
          const cidade = this.buscarCidadeNoPonto(ponto.x, ponto.z);
          if (cidade) {
            this.voarAte(cidade.x, cidade.z, 210, 380);
            this.aoSelecionarProjeto?.(cidade.id);
          } else {
            this.aoSelecionarProjeto?.(null);
          }
        }
      } else if (this.modoOperacao === 'arrastando_cidade' && this.projetoEmArrastoId) {
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (ponto) {
          const distMundo = Math.hypot(
            ponto.x - this.posicaoInicialArrasto.x,
            ponto.z - this.posicaoInicialArrasto.z
          );
          if (distMundo > 2.0) {
            const novoX = Math.round(ponto.x);
            const novoZ = Math.round(ponto.z);
            this.moverCidadeIncremental(this.projetoEmArrastoId, novoX, novoZ);
            this.aoMoverProjeto?.(this.projetoEmArrastoId, novoX, novoZ);
          }
        }
      } else if (this.modoOperacao === 'ligando' && this.projetoOrigemLigacaoId) {
        this.estradas.ocultarPreviaLigacao();
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (ponto) {
          const alvo = this.buscarCidadeNoPonto(ponto.x, ponto.z);
          if (alvo && alvo.id !== this.projetoOrigemLigacaoId) {
            this.aoLigarProjetos?.(this.projetoOrigemLigacaoId, alvo.id);
          }
        }
      }

      this.modoOperacao = 'nenhum';
      this.pontoAncoraPan = null;
      this.projetoEmArrastoId = null;
      this.projetoOrigemLigacaoId = null;
    };

    const aoDuploClique = (ev: MouseEvent): void => {
      const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
      if (!ponto) return;

      // 1. Duplo clique em loja: voa até nível Rua (~52 u)
      const loja = this.metropoleCentral.encontrarLojaEmPonto(ponto.x, ponto.z);
      if (loja) {
        this.voarAte(loja.x ?? ponto.x, loja.z ?? ponto.z, 52);
        this.aoClicarLoja?.(loja);
        return;
      }

      // 2. Duplo clique em cidade: voa até nível Cidade (~110 u)
      const cidade = this.buscarCidadeNoPonto(ponto.x, ponto.z);
      if (cidade) {
        this.voarAte(cidade.x, cidade.z, Math.min(130, this.distFitAtual * 0.08));
        this.aoSelecionarProjeto?.(cidade.id);
        return;
      }

      // 3. Duplo clique em rota/estrada: voa até o ponto da rota
      const estradaHover = this.estradas.atualizarHoverEstrada(ponto.x, ponto.z);
      if (estradaHover) {
        this.voarAte(ponto.x, ponto.z, Math.min(180, this.distFitAtual * 0.12));
        return;
      }

      // 4. Duplo clique no chão vazio: funda novo projeto na cunha do setor
      let ang = Math.atan2(ponto.z, ponto.x);
      if (ang < 0) ang += Math.PI * 2;
      const cunha = this.layoutAtual?.cunhas.find(
        (c) => ang >= c.anguloInicioRad && ang <= c.anguloFimRad
      );
      this.aoFundarProjeto?.(Math.round(ponto.x), Math.round(ponto.z), cunha?.setorId);
    };

    const aoRolarScroll = (ev: WheelEvent): void => {
      ev.preventDefault();
      this.aplicarZoomAoCursor(ev.clientX, ev.clientY, ev.deltaY, ev.deltaMode, false);
    };

    const aoPressionarTecla = (ev: KeyboardEvent): void => {
      if (this.destruido) return;
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      const passoPan = Math.max(12, this.distanciaCamera * 0.08);
      const cosA = Math.cos(this.anguloAzimute);
      const sinA = Math.sin(this.anguloAzimute);
      const k = ev.key;

      if (k === 'w' || k === 'W' || k === 'ArrowUp') {
        this.alvoCamera.x -= cosA * passoPan;
        this.alvoCamera.z -= sinA * passoPan;
        this.limitarAlvoDentroDoMundo();
        this.atualizarPosicaoCamera();
      } else if (k === 's' || k === 'S' || k === 'ArrowDown') {
        this.alvoCamera.x += cosA * passoPan;
        this.alvoCamera.z += sinA * passoPan;
        this.limitarAlvoDentroDoMundo();
        this.atualizarPosicaoCamera();
      } else if (k === 'a' || k === 'A' || k === 'ArrowLeft') {
        this.alvoCamera.x -= sinA * passoPan;
        this.alvoCamera.z += cosA * passoPan;
        this.limitarAlvoDentroDoMundo();
        this.atualizarPosicaoCamera();
      } else if (k === 'd' || k === 'D' || k === 'ArrowRight') {
        this.alvoCamera.x += sinA * passoPan;
        this.alvoCamera.z -= cosA * passoPan;
        this.limitarAlvoDentroDoMundo();
        this.atualizarPosicaoCamera();
      } else if (k === 'q' || k === 'Q') {
        this.anguloAzimute -= 0.12;
        this.atualizarPosicaoCamera();
      } else if (k === 'e' || k === 'E') {
        this.anguloAzimute += 0.12;
        this.atualizarPosicaoCamera();
      } else if (k === '+' || k === '=') {
        const rect = this.container.getBoundingClientRect();
        this.aplicarZoomAoCursor(
          rect.left + rect.width * 0.5,
          rect.top + rect.height * 0.5,
          -100,
          0,
          true
        );
      } else if (k === '-' || k === '_') {
        const rect = this.container.getBoundingClientRect();
        this.aplicarZoomAoCursor(
          rect.left + rect.width * 0.5,
          rect.top + rect.height * 0.5,
          100,
          0,
          true
        );
      } else if (k === 'Home') {
        ev.preventDefault();
        this.enquadrarImperio();
      } else if (k === 'Escape') {
        this.voltarEstadoCameraAnterior();
      }
    };

    this.listenerTecladoWindow = aoPressionarTecla;
    window.addEventListener('resize', aoRedimensionar);
    window.addEventListener('keydown', aoPressionarTecla);
    this.container.addEventListener('mousedown', aoPressionarMouse);
    this.container.addEventListener('mousemove', aoMoverMouse);
    this.container.addEventListener('mouseup', aoSoltarMouse);
    this.container.addEventListener('dblclick', aoDuploClique);
    this.container.addEventListener('wheel', aoRolarScroll, { passive: false });
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public processarHoverNoPonto(x: number, z: number): InfoHoverMapa | null {
    // 1. Loja na Metrópole Central
    const loja = this.metropoleCentral.encontrarLojaEmPonto(x, z);
    if (loja) {
      this.estradas.atualizarHoverEstrada(-99999, -99999);
      const proj = this.projetosPorId.get(loja.projetoId);
      const info: InfoHoverMapa = {
        tipo: 'loja',
        titulo: loja.nomeProduto ?? 'Loja do Mercado',
        subtitulo: `${proj?.nome ?? 'Projeto'} · Loja ${loja.tamanho} (${loja.estado})`,
        receitaOuVolumeCentavos: loja.receitaMensal,
        nomesProdutos: [loja.nomeProduto ?? loja.produtoId],
        loja,
        projetoId: loja.projetoId,
      };
      this.aoHoverElementoMapa?.(info);
      return info;
    }

    // 2. Cidade
    const cidade = this.buscarCidadeNoPonto(x, z);
    if (cidade) {
      this.estradas.atualizarHoverEstrada(-99999, -99999);
      const cidLayout = this.layoutAtual?.cidadesPorProjetoId.get(cidade.id);
      const info: InfoHoverMapa = {
        tipo: 'cidade',
        titulo: cidade.nome,
        subtitulo: `Cidade Nível ${cidLayout?.nivel ?? 1}`,
        receitaOuVolumeCentavos: cidLayout?.receitaMensalCentavos ?? 0,
        nomesProdutos: [],
        projetoId: cidade.id,
      };
      this.aoHoverElementoMapa?.(info);
      return info;
    }

    // 3. Estrada (realça os dois extremos e mostra volume mensal e produtos)
    const infoEstrada = this.estradas.atualizarHoverEstrada(x, z);
    if (infoEstrada) {
      const nomesProds: string[] = [];
      for (const pid of infoEstrada.produtoIds) {
        const l = this.lojasAtuais.find((lj) => lj.produtoId === pid);
        if (l?.nomeProduto) nomesProds.push(l.nomeProduto);
      }
      const pOrigem = this.projetosPorId.get(infoEstrada.origemId)?.nome ?? 'Metrópole Central';
      const pDestino =
        this.projetosPorId.get(infoEstrada.destinoId)?.nome ?? 'Metrópole Central';

      const info: InfoHoverMapa = {
        tipo: 'estrada',
        titulo: `${pOrigem} ↔ ${pDestino}`,
        subtitulo:
          infoEstrada.tipo === 'trilha'
            ? 'Trilha Cidade a Cidade'
            : infoEstrada.tipo === 'tronco'
              ? 'Avenida do Setor'
              : 'Ramal Comercial',
        receitaOuVolumeCentavos: infoEstrada.volumeMensal,
        nomesProdutos: nomesProds,
        estrada: infoEstrada,
      };
      this.aoHoverElementoMapa?.(info);
      return info;
    }

    this.aoHoverElementoMapa?.(null);
    return null;
  }

  private iniciarLoop(): void {
    const animar = (_tempo: number): void => {
      if (this.destruido) return;
      this.quadroAnimacaoId = window.requestAnimationFrame(animar);

      if (
        this.container.offsetWidth === 0 ||
        this.container.offsetHeight === 0 ||
        this.container.style.display === 'none'
      ) {
        return;
      }

      const tInicioRender = performance.now();
      const delta = Math.min(0.1, this.relogio.getDelta());

      // Suavização exponencial do zoom ao cursor (constante de tempo ~120 ms - Seção 3.2)
      if (this.zoomSuave) {
        const tauSeg = LAYOUT_PADRAO.zoomConstanteTempoSuavizacaoMs / 1000;
        const alpha = 1 - Math.exp(-Math.max(0.016, delta) / tauSeg);
        const logAtual = Math.log(Math.max(1, this.distanciaCamera));
        const logAlvo = Math.log(Math.max(1, this.zoomSuave.distanciaAlvo));
        const novaDist = Math.exp(logAtual + (logAlvo - logAtual) * alpha);

        this.definirDistanciaAncoradaNoCursor(
          novaDist,
          this.zoomSuave.clientX,
          this.zoomSuave.clientY,
          this.zoomSuave.pontoMundoAncora
        );

        if (Math.abs(novaDist - this.zoomSuave.distanciaAlvo) < 0.25) {
          this.definirDistanciaAncoradaNoCursor(
            this.zoomSuave.distanciaAlvo,
            this.zoomSuave.clientX,
            this.zoomSuave.clientY,
            this.zoomSuave.pontoMundoAncora
          );
          this.zoomSuave = null;
        }
      }

      // Inércia curta do pan após soltar o botão esquerdo
      if (
        this.modoOperacao === 'nenhum' &&
        (Math.abs(this.velocidadePan.vx) > 0.4 || Math.abs(this.velocidadePan.vz) > 0.4)
      ) {
        this.alvoCamera.x += this.velocidadePan.vx * delta;
        this.alvoCamera.z += this.velocidadePan.vz * delta;
        const decaimento = Math.exp(-LAYOUT_PADRAO.panAmortecimentoInercia * delta);
        this.velocidadePan.vx *= decaimento;
        this.velocidadePan.vz *= decaimento;
        this.limitarAlvoDentroDoMundo();
        this.atualizarPosicaoCamera();
      }

      this.tempoAnimacaoTotal += delta;
      this.atmosfera.animarQuadro(delta);
      if (this.propsMercado) {
        this.propsMercado.sistemaPoeiraRua.rotation.y += delta * 0.04;
      }
      this.luzAtmosfera?.ajustarSombraTexelSnapping(
        this.alvoCamera,
        this.distanciaCamera,
        this.qualidadeEfetiva
      );
      this.estradas.animarTransicoes(tInicioRender);
      this.npcsFluxo.atualizarMatrizesQuadro(delta, this.distanciaCamera);
      this.renderizador?.render(this.cena, this.camera);

      const duracaoRender = performance.now() - tInicioRender;
      if (this.renderizador && this.monitorDpr) {
        const dprTeto = LAYOUT_PADRAO.perfisQualidade[this.qualidadeEfetiva].dprMaximo;
        this.monitorDpr.atualizarDprAdaptativo(
          this.renderizador,
          duracaoRender,
          dprTeto
        );
      }
      this.historicoQuadros.push(duracaoRender);
      if (this.historicoQuadros.length > 120) {
        this.historicoQuadros.shift();
      }
    };
    this.quadroAnimacaoId = window.requestAnimationFrame(animar);
  }

  public async medirFps(
    duracaoMs = 500,
    moverCamera = true
  ): Promise<MetricasDesempenhoMapa> {
    const alvoOriginalX = this.alvoCamera.x;
    const alvoOriginalZ = this.alvoCamera.z;
    const distOriginal = this.distanciaCamera;

    const amostras: number[] = [];
    const totalPassos = Math.max(30, Math.min(90, Math.round(duracaoMs / 8)));

    for (let passo = 0; passo < totalPassos; passo++) {
      const t0 = performance.now();

      if (moverCamera) {
        const ang = (passo / totalPassos) * Math.PI * 2;
        this.alvoCamera.x = alvoOriginalX + Math.cos(ang) * 45;
        this.alvoCamera.z = alvoOriginalZ + Math.sin(ang) * 45;
        this.distanciaCamera = distOriginal + Math.sin(ang * 2) * 35;
        this.atualizarPosicaoCamera();
      }

      const delta = this.relogio.getDelta();
      this.tempoAnimacaoTotal += delta;
      this.atmosfera.animarQuadro(delta);
      if (this.propsMercado) {
        this.propsMercado.sistemaPoeiraRua.rotation.y += delta * 0.04;
      }
      this.npcsFluxo.atualizarMatrizesQuadro(delta || 0.016, this.distanciaCamera);
      this.renderizador?.render(this.cena, this.camera);

      const duracaoQuadro = performance.now() - t0;
      amostras.push(duracaoQuadro);

      if (
        this.qualidadeConfigurada === 'automatica' &&
        duracaoQuadro > 16.0 &&
        this.qualidadeEfetiva !== 'baixa'
      ) {
        this.qualidadeEfetiva = this.qualidadeEfetiva === 'alta' ? 'media' : 'baixa';
        this.renderizador?.setPixelRatio(1);
        this.vegetacaoLod.atualizarLodPorDistancia(
          this.camera.position,
          this.distanciaCamera,
          this.qualidadeEfetiva
        );
      }

      if (passo % 10 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    if (moverCamera) {
      this.alvoCamera.x = alvoOriginalX;
      this.alvoCamera.z = alvoOriginalZ;
      this.distanciaCamera = distOriginal;
      this.atualizarPosicaoCamera();
    }

    amostras.sort((a, b) => a - b);
    const p95Idx = Math.floor(amostras.length * 0.95);
    const p95TempoQuadroMs = Math.round((amostras[p95Idx] ?? 1.5) * 100) / 100;

    const mediaTempoMs =
      amostras.reduce((acc, v) => acc + v, 0) / Math.max(1, amostras.length);
    const fpsMedio =
      Math.round(Math.min(60, 1000 / Math.max(16.666, mediaTempoMs)) * 10) / 10;

    return {
      fpsMedio,
      p95TempoQuadroMs,
      totalInstancias: this.gradeEspacial.totalItens(),
      totalVerticesTerreno: this.malhaTerreno?.geometry.attributes.position?.count ?? 0,
      qualidadeEfetiva: this.qualidadeEfetiva,
      drawCallsRotas: this.estradas.obterTotalDrawCalls(),
      totalLojasVisiveis: this.lojasAtuais.length,
      totalNpcsAtivos: this.npcsFluxo.obterEstadoNpcs().totalNpcsAtivos,
    };
  }

  public destruir(): void {
    this.destruido = true;
    if (this.listenerTecladoWindow) {
      window.removeEventListener('keydown', this.listenerTecladoWindow);
      this.listenerTecladoWindow = null;
    }
    if (this.intervaloVooId !== null) {
      window.clearInterval(this.intervaloVooId);
      this.intervaloVooId = null;
    }
    if (this.quadroAnimacaoId !== null) {
      window.cancelAnimationFrame(this.quadroAnimacaoId);
    }
    this.cidadesInstanciadas.destruir();
    this.metropoleCentral.destruir();
    this.estradas.destruir();
    this.npcsFluxo.destruir();
    this.vegetacaoLod.destruir();
    this.atmosfera.destruir();

    this.malhaTerreno?.geometry.dispose();
    this.malhaTerreno?.material.dispose();
    if (this.malhaAguaRio) {
      this.malhaAguaRio.geometry.dispose();
      (this.malhaAguaRio.material as THREE.Material).dispose();
      this.malhaAguaRio = null;
    }
    this.renderizador?.dispose();
  }
}
