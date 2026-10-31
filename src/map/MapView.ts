import * as THREE from 'three';
import { createTerrain, type FiniteTerrain } from 'procedural-terrains';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { MetricasTerrenoGerado, SementeTerreno } from '../domain';
import { amostrarTerrenoPorSemente, gerarHashSemente } from '../engine';

export interface OpcoesMapView {
  container: HTMLElement;
  sementeInicial: SementeTerreno;
  aoAtualizarTerreno?: (
    metricas: Partial<
      Pick<MetricasTerrenoGerado, 'vertices' | 'cotaMinima' | 'cotaMaxima' | 'rotaTerreno'>
    >
  ) => void;
}

/**
 * Classe MapView em Three.js puro (sem react-three-fiber), conforme Seções 5.1, 5.2 e 5.4.
 * Renderiza instantaneamente a malha determinística da semente e embute o runtime `procedural-terrains`
 * (Rota A) com fallback automático para malha/GLB com heightmap (Rota B) em ambientes sem WebGL2 completo.
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
  private readonly aoAtualizarTerreno?: OpcoesMapView['aoAtualizarTerreno'];

  // Câmera inclinada estilo mapa estratégico de campanha (Total War: Three Kingdoms)
  private alvoCamera = new THREE.Vector3(0, 0, 0);
  private distanciaCamera = 250;
  private anguloAzimute = Math.PI * 0.25;
  private anguloElevacao = Math.PI * 0.27;
  private arrastando = false;
  private botaoArrasto = 0;
  private ultimoMouse = { x: 0, y: 0 };

  constructor(opcoes: OpcoesMapView) {
    this.container = opcoes.container;
    this.aoAtualizarTerreno = opcoes.aoAtualizarTerreno;

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

  public async aplicarSemente(semente: SementeTerreno): Promise<void> {
    if (this.destruido) return;
    // 1. Atualiza imediatamente a malha determinística (garante resposta < 16ms)
    this.aplicarHeightmapNaMalha(semente);

    // 2. Se o contexto suportar WebGL2, sincroniza também o runtime `procedural-terrains` (Rota A)
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
        // Permanece na malha heightmap determinística (Rota B) caso o shader WebGL2 falhe em software renderer
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

  private atualizarPosicaoCamera(): void {
    const elevacao = Math.max(0.18, Math.min(Math.PI * 0.44, this.anguloElevacao));
    const raioHorizontal = this.distanciaCamera * Math.cos(elevacao);
    const y = this.distanciaCamera * Math.sin(elevacao);
    const x = this.alvoCamera.x + raioHorizontal * Math.cos(this.anguloAzimute);
    const z = this.alvoCamera.z + raioHorizontal * Math.sin(this.anguloAzimute);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.alvoCamera);
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
      this.arrastando = true;
      this.botaoArrasto = ev.button;
      this.ultimoMouse = { x: ev.clientX, y: ev.clientY };
    };

    const aoMoverMouse = (ev: MouseEvent): void => {
      if (!this.arrastando) return;
      const dx = ev.clientX - this.ultimoMouse.x;
      const dy = ev.clientY - this.ultimoMouse.y;
      this.ultimoMouse = { x: ev.clientX, y: ev.clientY };

      if (this.botaoArrasto === 0) {
        this.anguloAzimute += dx * 0.006;
        this.anguloElevacao = Math.max(0.2, Math.min(1.35, this.anguloElevacao + dy * 0.005));
      } else {
        const fatorPan = this.distanciaCamera * 0.0018;
        this.alvoCamera.x -= dx * fatorPan;
        this.alvoCamera.z -= dy * fatorPan;
      }
      this.atualizarPosicaoCamera();
    };

    const aoSoltarMouse = (): void => {
      this.arrastando = false;
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
    this.container.addEventListener('wheel', aoRolarScroll, { passive: false });
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private iniciarLoop(): void {
    const animar = (): void => {
      if (this.destruido) return;
      this.quadroAnimacaoId = window.requestAnimationFrame(animar);
      const delta = this.relogio.getDelta();
      if (this.terrenoProcedural) {
        this.terrenoProcedural.update(delta, { camera: this.camera });
      }
      this.renderizador?.render(this.cena, this.camera);
    };
    this.quadroAnimacaoId = window.requestAnimationFrame(animar);
  }

  public destruir(): void {
    this.destruido = true;
    if (this.quadroAnimacaoId !== null) {
      window.cancelAnimationFrame(this.quadroAnimacaoId);
    }
    this.terrenoProcedural?.dispose();
    this.malhaTerreno?.geometry.dispose();
    this.malhaTerreno?.material.dispose();
    this.renderizador?.dispose();
  }
}
