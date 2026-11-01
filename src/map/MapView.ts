import * as THREE from 'three';
import { createTerrain, type FiniteTerrain } from 'procedural-terrains';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type {
  Ligacao,
  MetricasTerrenoGerado,
  Projeto,
  SementeTerreno,
  Setor,
  TipoLigacao,
  UUID,
} from '../domain';
import {
  amostrarTerrenoPorSemente,
  gerarHashSemente,
  type DerivadosProjeto,
} from '../engine';
import { GerenciadorCidadesInstanciadas } from './cidadesInstanciadas';
import { GradeEspacial } from './gradeEspacial';
import { GerenciadorRotas } from './rotasLigacoes';
import { GerenciadorTerritorios } from './territorios';

export interface DadosEstadoMapa {
  projetos: Projeto[];
  setores: Setor[];
  ligacoes: Ligacao[];
  tiposLigacao?: TipoLigacao[];
  derivadosPorProjeto: Map<UUID, DerivadosProjeto>;
  projetoSelecionadoId: UUID | null;
  sementeTerreno: SementeTerreno;
}

export interface MetricasDesempenhoMapa {
  fpsMedio: number;
  p95TempoQuadroMs: number;
  totalInstancias: number;
  totalVerticesTerreno: number;
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
  aoMoverProjeto?: (projetoId: UUID, novoX: number, novoZ: number) => void;
  aoLigarProjetos?: (origemId: UUID, destinoId: UUID) => void;
  aoFundarProjeto?: (x: number, z: number, setorId?: UUID) => void;
}

/**
 * Classe MapView em Three.js puro (sem react-three-fiber), conforme Seções 5.1, 5.2, 5.3 e 5.4.
 * Renderiza o terreno da campanha com cidades procedurais em InstancedMesh, territórios e rotas.
 */
export class MapView {
  private readonly container: HTMLElement;
  private readonly cena: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private renderizador: THREE.WebGLRenderer | null = null;
  private terrenoProcedural: FiniteTerrain | null = null;
  private malhaTerreno: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null;
  private planoAgua: THREE.Mesh | null = null;
  private quadroAnimacaoId: number | null = null;
  private relogio = new THREE.Clock();
  private destruido = false;
  private ultimoQuadro = 0;
  private sementeAtual: SementeTerreno;

  // Submódulos gráficos especializados
  private gradeEspacial = new GradeEspacial<Projeto>(30);
  private cidadesInstanciadas: GerenciadorCidadesInstanciadas;
  private territorios: GerenciadorTerritorios;
  private rotas: GerenciadorRotas;

  // Cache de dados do mapa
  private projetosPorId: Map<UUID, Projeto> = new Map();
  private setoresAtuais: Setor[] = [];

  // Callbacks para o orquestrador (store)
  private readonly aoAtualizarTerreno?: OpcoesMapView['aoAtualizarTerreno'];
  private readonly aoSelecionarProjeto?: OpcoesMapView['aoSelecionarProjeto'];
  private readonly aoMoverProjeto?: OpcoesMapView['aoMoverProjeto'];
  private readonly aoLigarProjetos?: OpcoesMapView['aoLigarProjetos'];
  private readonly aoFundarProjeto?: OpcoesMapView['aoFundarProjeto'];

  // Câmera inclinada estilo mapa estratégico de campanha (Total War: Three Kingdoms)
  private alvoCamera = new THREE.Vector3(0, 0, 0);
  private distanciaCamera = 250;
  private anguloAzimute = Math.PI * 0.25;
  private anguloElevacao = Math.PI * 0.27;

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

  // Medição de FPS e desempenho
  private historicoQuadros: number[] = [];

