import * as THREE from 'three';
import {
  LAYOUT_PADRAO,
  calcularDistFitMapa,
  calcularDuracaoVooSegundos,
  calcularInclinacaoSuaveCameraGraus,
  obterNivelSemanticoCamera,
  obterRotuloNivelSemantico,
  type ConfigLayoutMapa,
  type NivelSemanticoCamera,
} from '../config/layout';
import type { Loja, Projeto, Setor } from '../domain';
import type { ResultadoLayoutMundo } from '../engine';

export interface EstadoPilhaCamera {
  alvoX: number;
  alvoZ: number;
  distancia: number;
  azimuteRad: number;
  elevacaoGraus: number;
}

export interface InfoHudEscalaCamera {
  nivelSemantico: NivelSemanticoCamera;
  rotuloNivel: string;
  distancia: number;
  distFit: number;
  razaoDistFit: number;
  anguloElevacaoGraus: number;
  anguloAzimuteGraus: number;
  unidadesBarraEscala: number;
  larguraPxBarraEscala: number;
  trilhaBreadcrumb: string[];
  trapezioMinimapa: ReadonlyArray< readonly [number, number] >;
}

/**
 * Calcula a barra de escala ideal (em unidades de mundo `u` e pixels de tela)
 * para a distância e largura de tela atuais (Seção 3.2).
 */
export function calcularBarraEscalaHud(
  distancia: number,
  fovGraus: number,
  larguraTelaPx: number
): { unidades: number; larguraPx: number } {
  const fovRad = (fovGraus * Math.PI) / 180;
  const larguraMundoVisivel = 2 * distancia * Math.tan(fovRad * 0.5);
  const pxPorUnidade = Math.max(0.05, larguraTelaPx / Math.max(1, larguraMundoVisivel));

  const degraus = [5, 10, 20, 50, 100, 200, 500, 1000];
  let melhorUnidades = 50;
  let melhorPx = 80;
  for (const u of degraus) {
    const px = u * pxPorUnidade;
    melhorUnidades = u;
    melhorPx = px;
    if (px >= 56 && px <= 140) {
      break;
    }
  }
  return {
    unidades: melhorUnidades,
    larguraPx: Math.max(44, Math.min(150, Math.round(melhorPx))),
  };
}

/**
 * Normaliza `deltaY` entre roda de mouse tradicional e gesto de pinça/trackpad (Seção 3.2).
 */
export function normalizarDeltaRoda(deltaY: number, deltaMode: number): number {
  let valor = deltaY;
  if (deltaMode === 1) {
    // DOM_DELTA_LINE
    valor *= 32;
  } else if (deltaMode === 2) {
    // DOM_DELTA_PAGE
    valor *= 320;
  }
  // Limita impulsos extremos mantendo proporcionalidade para trackpads suaves
  return Math.max(-2.5, Math.min(2.5, valor / 100));
}

/**
 * Constrói a trilha hierárquica de escala (Seção 3.2):
 * "Império > Setor Agricultura > Padaria do Zé > Loja Pão"
 */
