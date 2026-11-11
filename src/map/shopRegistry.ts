import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETA_MAPA } from '../config/layout';
import {
  criarBarracaMercado,
  criarCeleiroElevado,
  criarPorticoComercial,
} from './arquiteturaModular';

export type TipoModeloLoja =
  | 'padaria'
  | 'acougue'
  | 'taverna'
  | 'armazem_graos'
  | 'ferraria'
  | 'laboratorio_alquimista'
  | 'casa_escribas'
  | 'balanca_cambio'
  | 'banca_generica';

export interface DefinicaoModeloLoja {
  chave: TipoModeloLoja;
  titulo: string;
  iconePadrao: string;
  corPrimaria: string;
  corTelhado: string;
  geometria: THREE.BufferGeometry;
}

function pintarGeometria(geo: THREE.BufferGeometry, corHex: string): THREE.BufferGeometry {
  const naoIndexada = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = naoIndexada.getAttribute('position');
  const cores = new Float32Array(pos.count * 3);
  const c = new THREE.Color(corHex);
  for (let i = 0; i < pos.count; i++) {
    cores[i * 3] = c.r;
    cores[i * 3 + 1] = c.g;
    cores[i * 3 + 2] = c.b;
  }
  naoIndexada.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  naoIndexada.computeVertexNormals();
  return naoIndexada;
}

function mesclarPartesColoridas(
  partes: Array<{ geo: THREE.BufferGeometry; cor: string }>
): THREE.BufferGeometry {
  const pintadas = partes.map((p) => {
    const g = pintarGeometria(p.geo, p.cor);
    p.geo.dispose();
    return g;
  });
  const mesclada = BufferGeometryUtils.mergeGeometries(pintadas, false);
  for (const g of pintadas) g.dispose();
  mesclada.computeVertexNormals();
  return mesclada;
}

/**
 * Normaliza qualquer geometria modular para um volume canônico com base assentada em Y=0
 * e pivô centralizado em X=0, Z=0.
 */
export function normalizarGeometria(
  geo: THREE.BufferGeometry,
  larguraAlvo = 1.0,
  alturaAlvo = 1.0
): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const box = geo.boundingBox ?? new THREE.Box3();
  const tamX = Math.max(0.001, box.max.x - box.min.x);
  const tamY = Math.max(0.001, box.max.y - box.min.y);
  const tamZ = Math.max(0.001, box.max.z - box.min.z);

  const centroX = (box.min.x + box.max.x) * 0.5;
  const centroZ = (box.min.z + box.max.z) * 0.5;
  const baseGroundY = box.min.y;

  geo.translate(-centroX, -baseGroundY, -centroZ);

  const fatorEscala = Math.min(larguraAlvo / Math.max(tamX, tamZ), alturaAlvo / tamY);
  geo.scale(fatorEscala, fatorEscala, fatorEscala);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Constrói geometrias modulares de inspiração Han dos Três Reinos para cada modelo
 * do shopRegistry (Fase 2c). Todas as peças possuem chanfros, base de pedra,
 * reboco, telhados curvos com cumeeira e elementos de identidade setorial.
 */
