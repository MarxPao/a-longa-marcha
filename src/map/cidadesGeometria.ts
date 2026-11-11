import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETA_MAPA } from '../config/layout';
import {
  aplicarDesgasteEContatoGeometria,
  colorirGeometriaModular,
  garantirAtributoCorGeometria,
} from './materiaisAvancados';
import {
  criarArmazemLongo,
  criarCasaTaipaPalha,
  criarCeleiroElevado,
  criarMuralhaModular,
  criarPortaoModular,
  criarPorticoComercial,
} from './arquiteturaModular';

export type NivelMaturidadeVisual = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 0;

// Paleta arquitetural canônica Han (Seção 4: telha cinza-azulada, reboco claro, madeira escura, pedra)
const COR_MADEIRA = PALETA_MAPA.madeiraEscura;
const COR_REBOCO = PALETA_MAPA.rebocoClaro;
const COR_TELHA = PALETA_MAPA.telhaCinzaAzulada;
const COR_PEDRA = PALETA_MAPA.pedraBase;
const COR_TENDA = PALETA_MAPA.terraClara;
const COR_FOGO = '#D96B27';
const COR_LACA = PALETA_MAPA.laca;
const COR_OURO = PALETA_MAPA.ouro;
const COR_ACO = '#8A9BA8';

interface ParteColorida {
  geo: THREE.BufferGeometry;
  cor: string;
}

