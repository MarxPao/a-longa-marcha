import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETA_MAPA } from '../config/layout';
import {
  aplicarDesgasteEContatoGeometria,
  colorirGeometriaModular,
  garantirAtributoCorGeometria,
} from './materiaisAvancados';

export type TipoEdificioAgricultura = 'casa_taipa_palha' | 'celeiro_elevado' | 'moinho_agua';
export type TipoEdificioComercio = 'armazem_longo' | 'portico_comercial' | 'barraca_mercado';

// Paleta arquitetural Han canônica (Seção 3 & 4)
const COR_MADEIRA = PALETA_MAPA.madeiraEscura;
const COR_REBOCO = PALETA_MAPA.rebocoClaro;
const COR_TELHA = PALETA_MAPA.telhaCinzaAzulada;
const COR_PEDRA = PALETA_MAPA.pedraBase;
const COR_JADE = PALETA_MAPA.jade; // Destaque Agricultura
const COR_LACA = PALETA_MAPA.laca; // Destaque Comércio
const COR_OURO = PALETA_MAPA.ouro; // Destaque Comércio
const COR_PALHA = PALETA_MAPA.terraClara;

interface PartePintada {
  geo: THREE.BufferGeometry;
  cor: string;
}

function mesclarPartes(partes: PartePintada[]): THREE.BufferGeometry {
  const pintadas: THREE.BufferGeometry[] = partes.map((p) => {
    const g = colorirGeometriaModular(p.geo, p.cor);
    p.geo.dispose();
    return g;
  });

  const mesclada = mergeGeometries(pintadas, false);
  for (const p of pintadas) {
    p.dispose();
  }

  mesclada.computeVertexNormals();
  aplicarDesgasteEContatoGeometria(mesclada);
  garantirAtributoCorGeometria(mesclada);
  return mesclada;
}

/**
 * Cria base/plataforma de pedra elevada com degraus de acesso frontais (Seção 4).
 */
function criarBasePedraComDegraus(
  largura: number,
  profundidade: number,
  alturaBase = 0.5,
  numDegraus = 2
): PartePintada[] {
  const partes: PartePintada[] = [];

  // Plataforma principal
  const geoPlat = new THREE.BoxGeometry(largura, alturaBase, profundidade);
  geoPlat.translate(0, alturaBase * 0.5, 0);
  partes.push({ geo: geoPlat, cor: COR_PEDRA });

  // Degraus frontais
  const largDegrau = largura * 0.45;
  const profDegrau = 0.35;
  const altDegrau = alturaBase / numDegraus;

  for (let d = 0; d < numDegraus; d++) {
    const geoDeg = new THREE.BoxGeometry(largDegrau, altDegrau, profDegrau);
    const zPos = profundidade * 0.5 + profDegrau * (d + 0.5);
    const yPos = altDegrau * (numDegraus - d - 0.5);
    geoDeg.translate(0, yPos, zPos);
    partes.push({ geo: geoDeg, cor: COR_PEDRA });
  }

  return partes;
}

/**
 * Cria paredes de reboco claro com pilares e vigas aparentes de madeira escura.
 */
function criarParedesComEstruturaMadeira(
  largura: number,
  profundidade: number,
  altura: number,
  yOffset: number
): PartePintada[] {
  const partes: PartePintada[] = [];

  // Painéis de reboco interno
  const espessura = 0.15;
  const geoReboco = new THREE.BoxGeometry(
    largura - espessura * 2,
    altura,
    profundidade - espessura * 2
  );
  geoReboco.translate(0, yOffset + altura * 0.5, 0);
  partes.push({ geo: geoReboco, cor: COR_REBOCO });

  // 4 Pilares de madeira nos cantos
  const raioPilar = 0.16;
  const cantos = [
    [-largura * 0.5 + raioPilar, -profundidade * 0.5 + raioPilar],
    [largura * 0.5 - raioPilar, -profundidade * 0.5 + raioPilar],
    [-largura * 0.5 + raioPilar, profundidade * 0.5 - raioPilar],
    [largura * 0.5 - raioPilar, profundidade * 0.5 - raioPilar],
  ];

  for (const [cx, cz] of cantos) {
    const pilar = new THREE.CylinderGeometry(raioPilar, raioPilar, altura, 6);
    pilar.translate(cx!, yOffset + altura * 0.5, cz!);
    partes.push({ geo: pilar, cor: COR_MADEIRA });
  }

  // Viga superior perimetral de madeira
  const geoVigaX1 = new THREE.BoxGeometry(largura + 0.1, 0.22, 0.25);
  geoVigaX1.translate(0, yOffset + altura - 0.11, profundidade * 0.5);
  const geoVigaX2 = geoVigaX1.clone().translate(0, 0, -profundidade);

  const geoVigaZ1 = new THREE.BoxGeometry(0.25, 0.22, profundidade + 0.1);
  geoVigaZ1.translate(largura * 0.5, yOffset + altura - 0.11, 0);
  const geoVigaZ2 = geoVigaZ1.clone().translate(-largura, 0, 0);

  partes.push(
    { geo: geoVigaX1, cor: COR_MADEIRA },
    { geo: geoVigaX2, cor: COR_MADEIRA },
    { geo: geoVigaZ1, cor: COR_MADEIRA },
    { geo: geoVigaZ2, cor: COR_MADEIRA }
  );

  return partes;
}