function criarGeometriaPadaria(): THREE.BufferGeometry {
  const partes: Array<{ geo: THREE.BufferGeometry; cor: string }> = [];

  // Base de pedra
  const base = new THREE.BoxGeometry(0.96, 0.12, 0.92);
  base.translate(0, 0.06, 0);
  partes.push({ geo: base, cor: PALETA_MAPA.pedraBase });

  // Paredes de reboco
  const corpo = new THREE.BoxGeometry(0.86, 0.52, 0.82);
  corpo.translate(0, 0.38, 0);
  partes.push({ geo: corpo, cor: PALETA_MAPA.rebocoClaro });

  // Beiral de madeira
  const beiral = new THREE.BoxGeometry(0.98, 0.08, 0.94);
  beiral.translate(0, 0.68, 0);
  partes.push({ geo: beiral, cor: PALETA_MAPA.madeiraEscura });

  // Telhado Han curvado de terracota
  const telhado = new THREE.ConeGeometry(0.78, 0.38, 4);
  telhado.rotateY(Math.PI * 0.25);
  telhado.translate(0, 0.88, 0);
  partes.push({ geo: telhado, cor: '#B05A36' });

  // Cumeeira ornamental
  const cumeeira = new THREE.BoxGeometry(0.58, 0.08, 0.12);
  cumeeira.translate(0, 1.08, 0);
  partes.push({ geo: cumeeira, cor: PALETA_MAPA.ouro });

  // Chaminé de tijolo (casa de forno com chaminé)
  const chamine = new THREE.BoxGeometry(0.18, 0.52, 0.18);
  chamine.translate(0.24, 0.92, -0.18);
  partes.push({ geo: chamine, cor: PALETA_MAPA.laca });

  // Toldo e bancada de pães
  const toldo = new THREE.BoxGeometry(0.72, 0.06, 0.25);
  toldo.translate(0, 0.44, 0.46);
  const bancada = new THREE.BoxGeometry(0.64, 0.22, 0.2);
  bancada.translate(0, 0.22, 0.44);
  partes.push(
    { geo: toldo, cor: PALETA_MAPA.ouro },
    { geo: bancada, cor: PALETA_MAPA.madeiraEscura }
  );

  // Saco de farinha
  const sacoFarinha = new THREE.BoxGeometry(0.14, 0.18, 0.14);
  sacoFarinha.translate(-0.28, 0.18, 0.45);
  partes.push({ geo: sacoFarinha, cor: PALETA_MAPA.pergaminho });

  return mesclarPartesColoridas(partes);
}

function criarGeometriaAcougue(): THREE.BufferGeometry {
  const partes: Array<{ geo: THREE.BufferGeometry; cor: string }> = [];

  // Base de pedra
  const base = new THREE.BoxGeometry(0.96, 0.12, 0.9);
  base.translate(0, 0.06, 0);
  partes.push({ geo: base, cor: PALETA_MAPA.pedraBase });

  // Paredes de reboco
  const corpo = new THREE.BoxGeometry(0.86, 0.5, 0.8);
  corpo.translate(0, 0.37, 0);
  partes.push({ geo: corpo, cor: PALETA_MAPA.rebocoClaro });

  // Telhado Han vermelho laca
  const telhado = new THREE.ConeGeometry(0.76, 0.36, 4);
  telhado.rotateY(Math.PI * 0.25);
  telhado.translate(0, 0.81, 0);
  partes.push({ geo: telhado, cor: PALETA_MAPA.laca });

  const cumeeira = new THREE.BoxGeometry(0.55, 0.08, 0.12);
  cumeeira.translate(0, 1.0, 0);
  partes.push({ geo: cumeeira, cor: PALETA_MAPA.bronze });

  // Trave frontal com ganchos e balcão de corte
  const trave = new THREE.BoxGeometry(0.82, 0.08, 0.14);
  trave.translate(0, 0.52, 0.45);
  const balcao = new THREE.BoxGeometry(0.68, 0.24, 0.22);
  balcao.translate(0, 0.23, 0.44);
  partes.push(
    { geo: trave, cor: PALETA_MAPA.madeiraEscura },
    { geo: balcao, cor: PALETA_MAPA.bronze }
  );

  return mesclarPartesColoridas(partes);
}

