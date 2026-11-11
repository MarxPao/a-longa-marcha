import * as THREE from 'three';
import { PALETA_MAPA } from '../config/layout';
import {
  criarArmazemLongo,
  criarBarracaMercado,
  criarCasaTaipaPalha,
  criarCeleiroElevado,
  criarMoinhoAgua,
  criarMuralhaModular,
  criarPortaoModular,
  criarPorticoComercial,
} from './arquiteturaModular';
import {
  criarTexturaPavimentoRuas,
  garantirAtributoCorGeometria,
  obterMaterialEdificiosCampanha,
} from './materiaisAvancados';

export type ModoVisualizacaoH2 =
  | 'setor-agricultura'
  | 'cidade-agricultura'
  | 'rua-agricultura'
  | 'setor-comercio'
  | 'cidade-comercio'
  | 'rua-comercio'
  | 'galeria-modelos';

export interface InfoModeloH2 {
  id: string;
  nome: string;
  setor: 'agricultura' | 'comercio' | 'defensivo';
  tipo: string;
  variante: number;
  geometria: THREE.BufferGeometry;
}

export interface OpcoesFatiaVerticalH2 {
  container: HTMLElement;
  ativarSombras?: boolean;
}

export class VisualizadorFatiaVerticalH2 {
  private readonly container: HTMLElement;
  private readonly cena: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderizador: THREE.WebGLRenderer;
  private animacaoId: number | null = null;
  private destruido = false;

  private readonly materialEdificios: THREE.MeshStandardMaterial;
  private matPlat: THREE.MeshStandardMaterial | null = null;
  private readonly modelosH2: InfoModeloH2[] = [];
  private readonly malhasInstanciadasOuMesh: THREE.Object3D[] = [];

  private visualizacaoAtual: ModoVisualizacaoH2 = 'setor-agricultura';

  constructor(opcoes: OpcoesFatiaVerticalH2) {
    this.container = opcoes.container;
    const largura = Math.max(1, this.container.clientWidth || 1440);
    const altura = Math.max(1, this.container.clientHeight || 900);

    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color('#2C2824');
    this.cena.fog = new THREE.FogExp2('#2C2824', 0.0035);

    this.camera = new THREE.PerspectiveCamera(42, largura / altura, 0.5, 1200);

    this.renderizador = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderizador.setSize(largura, altura);
    this.renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderizador.outputColorSpace = THREE.SRGBColorSpace;
    this.renderizador.shadowMap.enabled = opcoes.ativarSombras ?? true;
    this.renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderizador.domElement.dataset.testid = 'canvas-fatia-vertical-h2';

    this.container.innerHTML = '';
    this.container.appendChild(this.renderizador.domElement);

    this.materialEdificios = obterMaterialEdificiosCampanha();

    this.montarIluminacao(opcoes.ativarSombras ?? true);
    this.montarTerrenoEAssentamentos();
    this.coletar38ModelosGaleria();
    this.montarGaleriaExposicao();
    this.definirVisualizacao('setor-agricultura');
    this.iniciarLoop();
    this.exporApiGlobal();
  }

  private montarIluminacao(ativarSombras: boolean): void {
    const luzHemi = new THREE.HemisphereLight(
      PALETA_MAPA.pergaminho,
      PALETA_MAPA.bronze,
      1.15
    );
    this.cena.add(luzHemi);

    const luzSol = new THREE.DirectionalLight(PALETA_MAPA.luzSol, 1.45);
    luzSol.position.set(70, 110, 60);
    luzSol.castShadow = ativarSombras;
    if (ativarSombras) {
      luzSol.shadow.mapSize.width = 2048;
      luzSol.shadow.mapSize.height = 2048;
      luzSol.shadow.bias = -0.0002;
      luzSol.shadow.normalBias = 0.04;
      luzSol.shadow.camera.near = 10;
      luzSol.shadow.camera.far = 400;
      const d = 120;
      luzSol.shadow.camera.left = -d;
      luzSol.shadow.camera.right = d;
      luzSol.shadow.camera.top = d;
      luzSol.shadow.camera.bottom = -d;
    }
    this.cena.add(luzSol);
    this.cena.add(luzSol.target);
  }