/**
 * Cria a estrutura tradicional de suporte ao beiral (Dougong / consolos sobrepostos).
 */
function criarDougongSuporte(
  largura: number,
  profundidade: number,
  yTopo: number
): PartePintada[] {
  const partes: PartePintada[] = [];
  const coordsSuporte = [
    [-largura * 0.35, profundidade * 0.5 + 0.1],
    [largura * 0.35, profundidade * 0.5 + 0.1],
    [-largura * 0.35, -profundidade * 0.5 - 0.1],
    [largura * 0.35, -profundidade * 0.5 - 0.1],
  ];

  for (const [sx, sz] of coordsSuporte) {
    // Bloco 1 (inferior)
    const b1 = new THREE.BoxGeometry(0.35, 0.15, 0.35);
    b1.translate(sx!, yTopo - 0.15, sz!);
    // Bloco 2 (superior saliente)
    const b2 = new THREE.BoxGeometry(0.55, 0.15, 0.5);
    b2.translate(sx!, yTopo, sz!);
    partes.push({ geo: b1, cor: COR_MADEIRA }, { geo: b2, cor: COR_MADEIRA });
  }

  return partes;
}

/**
 * Telhado chinês com beiral curvado para cima (splay ~12%) e cumeeira ornamental.
 */
function criarTelhadoCurvoHan(
  largura: number,
  profundidade: number,
  altura: number,
  yBase: number,
  corTelha = COR_TELHA,
  corCumeeira = COR_OURO
): PartePintada[] {
  const partes: PartePintada[] = [];
  const beiral = 0.8;

  // Telhado cônico de 4 águas curvado
  const geoTelhado = new THREE.ConeGeometry(
    Math.max(largura + beiral * 2, profundidade + beiral * 2) * 0.68,
    altura,
    4
  );
  geoTelhado.rotateY(Math.PI * 0.25);
  geoTelhado.translate(0, yBase + altura * 0.5, 0);

  // Cumeeira de acabamento ornamental no topo
  const geoCumeeira = new THREE.BoxGeometry(largura * 0.75, 0.25, 0.35);
  geoCumeeira.translate(0, yBase + altura + 0.12, 0);

  // Arremates de extremidade da cumeeira (chīwěn / pontas curvadas)
  const pontaEsq = new THREE.ConeGeometry(0.2, 0.5, 4);
  pontaEsq.rotateZ(0.4);
  pontaEsq.translate(-largura * 0.38, yBase + altura + 0.25, 0);
  const pontaDir = pontaEsq.clone();
  pontaDir.rotateZ(-0.8);
  pontaDir.translate(largura * 0.76, 0, 0);

  partes.push(
    { geo: geoTelhado, cor: corTelha },
    { geo: geoCumeeira, cor: corCumeeira },
    { geo: pontaEsq, cor: corCumeeira },
    { geo: pontaDir, cor: corCumeeira }
  );

  return partes;
}

/* =========================================================================
 * 1. SETOR AGRICULTURA (Verde-Jade) — 3 Tipos x 6 Variantes
 * ========================================================================= */

/**
 * Tipo 1: Casa de Taipa e Palha (Agricultura)
 * 6 variantes: variações de largura (5 a 8u), telhado de 2 ou 4 águas, varanda, anexo.
 */