function criarGeometriaTaverna(): THREE.BufferGeometry {
  const partes: Array<{ geo: THREE.BufferGeometry; cor: string }> = [];

  // Base de pedra
  const base = new THREE.BoxGeometry(1.0, 0.12, 0.94);
  base.translate(0, 0.06, 0);
  partes.push({ geo: base, cor: PALETA_MAPA.pedraBase });

  // Andar 1 (salão)
  const andar1 = new THREE.BoxGeometry(0.88, 0.42, 0.82);
  andar1.translate(0, 0.33, 0);
  partes.push({ geo: andar1, cor: PALETA_MAPA.rebocoClaro });

  // Beiral intermediário
  const beiralMeio = new THREE.BoxGeometry(0.98, 0.06, 0.92);
  beiralMeio.translate(0, 0.56, 0);
  partes.push({ geo: beiralMeio, cor: PALETA_MAPA.telhaCinzaAzulada });

  // Andar 2
  const andar2 = new THREE.BoxGeometry(0.72, 0.34, 0.68);
  andar2.translate(0, 0.74, 0);
  partes.push({ geo: andar2, cor: PALETA_MAPA.madeiraEscura });

  // Telhado Han superior
  const telhado = new THREE.ConeGeometry(0.68, 0.34, 4);
  telhado.rotateY(Math.PI * 0.25);
  telhado.translate(0, 1.08, 0);
  partes.push({ geo: telhado, cor: PALETA_MAPA.telhaCinzaAzulada });

  const cumeeira = new THREE.BoxGeometry(0.48, 0.08, 0.1);
  cumeeira.translate(0, 1.26, 0);
  partes.push({ geo: cumeeira, cor: PALETA_MAPA.ouro });

  // Lanterna vermelha acolhedora
  const lanterna = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 6);
  lanterna.translate(-0.32, 0.48, 0.46);
  partes.push({ geo: lanterna, cor: PALETA_MAPA.laca });

  // Barril de vinho
  const barril = new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8);
  barril.translate(0.3, 0.22, 0.46);
  partes.push({ geo: barril, cor: PALETA_MAPA.bronze });

  return mesclarPartesColoridas(partes);
}

function criarGeometriaFerraria(): THREE.BufferGeometry {
  const partes: Array<{ geo: THREE.BufferGeometry; cor: string }> = [];

  // Base de cantaria
  const base = new THREE.BoxGeometry(0.98, 0.12, 0.92);
  base.translate(0, 0.06, 0);
  partes.push({ geo: base, cor: PALETA_MAPA.pedraBase });

  // Oficina com pilares de madeira aparentes
  const oficina = new THREE.BoxGeometry(0.86, 0.46, 0.82);
  oficina.translate(0, 0.35, 0);
  partes.push({ geo: oficina, cor: PALETA_MAPA.madeiraEscura });

  // Telhado
  const telhado = new THREE.ConeGeometry(0.74, 0.32, 4);
  telhado.rotateY(Math.PI * 0.25);
  telhado.translate(0, 0.74, 0);
  partes.push({ geo: telhado, cor: PALETA_MAPA.telhaCinzaAzulada });

  // Chaminé alta de pedra
  const chamine = new THREE.BoxGeometry(0.22, 0.78, 0.22);
  chamine.translate(-0.24, 0.56, -0.2);
  partes.push({ geo: chamine, cor: PALETA_MAPA.pedraBase });

  // Roda de engrenagem de bronze na lateral
  const engrenagem = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 8);
  engrenagem.rotateX(Math.PI * 0.5);
  engrenagem.translate(0.44, 0.38, 0);
  partes.push({ geo: engrenagem, cor: PALETA_MAPA.bronze });

  // Bigorna metálica
  const bigorna = new THREE.BoxGeometry(0.18, 0.16, 0.12);
  bigorna.translate(0.15, 0.2, 0.45);
  partes.push({ geo: bigorna, cor: '#5A7488' });

  return mesclarPartesColoridas(partes);
}

