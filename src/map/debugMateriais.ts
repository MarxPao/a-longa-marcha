import * as THREE from 'three';
import { PALETA_MAPA } from '../config/layout';
import {
  construirGeometriasCidades,
  criarGeometriaGeneralTotalWar,
  type NivelMaturidadeVisual,
} from './cidadesGeometria';
import {
  garantirAtributoCorGeometria,
  obterMaterialEdificiosCampanha,
} from './materiaisAvancados';
import { RegistroModelosLoja } from './shopRegistry';
import { GerenciadorVegetacaoLOD } from './vegetacaoLod';

export interface ItemDebugMaterial {
  id: string;
  nome: string;
  geometria: THREE.BufferGeometry;
  escala: number;
}

export interface ResultadoLuminanciaModelo {
  id: string;
  nome: string;
  luminanciaMedia: number;
  pctPixelsAbaixo005: number;
  aprovado: boolean;
}

export interface OpcoesDebugMateriais {
  container: HTMLElement;
  ativarSombras?: boolean;
}

/**
 * Cena de auditoria de materiais ?debug=materials (Seção 2 - Passo Zero).
 * Renderiza todos os edifícios, muralhas, generais, lojas e árvores em 4 variantes:
 * 1. Material Final PBR (MeshStandardMaterial);
 * 2. Albedo Puro (MeshBasicMaterial com vertexColors);
 * 3. MeshNormalMaterial (auditoria de normais);
 * 4. Só Contorno (wireframe/edges).
 */
export class VisualizadorDebugMateriais {
  private readonly container: HTMLElement;
  private readonly cena: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderizador: THREE.WebGLRenderer;
  private animacaoId: number | null = null;
  private destruido = false;

  private readonly itens: ItemDebugMaterial[] = [];
  private readonly malhasPorItemEVariante: Array<{
    item: ItemDebugMaterial;
    variante: 'final' | 'albedo' | 'normal' | 'contorno';
    malha: THREE.Object3D;
  }> = [];

  constructor(opcoes: OpcoesDebugMateriais) {
    this.container = opcoes.container;
    const largura = Math.max(1, this.container.clientWidth || 1200);
    const altura = Math.max(1, this.container.clientHeight || 800);

    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color('#404040');

    this.camera = new THREE.PerspectiveCamera(40, largura / altura, 0.5, 2000);
    this.camera.position.set(0, 36, 92);
    this.camera.lookAt(0, 4, 0);

    this.renderizador = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderizador.setSize(largura, altura);
    this.renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderizador.outputColorSpace = THREE.SRGBColorSpace;
    this.renderizador.shadowMap.enabled = opcoes.ativarSombras ?? false;
    this.renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderizador.domElement.dataset.testid = 'canvas-debug-materials';

    this.container.innerHTML = '';
    this.container.appendChild(this.renderizador.domElement);

    this.montarChaoCinzaMedio();
    this.montarIluminacaoReal(opcoes.ativarSombras ?? false);
    this.coletarModelosDoMapa();
    this.construirGrid4Variantes();
    this.iniciarLoop();
    this.exporApiGlobal();
  }