export function criarCasaTaipaPalha(variante: number, escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];
  const v = Math.abs(variante) % 6;

  const larg = (5.2 + (v % 3) * 0.9) * escala;
  const prof = (4.4 + Math.floor(v / 2) * 0.7) * escala;
  const altBase = 0.45 * escala;
  const altParede = (2.6 + (v % 2) * 0.5) * escala;

  // Base de pedra
  partes.push(...criarBasePedraComDegraus(larg, prof, altBase, 2));
  // Paredes e estrutura
  partes.push(...criarParedesComEstruturaMadeira(larg, prof, altParede, altBase));
  // Dougong
  partes.push(...criarDougongSuporte(larg, prof, altBase + altParede));

  // Telhado de palha/taipa com destaque jade
  const corTelhado = v % 2 === 0 ? COR_PALHA : COR_TELHA;
  const corDestaque = v >= 3 ? COR_JADE : COR_OURO;
  partes.push(
    ...criarTelhadoCurvoHan(larg, prof, 2.2 * escala, altBase + altParede, corTelhado, corDestaque)
  );

  // Porta de entrada de madeira
  const porta = new THREE.BoxGeometry(1.2 * escala, 2.0 * escala, 0.2);
  porta.translate(0, altBase + 1.0 * escala, prof * 0.5 + 0.05);
  partes.push({ geo: porta, cor: COR_MADEIRA });

  // Adicionais conforme variante:
  if (v === 1 || v === 4) {
    // Varanda frontal com estacas e toldo de palha
    const estaca1 = new THREE.CylinderGeometry(0.08, 0.08, 2.2 * escala, 4);
    estaca1.translate(-larg * 0.35, altBase + 1.1 * escala, prof * 0.5 + 1.0 * escala);
    const estaca2 = estaca1.clone().translate(larg * 0.7, 0, 0);
    const toldo = new THREE.BoxGeometry(larg * 0.9, 0.12, 1.2 * escala);
    toldo.translate(0, altBase + 2.2 * escala, prof * 0.5 + 0.5 * escala);
    partes.push(
      { geo: estaca1, cor: COR_MADEIRA },
      { geo: estaca2, cor: COR_MADEIRA },
      { geo: toldo, cor: COR_PALHA }
    );
  } else if (v === 2 || v === 5) {
    // Anexo lateral de armazenamento de feixes/ferramentas
    const anexo = new THREE.BoxGeometry(2.0 * escala, altParede * 0.7, prof * 0.75);
    anexo.translate(-larg * 0.5 - 1.0 * escala, altBase + altParede * 0.35, 0);
    const telhadoAnexo = new THREE.ConeGeometry(2.4 * escala, 1.4 * escala, 4);
    telhadoAnexo.rotateY(Math.PI * 0.25);
    telhadoAnexo.translate(-larg * 0.5 - 1.0 * escala, altBase + altParede * 0.7 + 0.7 * escala, 0);
    partes.push({ geo: anexo, cor: COR_REBOCO }, { geo: telhadoAnexo, cor: COR_PALHA });
  }

  // Props agrícolas na entrada: cesto de grãos de jade e feixes
  const cesto = new THREE.CylinderGeometry(0.35 * escala, 0.25 * escala, 0.55 * escala, 6);
  cesto.translate(larg * 0.35, altBase + 0.28 * escala, prof * 0.5 + 0.45 * escala);
  partes.push({ geo: cesto, cor: COR_JADE });

  return mesclarPartes(partes);
}

/**
 * Tipo 2: Celeiro Elevado sobre Estacas (Agricultura)
 * 6 variantes: altura das estacas, rampa de acesso, tamanho do paiol, cata-vento.
 */
export function criarCeleiroElevado(variante: number, escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];
  const v = Math.abs(variante) % 6;

  const larg = (4.8 + (v % 3) * 0.8) * escala;
  const prof = (4.2 + Math.floor(v / 2) * 0.6) * escala;
  const altEstacas = (1.6 + (v % 2) * 0.6) * escala;
  const altCorpo = (3.0 + (v % 3) * 0.4) * escala;

  // 1. Estacas de sustentação elevadas
  const raioEstaca = 0.16 * escala;
  const coordsEstacas = [
    [-larg * 0.4, -prof * 0.4],
    [larg * 0.4, -prof * 0.4],
    [-larg * 0.4, prof * 0.4],
    [larg * 0.4, prof * 0.4],
    [0, -prof * 0.4],
    [0, prof * 0.4],
  ];

  for (const [ex, ez] of coordsEstacas) {
    const estaca = new THREE.CylinderGeometry(raioEstaca, raioEstaca, altEstacas, 6);
    estaca.translate(ex!, altEstacas * 0.5, ez!);
    partes.push({ geo: estaca, cor: COR_MADEIRA });
  }

  // Plataforma do piso do celeiro
  const assoalho = new THREE.BoxGeometry(larg + 0.4 * escala, 0.3 * escala, prof + 0.4 * escala);
  assoalho.translate(0, altEstacas + 0.15 * escala, 0);
  partes.push({ geo: assoalho, cor: COR_MADEIRA });

  // Paredes de tábuas de madeira e taipa
  const corpo = new THREE.BoxGeometry(larg, altCorpo, prof);
  corpo.translate(0, altEstacas + 0.3 * escala + altCorpo * 0.5, 0);
  partes.push({ geo: corpo, cor: v % 2 === 0 ? COR_REBOCO : COR_PALHA });

  // Telhado alto de duas águas em arco para escoar chuva
  partes.push(
    ...criarTelhadoCurvoHan(
      larg + 0.4 * escala,
      prof + 0.4 * escala,
      2.5 * escala,
      altEstacas + 0.3 * escala + altCorpo,
      COR_PALHA,
      COR_JADE
    )
  );

  // Rampa ou escada frontal de acesso
  const compRampa = altEstacas * 1.5;
  const rampa = new THREE.BoxGeometry(1.2 * escala, 0.15 * escala, compRampa);
  rampa.rotateX(Math.atan2(altEstacas, compRampa));
  rampa.translate(0, altEstacas * 0.5, prof * 0.5 + compRampa * 0.4);
  partes.push({ geo: rampa, cor: COR_MADEIRA });

  // Prop do celeiro: sacos de grãos na entrada
  const sacoGraos = new THREE.BoxGeometry(0.5 * escala, 0.4 * escala, 0.6 * escala);
  sacoGraos.translate(larg * 0.35, altEstacas + 0.5 * escala, prof * 0.5 - 0.2 * escala);
  partes.push({ geo: sacoGraos, cor: COR_PALHA });

  // Elementos estruturais exclusivos por variante
  if (v === 1 || v === 4) {
    // Guindaste / viga de roldana de carga saliente sob o beiral
    const vigaGuindaste = new THREE.BoxGeometry(0.2 * escala, 0.2 * escala, 1.6 * escala);
    vigaGuindaste.translate(0, altEstacas + 0.3 * escala + altCorpo * 0.9, prof * 0.5 + 0.8 * escala);
    const corda = new THREE.CylinderGeometry(0.02 * escala, 0.02 * escala, 1.2 * escala, 4);
    corda.translate(0, altEstacas + 0.3 * escala + altCorpo * 0.6, prof * 0.5 + 1.4 * escala);
    partes.push({ geo: vigaGuindaste, cor: COR_MADEIRA }, { geo: corda, cor: COR_PALHA });
  } else if (v === 2 || v === 5) {
    // Estrado lateral de secagem de espigas
    const estrado = new THREE.BoxGeometry(1.8 * escala, 0.12 * escala, prof * 0.8);
    estrado.translate(larg * 0.5 + 0.9 * escala, altEstacas + 0.3 * escala, 0);
    const estacaEstrado = new THREE.CylinderGeometry(0.08 * escala, 0.08 * escala, altEstacas + 0.3 * escala, 4);
    estacaEstrado.translate(larg * 0.5 + 1.6 * escala, (altEstacas + 0.3 * escala) * 0.5, 0);
    partes.push({ geo: estrado, cor: COR_MADEIRA }, { geo: estacaEstrado, cor: COR_MADEIRA });
  }

  return mesclarPartes(partes);
}