function criarGeometriaLaboratorioAlquimista(): THREE.BufferGeometry {
  const partes: Array<{ geo: THREE.BufferGeometry; cor: string }> = [];

  // Base octogonal de pedra
  const base = new THREE.CylinderGeometry(0.52, 0.56, 0.12, 8);
  base.translate(0, 0.06, 0);
  partes.push({ geo: base, cor: PALETA_MAPA.pedraBase });

  // Pavilhão octogonal
  const pav = new THREE.CylinderGeometry(0.46, 0.48, 0.52, 8);
  pav.translate(0, 0.38, 0);
  partes.push({ geo: pav, cor: PALETA_MAPA.rebocoClaro });

  // Telhado alto de jade com abertura de fumaça
  const telhado = new THREE.ConeGeometry(0.58, 0.46, 8);
  telhado.translate(0, 0.86, 0);
  partes.push({ geo: telhado, cor: PALETA_MAPA.jade });

  // Pináculo e abertura
  const pinaculo = new THREE.ConeGeometry(0.12, 0.26, 6);
  pinaculo.translate(0, 1.2, 0);
  partes.push({ geo: pinaculo, cor: PALETA_MAPA.ouro });

  // Caldeirão de bronze
  const caldeirao = new THREE.CylinderGeometry(0.12, 0.08, 0.18, 8);
  caldeirao.translate(0.28, 0.2, 0.38);
  partes.push({ geo: caldeirao, cor: PALETA_MAPA.bronze });

  return mesclarPartesColoridas(partes);
}

function criarGeometriaCasaEscribas(): THREE.BufferGeometry {
  const partes: Array<{ geo: THREE.BufferGeometry; cor: string }> = [];

  // Pódio de pedra
  const base = new THREE.BoxGeometry(0.98, 0.14, 0.92);
  base.translate(0, 0.07, 0);
  partes.push({ geo: base, cor: PALETA_MAPA.pedraBase });

  // Salão principal
  const salao = new THREE.BoxGeometry(0.86, 0.44, 0.8);
  salao.translate(0, 0.36, 0);
  partes.push({ geo: salao, cor: PALETA_MAPA.rebocoClaro });

  // Telhado 1
  const telhado1 = new THREE.ConeGeometry(0.76, 0.28, 4);
  telhado1.rotateY(Math.PI * 0.25);
  telhado1.translate(0, 0.72, 0);
  partes.push({ geo: telhado1, cor: PALETA_MAPA.telhaCinzaAzulada });

  // Pavilhão superior
  const torre = new THREE.BoxGeometry(0.54, 0.32, 0.5);
  torre.translate(0, 0.98, 0);
  partes.push({ geo: torre, cor: PALETA_MAPA.madeiraEscura });

  // Telhado 2 com remate de ouro
  const telhado2 = new THREE.ConeGeometry(0.48, 0.24, 4);
  telhado2.rotateY(Math.PI * 0.25);
  telhado2.translate(0, 1.24, 0);
  partes.push({ geo: telhado2, cor: PALETA_MAPA.telhaCinzaAzulada });

  const remate = new THREE.BoxGeometry(0.32, 0.08, 0.08);
  remate.translate(0, 1.38, 0);
  partes.push({ geo: remate, cor: PALETA_MAPA.ouro });

  // Estandarte com mensagens
  const estandarte = new THREE.BoxGeometry(0.08, 0.44, 0.02);
  estandarte.translate(-0.35, 0.52, 0.44);
  partes.push({ geo: estandarte, cor: '#6FA3C7' });

  return mesclarPartesColoridas(partes);
}

export class RegistroModelosLoja {
  private readonly modelos = new Map<string, DefinicaoModeloLoja>();
  private readonly chavePadrao: TipoModeloLoja = 'banca_generica';