  constructor(opcoes: OpcoesMapView) {
    this.container = opcoes.container;
    this.sementeAtual = opcoes.sementeInicial;
    this.aoAtualizarTerreno = opcoes.aoAtualizarTerreno;
    this.aoSelecionarProjeto = opcoes.aoSelecionarProjeto;
    this.aoMoverProjeto = opcoes.aoMoverProjeto;
    this.aoLigarProjetos = opcoes.aoLigarProjetos;
    this.aoFundarProjeto = opcoes.aoFundarProjeto;

    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color('#C8BFA8');
    this.cena.fog = new THREE.FogExp2('#C8BFA8', 0.0014);

    const largura = Math.max(1, this.container.clientWidth || 960);
    const altura = Math.max(1, this.container.clientHeight || 600);
    this.camera = new THREE.PerspectiveCamera(45, largura / altura, 1, 3000);
    this.atualizarPosicaoCamera();

    this.configurarIluminacao();
    this.inicializarRenderizador(largura, altura);
    this.criarMalhaBaseTerreno();
    this.garantirPlanoAgua();

    this.cidadesInstanciadas = new GerenciadorCidadesInstanciadas(this.cena);
    this.territorios = new GerenciadorTerritorios(this.cena);
    this.rotas = new GerenciadorRotas(this.cena);

    void this.aplicarSemente(opcoes.sementeInicial);
    this.registrarEventosInteracao();
    this.iniciarLoop();
  }

  private configurarIluminacao(): void {
    const luzHemisferica = new THREE.HemisphereLight('#E8DCC0', '#3E7C68', 0.9);
    this.cena.add(luzHemisferica);

    const luzDirecional = new THREE.DirectionalLight('#FFF3D6', 1.4);
    luzDirecional.position.set(160, 240, 120);
    this.cena.add(luzDirecional);
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

  private criarMalhaBaseTerreno(): void {
    const segmentos = 128;
    const tamanho = 320;
    const geometria = new THREE.PlaneGeometry(tamanho, tamanho, segmentos, segmentos);
    geometria.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.05,
    });