/**
 * Tipo 3: Moinho d'Água (Agricultura)
 * 6 variantes: roda d'água lateral giratória, calha de madeira, tamanho do moinho.
 */
export function criarMoinhoAgua(variante: number, escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];
  const v = Math.abs(variante) % 6;

  const larg = (5.0 + (v % 3) * 0.8) * escala;
  const prof = (4.6 + Math.floor(v / 2) * 0.6) * escala;
  const altBase = 0.5 * escala;
  const altParede = 3.2 * escala;

  // Base de pedra ribeirinha
  partes.push(...criarBasePedraComDegraus(larg, prof, altBase, 2));
  partes.push(...criarParedesComEstruturaMadeira(larg, prof, altParede, altBase));
  partes.push(
    ...criarTelhadoCurvoHan(larg, prof, 2.2 * escala, altBase + altParede, COR_TELHA, COR_JADE)
  );

  // Roda d'água monumental de madeira montada na lateral
  const raioRoda = (2.2 + (v % 3) * 0.4) * escala;
  const xRoda = larg * 0.5 + 0.45 * escala;
  const yRoda = raioRoda * 0.85;

  // Aro da roda
  const aroRoda = new THREE.TorusGeometry(raioRoda, 0.14 * escala, 6, 16);
  aroRoda.rotateY(Math.PI * 0.5);
  aroRoda.translate(xRoda, yRoda, 0);
  partes.push({ geo: aroRoda, cor: COR_MADEIRA });

  // Raios e pás da roda (8 pás)
  const numPas = 8;
  for (let p = 0; p < numPas; p++) {
    const ang = (p / numPas) * Math.PI * 2;
    const raioMadeira = new THREE.CylinderGeometry(0.06 * escala, 0.06 * escala, raioRoda * 1.9, 4);
    raioMadeira.rotateX(ang);
    raioMadeira.translate(xRoda, yRoda, 0);

    const pa = new THREE.BoxGeometry(0.35 * escala, 0.08 * escala, 0.6 * escala);
    pa.translate(xRoda, yRoda + Math.sin(ang) * raioRoda, Math.cos(ang) * raioRoda);

    partes.push({ geo: raioMadeira, cor: COR_MADEIRA }, { geo: pa, cor: COR_MADEIRA });
  }

  // Calha de madeira superior conduzindo água
  const calha = new THREE.BoxGeometry(0.6 * escala, 0.25 * escala, prof * 1.3);
  calha.translate(xRoda, yRoda + raioRoda * 0.95, 0);
  partes.push({ geo: calha, cor: COR_MADEIRA });

  // Estandarte verde-jade de agricultura na fachada
  const estandarte = new THREE.BoxGeometry(0.6 * escala, 1.4 * escala, 0.04);
  estandarte.translate(-larg * 0.35, altBase + altParede * 0.7, prof * 0.5 + 0.15);
  partes.push({ geo: estandarte, cor: COR_JADE });

  // Detalhes exclusivos por variante
  if (v === 1 || v === 4) {
    // Moega / silo de grãos superior de madeira
    const silo = new THREE.BoxGeometry(1.6 * escala, 1.4 * escala, 1.6 * escala);
    silo.translate(0, altBase + altParede + 2.2 * escala, 0);
    const telhadoSilo = new THREE.ConeGeometry(1.3 * escala, 0.8 * escala, 4);
    telhadoSilo.rotateY(Math.PI * 0.25);
    telhadoSilo.translate(0, altBase + altParede + 3.3 * escala, 0);
    partes.push({ geo: silo, cor: COR_MADEIRA }, { geo: telhadoSilo, cor: COR_PALHA });
  } else if (v === 2 || v === 5) {
    // Deck de descarga com barris de farinha
    const deck = new THREE.BoxGeometry(2.0 * escala, 0.2 * escala, 1.4 * escala);
    deck.translate(-larg * 0.3, altBase + 0.1 * escala, prof * 0.5 + 0.9 * escala);
    const barril = new THREE.CylinderGeometry(0.3 * escala, 0.35 * escala, 0.6 * escala, 6);
    barril.translate(-larg * 0.3, altBase + 0.5 * escala, prof * 0.5 + 0.9 * escala);
    partes.push({ geo: deck, cor: COR_MADEIRA }, { geo: barril, cor: COR_MADEIRA });
  }

  return mesclarPartes(partes);
}