  constructor() {
    this.registrar({
      chave: 'padaria',
      titulo: 'Padaria',
      iconePadrao: 'pao',
      corPrimaria: '#C9A24B',
      corTelhado: '#8E1F1A',
      geometria: normalizarGeometria(criarGeometriaPadaria(), 1.0, 1.0),
    });
    this.registrar({
      chave: 'acougue',
      titulo: 'Açougue',
      iconePadrao: 'carne',
      corPrimaria: '#8E1F1A',
      corTelhado: '#7A5A2B',
      geometria: normalizarGeometria(criarGeometriaAcougue(), 1.0, 1.0),
    });
    this.registrar({
      chave: 'taverna',
      titulo: 'Taverna (Bebidas)',
      iconePadrao: 'barril',
      corPrimaria: '#7B2D3A',
      corTelhado: '#1F1B16',
      geometria: normalizarGeometria(criarGeometriaTaverna(), 1.0, 1.0),
    });
    this.registrar({
      chave: 'armazem_graos',
      titulo: 'Armazém de Grãos',
      iconePadrao: 'saco_graos',
      corPrimaria: '#7FA35A',
      corTelhado: '#D0B25C',
      geometria: normalizarGeometria(criarCeleiroElevado(0, 1.0), 1.0, 1.0),
    });
    this.registrar({
      chave: 'ferraria',
      titulo: 'Ferraria (Automação & Robótica)',
      iconePadrao: 'engrenagem',
      corPrimaria: '#B07A4A',
      corTelhado: '#5A7488',
      geometria: normalizarGeometria(criarGeometriaFerraria(), 1.0, 1.0),
    });
    this.registrar({
      chave: 'laboratorio_alquimista',
      titulo: 'Laboratório do Alquimista',
      iconePadrao: 'frasco',
      corPrimaria: '#3E7C68',
      corTelhado: '#6F7F72',
      geometria: normalizarGeometria(criarGeometriaLaboratorioAlquimista(), 1.0, 1.0),
    });
    this.registrar({
      chave: 'casa_escribas',
      titulo: 'Casa dos Escribas (Software)',
      iconePadrao: 'pergaminho',
      corPrimaria: '#6FA3C7',
      corTelhado: '#1F1B16',
      geometria: normalizarGeometria(criarGeometriaCasaEscribas(), 1.0, 1.0),
    });
    this.registrar({
      chave: 'balanca_cambio',
      titulo: 'Balança de Câmbio (Comércio)',
      iconePadrao: 'balanca',
      corPrimaria: '#B8923A',
      corTelhado: '#D0B25C',
      geometria: normalizarGeometria(criarPorticoComercial(0, 1.0), 1.0, 1.0),
    });
    this.registrar({
      chave: 'banca_generica',
      titulo: 'Banca Mercantil',
      iconePadrao: 'caixa',
      corPrimaria: '#7A5A2B',
      corTelhado: '#E8DCC0',
      geometria: normalizarGeometria(criarBarracaMercado(0, 1.0), 1.0, 1.0),
    });
  }

  public registrar(definicao: DefinicaoModeloLoja): void {
    this.modelos.set(definicao.chave, definicao);
  }

  public obter(chave: string): DefinicaoModeloLoja {
    return this.modelos.get(chave) ?? this.modelos.get(this.chavePadrao)!;
  }

  public listarTodos(): DefinicaoModeloLoja[] {
    return Array.from(this.modelos.values());
  }

  public destruir(): void {
    for (const def of this.modelos.values()) {
      def.geometria.dispose();
    }
    this.modelos.clear();
  }
}

export const OPCOES_TIPO_LOJA: ReadonlyArray<{
  chave: TipoModeloLoja;
  rotulo: string;
  iconeSugerido: string;
}> = [
  { chave: 'padaria', rotulo: '🥖 Padaria (Alimentos)', iconeSugerido: 'pao' },
  { chave: 'acougue', rotulo: '🥩 Açougue', iconeSugerido: 'carne' },
  { chave: 'taverna', rotulo: '🍺 Taverna (Bebidas)', iconeSugerido: 'barril' },
  { chave: 'armazem_graos', rotulo: '🌾 Armazém de Grãos (Agricultura)', iconeSugerido: 'saco_graos' },
  { chave: 'ferraria', rotulo: '⚒️ Ferraria (Automação e Robótica)', iconeSugerido: 'engrenagem' },
  { chave: 'laboratorio_alquimista', rotulo: '⚗️ Laboratório do Alquimista (Química)', iconeSugerido: 'frasco' },
  { chave: 'casa_escribas', rotulo: '📜 Casa dos Escribas (Software)', iconeSugerido: 'pergaminho' },
  { chave: 'balanca_cambio', rotulo: '⚖️ Balança de Câmbio (Comércio)', iconeSugerido: 'balanca' },
  { chave: 'banca_generica', rotulo: '⛺ Banca Genérica', iconeSugerido: 'caixa' },
];