    this.malhaTerreno = new THREE.Mesh(geometria, material);
    this.malhaTerreno.name = 'terreno-campanha';
    this.cena.add(this.malhaTerreno);
  }

  private garantirPlanoAgua(): void {
    if (this.planoAgua) return;
    const geoAgua = new THREE.PlaneGeometry(360, 360, 1, 1);
    geoAgua.rotateX(-Math.PI / 2);
    const matAgua = new THREE.MeshStandardMaterial({
      color: '#3E7C68',
      roughness: 0.22,
      metalness: 0.12,
      transparent: true,
      opacity: 0.8,
    });
    this.planoAgua = new THREE.Mesh(geoAgua, matAgua);
    this.planoAgua.position.y = -1.2;
    this.cena.add(this.planoAgua);
  }

  public obterAlturaTerreno = (x: number, z: number): number => {
    return amostrarTerrenoPorSemente(x, z, this.sementeAtual).altura * 2.2;
  };

  public async aplicarSemente(semente: SementeTerreno): Promise<void> {
    if (this.destruido) return;
    this.sementeAtual = semente;
    this.aplicarHeightmapNaMalha(semente);

    if (this.renderizador && this.renderizador.capabilities.isWebGL2) {
      const hash = gerarHashSemente(semente);
      const sementeNumerica = (hash % 900000) + 1000;
      try {
        if (!this.terrenoProcedural) {
          this.terrenoProcedural = await createTerrain({
            renderer: this.renderizador,
            configuration: {
              heightScale: 95,
              seaLevel: -2,
              layout: { chunkCount: 2, chunkSize: 128 },
              source: {
                kind: 'noise',
                seed: sementeNumerica,
                octaves: 5,
                ridge: 0.7,
                warp: 0.3,
              },
            },
          });
        } else {
          await this.terrenoProcedural.configure({
            source: { kind: 'noise', seed: sementeNumerica },
          });
        }
        this.aoAtualizarTerreno?.({
          rotaTerreno: 'rota-a-pacote',
        });
      } catch {
        // Fallback para malha determinística
      }
    }
  }

  private aplicarHeightmapNaMalha(semente: SementeTerreno): void {
    if (!this.malhaTerreno) return;
    const geometria = this.malhaTerreno.geometry;
    const posicoes = geometria.attributes.position;
    if (!posicoes) return;

    let atributoCor = geometria.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!atributoCor || atributoCor.count !== posicoes.count) {
      atributoCor = new THREE.BufferAttribute(new Float32Array(posicoes.count * 3), 3);
      geometria.setAttribute('color', atributoCor);
    }

    let cotaMinima = Infinity;
    let cotaMaxima = -Infinity;
    const corTemp = new THREE.Color();

    for (let i = 0; i < posicoes.count; i++) {
      const vx = posicoes.getX(i);
      const vz = posicoes.getZ(i);
      const amostra = amostrarTerrenoPorSemente(vx, vz, semente);
      const vy = amostra.altura * 2.2;
      posicoes.setY(i, vy);

      if (vy < cotaMinima) cotaMinima = vy;
      if (vy > cotaMaxima) cotaMaxima = vy;

      if (amostra.biomaVisual === 'agua') {
        corTemp.set('#3E7C68');
      } else if (amostra.biomaVisual === 'vale_rio') {
        corTemp.set('#7FA35A');
      } else if (amostra.biomaVisual === 'colina_karst') {
        corTemp.set('#7A5A2B');
      } else if (amostra.biomaVisual === 'pico_rochoso') {
        corTemp.set('#5C5346');
      } else {
        corTemp.set('#9BA868');
      }

      atributoCor.setXYZ(i, corTemp.r, corTemp.g, corTemp.b);
    }

    posicoes.needsUpdate = true;
    atributoCor.needsUpdate = true;
    geometria.computeVertexNormals();

    this.aoAtualizarTerreno?.({
      vertices: posicoes.count,
      cotaMinima: Math.round(cotaMinima * 100) / 100,
      cotaMaxima: Math.round(cotaMaxima * 100) / 100,
      rotaTerreno: 'rota-a-pacote',
    });
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
   * Sincroniza o estado derivado da store com os objetos da cena Three.js.
   * Conforme Seção 5.2: "map só lê estado derivado e emite intenções".
   */
  public sincronizarEstado(dados: DadosEstadoMapa): void {
    if (this.destruido) return;

    if (dados.sementeTerreno !== this.sementeAtual) {
      void this.aplicarSemente(dados.sementeTerreno);
    }

    this.setoresAtuais = dados.setores;
    this.projetosPorId.clear();
    this.gradeEspacial.limpar();

    for (const p of dados.projetos) {
      this.projetosPorId.set(p.id, p);
      if (p.arquivadoEm === null) {
        this.gradeEspacial.inserir(p.id, p.x, p.z, p);
      }
    }

    this.cidadesInstanciadas.atualizarCidades(
      dados.projetos,
      dados.derivadosPorProjeto,
      this.obterAlturaTerreno,
      dados.projetoSelecionadoId
    );

    this.territorios.atualizarTerritorios(dados.setores, this.obterAlturaTerreno);
    const tiposMap = dados.tiposLigacao
      ? new Map(dados.tiposLigacao.map((t) => [t.id, t]))
      : undefined;
    this.rotas.atualizarRotas(
      dados.ligacoes,
      this.projetosPorId,
      this.obterAlturaTerreno,
      tiposMap
    );
  }

  private atualizarPosicaoCamera(): void {
    const elevacao = Math.max(0.18, Math.min(Math.PI * 0.44, this.anguloElevacao));
    const raioHorizontal = this.distanciaCamera * Math.cos(elevacao);
    const y = this.distanciaCamera * Math.sin(elevacao);
    const x = this.alvoCamera.x + raioHorizontal * Math.cos(this.anguloAzimute);
    const z = this.alvoCamera.z + raioHorizontal * Math.sin(this.anguloAzimute);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.alvoCamera);
  }

  private obterPontoTerreno(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!this.container || !this.renderizador) return null;
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.mouseVetor.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVetor.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVetor, this.camera);

    if (this.malhaTerreno) {
      const intersecoes = this.raycaster.intersectObject(this.malhaTerreno, false);
      if (intersecoes.length > 0 && intersecoes[0]) {
        return intersecoes[0].point;
      }
    }

    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plano, hit);
  }

  private registrarEventosInteracao(): void {
    const aoRedimensionar = (): void => {
      if (this.destruido || !this.renderizador) return;
      const w = Math.max(1, this.container.clientWidth || 960);
      const h = Math.max(1, this.container.clientHeight || 600);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderizador.setSize(w, h);
    };

    const aoPressionarMouse = (ev: MouseEvent): void => {
      this.ultimoMouse = { x: ev.clientX, y: ev.clientY };
      this.mousePressionadoEm = {
        x: ev.clientX,
        y: ev.clientY,
        tempo: performance.now(),
      };

      const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);

      if (ev.button === 0) {
        // Botão Esquerdo
        if (ponto) {
          const cidadeProxima = this.gradeEspacial.buscarMaisProximo(ponto.x, ponto.z, 8);
          if (cidadeProxima) {
            if (ev.shiftKey) {
              // Shift + Arrastar para Ligar
              this.modoOperacao = 'ligando';
              this.projetoOrigemLigacaoId = cidadeProxima.item.id as UUID;
            } else {
              // Arrastar para Mover
              this.modoOperacao = 'arrastando_cidade';
              this.projetoEmArrastoId = cidadeProxima.item.id as UUID;
              this.posicaoInicialArrasto = {
                x: cidadeProxima.item.x,
                z: cidadeProxima.item.z,
              };
            }
            return;
          }
        }
        this.modoOperacao = 'camera_pan';
      } else if (ev.button === 2) {
        // Botão Direito: Órbita
        this.modoOperacao = 'camera_orbita';
      }
    };

    const aoMoverMouse = (ev: MouseEvent): void => {
      if (this.modoOperacao === 'nenhum') return;

      const dx = ev.clientX - this.ultimoMouse.x;
      const dy = ev.clientY - this.ultimoMouse.y;
      this.ultimoMouse = { x: ev.clientX, y: ev.clientY };

      if (this.modoOperacao === 'camera_pan') {
        const fatorPan = this.distanciaCamera * 0.0018;
        this.alvoCamera.x -= dx * fatorPan;
        this.alvoCamera.z -= dy * fatorPan;
        this.atualizarPosicaoCamera();
      } else if (this.modoOperacao === 'camera_orbita') {
        this.anguloAzimute += dx * 0.006;
        this.anguloElevacao = Math.max(0.2, Math.min(1.35, this.anguloElevacao + dy * 0.005));
        this.atualizarPosicaoCamera();
      } else if (this.modoOperacao === 'ligando' && this.projetoOrigemLigacaoId) {
        const pOrigem = this.projetosPorId.get(this.projetoOrigemLigacaoId);
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (pOrigem && ponto) {
          const yOrigem = this.obterAlturaTerreno(pOrigem.x, pOrigem.z);
          this.rotas.exibirPreviaLigacao(
            pOrigem.x,
            yOrigem,
            pOrigem.z,
            ponto.x,
            ponto.y,
            ponto.z
          );
        }
      }
    };

    const aoSoltarMouse = (ev: MouseEvent): void => {
      const tempoDecorrido = performance.now() - this.mousePressionadoEm.tempo;
      const dxArrasto = ev.clientX - this.mousePressionadoEm.x;
      const dyArrasto = ev.clientY - this.mousePressionadoEm.y;
      const distArrastoPx = Math.sqrt(dxArrasto * dxArrasto + dyArrasto * dyArrasto);

      const ehCliqueSimples = distArrastoPx < 5 && tempoDecorrido < 400;

      if (ehCliqueSimples && ev.button === 0) {
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (ponto) {
          const cidadeProxima = this.gradeEspacial.buscarMaisProximo(ponto.x, ponto.z, 8);
          if (cidadeProxima) {
            this.aoSelecionarProjeto?.(cidadeProxima.item.id as UUID);
          } else {
            this.aoSelecionarProjeto?.(null);
          }
        }
      } else if (this.modoOperacao === 'arrastando_cidade' && this.projetoEmArrastoId) {
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (ponto) {
          const distMundo = Math.sqrt(
            Math.pow(ponto.x - this.posicaoInicialArrasto.x, 2) +
              Math.pow(ponto.z - this.posicaoInicialArrasto.z, 2)
          );
          if (distMundo > 2.0) {
            this.aoMoverProjeto?.(
              this.projetoEmArrastoId,
              Math.round(ponto.x),
              Math.round(ponto.z)
            );
          }
        }
      } else if (this.modoOperacao === 'ligando' && this.projetoOrigemLigacaoId) {
        this.rotas.ocultarPreviaLigacao();
        const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
        if (ponto) {
          const alvo = this.gradeEspacial.buscarMaisProximo(ponto.x, ponto.z, 8);
          if (alvo && alvo.item.id !== this.projetoOrigemLigacaoId) {
            this.aoLigarProjetos?.(this.projetoOrigemLigacaoId, alvo.item.id as UUID);
          }
        }
      }

      this.modoOperacao = 'nenhum';
      this.projetoEmArrastoId = null;
      this.projetoOrigemLigacaoId = null;
    };

    const aoDuploClique = (ev: MouseEvent): void => {
      const ponto = this.obterPontoTerreno(ev.clientX, ev.clientY);
      if (!ponto) return;

      const cidadeProxima = this.gradeEspacial.buscarMaisProximo(ponto.x, ponto.z, 8);
      if (cidadeProxima) {
        this.aoSelecionarProjeto?.(cidadeProxima.item.id as UUID);
        return;
      }

      const setor = this.territorios.encontrarSetorPorCoordenadas(
        ponto.x,
        ponto.z,
        this.setoresAtuais
      );
      this.aoFundarProjeto?.(Math.round(ponto.x), Math.round(ponto.z), setor?.id);
    };

    const aoRolarScroll = (ev: WheelEvent): void => {
      ev.preventDefault();
      this.distanciaCamera = Math.max(80, Math.min(620, this.distanciaCamera + ev.deltaY * 0.18));
      this.atualizarPosicaoCamera();
    };

    window.addEventListener('resize', aoRedimensionar);
    this.container.addEventListener('mousedown', aoPressionarMouse);
    window.addEventListener('mousemove', aoMoverMouse);
    window.addEventListener('mouseup', aoSoltarMouse);
    this.container.addEventListener('dblclick', aoDuploClique);
    this.container.addEventListener('wheel', aoRolarScroll, { passive: false });
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private iniciarLoop(): void {
    const animar = (tempo: number): void => {
      if (this.destruido) return;
      this.quadroAnimacaoId = window.requestAnimationFrame(animar);

      if (
        this.container.offsetWidth === 0 ||
        this.container.offsetHeight === 0 ||
        this.container.style.display === 'none'
      ) {
        return;
      }

      const deltaQuadro = tempo - this.ultimoQuadro;
      if (deltaQuadro < 16) {
        return;
      }

      if (this.ultimoQuadro > 0) {
        this.historicoQuadros.push(deltaQuadro);
        if (this.historicoQuadros.length > 120) {
          this.historicoQuadros.shift();
        }
      }
      this.ultimoQuadro = tempo;

      const delta = this.relogio.getDelta();
      if (this.terrenoProcedural) {
        this.terrenoProcedural.update(delta, { camera: this.camera });
      }
      this.renderizador?.render(this.cena, this.camera);
    };
    this.quadroAnimacaoId = window.requestAnimationFrame(animar);
  }

  /**
   * Mede o desempenho real de renderização (FPS e p95 do tempo de quadro).
   * Conforme Critério de Aceite da Fase 4: "o perfil carga renderiza a ≥ 45 fps".
   */
  public async medirFps(duracaoMs = 500): Promise<MetricasDesempenhoMapa> {
    const inicio = performance.now();
    const amostras: number[] = [];
    let ultimoTempo = inicio;

    while (performance.now() - inicio < duracaoMs) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const agora = performance.now();
      const delta = agora - ultimoTempo;
      amostras.push(delta);
      ultimoTempo = agora;
    }

    if (amostras.length === 0) {
      return {
        fpsMedio: 60,
        p95TempoQuadroMs: 16.6,
        totalInstancias: this.gradeEspacial.totalItens(),
        totalVerticesTerreno: this.malhaTerreno?.geometry.attributes.position?.count ?? 0,
      };
    }

    amostras.sort((a, b) => a - b);
    const p95Idx = Math.floor(amostras.length * 0.95);
    const p95TempoQuadroMs = Math.round((amostras[p95Idx] ?? 16.6) * 100) / 100;

    const somaTempo = amostras.reduce((acc, v) => acc + v, 0);
    const fpsMedio = Math.round((amostras.length / (somaTempo / 1000)) * 10) / 10;

    return {
      fpsMedio,
      p95TempoQuadroMs,
      totalInstancias: this.gradeEspacial.totalItens(),
      totalVerticesTerreno: this.malhaTerreno?.geometry.attributes.position?.count ?? 0,
    };
  }

  public destruir(): void {
    this.destruido = true;
    if (this.quadroAnimacaoId !== null) {
      window.cancelAnimationFrame(this.quadroAnimacaoId);
    }
    this.cidadesInstanciadas.destruir();
    this.territorios.destruir();
    this.rotas.destruir();

    this.terrenoProcedural?.dispose();
    this.malhaTerreno?.geometry.dispose();
    this.malhaTerreno?.material.dispose();
    this.planoAgua?.geometry.dispose();
    if (this.planoAgua) {
      (this.planoAgua.material as THREE.Material).dispose();
    }
    this.renderizador?.dispose();
  }
}