function mesclarComCores(partes: ParteColorida[]): THREE.BufferGeometry {
  const pintadas: THREE.BufferGeometry[] = partes.map((p) => {
    const pintada = colorirGeometriaModular(p.geo, p.cor);
    p.geo.dispose();
    return pintada;
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
  const tenda1 = new THREE.ConeGeometry(1.6, 2.4, 6);
  tenda1.translate(0, 1.2, 0);

  const tenda2 = new THREE.ConeGeometry(1.1, 1.8, 6);
  tenda2.translate(-1.8, 0.9, 0.8);

  const fogueira = new THREE.CylinderGeometry(0.5, 0.6, 0.3, 6);
  fogueira.translate(1.5, 0.15, 1.2);

  const brasa = new THREE.ConeGeometry(0.35, 0.6, 5);
  brasa.translate(1.5, 0.5, 1.2);

  return mesclarComCores([
    { geo: tenda1, cor: COR_TENDA },
    { geo: tenda2, cor: COR_TENDA },
    { geo: fogueira, cor: COR_PEDRA },
    { geo: brasa, cor: COR_FOGO },
  ]);
}

/**
 * Nível 2: Expedição — Paliçada de estacas de madeira e torre de vigia rústica.
 */
function criarGeometriaExpedicao(): THREE.BufferGeometry {
  const partes: ParteColorida[] = [];

  // Torre de vigia (4 pilares de madeira)
  const pilar1 = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 4);
  pilar1.translate(-0.8, 1.9, -0.8);
  const pilar2 = pilar1.clone().translate(1.6, 0, 0);
  const pilar3 = pilar1.clone().translate(0, 0, 1.6);
  const pilar4 = pilar1.clone().translate(1.6, 0, 1.6);

  const plataforma = new THREE.BoxGeometry(2.0, 0.2, 2.0);
  plataforma.translate(0, 3.8, 0);

  const telhado = criarTelhadoChines(2.0, 1.0, 0.6, 3.9);

  partes.push(
    { geo: pilar1, cor: COR_MADEIRA },
    { geo: pilar2, cor: COR_MADEIRA },
    { geo: pilar3, cor: COR_MADEIRA },
    { geo: pilar4, cor: COR_MADEIRA },
    { geo: plataforma, cor: COR_MADEIRA },
    { geo: telhado, cor: COR_TELHA }
  );

  // Tenda de comando da expedição no centro do acampamento
  const tenda = new THREE.ConeGeometry(1.4, 2.0, 6);
  tenda.translate(0, 1.0, 0);
  partes.push({ geo: tenda, cor: COR_TENDA });

  // Paliçada perimetral circular (estacas de madeira)
  const numEstacas = 12;
  const raio = 3.2;
  for (let i = 0; i < numEstacas; i++) {
    const ang = (i / numEstacas) * Math.PI * 2;
    if (i === 0) continue; // vão de entrada
    const estaca = new THREE.CylinderGeometry(0.15, 0.18, 1.5, 4);
    estaca.translate(Math.cos(ang) * raio, 0.75, Math.sin(ang) * raio);
    partes.push({ geo: estaca, cor: COR_MADEIRA });
  }

  return mesclarComCores(partes);
}

/**
 * Nível 3: Assentamento — Cabana rural Han com beirais curvos, celeiro elevado e mastro com estandarte.
 */
function criarGeometriaAssentamento(): THREE.BufferGeometry {
  const geoCasa = criarCasaTaipaPalha(0, 0.72);
  geoCasa.translate(0.5, 0, -0.4);

  const geoCeleiro = criarCeleiroElevado(0, 0.62);
  geoCeleiro.translate(-1.8, 0, 0.5);

  const mastro = new THREE.CylinderGeometry(0.06, 0.08, 3.2, 4);
  mastro.translate(1.8, 1.6, 1.2);
  const bandeira = new THREE.BoxGeometry(0.8, 0.5, 0.04);
  bandeira.translate(2.2, 2.8, 1.2);

  const partesMastro = mesclarComCores([
    { geo: mastro, cor: COR_MADEIRA },
    { geo: bandeira, cor: COR_LACA },
  ]);

  const mesclada = mergeGeometries([geoCasa, geoCeleiro, partesMastro], false);
  geoCasa.dispose();
  geoCeleiro.dispose();
  partesMastro.dispose();

  mesclada.computeVertexNormals();
  aplicarDesgasteEContatoGeometria(mesclada);
  garantirAtributoCorGeometria(mesclada);
  return mesclada;
}

/**
 * Nível 4: Vila — Conjunto de casas Han com pátio, celeiro elevado, armazém e muro com portal.
 */
function criarGeometriaVila(): THREE.BufferGeometry {
  const casaNorte = criarCasaTaipaPalha(1, 0.82);
  casaNorte.translate(0, 0, -1.8);

  const celeiroOeste = criarCeleiroElevado(1, 0.72);
  celeiroOeste.translate(-2.2, 0, 0.4);

  const armazemLeste = criarArmazemLongo(0, 0.65);
  armazemLeste.rotateY(-Math.PI / 2);
  armazemLeste.translate(2.2, 0, 0.4);

  // Muro perimetral baixo (taipa/pedra) e portal
  const muroSulEsq = new THREE.BoxGeometry(1.6, 0.8, 0.3);
  muroSulEsq.translate(-1.8, 0.4, 2.2);
  const muroSulDir = new THREE.BoxGeometry(1.6, 0.8, 0.3);
  muroSulDir.translate(1.8, 0.4, 2.2);

  const pilarEntrada1 = new THREE.BoxGeometry(0.2, 1.4, 0.2);
  pilarEntrada1.translate(-0.8, 0.7, 2.2);
  const pilarEntrada2 = pilarEntrada1.clone().translate(1.6, 0, 0);
  const vigaEntrada = new THREE.BoxGeometry(2.0, 0.2, 0.3);
  vigaEntrada.translate(0, 1.4, 2.2);

  const partesMuro = mesclarComCores([
    { geo: muroSulEsq, cor: COR_PEDRA },
    { geo: muroSulDir, cor: COR_PEDRA },
    { geo: pilarEntrada1, cor: COR_MADEIRA },
    { geo: pilarEntrada2, cor: COR_MADEIRA },
    { geo: vigaEntrada, cor: COR_MADEIRA },
  ]);

  const mesclada = mergeGeometries([casaNorte, celeiroOeste, armazemLeste, partesMuro], false);
  casaNorte.dispose();
  celeiroOeste.dispose();
  armazemLeste.dispose();
  partesMuro.dispose();

  mesclada.computeVertexNormals();
  aplicarDesgasteEContatoGeometria(mesclada);
  garantirAtributoCorGeometria(mesclada);
  return mesclada;
}

/**
 * Nível 5: Cidade — "CHEN - Regional City" (conforme Screenshot 3 de Total War: Three Kingdoms):
 * Muralhas de pedra completas com ameias, portão monumental fortificado com pavilhão Han,
 * e interior denso com armazém longo, pórtico mercantil e casas Han com telhados curvos.
 */
function criarGeometriaCidade(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // 1. Muralhas perimetrais fortificadas com ameias (escala 0.95)
  // Muralha Norte
  const muralhaNorte = criarMuralhaModular(0.95);
  muralhaNorte.translate(0, 0, -4.0);
  geos.push(muralhaNorte);

  // Muralha Leste
  const muralhaLeste = criarMuralhaModular(0.95);
  muralhaLeste.rotateY(-Math.PI / 2);
  muralhaLeste.translate(4.0, 0, 0);
  geos.push(muralhaLeste);

  // Muralha Oeste
  const muralhaOeste = criarMuralhaModular(0.95);
  muralhaOeste.rotateY(Math.PI / 2);
  muralhaOeste.translate(-4.0, 0, 0);
  geos.push(muralhaOeste);

  // 2. Portão Monumental Fortificado Han ao Sul (de frente para a estrada)
  const portaoSul = criarPortaoModular(0.92);
  portaoSul.translate(0, 0, 4.0);
  geos.push(portaoSul);

  // 3. Interior denso:
  // Salão Central / Commandery com telhado curvo tradicional Han
  const salaoCentral = criarArmazemLongo(1, 0.78);
  salaoCentral.translate(0, 0, -1.2);
  geos.push(salaoCentral);

  // Armazém / Guilda comercial a oeste
  const armazemOeste = criarArmazemLongo(0, 0.65);
  armazemOeste.rotateY(Math.PI / 2);
  armazemOeste.translate(-2.0, 0, 0.6);
  geos.push(armazemOeste);

  // Pórtico comercial / mercado a leste
  const porticoLeste = criarPorticoComercial(0, 0.65);
  porticoLeste.rotateY(-Math.PI / 2);
  porticoLeste.translate(2.0, 0, 0.6);
  geos.push(porticoLeste);

  // Casas residenciais Han com beirais curvos
  const casa1 = criarCasaTaipaPalha(0, 0.6);
  casa1.translate(-1.8, 0, -2.6);
  geos.push(casa1);

  const casa2 = criarCasaTaipaPalha(1, 0.6);
  casa2.translate(1.8, 0, -2.6);
  geos.push(casa2);

  // 4 Torres de canto
  const coordsCanto: Array<[number, number]> = [
    [-4.0, -4.0],
    [4.0, -4.0],
    [-4.0, 4.0],
    [4.0, 4.0],
  ];
  for (const [cx, cz] of coordsCanto) {
    const torre = new THREE.BoxGeometry(1.4, 3.0, 1.4);
    torre.translate(cx, 1.5, cz);
    const telhadoTorre = criarTelhadoChines(1.4, 0.9, 0.5, 3.0);
    telhadoTorre.translate(cx, 0, cz);
    geos.push(colorirGeometriaModular(torre, COR_PEDRA));
    geos.push(colorirGeometriaModular(telhadoTorre, COR_TELHA));
  }

  const mesclada = mergeGeometries(geos, false);
  for (const g of geos) {
    g.dispose();
  }

  mesclada.computeVertexNormals();
  aplicarDesgasteEContatoGeometria(mesclada);
  garantirAtributoCorGeometria(mesclada);
  return mesclada;
}

/**
 * Nível 6: Metrópole — Cidadela fortificada com muralhas maciças, pagode de 3 andares e bairros densos.
 */
function criarGeometriaMetropole(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Muralhas externas maciças
  const muralhaNorte = criarMuralhaModular(1.35);
  muralhaNorte.translate(0, 0, -5.5);
  geos.push(muralhaNorte);

  const muralhaLeste = criarMuralhaModular(1.35);
  muralhaLeste.rotateY(-Math.PI / 2);
  muralhaLeste.translate(5.5, 0, 0);
  geos.push(muralhaLeste);

  const muralhaOeste = criarMuralhaModular(1.35);
  muralhaOeste.rotateY(Math.PI / 2);
  muralhaOeste.translate(-5.5, 0, 0);
  geos.push(muralhaOeste);

  const portaoSul = criarPortaoModular(1.2);
  portaoSul.translate(0, 0, 5.5);
  geos.push(portaoSul);

  // Pagode imperial central de 3 andares com beirais curvos
  const base1 = new THREE.BoxGeometry(3.6, 1.8, 3.6);
  base1.translate(0, 0.9, -1.0);
  const telhado1 = criarTelhadoChines(3.6, 1.1, 1.0, 1.8);
  telhado1.translate(0, 0, -1.0);

  const base2 = new THREE.BoxGeometry(2.7, 1.6, 2.7);
  base2.translate(0, 3.3, -1.0);
  const telhado2 = criarTelhadoChines(2.7, 1.1, 0.9, 4.9);
  telhado2.translate(0, 0, -1.0);

  const base3 = new THREE.BoxGeometry(1.8, 1.4, 1.8);
  base3.translate(0, 6.2, -1.0);
  const telhado3 = criarTelhadoChines(1.8, 1.3, 0.8, 7.6);
  telhado3.translate(0, 0, -1.0);

  geos.push(colorirGeometriaModular(base1, COR_REBOCO));
  geos.push(colorirGeometriaModular(telhado1, COR_TELHA));
  geos.push(colorirGeometriaModular(base2, COR_REBOCO));
  geos.push(colorirGeometriaModular(telhado2, COR_TELHA));
  geos.push(colorirGeometriaModular(base3, COR_REBOCO));
  geos.push(colorirGeometriaModular(telhado3, COR_TELHA));

  // Edifícios de apoio nos quadrantes internos
  const armazem1 = criarArmazemLongo(1, 0.75);
  armazem1.rotateY(Math.PI / 2);
  armazem1.translate(-3.0, 0, 1.2);
  geos.push(armazem1);

  const portico1 = criarPorticoComercial(1, 0.75);
  portico1.rotateY(-Math.PI / 2);
  portico1.translate(3.0, 0, 1.2);
  geos.push(portico1);

  const mesclada = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();

  mesclada.computeVertexNormals();
  aplicarDesgasteEContatoGeometria(mesclada);
  garantirAtributoCorGeometria(mesclada);
  return mesclada;
}

/**
 * Nível 7: Legado / Maravilha — Palácio imperial monumental, cúpula dourada e muralhas duplas.
 */
function criarGeometriaLegado(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Pátio em degraus / terraço de mármore/pedra
  const terraco = new THREE.BoxGeometry(14.0, 0.8, 14.0);
  terraco.translate(0, 0.4, 0);
  geos.push(colorirGeometriaModular(terraco, COR_PEDRA));

  // Muralhas perimetrais com portão monumental
  const muralhaNorte = criarMuralhaModular(1.6);
  muralhaNorte.translate(0, 0.8, -6.8);
  geos.push(muralhaNorte);

  const muralhaLeste = criarMuralhaModular(1.6);
  muralhaLeste.rotateY(-Math.PI / 2);
  muralhaLeste.translate(6.8, 0.8, 0);
  geos.push(muralhaLeste);

  const muralhaOeste = criarMuralhaModular(1.6);
  muralhaOeste.rotateY(Math.PI / 2);
  muralhaOeste.translate(-6.8, 0.8, 0);
  geos.push(muralhaOeste);

  const portaoSul = criarPortaoModular(1.4);
  portaoSul.translate(0, 0.8, 6.8);
  geos.push(portaoSul);

  // Pavilhão do trono imperial
  const tronoCorpo = new THREE.BoxGeometry(5.4, 2.6, 4.4);
  tronoCorpo.translate(0, 2.1, -1.2);
  const telhadoTrono1 = criarTelhadoChines(5.4, 1.5, 1.4, 3.4);
  telhadoTrono1.translate(0, 0, -1.2);

  const tronoSuperior = new THREE.BoxGeometry(3.6, 2.2, 2.8);
  tronoSuperior.translate(0, 5.0, -1.2);
  const telhadoTrono2 = criarTelhadoChines(3.6, 1.8, 1.2, 7.2);
  telhadoTrono2.translate(0, 0, -1.2);

  // Agulha imperial dourada no topo
  const agulha = new THREE.ConeGeometry(0.38, 2.6, 8);
  agulha.translate(0, 9.8, -1.2);

  geos.push(colorirGeometriaModular(tronoCorpo, COR_REBOCO));
  geos.push(colorirGeometriaModular(telhadoTrono1, COR_OURO));
  geos.push(colorirGeometriaModular(tronoSuperior, COR_REBOCO));
  geos.push(colorirGeometriaModular(telhadoTrono2, COR_OURO));
  geos.push(colorirGeometriaModular(agulha, COR_OURO));

  // Pavilhões laterais
  const pavEsq = criarPorticoComercial(1, 0.85);
  pavEsq.rotateY(Math.PI / 2);
  pavEsq.translate(-4.5, 0.8, 1.5);
  geos.push(pavEsq);

  const pavDir = criarPorticoComercial(0, 0.85);
  pavDir.rotateY(-Math.PI / 2);
  pavDir.translate(4.5, 0.8, 1.5);
  geos.push(pavDir);

  const mesclada = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();

  mesclada.computeVertexNormals();
  aplicarDesgasteEContatoGeometria(mesclada);
  garantirAtributoCorGeometria(mesclada);
  return mesclada;
}

/**
 * Nível 0: Ruínas — Muralha desabada, colunas partidas e escombros de guerra.
 */
function criarGeometriaRuinas(): THREE.BufferGeometry {
  const partes: ParteColorida[] = [];

  const muroQuebrado1 = new THREE.BoxGeometry(2.5, 0.8, 0.6);
  muroQuebrado1.rotateY(-0.25);
  muroQuebrado1.translate(-1.2, 0.4, -0.6);

  const muroQuebrado2 = new THREE.BoxGeometry(2.0, 0.5, 1.2);
  muroQuebrado2.rotateY(0.4);
  muroQuebrado2.translate(1.4, 0.25, 0.8);

  const coluna1 = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 6);
  coluna1.rotateX(Math.PI * 0.45);
  coluna1.translate(0.5, 0.45, -1.2);

  const coluna2 = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 6);
  coluna2.rotateZ(-0.3);
  coluna2.translate(-1.8, 0.65, -0.8);

  const bloco1 = new THREE.BoxGeometry(0.6, 0.4, 0.5);
  bloco1.translate(1.0, 0.2, -0.2);
  const bloco2 = new THREE.BoxGeometry(0.5, 0.3, 0.7);
  bloco2.translate(-0.4, 0.15, 1.5);

  partes.push(
    { geo: muroQuebrado1, cor: COR_PEDRA },
    { geo: muroQuebrado2, cor: COR_PEDRA },
    { geo: coluna1, cor: COR_PEDRA },
    { geo: coluna2, cor: COR_PEDRA },
    { geo: bloco1, cor: COR_PEDRA },
    { geo: bloco2, cor: COR_PEDRA }
  );

  return mesclarComCores(partes);
}