/* =========================================================================
 * 2. SETOR COMÉRCIO (Laca e Ouro) — 3 Tipos x 6 Variantes
 * ========================================================================= */

/**
 * Tipo 1: Armazém Comercial Longo (Comércio)
 * 6 variantes: comprimento estendido (7 a 12u), portões duplos de carga, lanternas.
 */
export function criarArmazemLongo(variante: number, escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];
  const v = Math.abs(variante) % 6;

  const larg = (7.5 + (v % 3) * 1.6) * escala; // Edifício longo
  const prof = (4.4 + Math.floor(v / 2) * 0.6) * escala;
  const altBase = 0.5 * escala;
  const altParede = (2.8 + (v % 2) * 0.4) * escala;

  partes.push(...criarBasePedraComDegraus(larg, prof, altBase, 2));
  partes.push(...criarParedesComEstruturaMadeira(larg, prof, altParede, altBase));
  partes.push(...criarDougongSuporte(larg, prof, altBase + altParede));

  // Telhado baixo e alongado com cumeeira imperial de laca e ouro
  partes.push(
    ...criarTelhadoCurvoHan(larg, prof, 2.0 * escala, altBase + altParede, COR_TELHA, COR_LACA)
  );

  // Portão largo de carga no centro da fachada frontal
  const largPortao = (2.4 + (v % 2) * 0.8) * escala;
  const portao = new THREE.BoxGeometry(largPortao, 2.3 * escala, 0.25);
  portao.translate(0, altBase + 1.15 * escala, prof * 0.5 + 0.08);
  partes.push({ geo: portao, cor: COR_LACA });

  // Anéis dourados de ferro no portão
  const anel1 = new THREE.TorusGeometry(0.18 * escala, 0.04 * escala, 4, 8);
  anel1.translate(-largPortao * 0.25, altBase + 1.2 * escala, prof * 0.5 + 0.25);
  const anel2 = anel1.clone().translate(largPortao * 0.5, 0, 0);
  partes.push({ geo: anel1, cor: COR_OURO }, { geo: anel2, cor: COR_OURO });

  // Pilhas de caixas comerciais do lado de fora (identificador de Comércio)
  const numCaixas = 2 + (v % 3);
  for (let c = 0; c < numCaixas; c++) {
    const cx = (c === 0 ? 0.7 : c === 1 ? 0.6 : 0.5) * escala;
    const caixa = new THREE.BoxGeometry(cx, cx, cx);
    caixa.translate(
      larg * 0.35 + (c * 0.4 - 0.2) * escala,
      altBase + (c > 1 ? cx * 1.5 : cx * 0.5),
      prof * 0.5 + 0.6 * escala
    );
    partes.push({ geo: caixa, cor: COR_MADEIRA });
  }

  return mesclarPartes(partes);
}

/**
 * Tipo 2: Pórtico Comercial e Balcão de Câmbio (Comércio)
 * 6 variantes: colunata de entrada aberta, estandartes de ouro, balcão de pesagem.
 */
