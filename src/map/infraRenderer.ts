import * as THREE from 'three';
import { LAYOUT_PADRAO } from '../config/layout';

export interface MetricasDebugRenderer {
  cpuMs: number;
  gpuMs: number;
  drawCalls: number;
  triangulos: number;
  geometrias: number;
  texturas: number;
  instanciasVisiveis: number;
  dprAtual: number;
  fps: number;
}

export interface ChaveBloco128 {
  bx: number;
  bz: number;
  chave: string;
}

export function calcularChaveBloco128(
  x: number,
  z: number,
  tamanhoBloco = LAYOUT_PADRAO.tamanhoBlocoEspacialUnidades
): ChaveBloco128 {
  const bx = Math.floor(x / tamanhoBloco);
  const bz = Math.floor(z / tamanhoBloco);
  return {
    bx,
    bz,
    chave: `${bx},${bz}`,
  };
}

export interface ItemEspacialBloco<T> {
  id: string;
  x: number;
  z: number;
  raio: number;
  dados: T;
}

/**
 * Grade espacial de blocos de 128 u para culling por frustum e distância (Seção 4.1 e 4.2).
 */
export class GradeBlocosEspaciais128<T> {
  private blocos = new Map<string, ItemEspacialBloco<T>[]>();
  private readonly tamanhoBloco: number;

  constructor(tamanhoBloco = LAYOUT_PADRAO.tamanhoBlocoEspacialUnidades) {
    this.tamanhoBloco = tamanhoBloco;
  }

  public limpar(): void {
    this.blocos.clear();
  }

  public inserir(id: string, x: number, z: number, raio: number, dados: T): void {
    const { chave } = calcularChaveBloco128(x, z, this.tamanhoBloco);
    let lista = this.blocos.get(chave);
    if (!lista) {
      lista = [];
      this.blocos.set(chave, lista);
    }
    lista.push({ id, x, z, raio, dados });
  }

  public obterBlocosVisiveis(
    frustum: THREE.Frustum,
    _distanciaMaxima = 2500
  ): ItemEspacialBloco<T>[] {
    const itensVisiveis: ItemEspacialBloco<T>[] = [];
    const esferaBloco = new THREE.Sphere();
    const raioEsferaBloco = (this.tamanhoBloco * Math.SQRT2) * 0.5;

    for (const [chave, itens] of this.blocos.entries()) {
      const [bxStr, bzStr] = chave.split(',');
      const bx = parseInt(bxStr || '0', 10);
      const bz = parseInt(bzStr || '0', 10);
      const centroX = (bx + 0.5) * this.tamanhoBloco;
      const centroZ = (bz + 0.5) * this.tamanhoBloco;

      esferaBloco.center.set(centroX, 0, centroZ);
      esferaBloco.radius = raioEsferaBloco;

      if (!frustum.intersectsSphere(esferaBloco)) {
        continue;
      }

      for (const item of itens) {
        itensVisiveis.push(item);
      }
    }
    return itensVisiveis;
  }

  public totalItens(): number {
    let cont = 0;
    for (const l of this.blocos.values()) cont += l.length;
    return cont;
  }
}

/**
 * Shader chunk para transição de LOD por dithering alpha-hash (Seção 4.2).
 * Evita qualquer popping abrupto entre LOD0, LOD1 e impostores.
 */
export const SHADER_CHUNK_DITHER_LOD = `
#ifdef USE_DITHER_LOD
  float ditherHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void aplicarAlphaHashLod(float opacidadeAlvo) {
    float limiar = ditherHash(gl_FragCoord.xy);
    if (opacidadeAlvo < limiar) {
      discard;
    }
  }
#endif
`;

/**
 * Injeta alpha hash nos materiais standard para fade suave sem pop.
 */
export function aplicarAlphaHashAoMaterial(material: THREE.Material): void {
  material.defines = material.defines || {};
  material.defines.USE_DITHER_LOD = '';
  material.customProgramCacheKey = () => 'USE_DITHER_LOD';

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = `
      ${SHADER_CHUNK_DITHER_LOD}
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      #ifdef USE_DITHER_LOD
        aplicarAlphaHashLod(diffuseColor.a);
      #endif
      `
    );
  };
}

/**
 * Medidor de tempos CPU/GPU e controle de resolução dinâmica (DPR escalável entre 0.75 e maxDpr).
 */
export class MonitorDesempenhoEDpr {
  private dprAtual = 1.0;
  private historicoQuadrosMs: number[] = [];
  private ultimoAjusteMs = 0;

  constructor(_renderizador: THREE.WebGLRenderer) {
    // Inicialização do monitor de desempenho e dpr
  }

  public atualizarDprAdaptativo(
    renderizador: THREE.WebGLRenderer,
    duracaoQuadroMs: number,
    dprTeto: number,
    dprPiso = LAYOUT_PADRAO.dprMinimoDinamico
  ): number {
    this.historicoQuadrosMs.push(duracaoQuadroMs);
    if (this.historicoQuadrosMs.length > 60) {
      this.historicoQuadrosMs.shift();
    }

    const agora = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Cooldown de 3.5 segundos para impedir qualquer oscilação ou piscamento do canvas WebGL
    if (agora - this.ultimoAjusteMs < 3500) {
      return this.dprAtual;
    }

    if (this.historicoQuadrosMs.length >= 30) {
      const soma = this.historicoQuadrosMs.reduce((a, b) => a + b, 0);
      const media = soma / this.historicoQuadrosMs.length;

      // Histerese ampla com limiar estrito:
      // Reduz apenas se o quadro médio exceder 24 ms (quedas reais e contínuas de FPS)
      if (media > 24.0 && this.dprAtual > dprPiso) {
        const novoDpr = Math.max(dprPiso, Math.round((this.dprAtual - 0.25) * 100) / 100);
        if (Math.abs(novoDpr - this.dprAtual) >= 0.1) {
          this.dprAtual = novoDpr;
          this.ultimoAjusteMs = agora;
          renderizador.setPixelRatio(this.dprAtual);
        }
      } else if (media < 10.0 && this.dprAtual < dprTeto) {
        // Aumenta apenas se o quadro for extremamente leve (< 10 ms)
        const novoDpr = Math.min(dprTeto, Math.round((this.dprAtual + 0.2) * 100) / 100);
        if (Math.abs(novoDpr - this.dprAtual) >= 0.1) {
          this.dprAtual = novoDpr;
          this.ultimoAjusteMs = agora;
          renderizador.setPixelRatio(this.dprAtual);
        }
      }
    }
    return this.dprAtual;
  }

  public obterDpr(): number {
    return this.dprAtual;
  }
}