export function construirTrilhaBreadcrumbCamera(
  nivel: NivelSemanticoCamera,
  alvoX: number,
  alvoZ: number,
  layout: ResultadoLayoutMundo | null,
  setores: readonly Setor[],
  projetos: readonly Projeto[],
  lojas: readonly Loja[]
): string[] {
  const trilha: string[] = ['Império'];
  if (nivel === 'imperio' || !layout) {
    return trilha;
  }

  const distCentro = Math.hypot(alvoX, alvoZ);
  let ang = Math.atan2(alvoZ, alvoX);
  if (ang < 0) ang += Math.PI * 2;

  const cunha = layout.cunhas.find(
    (c) => ang >= c.anguloInicioRad && ang <= c.anguloFimRad
  );
  const setor = setores.find((s) => s.id === cunha?.setorId);
  if (setor) {
    trilha.push(`Setor ${setor.nome}`);
  } else if (distCentro <= layout.metropole.raio * 1.15) {
    trilha.push('Metrópole Central');
  }

  if (nivel === 'setor') {
    return trilha;
  }

  // Nível Cidade ou Rua: verifica se estamos perto de uma loja na Metrópole ou de uma cidade
  if (distCentro <= layout.metropole.raio * 1.15) {
    let lojaMaisProxima: Loja | null = null;
    let menorDistLoja = Infinity;
    for (const l of lojas) {
      const d = Math.hypot((l.x ?? 0) - alvoX, (l.z ?? 0) - alvoZ);
      if (d < menorDistLoja) {
        menorDistLoja = d;
        lojaMaisProxima = l;
      }
    }
    if (lojaMaisProxima && menorDistLoja <= 55) {
      const proj = projetos.find((p) => p.id === lojaMaisProxima!.projetoId);
      if (proj) {
        trilha.push(proj.nome);
      } else {
        trilha.push('Metrópole Central');
      }
      if (nivel === 'rua' || menorDistLoja <= 28) {
        trilha.push(`Loja ${lojaMaisProxima.nomeProduto ?? lojaMaisProxima.produtoId}`);
      }
      return trilha;
    }
    if (!trilha.includes('Metrópole Central')) {
      trilha.push('Metrópole Central');
    }
    return trilha;
  }

  // Fora da metrópole: procura cidade mais próxima
  let cidadeMaisProxima: Projeto | null = null;
  let menorDistCid = Infinity;
  for (const p of projetos) {
    if (p.arquivadoEm !== null) continue;
    const cidLayout = layout.cidadesPorProjetoId.get(p.id);
    const cx = cidLayout ? cidLayout.x : p.x;
    const cz = cidLayout ? cidLayout.z : p.z;
    const d = Math.hypot(cx - alvoX, cz - alvoZ);
    if (d < menorDistCid) {
      menorDistCid = d;
      cidadeMaisProxima = p;
    }
  }

  if (cidadeMaisProxima && menorDistCid <= 160) {
    trilha.push(cidadeMaisProxima.nome);
    if (nivel === 'rua') {
      const lojaDoProj = lojas.find((l) => l.projetoId === cidadeMaisProxima!.id);
      if (lojaDoProj) {
        trilha.push(`Loja ${lojaDoProj.nomeProduto ?? lojaDoProj.produtoId}`);
      }
    }
  }

  return trilha;
}

/**
 * Calcula os 4 vértices do trapézio visível da câmera projetados no plano Y = 0 (Seção 3.2).
 */
export function calcularTrapezioFrustumNoChao(
  camera: THREE.PerspectiveCamera,
  alvoFallback: { x: number; z: number },
  raioMaximo: number
): ReadonlyArray<readonly [number, number]> {
  camera.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const planoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const cantosNdc: ReadonlyArray<readonly [number, number]> = [
    [-0.92, -0.92], // inferior esquerdo
    [0.92, -0.92], // inferior direito
    [0.92, 0.85], // superior direito
    [-0.92, 0.85], // superior esquerdo
  ];

  const pontos: Array<readonly [number, number]> = [];
  const tempVec = new THREE.Vector3();
  const limite = Math.max(300, raioMaximo * 1.35);

  for (const [nx, ny] of cantosNdc) {
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const intersecao = raycaster.ray.intersectPlane(planoChao, tempVec);
    if (intersecao) {
      const xClamp = Math.max(-limite, Math.min(limite, Math.round(intersecao.x * 10) / 10));
      const zClamp = Math.max(-limite, Math.min(limite, Math.round(intersecao.z * 10) / 10));
      pontos.push([xClamp, zClamp]);
    } else {
      // Se o raio superior apontar acima do horizonte em inclinação rasa, projeta no alcance máximo na direção horizontal do raio
      const dir = raycaster.ray.direction;
      const t = limite * 0.85;
      const xHoriz = Math.max(-limite, Math.min(limite, Math.round((camera.position.x + dir.x * t) * 10) / 10));
      const zHoriz = Math.max(-limite, Math.min(limite, Math.round((camera.position.z + dir.z * t) * 10) / 10));
      pontos.push([xHoriz, zHoriz]);
    }
  }

  if (pontos.length < 4) {
    return [
      [alvoFallback.x - 40, alvoFallback.z - 30],
      [alvoFallback.x + 40, alvoFallback.z - 30],
      [alvoFallback.x + 55, alvoFallback.z + 35],
      [alvoFallback.x - 55, alvoFallback.z + 35],
    ];
  }
  return pontos;
}

export {
  calcularDistFitMapa,
  calcularDuracaoVooSegundos,
  calcularInclinacaoSuaveCameraGraus,
  obterNivelSemanticoCamera,
  obterRotuloNivelSemantico,
  LAYOUT_PADRAO,
  type ConfigLayoutMapa,
  type NivelSemanticoCamera,
};