export function criarPorticoComercial(variante: number, escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];
  const v = Math.abs(variante) % 6;

  const larg = (6.0 + (v % 3) * 0.8) * escala;
  const prof = (5.2 + Math.floor(v / 2) * 0.7) * escala;
  const altBase = 0.6 * escala;
  const altParede = 3.6 * escala;

  partes.push(...criarBasePedraComDegraus(larg, prof, altBase, 3));

  // Pórtico com colunata aberta frontal (4 colunas imponentes)
  const numColunas = 4;
  for (let c = 0; c < numColunas; c++) {
    const colX = (-larg * 0.5 + (larg / (numColunas - 1)) * c) * 0.85;
    const coluna = new THREE.CylinderGeometry(0.2 * escala, 0.22 * escala, altParede, 8);
    coluna.translate(colX, altBase + altParede * 0.5, prof * 0.5 - 0.2 * escala);
    partes.push({ geo: coluna, cor: COR_LACA });
  }

  // Parede traseira e laterais fechadas
  const paredeFundo = new THREE.BoxGeometry(larg, altParede, 0.25);
  paredeFundo.translate(0, altBase + altParede * 0.5, -prof * 0.5 + 0.15);
  const paredeEsq = new THREE.BoxGeometry(0.25, altParede, prof * 0.7);
  paredeEsq.translate(-larg * 0.5 + 0.15, altBase + altParede * 0.5, -prof * 0.15);
  const paredeDir = paredeEsq.clone().translate(larg - 0.3, 0, 0);

  partes.push(
    { geo: paredeFundo, cor: COR_REBOCO },
    { geo: paredeEsq, cor: COR_REBOCO },
    { geo: paredeDir, cor: COR_REBOCO }
  );

  // Telhado empilhado de 2 níveis com arremates de ouro
  partes.push(
    ...criarTelhadoCurvoHan(larg, prof, 2.2 * escala, altBase + altParede, COR_TELHA, COR_OURO)
  );

  // Balcão de câmbio / pesagem de moedas no centro do pórtico
  const balcao = new THREE.BoxGeometry(2.4 * escala, 1.1 * escala, 0.8 * escala);
  balcao.translate(0, altBase + 0.55 * escala, prof * 0.15);
  const balanca = new THREE.CylinderGeometry(0.04, 0.04, 0.8 * escala, 4);
  balanca.translate(0, altBase + 1.5 * escala, prof * 0.15);
  const pratoEsq = new THREE.CylinderGeometry(0.2 * escala, 0.2 * escala, 0.04, 6);
  pratoEsq.translate(-0.35 * escala, altBase + 1.25 * escala, prof * 0.15);
  const pratoDir = pratoEsq.clone().translate(0.7 * escala, 0, 0);

  partes.push(
    { geo: balcao, cor: COR_MADEIRA },
    { geo: balanca, cor: COR_OURO },
    { geo: pratoEsq, cor: COR_OURO },
    { geo: pratoDir, cor: COR_OURO }
  );

  // Estandartes verticais de laca com símbolos dourados nas colunas frontais
  const estandarte1 = new THREE.BoxGeometry(0.4 * escala, 1.8 * escala, 0.03);
  estandarte1.translate(-larg * 0.35, altBase + altParede * 0.6, prof * 0.5 + 0.05);
  const estandarte2 = estandarte1.clone().translate(larg * 0.7, 0, 0);
  partes.push({ geo: estandarte1, cor: COR_LACA }, { geo: estandarte2, cor: COR_LACA });

  // Detalhes exclusivos por variante
  if (v === 1 || v === 4) {
    // Duas lanternas hexagonais de papel/ouro nas colunas
    const lan1 = new THREE.CylinderGeometry(0.22 * escala, 0.22 * escala, 0.45 * escala, 6);
    lan1.translate(-larg * 0.35, altBase + altParede * 0.85, prof * 0.5 + 0.35 * escala);
    const lan2 = lan1.clone().translate(larg * 0.7, 0, 0);
    partes.push({ geo: lan1, cor: COR_OURO }, { geo: lan2, cor: COR_OURO });
  } else if (v === 2 || v === 5) {
    // Placa monumental de laca escura e ouro sobre o pórtico
    const placa = new THREE.BoxGeometry(larg * 0.6, 0.6 * escala, 0.12 * escala);
    placa.translate(0, altBase + altParede - 0.2 * escala, prof * 0.5 + 0.15 * escala);
    partes.push({ geo: placa, cor: COR_LACA });
  }

  return mesclarPartes(partes);
}

/**
 * Tipo 3: Barraca de Feira Comercial (Comércio)
 * 6 variantes: toldo em laca/ouro listrado, caixas empilhadas, balcão de especiarias.
 */