/**
 * Modelo estilizado de General Han de Campanha (estilo estátua/token Total War).
 */
export function criarGeometriaGeneralTotalWar(): THREE.BufferGeometry {
  const partes: ParteColorida[] = [];

  // Pedestal ornamental
  const pedestal = new THREE.CylinderGeometry(0.9, 1.0, 0.4, 8);
  pedestal.translate(0, 0.2, 0);

  // Pernas / armadura inferior
  const pernas = new THREE.BoxGeometry(0.7, 1.1, 0.5);
  pernas.translate(0, 0.95, 0);

  // Tronco com couraça de laca e dragão
  const tronco = new THREE.BoxGeometry(0.95, 1.2, 0.65);
  tronco.translate(0, 2.1, 0);

  // Ombreiras volumosas tradicionais (pao)
  const ombreiraEsq = new THREE.ConeGeometry(0.35, 0.6, 4);
  ombreiraEsq.rotateZ(Math.PI * 0.4);
  ombreiraEsq.translate(-0.65, 2.5, 0);

  const ombreiraDir = new THREE.ConeGeometry(0.35, 0.6, 4);
  ombreiraDir.rotateZ(-Math.PI * 0.4);
  ombreiraDir.translate(0.65, 2.5, 0);

  // Cabeça e elmo tradicional de penas
  const cabeca = new THREE.SphereGeometry(0.32, 8, 8);
  cabeca.translate(0, 3.0, 0);

  const elmo = new THREE.ConeGeometry(0.38, 0.7, 6);
  elmo.translate(0, 3.45, 0);

  const pluma = new THREE.CylinderGeometry(0.04, 0.08, 0.6, 4);
  pluma.translate(0, 3.9, -0.1);

  // Manto/capa traseira
  const capa = new THREE.BoxGeometry(0.9, 1.8, 0.15);
  capa.rotateX(0.12);
  capa.translate(0, 1.9, -0.38);

  partes.push(
    { geo: pedestal, cor: COR_PEDRA },
    { geo: pernas, cor: COR_MADEIRA },
    { geo: tronco, cor: COR_LACA },
    { geo: ombreiraEsq, cor: COR_OURO },
    { geo: ombreiraDir, cor: COR_OURO },
    { geo: cabeca, cor: COR_REBOCO },
    { geo: elmo, cor: COR_OURO },
    { geo: pluma, cor: COR_LACA },
    { geo: capa, cor: COR_LACA }
  );

  // Guan Dao / Alabarda na mão
  const haste = new THREE.CylinderGeometry(0.04, 0.04, 3.6, 4);
  haste.translate(0.65, 1.8, 0.4);

  const lamina = new THREE.BoxGeometry(0.06, 0.9, 0.28);
  lamina.translate(0.65, 3.4, 0.4);

  const estandarte = new THREE.BoxGeometry(0.03, 0.8, 0.5);
  estandarte.translate(0.65, 3.3, 0.72);

  partes.push(
    { geo: haste, cor: COR_MADEIRA },
    { geo: lamina, cor: COR_ACO },
    { geo: estandarte, cor: COR_OURO }
  );

  return mesclarComCores(partes);
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