  private montarChaoCinzaMedio(): void {
    // Chão cinza médio conforme especificação da Seção 2
    const geoChao = new THREE.PlaneGeometry(160, 320);
    geoChao.rotateX(-Math.PI / 2);
    const matChao = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x707070),
      roughness: 0.9,
      metalness: 0.0,
    });
    const chao = new THREE.Mesh(geoChao, matChao);
    chao.name = 'chao-cinza-medio-debug';
    chao.position.y = -0.05;
    chao.receiveShadow = true;
    this.cena.add(chao);
  }

  private montarIluminacaoReal(ativarSombras: boolean): void {
    // Luz hemisférica de preenchimento idêntica ao mapa
    const luzHemi = new THREE.HemisphereLight(
      PALETA_MAPA.pergaminho,
      PALETA_MAPA.bronze,
      1.1
    );
    this.cena.add(luzHemi);

    // Luz solar direcional idêntica ao mapa
    const luzSol = new THREE.DirectionalLight(PALETA_MAPA.luzSol, 1.45);
    luzSol.position.set(80, 140, 80);
    luzSol.castShadow = ativarSombras;
    if (ativarSombras) {
      luzSol.shadow.mapSize.width = 2048;
      luzSol.shadow.mapSize.height = 2048;
      luzSol.shadow.bias = -0.0002;
      luzSol.shadow.normalBias = 0.04;
    }
    this.cena.add(luzSol);
    this.cena.add(luzSol.target);
  }

  private coletarModelosDoMapa(): void {
    // 1. Cidades Nível 1 a 7 e Ruínas 0
    const geosCidades = construirGeometriasCidades();
    const niveis: NivelMaturidadeVisual[] = [1, 2, 3, 4, 5, 6, 7, 0];
    const nomesNivel: Record<NivelMaturidadeVisual, string> = {
      1: 'Nível 1 — Faísca',
      2: 'Nível 2 — Expedição',
      3: 'Nível 3 — Assentamento',
      4: 'Nível 4 — Vila',
      5: 'Nível 5 — Cidade',
      6: 'Nível 6 — Metrópole',
      7: 'Nível 7 — Legado',
      0: 'Nível 0 — Ruínas',
    };

    for (const n of niveis) {
      this.itens.push({
        id: `cidade-nivel-${n}`,
        nome: nomesNivel[n],
        geometria: geosCidades[n],
        escala: n >= 5 ? 0.75 : n >= 3 ? 0.9 : 1.0,
      });
    }

    // 2. General Han de Campanha
    this.itens.push({
      id: 'general-han',
      nome: 'General Han de Campanha',
      geometria: criarGeometriaGeneralTotalWar(),
      escala: 1.25,
    });

    // 3. Lojas Típicas da Metrópole (ShopRegistry)
    const registry = new RegistroModelosLoja();
    const lojas = ['padaria', 'ferraria', 'laboratorio_alquimista', 'taverna'];
    for (const k of lojas) {
      const def = registry.obter(k);
      if (def) {
        this.itens.push({
          id: `loja-${k}`,
          nome: `Loja ${def.titulo}`,
          geometria: def.geometria,
          escala: 0.85,
        });
      }
    }

    // 4. Vegetação de Outono (LOD0)
    const vegMgr = new GerenciadorVegetacaoLOD(this.cena);
    const geoArvore = (vegMgr as unknown as { criarGeometriaPinheiroAlta: () => THREE.BufferGeometry })
      .criarGeometriaPinheiroAlta();
    vegMgr.destruir();
    this.itens.push({
      id: 'arvore-outono',
      nome: 'Pinheiro Outonal (LOD0)',
      geometria: geoArvore,
      escala: 1.8,
    });
  }

  private construirGrid4Variantes(): void {
    const matFinal = obterMaterialEdificiosCampanha();
    const matAlbedo = new THREE.MeshBasicMaterial({ vertexColors: true });
    const matNormal = new THREE.MeshNormalMaterial();
    const matContorno = new THREE.MeshBasicMaterial({
      color: 0x1f1b16,
      wireframe: true,
    });

    // Posições X das 4 colunas
    const colunas: Array<{
      variante: 'final' | 'albedo' | 'normal' | 'contorno';
      x: number;
      mat: THREE.Material;
    }> = [
      { variante: 'final', x: -36, mat: matFinal },
      { variante: 'albedo', x: -12, mat: matAlbedo },
      { variante: 'normal', x: 12, mat: matNormal },
      { variante: 'contorno', x: 36, mat: matContorno },
    ];

    const espacamentoZ = 16;
    const zInicial = -((this.itens.length - 1) * espacamentoZ) * 0.5;

    for (let r = 0; r < this.itens.length; r++) {
      const item = this.itens[r]!;
      const z = zInicial + r * espacamentoZ;
      garantirAtributoCorGeometria(item.geometria);

      for (const col of colunas) {
        const mesh = new THREE.Mesh(item.geometria, col.mat);
        mesh.position.set(col.x, 0, z);
        mesh.scale.set(item.escala, item.escala, item.escala);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `debug-${item.id}-${col.variante}`;
        this.cena.add(mesh);

        this.malhasPorItemEVariante.push({
          item,
          variante: col.variante,
          malha: mesh,
        });
      }
    }
  }

  private iniciarLoop(): void {
    const animar = (): void => {
      if (this.destruido) return;
      this.animacaoId = window.requestAnimationFrame(animar);
      this.renderizador.render(this.cena, this.camera);
    };
    this.animacaoId = window.requestAnimationFrame(animar);
  }

  /**
   * Avalia a luminância dentro da silhueta dos modelos para auditoria automática (Seção 2 - Passo Zero).
   * Critério: Luminância média >= 0.25 e no máximo 2% dos pixels abaixo de 0.05 (sem faces pretas).
   */
  public auditarLuminanciaModelos(): ResultadoLuminanciaModelo[] {
    const gl = this.renderizador.getContext();
    const largura = gl.drawingBufferWidth;
    const altura = gl.drawingBufferHeight;

    const modelosFinais = this.malhasPorItemEVariante.filter(
      (m) => m.variante === 'final'
    );

    const resultados: ResultadoLuminanciaModelo[] = [];
    const pixels = new Uint8Array(largura * altura * 4);

    // Salva pose da câmera original
    const posOriginal = this.camera.position.clone();
    const rotOriginal = this.camera.rotation.clone();

    for (const m of modelosFinais) {
      // Posiciona a câmera diretamente enquadrando o modelo a curta distância
      const centroY = m.malha.position.y + 2.0;
      this.camera.position.set(m.malha.position.x, centroY + 2.5, m.malha.position.z + 9.0);
      this.camera.lookAt(m.malha.position.x, centroY, m.malha.position.z);
      this.camera.updateMatrixWorld(true);

      // Renderiza com luz real
      this.renderizador.render(this.cena, this.camera);
      gl.readPixels(0, 0, largura, altura, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Amostra uma janela central de 32x32 pixels
      const cx = Math.floor(largura / 2);
      const cy = Math.floor(altura / 2);
      const raio = 16;

      let somaLum = 0;
      let count = 0;
      let pretos = 0;

      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (px < 0 || px >= largura || py < 0 || py >= altura) continue;

          const idx = (py * largura + px) * 4;
          const r = pixels[idx]! / 255;
          const g = pixels[idx + 1]! / 255;
          const b = pixels[idx + 2]! / 255;

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          somaLum += lum;
          count++;

          if (lum < 0.05) {
            pretos++;
          }
        }
      }

      const media = count > 0 ? somaLum / count : 0;
      const pctPreto = count > 0 ? pretos / count : 0;
      const passou = media >= 0.25 && pctPreto <= 0.02;

      resultados.push({
        id: m.item.id,
        nome: m.item.nome,
        luminanciaMedia: Math.round(media * 1000) / 1000,
        pctPixelsAbaixo005: Math.round(pctPreto * 1000) / 1000,
        aprovado: passou,
      });
    }

    // Restaura câmera original
    this.camera.position.copy(posOriginal);
    this.camera.rotation.copy(rotOriginal);
    this.camera.updateMatrixWorld(true);
    this.renderizador.render(this.cena, this.camera);

    return resultados;
  }

  private exporApiGlobal(): void {
    if (typeof window === 'undefined') return;
    (window as unknown as {
      __DEBUG_MATERIALS__: {
        obterStatus: () => { pronto: boolean; totalItens: number };
        auditarLuminancia: () => ResultadoLuminanciaModelo[];
      };
    }).__DEBUG_MATERIALS__ = {
      obterStatus: () => ({
        pronto: true,
        totalItens: this.itens.length,
      }),
      auditarLuminancia: () => this.auditarLuminanciaModelos(),
    };
  }

  public moverCameraParaItem(indice: number): void {
    const item = this.itens[indice];
    if (!item) return;
    const malha = this.malhasPorItemEVariante.find((m) => m.item.id === item.id);
    if (!malha) return;

    this.camera.position.set(0, 18, malha.malha.position.z + 32);
    this.camera.lookAt(0, malha.malha.position.y + 2, malha.malha.position.z);
  }

  public destruir(): void {
    this.destruido = true;
    if (this.animacaoId !== null) {
      window.cancelAnimationFrame(this.animacaoId);
    }
    this.renderizador.dispose();
  }
}