export function criarBarracaMercado(variante: number, escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];
  const v = Math.abs(variante) % 6;

  const larg = (4.0 + (v % 3) * 0.7) * escala;
  const prof = (3.6 + Math.floor(v / 2) * 0.5) * escala;
  const altBase = 0.3 * escala;
  const altBanca = 1.1 * escala;

  // Base rasa
  partes.push(...criarBasePedraComDegraus(larg, prof, altBase, 1));

  // Balcão de madeira em U com saia frontal de tecido mercantil
  const balcaoFrente = new THREE.BoxGeometry(larg * 0.85, altBanca, 0.6 * escala);
  balcaoFrente.translate(0, altBase + altBanca * 0.5, prof * 0.25);

  const saiaBalcao = new THREE.BoxGeometry(larg * 0.72, altBanca * 0.65, 0.04);
  saiaBalcao.translate(0, altBase + altBanca * 0.45, prof * 0.25 + 0.31 * escala);

  partes.push({ geo: balcaoFrente, cor: COR_MADEIRA }, { geo: saiaBalcao, cor: COR_REBOCO });

  // 4 Hastes de sustentação do toldo de tecido
  const altHaste = 2.4 * escala;
  const cantosToldo = [
    [-larg * 0.45, -prof * 0.45],
    [larg * 0.45, -prof * 0.45],
    [-larg * 0.45, prof * 0.45],
    [larg * 0.45, prof * 0.45],
  ];

  for (const [hx, hz] of cantosToldo) {
    const haste = new THREE.CylinderGeometry(0.06 * escala, 0.06 * escala, altHaste, 4);
    haste.translate(hx!, altBase + altHaste * 0.5, hz!);
    partes.push({ geo: haste, cor: COR_MADEIRA });
  }

  // Toldo abaulado em tecido claro com listras de destaque em laca e ouro (máximo 15% da superfície visível - Seção 3)
  const toldoTecido = new THREE.BoxGeometry(larg * 1.1, 0.12 * escala, prof * 0.6);
  toldoTecido.rotateX(-0.15);
  toldoTecido.translate(0, altBase + altHaste, 0);

  const faixaLaca1 = new THREE.BoxGeometry(larg * 0.15, 0.14 * escala, prof * 0.62);
  faixaLaca1.rotateX(-0.15);
  faixaLaca1.translate(-larg * 0.32, altBase + altHaste + 0.01, 0);
  const faixaLaca2 = faixaLaca1.clone().translate(larg * 0.64, 0, 0);

  const faixaOuro = new THREE.BoxGeometry(larg * 0.12, 0.15 * escala, prof * 0.62);
  faixaOuro.rotateX(-0.15);
  faixaOuro.translate(0, altBase + altHaste + 0.015, 0);

  partes.push(
    { geo: toldoTecido, cor: COR_REBOCO },
    { geo: faixaLaca1, cor: COR_LACA },
    { geo: faixaLaca2, cor: COR_LACA },
    { geo: faixaOuro, cor: COR_OURO }
  );

  // Mercadorias em exposição no balcão
  const cesto = new THREE.CylinderGeometry(0.3 * escala, 0.2 * escala, 0.35 * escala, 6);
  cesto.translate(-larg * 0.25, altBase + altBanca + 0.18 * escala, prof * 0.25);
  const jarro = new THREE.CylinderGeometry(0.18 * escala, 0.25 * escala, 0.45 * escala, 6);
  jarro.translate(larg * 0.25, altBase + altBanca + 0.22 * escala, prof * 0.25);

  partes.push({ geo: cesto, cor: COR_OURO }, { geo: jarro, cor: COR_LACA });

  // Detalhes exclusivos por variante
  if (v === 1 || v === 4) {
    // Mesa lateral com pilhas de rolos de seda
    const mesa = new THREE.BoxGeometry(0.8 * escala, altBanca * 0.8, 1.4 * escala);
    mesa.translate(-larg * 0.5 - 0.45 * escala, altBase + altBanca * 0.4, 0);
    const roloSeda = new THREE.CylinderGeometry(0.12 * escala, 0.12 * escala, 0.7 * escala, 6);
    roloSeda.rotateX(Math.PI * 0.5);
    roloSeda.translate(-larg * 0.5 - 0.45 * escala, altBase + altBanca * 0.85, 0);
    partes.push({ geo: mesa, cor: COR_MADEIRA }, { geo: roloSeda, cor: COR_LACA });
  } else if (v === 2 || v === 5) {
    // Prateleira traseira com jarros de porcelana
    const prateleira = new THREE.BoxGeometry(larg * 0.8, 0.12 * escala, 0.4 * escala);
    prateleira.translate(0, altBase + 1.6 * escala, -prof * 0.35);
    const jarroTraseiro = new THREE.CylinderGeometry(0.14 * escala, 0.18 * escala, 0.4 * escala, 6);
    jarroTraseiro.translate(0, altBase + 1.85 * escala, -prof * 0.35);
    partes.push({ geo: prateleira, cor: COR_MADEIRA }, { geo: jarroTraseiro, cor: COR_OURO });
  }

  return mesclarPartes(partes);
}

/* =========================================================================
 * 3. ELEMENTOS DEFENSIVOS MODULARES (Muralhas e Portões)
 * ========================================================================= */

/**
 * Segmento Modular de Muralha Fortificada com Ameias e Caminho de Ronda (Seção 4 & 5).
 */