  private montarTerrenoEAssentamentos(): void {
    // 1. Chão principal (Plano com terra e pasto estilo Three Kingdoms)
    const geoChao = new THREE.PlaneGeometry(360, 360, 32, 32);
    geoChao.rotateX(-Math.PI / 2);
    const texChao = criarTexturaPavimentoRuas(512);
    texChao.repeat.set(16, 16);
    const matChao = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.terraClara,
      roughness: 0.92,
      metalness: 0.04,
      map: texChao,
      roughnessMap: texChao,
    });
    const chao = new THREE.Mesh(geoChao, matChao);
    chao.name = 'chao-geral-fatia-vertical';
    chao.position.y = -0.02;
    chao.receiveShadow = true;
    this.cena.add(chao);

    // 2. Assentamento de AGRICULTURA (Centralizado em X = -75, Z = 0)
    this.montarAssentamentoAgricultura(-75, 0);

    // 3. Assentamento de COMÉRCIO (Centralizado em X = 75, Z = 0)
    this.montarAssentamentoComercio(75, 0);
  }

  private montarAssentamentoAgricultura(origemX: number, origemZ: number): void {
    const grupoAgri = new THREE.Group();
    grupoAgri.name = 'grupo-assentamento-agricultura';
    grupoAgri.position.set(origemX, 0, origemZ);

    // Zona de campos agrícolas retangulares de arrozal com cor verde-jade
    const geoCampos = new THREE.PlaneGeometry(110, 90);
    geoCampos.rotateX(-Math.PI / 2);
    const matCampos = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.jade,
      roughness: 0.88,
      metalness: 0.02,
    });
    const malhaCampos = new THREE.Mesh(geoCampos, matCampos);
    malhaCampos.position.y = 0.02;
    malhaCampos.receiveShadow = true;
    grupoAgri.add(malhaCampos);

    // Canal d'água para o moinho
    const geoCanal = new THREE.PlaneGeometry(8, 70);
    geoCanal.rotateX(-Math.PI / 2);
    const matCanal = new THREE.MeshStandardMaterial({
      color: '#345568',
      roughness: 0.15,
      metalness: 0.35,
    });
    const malhaCanal = new THREE.Mesh(geoCanal, matCanal);
    malhaCanal.position.set(-18, 0.05, 0);
    grupoAgri.add(malhaCanal);

    // Caminho de terra batida
    const geoEstrada = new THREE.PlaneGeometry(6, 60);
    geoEstrada.rotateX(-Math.PI / 2);
    const matEstrada = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.bronze,
      roughness: 0.9,
    });
    const malhaEstrada = new THREE.Mesh(geoEstrada, matEstrada);
    malhaEstrada.position.set(0, 0.04, 0);
    grupoAgri.add(malhaEstrada);

    // Modelos do Kit de Agricultura posicionados:
    // a) Moinho d'Água (variante 0 e 1 ao lado do canal)
    const moinho1 = new THREE.Mesh(criarMoinhoAgua(0, 1.25), this.materialEdificios);
    moinho1.position.set(-18, 0, -10);
    moinho1.rotation.y = Math.PI * 0.5;
    moinho1.castShadow = true;
    moinho1.receiveShadow = true;
    grupoAgri.add(moinho1);

    const moinho2 = new THREE.Mesh(criarMoinhoAgua(1, 1.1), this.materialEdificios);
    moinho2.position.set(-18, 0, 18);
    moinho2.rotation.y = Math.PI * 0.5;
    moinho2.castShadow = true;
    moinho2.receiveShadow = true;
    grupoAgri.add(moinho2);

    // b) Celeiros Elevados sobre Estacas (variantes 0, 1, 2)
    const celeiro1 = new THREE.Mesh(criarCeleiroElevado(0, 1.2), this.materialEdificios);
    celeiro1.position.set(-2, 0, -18);
    celeiro1.castShadow = true;
    celeiro1.receiveShadow = true;
    grupoAgri.add(celeiro1);

    const celeiro2 = new THREE.Mesh(criarCeleiroElevado(1, 1.15), this.materialEdificios);
    celeiro2.position.set(16, 0, -18);
    celeiro2.castShadow = true;
    celeiro2.receiveShadow = true;
    grupoAgri.add(celeiro2);

    const celeiro3 = new THREE.Mesh(criarCeleiroElevado(2, 1.1), this.materialEdificios);
    celeiro3.position.set(24, 0, 2);
    celeiro3.rotation.y = -Math.PI * 0.4;
    celeiro3.castShadow = true;
    celeiro3.receiveShadow = true;
    grupoAgri.add(celeiro3);

    // c) Casas de Taipa e Palha (variantes 0, 1, 2)
    const casa1 = new THREE.Mesh(criarCasaTaipaPalha(0, 1.2), this.materialEdificios);
    casa1.position.set(-2, 0, 16);
    casa1.castShadow = true;
    casa1.receiveShadow = true;
    grupoAgri.add(casa1);

    const casa2 = new THREE.Mesh(criarCasaTaipaPalha(1, 1.15), this.materialEdificios);
    casa2.position.set(15, 0, 18);
    casa2.rotation.y = -0.2;
    casa2.castShadow = true;
    casa2.receiveShadow = true;
    grupoAgri.add(casa2);

    const casa3 = new THREE.Mesh(criarCasaTaipaPalha(2, 1.1), this.materialEdificios);
    casa3.position.set(4, 0, 0);
    casa3.rotation.y = Math.PI * 0.5;
    casa3.castShadow = true;
    casa3.receiveShadow = true;
    grupoAgri.add(casa3);

    this.cena.add(grupoAgri);
  }

  private montarAssentamentoComercio(origemX: number, origemZ: number): void {
    const grupoCom = new THREE.Group();
    grupoCom.name = 'grupo-assentamento-comercio';
    grupoCom.position.set(origemX, 0, origemZ);

    // Calçamento pavimentado de pedra de cantaria para o distrito comercial
    const geoPraca = new THREE.PlaneGeometry(110, 90);
    geoPraca.rotateX(-Math.PI / 2);
    const texPav = criarTexturaPavimentoRuas(512);
    texPav.repeat.set(10, 8);
    const matPraca = new THREE.MeshStandardMaterial({
      color: PALETA_MAPA.pedraBase,
      roughness: 0.78,
      metalness: 0.06,
      map: texPav,
      roughnessMap: texPav,
    });
    const malhaPraca = new THREE.Mesh(geoPraca, matPraca);
    malhaPraca.position.y = 0.02;
    malhaPraca.receiveShadow = true;
    grupoCom.add(malhaPraca);

    // Linhas de contorno em laca e ouro delimitando a praça mercantil
    const geoFaixa = new THREE.RingGeometry(38, 40, 48);
    geoFaixa.rotateX(-Math.PI / 2);
    const matFaixa = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.ouro,
      side: THREE.DoubleSide,
    });
    const malhaFaixa = new THREE.Mesh(geoFaixa, matFaixa);
    malhaFaixa.position.y = 0.04;
    grupoCom.add(malhaFaixa);

    // 1. Defesa Perimetral: Muralhas Modulares e Portão Fortificado Han
    // Portão frontal de entrada comercial
    const portaoHan = new THREE.Mesh(criarPortaoModular(1.2), this.materialEdificios);
    portaoHan.position.set(0, 0, 32);
    portaoHan.castShadow = true;
    portaoHan.receiveShadow = true;
    grupoCom.add(portaoHan);

    // Segmentos de muralha modular ladeando o portão
    const compSegMuralha = 9.6;
    for (let s = -2; s <= 2; s++) {
      if (s === 0) continue; // vão do portão
      const seg = new THREE.Mesh(criarMuralhaModular(1.2), this.materialEdificios);
      seg.position.set(s * compSegMuralha, 0, 32);
      seg.castShadow = true;
      seg.receiveShadow = true;
      grupoCom.add(seg);
    }

    // Muralha lateral leste e oeste
    for (let z = 0; z < 3; z++) {
      const segEsq = new THREE.Mesh(criarMuralhaModular(1.2), this.materialEdificios);
      segEsq.position.set(-28, 0, 20 - z * compSegMuralha);
      segEsq.rotation.y = Math.PI * 0.5;
      segEsq.castShadow = true;
      segEsq.receiveShadow = true;
      grupoCom.add(segEsq);

      const segDir = new THREE.Mesh(criarMuralhaModular(1.2), this.materialEdificios);
      segDir.position.set(28, 0, 20 - z * compSegMuralha);
      segDir.rotation.y = Math.PI * 0.5;
      segDir.castShadow = true;
      segDir.receiveShadow = true;
      grupoCom.add(segDir);
    }

    // 2. Edifícios de Comércio dentro do pátio fortificado:
    // a) Armazéns Comerciais Longos (variantes 0, 1)
    const armazem1 = new THREE.Mesh(criarArmazemLongo(0, 1.2), this.materialEdificios);
    armazem1.position.set(-14, 0, -16);
    armazem1.castShadow = true;
    armazem1.receiveShadow = true;
    grupoCom.add(armazem1);

    const armazem2 = new THREE.Mesh(criarArmazemLongo(1, 1.15), this.materialEdificios);
    armazem2.position.set(14, 0, -16);
    armazem2.castShadow = true;
    armazem2.receiveShadow = true;
    grupoCom.add(armazem2);

    // b) Pórtico Comercial e Balcão de Câmbio (variantes 0, 1)
    const portico1 = new THREE.Mesh(criarPorticoComercial(0, 1.25), this.materialEdificios);
    portico1.position.set(0, 0, -2);
    portico1.castShadow = true;
    portico1.receiveShadow = true;
    grupoCom.add(portico1);

    const portico2 = new THREE.Mesh(criarPorticoComercial(1, 1.15), this.materialEdificios);
    portico2.position.set(-15, 0, 10);
    portico2.rotation.y = Math.PI * 0.5;
    portico2.castShadow = true;
    portico2.receiveShadow = true;
    grupoCom.add(portico2);

    // c) Barracas de Mercado / Feira (variantes 0, 1, 2)
    const barraca1 = new THREE.Mesh(criarBarracaMercado(0, 1.2), this.materialEdificios);
    barraca1.position.set(14, 0, 8);
    barraca1.rotation.y = -Math.PI * 0.45;
    barraca1.castShadow = true;
    barraca1.receiveShadow = true;
    grupoCom.add(barraca1);

    const barraca2 = new THREE.Mesh(criarBarracaMercado(1, 1.15), this.materialEdificios);
    barraca2.position.set(14, 0, 20);
    barraca2.rotation.y = -Math.PI * 0.5;
    barraca2.castShadow = true;
    barraca2.receiveShadow = true;
    grupoCom.add(barraca2);

    const barraca3 = new THREE.Mesh(criarBarracaMercado(2, 1.1), this.materialEdificios);
    barraca3.position.set(-14, 0, 20);
    barraca3.rotation.y = Math.PI * 0.5;
    barraca3.castShadow = true;
    barraca3.receiveShadow = true;
    grupoCom.add(barraca3);

    this.cena.add(grupoCom);
  }

  private coletar38ModelosGaleria(): void {
    // 1. Agricultura: 3 tipos x 6 variantes = 18 modelos
    for (let v = 0; v < 6; v++) {
      this.modelosH2.push({
        id: `agri-casa-v${v}`,
        nome: `Casa Taipa Palha (v${v})`,
        setor: 'agricultura',
        tipo: 'casa_taipa_palha',
        variante: v,
        geometria: criarCasaTaipaPalha(v, 1.0),
      });
      this.modelosH2.push({
        id: `agri-celeiro-v${v}`,
        nome: `Celeiro Elevado (v${v})`,
        setor: 'agricultura',
        tipo: 'celeiro_elevado',
        variante: v,
        geometria: criarCeleiroElevado(v, 1.0),
      });
      this.modelosH2.push({
        id: `agri-moinho-v${v}`,
        nome: `Moinho d'Água (v${v})`,
        setor: 'agricultura',
        tipo: 'moinho_agua',
        variante: v,
        geometria: criarMoinhoAgua(v, 1.0),
      });
    }

    // 2. Comércio: 3 tipos x 6 variantes = 18 modelos
    for (let v = 0; v < 6; v++) {
      this.modelosH2.push({
        id: `com-armazem-v${v}`,
        nome: `Armazém Longo (v${v})`,
        setor: 'comercio',
        tipo: 'armazem_longo',
        variante: v,
        geometria: criarArmazemLongo(v, 1.0),
      });
      this.modelosH2.push({
        id: `com-portico-v${v}`,
        nome: `Pórtico Comercial (v${v})`,
        setor: 'comercio',
        tipo: 'portico_comercial',
        variante: v,
        geometria: criarPorticoComercial(v, 1.0),
      });
      this.modelosH2.push({
        id: `com-barraca-v${v}`,
        nome: `Barraca de Feira (v${v})`,
        setor: 'comercio',
        tipo: 'barraca_mercado',
        variante: v,
        geometria: criarBarracaMercado(v, 1.0),
      });
    }

    // 3. Peças defensivas: 2 modelos
    this.modelosH2.push({
      id: `def-muralha`,
      nome: `Muralha Modular`,
      setor: 'defensivo',
      tipo: 'muralha',
      variante: 0,
      geometria: criarMuralhaModular(1.0),
    });
    this.modelosH2.push({
      id: `def-portao`,
      nome: `Portão Fortificado Han`,
      setor: 'defensivo',
      tipo: 'portao',
      variante: 0,
      geometria: criarPortaoModular(1.0),
    });
  }

  private montarGaleriaExposicao(): void {
    const grupoGaleria = new THREE.Group();
    grupoGaleria.name = 'grupo-galeria-38-modelos';
    grupoGaleria.position.set(0, 0, 110); // Posicionado ao sul

    // Plataforma da galeria
    const geoPlat = new THREE.PlaneGeometry(280, 80);
    geoPlat.rotateX(-Math.PI / 2);
    const matPlat = new THREE.MeshStandardMaterial({
      color: '#34302A',
      roughness: 0.85,
    });
    this.matPlat = matPlat;
    const plat = new THREE.Mesh(geoPlat, matPlat);
    plat.position.y = 0.05;
    plat.receiveShadow = true;
    grupoGaleria.add(plat);

    // Disposição em 4 fileiras de até 10 modelos
    const itensPorLinha = 10;
    const espacamentoX = 24;
    const espacamentoZ = 16;

    for (let i = 0; i < this.modelosH2.length; i++) {
      const mod = this.modelosH2[i]!;
      garantirAtributoCorGeometria(mod.geometria);

      const linha = Math.floor(i / itensPorLinha);
      const col = i % itensPorLinha;
      const x = (col - (itensPorLinha - 1) * 0.5) * espacamentoX;
      const z = (linha - 1.5) * espacamentoZ;

      // Pedestal para cada modelo
      const geoPedestal = new THREE.CylinderGeometry(5.2, 5.5, 0.4, 8);
      geoPedestal.translate(0, 0.2, 0);
      const matPed = new THREE.MeshStandardMaterial({
        color: mod.setor === 'agricultura' ? '#2F4F42' : mod.setor === 'comercio' ? '#5E2B25' : '#454037',
        roughness: 0.8,
      });
      const malhaPed = new THREE.Mesh(geoPedestal, matPed);
      malhaPed.position.set(x, 0, z);
      malhaPed.receiveShadow = true;
      grupoGaleria.add(malhaPed);

      // Modelo
      const mesh = new THREE.Mesh(mod.geometria, this.materialEdificios);
      mesh.position.set(x, 0.4, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `galeria-${mod.id}`;
      grupoGaleria.add(mesh);
      this.malhasInstanciadasOuMesh.push(mesh);
    }

    this.cena.add(grupoGaleria);
  }

  public definirVisualizacao(modo: ModoVisualizacaoH2): void {
    this.visualizacaoAtual = modo;

    switch (modo) {
      case 'setor-agricultura':
        // Visão aérea panorâmica do setor de Agricultura
        this.camera.position.set(-75, 42, 68);
        this.camera.lookAt(-75, 2, 0);
        break;

      case 'cidade-agricultura':
        // Visão média do cluster de edifícios agrícolas
        this.camera.position.set(-70, 22, 38);
        this.camera.lookAt(-75, 4, 0);
        break;

      case 'rua-agricultura':
        // Visão rés do chão próxima da casa de taipa, celeiro e moinho
        this.camera.position.set(-72, 4.5, 18);
        this.camera.lookAt(-75, 3.2, 0);
        break;

      case 'setor-comercio':
        // Visão aérea panorâmica do setor de Comércio com muralha e portão
        this.camera.position.set(75, 44, 76);
        this.camera.lookAt(75, 2, 4);
        break;

      case 'cidade-comercio':
        // Visão média focando o portão Han, praça mercantil e armazéns
        this.camera.position.set(75, 24, 46);
        this.camera.lookAt(75, 5, 6);
        break;

      case 'rua-comercio':
        // Visão rés do chão entrando pelo portão Han em direção à praça
        this.camera.position.set(75, 4.8, 38);
        this.camera.lookAt(75, 3.5, 6);
        break;

      case 'galeria-modelos':
        // Visão ampla da galeria com todos os 38 modelos
        this.camera.position.set(0, 48, 175);
        this.camera.lookAt(0, 2, 110);
        break;
    }

    this.camera.updateMatrixWorld(true);
  }

  public obterModoAtual(): ModoVisualizacaoH2 {
    return this.visualizacaoAtual;
  }

  public auditarModelosLuminancia(): Array<{
    id: string;
    nome: string;
    luminanciaMedia: number;
    pctPixelsAbaixo005: number;
    aprovado: boolean;
  }> {
    const gl = this.renderizador.getContext();
    const largura = gl.drawingBufferWidth;
    const altura = gl.drawingBufferHeight;
    const pixels = new Uint8Array(largura * altura * 4);

    const posOriginal = this.camera.position.clone();
    const rotOriginal = this.camera.rotation.clone();

    const resultados: Array<{
      id: string;
      nome: string;
      luminanciaMedia: number;
      pctPixelsAbaixo005: number;
      aprovado: boolean;
    }> = [];

    const bbox = new THREE.Box3();
    const centro = new THREE.Vector3();
    const tamanho = new THREE.Vector3();

    const bgOriginal = this.cena.background;
    this.cena.background = new THREE.Color(0x707070); // Chão e fundo cinza médio padrão da Seção 2
    this.matPlat?.color.setHex(0x707070);

    for (const mesh of this.malhasInstanciadasOuMesh) {
      mesh.updateMatrixWorld(true);
      bbox.setFromObject(mesh);
      bbox.getCenter(centro);
      bbox.getSize(tamanho);

      const raioVisual = Math.max(1.8, Math.max(tamanho.x, tamanho.y, tamanho.z) * 0.5);
      const dist = raioVisual * 1.5;
      const alvoY = mesh.name.includes('barraca')
        ? bbox.min.y + 0.85
        : bbox.min.y + tamanho.y * 0.48;
      this.camera.position.set(centro.x, alvoY + dist * 0.15, centro.z + dist);
      this.camera.lookAt(centro.x, alvoY, centro.z);
      this.camera.updateMatrixWorld(true);

      this.renderizador.render(this.cena, this.camera);
      gl.readPixels(0, 0, largura, altura, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      const cx = Math.floor(largura / 2);
      const cy = Math.floor(altura / 2);
      const raio = 24;
      let somaLum = 0;
      let count = 0;
      let pretos = 0;

      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (px < 0 || px >= largura || py < 0 || py >= altura) continue;
          const idx = (py * largura + px) * 4;
          const a = pixels[idx + 3]!;
          if (a === 0) continue; // Filtra pixels fora da silhueta (Seção 2 - Passo Zero)

          const r = pixels[idx]! / 255;
          const g = pixels[idx + 1]! / 255;
          const b = pixels[idx + 2]! / 255;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          somaLum += lum;
          count++;
          if (lum < 0.05) pretos++;
        }
      }

      const media = count > 0 ? somaLum / count : 0;
      const pctPreto = count > 0 ? pretos / count : 0;
      const passou = media >= 0.25 && pctPreto <= 0.02;

      resultados.push({
        id: mesh.name,
        nome: mesh.name,
        luminanciaMedia: Math.round(media * 1000) / 1000,
        pctPixelsAbaixo005: Math.round(pctPreto * 1000) / 1000,
        aprovado: passou,
      });
    }

    this.cena.background = bgOriginal;
    this.matPlat?.color.set('#34302A');
    this.camera.position.copy(posOriginal);
    this.camera.rotation.copy(rotOriginal);
    this.camera.updateMatrixWorld(true);
    this.renderizador.render(this.cena, this.camera);

    return resultados;
  }

  private iniciarLoop(): void {
    const animar = (): void => {
      if (this.destruido) return;
      this.animacaoId = window.requestAnimationFrame(animar);
      this.renderizador.render(this.cena, this.camera);
    };
    this.animacaoId = window.requestAnimationFrame(animar);
  }

  private exporApiGlobal(): void {
    if (typeof window === 'undefined') return;
    (window as unknown as {
      __FATIA_VERTICAL_H2__: {
        definirVisualizacao: (modo: ModoVisualizacaoH2) => void;
        obterModoAtual: () => ModoVisualizacaoH2;
        auditarModelos: () => Array<{
          id: string;
          nome: string;
          luminanciaMedia: number;
          pctPixelsAbaixo005: number;
          aprovado: boolean;
        }>;
        totalModelos: number;
      };
    }).__FATIA_VERTICAL_H2__ = {
      definirVisualizacao: (m) => this.definirVisualizacao(m),
      obterModoAtual: () => this.obterModoAtual(),
      auditarModelos: () => this.auditarModelosLuminancia(),
      totalModelos: this.modelosH2.length,
    };
  }

  public destruir(): void {
    this.destruido = true;
    if (this.animacaoId !== null) {
      window.cancelAnimationFrame(this.animacaoId);
    }
    for (const mod of this.modelosH2) {
      mod.geometria.dispose();
    }
    this.renderizador.dispose();
  }
}
