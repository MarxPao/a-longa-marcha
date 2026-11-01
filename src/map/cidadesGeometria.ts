import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type NivelMaturidadeVisual = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 0;

/**
 * Criação procedural de telhados chineses curvados/abaulados (estilo Three Kingdoms).
 */
function criarTelhadoChines(
  larguraBase: number,
  altura: number,
  beiral: number,
  yPos: number
): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry((larguraBase + beiral) * 0.7, altura, 4);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, yPos + altura * 0.5, 0);
  return geo;
}

/**
 * Nível 1: Faísca — Tendas cônicas e fogueira central, sem muralhas.
 */
function criarGeometriaFaisca(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Tenda principal
  const tenda1 = new THREE.ConeGeometry(1.6, 2.4, 6);
  tenda1.translate(0, 1.2, 0);
  pecas.push(tenda1);

  // Tenda auxiliar
  const tenda2 = new THREE.ConeGeometry(1.1, 1.8, 6);
  tenda2.translate(-1.8, 0.9, 0.8);
  pecas.push(tenda2);

  // Fogueira (pedras / base)
  const fogueira = new THREE.CylinderGeometry(0.5, 0.6, 0.3, 6);
  fogueira.translate(1.5, 0.15, 1.2);
  pecas.push(fogueira);

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 2: Expedição — Paliçada de estacas de madeira e torre de vigia rústica.
 */
function criarGeometriaExpedicao(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Torre de vigia (4 pilares)
  const pilar1 = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 4);
  pilar1.translate(-0.8, 1.9, -0.8);
  const pilar2 = pilar1.clone().translate(1.6, 0, 0);
  const pilar3 = pilar1.clone().translate(0, 0, 1.6);
  const pilar4 = pilar1.clone().translate(1.6, 0, 1.6);
  pecas.push(pilar1, pilar2, pilar3, pilar4);

  // Plataforma da torre
  const plataforma = new THREE.BoxGeometry(2.0, 0.2, 2.0);
  plataforma.translate(0, 3.8, 0);
  pecas.push(plataforma);

  // Telhado da torre
  const telhado = criarTelhadoChines(2.0, 1.0, 0.6, 3.9);
  pecas.push(telhado);

  // Paliçada perimetral circular (estacas)
  const numEstacas = 12;
  const raio = 3.2;
  for (let i = 0; i < numEstacas; i++) {
    const ang = (i / numEstacas) * Math.PI * 2;
    if (i === 0) continue; // vão de entrada
    const estaca = new THREE.CylinderGeometry(0.15, 0.18, 1.5, 4);
    estaca.translate(Math.cos(ang) * raio, 0.75, Math.sin(ang) * raio);
    pecas.push(estaca);
  }

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 3: Assentamento — Muralha baixa, construções de apoio e mastro com bandeira.
 */
function criarGeometriaAssentamento(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Edifício principal
  const corpo = new THREE.BoxGeometry(2.4, 1.4, 2.0);
  corpo.translate(0, 0.7, 0);
  const telhadoCorpo = criarTelhadoChines(2.4, 1.0, 0.8, 1.4);
  pecas.push(corpo, telhadoCorpo);

  // Cabana anexa
  const anexo = new THREE.BoxGeometry(1.4, 1.0, 1.4);
  anexo.translate(-2.0, 0.5, 0.4);
  const telhadoAnexo = criarTelhadoChines(1.4, 0.8, 0.5, 1.0);
  telhadoAnexo.translate(-2.0, 0, 0.4);
  pecas.push(anexo, telhadoAnexo);

  // Muro baixo frontal
  const muroL = new THREE.BoxGeometry(1.6, 0.9, 0.4);
  muroL.translate(-1.8, 0.45, 2.2);
  const muroR = new THREE.BoxGeometry(1.6, 0.9, 0.4);
  muroR.translate(1.8, 0.45, 2.2);
  pecas.push(muroL, muroR);

  // Mastro de bandeira
  const mastro = new THREE.CylinderGeometry(0.08, 0.08, 3.6, 4);
  mastro.translate(1.8, 1.8, 1.8);
  const bandeira = new THREE.BoxGeometry(0.9, 0.5, 0.04);
  bandeira.translate(2.25, 3.2, 1.8);
  pecas.push(mastro, bandeira);

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 4: Vila — Muralha de pedra com baluartes e pagode central de 2 níveis.
 */
function criarGeometriaVila(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Pagode central - Andar 1
  const andar1 = new THREE.BoxGeometry(2.8, 1.6, 2.8);
  andar1.translate(0, 0.8, 0);
  const telhado1 = criarTelhadoChines(2.8, 1.0, 1.0, 1.6);

  // Pagode central - Andar 2
  const andar2 = new THREE.BoxGeometry(1.8, 1.4, 1.8);
  andar2.translate(0, 2.9, 0);
  const telhado2 = criarTelhadoChines(1.8, 1.2, 0.8, 3.6);

  pecas.push(andar1, telhado1, andar2, telhado2);

  // Muro de pedra perimetral quadrado com ameias
  const raioMuro = 4.0;
  const espessura = 0.5;
  const altMuro = 1.2;

  const muroN = new THREE.BoxGeometry(raioMuro * 2, altMuro, espessura);
  muroN.translate(0, altMuro * 0.5, -raioMuro);
  const muroS_L = new THREE.BoxGeometry(raioMuro - 0.8, altMuro, espessura);
  muroS_L.translate(-raioMuro * 0.5 - 0.4, altMuro * 0.5, raioMuro);
  const muroS_R = new THREE.BoxGeometry(raioMuro - 0.8, altMuro, espessura);
  muroS_R.translate(raioMuro * 0.5 + 0.4, altMuro * 0.5, raioMuro);

  const muroW = new THREE.BoxGeometry(espessura, altMuro, raioMuro * 2);
  muroW.translate(-raioMuro, altMuro * 0.5, 0);
  const muroE = new THREE.BoxGeometry(espessura, altMuro, raioMuro * 2);
  muroE.translate(raioMuro, altMuro * 0.5, 0);

  pecas.push(muroN, muroS_L, muroS_R, muroW, muroE);

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 5: Cidade — Muralha alta, portão imperial vermelho e múltiplos pagodes.
 */
function criarGeometriaCidade(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Pagode Central
  const b1 = new THREE.BoxGeometry(3.4, 1.8, 3.4);
  b1.translate(0, 0.9, -0.6);
  const t1 = criarTelhadoChines(3.4, 1.2, 1.2, 1.8);
  t1.translate(0, 0, -0.6);

  const b2 = new THREE.BoxGeometry(2.4, 1.5, 2.4);
  b2.translate(0, 3.2, -0.6);
  const t2 = criarTelhadoChines(2.4, 1.2, 1.0, 3.9);
  t2.translate(0, 0, -0.6);

  pecas.push(b1, t1, b2, t2);

  // Pagode lateral menor
  const bLat = new THREE.BoxGeometry(1.6, 1.4, 1.6);
  bLat.translate(-3.2, 0.7, -0.6);
  const tLat = criarTelhadoChines(1.6, 0.9, 0.6, 1.4);
  tLat.translate(-3.2, 0, -0.6);
  pecas.push(bLat, tLat);

  // Portão Vermelho Frontal com portal arqueado
  const pilarL = new THREE.BoxGeometry(0.6, 2.4, 0.8);
  pilarL.translate(-1.2, 1.2, 4.4);
  const pilarR = new THREE.BoxGeometry(0.6, 2.4, 0.8);
  pilarR.translate(1.2, 1.2, 4.4);
  const viga = new THREE.BoxGeometry(3.6, 0.6, 1.0);
  viga.translate(0, 2.6, 4.4);
  const telhadoPortao = criarTelhadoChines(3.6, 0.9, 0.8, 2.9);
  telhadoPortao.translate(0, 0, 4.4);
  pecas.push(pilarL, pilarR, viga, telhadoPortao);

  // Muralhas Altas
  const muroW = new THREE.BoxGeometry(0.6, 2.0, 9.0);
  muroW.translate(-4.5, 1.0, 0);
  const muroE = new THREE.BoxGeometry(0.6, 2.0, 9.0);
  muroE.translate(4.5, 1.0, 0);
  const muroN = new THREE.BoxGeometry(9.0, 2.0, 0.6);
  muroN.translate(0, 1.0, -4.5);
  pecas.push(muroW, muroE, muroN);

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 6: Metrópole — Muralha dupla, pagode nobre de 3 patamares com telhados abaulados.
 */
function criarGeometriaMetropole(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Torre Nobre Central de 3 Níveis
  const a1 = new THREE.BoxGeometry(4.2, 2.0, 4.2);
  a1.translate(0, 1.0, 0);
  const t1 = criarTelhadoChines(4.2, 1.4, 1.4, 2.0);

  const a2 = new THREE.BoxGeometry(3.0, 1.8, 3.0);
  a2.translate(0, 3.7, 0);
  const t2 = criarTelhadoChines(3.0, 1.3, 1.2, 4.6);

  const a3 = new THREE.BoxGeometry(2.0, 1.6, 2.0);
  a3.translate(0, 6.2, 0);
  const t3 = criarTelhadoChines(2.0, 1.4, 1.0, 7.0);

  // Pináculo dourado
  const pinaculo = new THREE.ConeGeometry(0.3, 1.6, 6);
  pinaculo.translate(0, 8.8, 0);

  pecas.push(a1, t1, a2, t2, a3, t3, pinaculo);

  // Muralha externa dupla
  const muroExt = new THREE.BoxGeometry(11.0, 2.2, 0.7);
  muroExt.translate(0, 1.1, -5.5);
  const muroInt = new THREE.BoxGeometry(8.0, 2.6, 0.7);
  muroInt.translate(0, 1.3, -3.5);
  pecas.push(muroExt, muroInt);

  // 4 Torres de Canto
  const coordsCanto: [number, number][] = [
    [-5.5, -5.5],
    [5.5, -5.5],
    [-5.5, 5.5],
    [5.5, 5.5],
  ];
  for (const ponto of coordsCanto) {
    const cx = ponto[0];
    const cz = ponto[1];
    const torre = new THREE.CylinderGeometry(0.8, 1.0, 3.2, 6);
    torre.translate(cx, 1.6, cz);
    const telhadoTorre = criarTelhadoChines(1.6, 0.9, 0.6, 3.2);
    telhadoTorre.translate(cx, 0, cz);
    pecas.push(torre, telhadoTorre);
  }

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 7: Legado — Palácio Imperial sobre múltiplos terraços monumentais.
 */
function criarGeometriaLegado(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Terraço Inferior de Pedra Branca
  const terraco1 = new THREE.BoxGeometry(12.0, 0.8, 12.0);
  terraco1.translate(0, 0.4, 0);

  // Terraço Intermediário
  const terraco2 = new THREE.BoxGeometry(9.0, 0.8, 9.0);
  terraco2.translate(0, 1.2, 0);

  // Pavilhão Principal Imperial (4 patamares majestosos)
  const p1 = new THREE.BoxGeometry(6.0, 2.2, 6.0);
  p1.translate(0, 2.3, 0);
  const t1 = criarTelhadoChines(6.0, 1.6, 1.8, 3.4);

  const p2 = new THREE.BoxGeometry(4.4, 2.0, 4.4);
  p2.translate(0, 5.4, 0);
  const t2 = criarTelhadoChines(4.4, 1.5, 1.5, 6.4);

  const p3 = new THREE.BoxGeometry(3.0, 1.8, 3.0);
  p3.translate(0, 8.3, 0);
  const t3 = criarTelhadoChines(3.0, 1.4, 1.2, 9.2);

  const pinaculoImperial = new THREE.ConeGeometry(0.4, 2.2, 8);
  pinaculoImperial.translate(0, 11.2, 0);

  pecas.push(terraco1, terraco2, p1, t1, p2, t2, p3, t3, pinaculoImperial);

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Nível 0: Ruínas — Muros desabados, colunas caídas e entulho desgastado pelo tempo.
 */
function criarGeometriaRuinas(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];

  // Muro desabado inclinado
  const muroQuebrado1 = new THREE.BoxGeometry(2.8, 1.0, 0.6);
  muroQuebrado1.rotateZ(0.2);
  muroQuebrado1.translate(-1.0, 0.78, 0);

  // Pedaço de muro tombado no chão
  const muroQuebrado2 = new THREE.BoxGeometry(2.0, 0.5, 1.2);
  muroQuebrado2.rotateY(0.4);
  muroQuebrado2.translate(1.4, 0.25, 0.8);

  // Coluna caída partida em duas
  const coluna1 = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 6);
  coluna1.rotateX(Math.PI * 0.45);
  coluna1.translate(0.5, 0.45, -1.2);

  const coluna2 = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 6);
  coluna2.rotateZ(-0.3);
  coluna2.translate(-1.8, 0.65, -0.8);

  // Blocos de escombros espalhados
  const bloco1 = new THREE.BoxGeometry(0.6, 0.4, 0.5);
  bloco1.translate(1.0, 0.2, -0.2);
  const bloco2 = new THREE.BoxGeometry(0.5, 0.3, 0.7);
  bloco2.translate(-0.4, 0.15, 1.5);

  pecas.push(muroQuebrado1, muroQuebrado2, coluna1, coluna2, bloco1, bloco2);

  const merged = mergeGeometries(pecas, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Dicionário imutável com as 8 geometrias procedurais otimizadas para InstancedMesh.
 */
export function construirGeometriasCidades(): Record<NivelMaturidadeVisual, THREE.BufferGeometry> {
  return {
    1: criarGeometriaFaisca(),
    2: criarGeometriaExpedicao(),
    3: criarGeometriaAssentamento(),
    4: criarGeometriaVila(),
    5: criarGeometriaCidade(),
    6: criarGeometriaMetropole(),
    7: criarGeometriaLegado(),
    0: criarGeometriaRuinas(),
  };
}