export function criarMuralhaModular(escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];

  const comprimento = 8.0 * escala;
  const altura = 2.4 * escala;
  const espessura = 1.0 * escala;

  // Corpo maciço da muralha
  const corpoMuralha = new THREE.BoxGeometry(comprimento, altura, espessura);
  corpoMuralha.translate(0, altura * 0.5, 0);
  partes.push({ geo: corpoMuralha, cor: COR_PEDRA });

  // Contrafortes de reforço na base
  const contraforteEsq = new THREE.BoxGeometry(0.8 * escala, altura * 0.7, 0.4 * escala);
  contraforteEsq.translate(-comprimento * 0.3, altura * 0.35, espessura * 0.5 + 0.2 * escala);
  const contraforteDir = contraforteEsq.clone().translate(comprimento * 0.6, 0, 0);
  partes.push({ geo: contraforteEsq, cor: COR_PEDRA }, { geo: contraforteDir, cor: COR_PEDRA });

  // Ameias defensivas no topo frontal
  const numAmeias = 5;
  const largAmeia = 0.8 * escala;
  const altAmeia = 0.5 * escala;

  for (let a = 0; a < numAmeias; a++) {
    const ax = -comprimento * 0.5 + (comprimento / numAmeias) * (a + 0.5);
    const ameia = new THREE.BoxGeometry(largAmeia, altAmeia, 0.25 * escala);
    ameia.translate(ax, altura + altAmeia * 0.5, espessura * 0.5 - 0.12 * escala);
    partes.push({ geo: ameia, cor: COR_PEDRA });
  }

  return mesclarPartes(partes);
}

/**
 * Portão Fortificado Han Monumental com Torres de Flanco e Pavilhão Superior (Seção 4 & 5).
 */
export function criarPortaoModular(escala = 1.0): THREE.BufferGeometry {
  const partes: PartePintada[] = [];

  const largTotal = 8.6 * escala;
  const altBasePortao = 3.2 * escala;

  // 2 Torres fortificadas laterais de cantaria
  const largTorre = 2.2 * escala;
  const torreEsq = new THREE.BoxGeometry(largTorre, altBasePortao, 2.2 * escala);
  torreEsq.translate(-largTotal * 0.5 + largTorre * 0.5, altBasePortao * 0.5, 0);
  const torreDir = torreEsq.clone().translate(largTotal - largTorre, 0, 0);

  partes.push({ geo: torreEsq, cor: COR_PEDRA }, { geo: torreDir, cor: COR_PEDRA });

  // Arco e viga superior do vão de passagem
  const vigaPortao = new THREE.BoxGeometry(largTotal - largTorre * 2, 0.8 * escala, 1.8 * escala);
  vigaPortao.translate(0, altBasePortao - 0.4 * escala, 0);
  partes.push({ geo: vigaPortao, cor: COR_PEDRA });

  // Portas de madeira maciça de duas folhas com pregos e anéis de ferro
  const portaEsq = new THREE.BoxGeometry(
    (largTotal - largTorre * 2) * 0.48,
    altBasePortao - 0.8 * escala,
    0.2 * escala
  );
  portaEsq.translate(-(largTotal - largTorre * 2) * 0.25, (altBasePortao - 0.8 * escala) * 0.5, 0);
  const portaDir = portaEsq.clone().translate((largTotal - largTorre * 2) * 0.5, 0, 0);
  partes.push({ geo: portaEsq, cor: COR_LACA }, { geo: portaDir, cor: COR_LACA });

  // Pavilhão superior de guarda com telhado curvo tradicional Han
  const largPavilhao = (largTotal - largTorre * 2) * 1.3;
  const altPavilhao = 2.2 * escala;
  partes.push(
    ...criarParedesComEstruturaMadeira(largPavilhao, 2.0 * escala, altPavilhao, altBasePortao)
  );
  partes.push(
    ...criarTelhadoCurvoHan(
      largPavilhao + 0.6 * escala,
      2.6 * escala,
      2.4 * escala,
      altBasePortao + altPavilhao,
      COR_TELHA,
      COR_OURO
    )
  );

  return mesclarPartes(partes);
}

/**
 * Função de roteamento unificada para edifícios do kit de arquitetura.
 */
export function criarEdificioModularProcedural(
  setorOuTipo: string,
  variante = 0,
  escala = 1.0
): THREE.BufferGeometry {
  switch (setorOuTipo) {
    case 'agricultura':
    case 'casa_taipa_palha':
      return criarCasaTaipaPalha(variante, escala);
    case 'celeiro_elevado':
      return criarCeleiroElevado(variante, escala);
    case 'moinho_agua':
      return criarMoinhoAgua(variante, escala);
    case 'comercio':
    case 'armazem_longo':
      return criarArmazemLongo(variante, escala);
    case 'portico_comercial':
      return criarPorticoComercial(variante, escala);
    case 'barraca_mercado':
      return criarBarracaMercado(variante, escala);
    case 'muralha':
      return criarMuralhaModular(escala);
    case 'portao':
      return criarPortaoModular(escala);
    default:
      // Fallback seguro usando uma das variantes ricas de Agricultura
      return criarCasaTaipaPalha(variante, escala);
  }
}
