import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SementeTerreno } from '../domain';
import { amostrarTerrenoPorSemente, gerarHashSemente } from '../engine';
import {
  colorirGeometriaModular,
  garantirAtributoCorGeometria,
} from './materiaisAvancados';

export type QualidadeVegetacao = 'baixa' | 'media' | 'alta';

interface PontoArvore {
  x: number;
  y: number;
  z: number;
  escala: number;
  rotacao: number;
  cor: THREE.Color;
}

const PALETA_OUTONO_TOTAL_WAR = [
  '#E5AF28', // Ginkgo amarelo ouro brilhante
  '#D46A29', // Tallow chinês laranja outonal
  '#C94A29', // Bordo carmim âmbar
  '#A82E1E', // Folhas vermelhas escuras
  '#788A38', // Folhagem mista dourada/oliva
  '#2E4F38', // Pinheiro verde jade profundo
];

/**
 * Gerenciador de árvores e detalhes do terreno com Níveis de Detalhe (LOD) por distância
 * e adaptação automática à qualidade gráfica (Seção 5.3 e Fase 8).
 */
export class GerenciadorVegetacaoLOD {
  private readonly cena: THREE.Scene;
  private malhaAltaDetalhe: THREE.InstancedMesh | null = null;
  private malhaBaixoDetalhe: THREE.InstancedMesh | null = null;
  private pontosArvores: PontoArvore[] = [];
  private qualidadeAtual: QualidadeVegetacao = 'alta';
  private nivelLodAtivo: 'lod0_alta' | 'lod1_media' | 'lod2_oculto' = 'lod0_alta';

  private readonly capacidadeMaxima = 640;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.inicializarMalhas();
  }

  private criarGeometriaPinheiroAlta(): THREE.BufferGeometry {
    const tronco = colorirGeometriaModular(
      new THREE.CylinderGeometry(0.14, 0.22, 1.1, 6),
      '#5C4033'
    );
    tronco.translate(0, 0.55, 0);

    const copaBase = colorirGeometriaModular(
      new THREE.ConeGeometry(0.95, 1.4, 7),
      '#3A5F43'
    );
    copaBase.translate(0, 1.45, 0);

    const copaTopo = colorirGeometriaModular(
      new THREE.ConeGeometry(0.68, 1.15, 7),
      '#3A5F43'
    );
    copaTopo.translate(0, 2.25, 0);

    const mesclada =
      mergeGeometries([tronco, copaBase, copaTopo], false) ??
      new THREE.ConeGeometry(0.8, 2.2, 6);
    mesclada.computeVertexNormals();
    garantirAtributoCorGeometria(mesclada);
    tronco.dispose();
    copaBase.dispose();
    copaTopo.dispose();
    return mesclada;
  }

  private criarGeometriaPinheiroBaixa(): THREE.BufferGeometry {
    const piramide = colorirGeometriaModular(
      new THREE.ConeGeometry(0.85, 2.3, 4),
      '#466B4E'
    );
    piramide.translate(0, 1.15, 0);
    piramide.computeVertexNormals();
    garantirAtributoCorGeometria(piramide);
    return piramide;
  }

  private inicializarMalhas(): void {
    const geoAlta = this.criarGeometriaPinheiroAlta();
    const matAlta = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.0,
      vertexColors: true,
    });

    this.malhaAltaDetalhe = new THREE.InstancedMesh(
      geoAlta,
      matAlta,
      this.capacidadeMaxima
    );
    this.malhaAltaDetalhe.name = 'vegetacao-lod0-alta';
    this.malhaAltaDetalhe.count = 0;
    this.malhaAltaDetalhe.frustumCulled = false;
    this.malhaAltaDetalhe.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaAltaDetalhe.instanceColor) {
      this.malhaAltaDetalhe.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.cena.add(this.malhaAltaDetalhe);

    const geoBaixa = this.criarGeometriaPinheiroBaixa();
    const matBaixa = new THREE.MeshBasicMaterial({
      vertexColors: true,
    });

    this.malhaBaixoDetalhe = new THREE.InstancedMesh(
      geoBaixa,
      matBaixa,
      this.capacidadeMaxima
    );
    this.malhaBaixoDetalhe.name = 'vegetacao-lod1-baixa';
    this.malhaBaixoDetalhe.count = 0;
    this.malhaBaixoDetalhe.frustumCulled = false;
    this.malhaBaixoDetalhe.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.malhaBaixoDetalhe.instanceColor) {
      this.malhaBaixoDetalhe.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.cena.add(this.malhaBaixoDetalhe);
  }

  public gerarVegetacaoPorSemente(
    semente: SementeTerreno,
    obterAlturaTerreno: (x: number, z: number) => number,
    raioMaximo = 520
  ): void {
    const hashBase = gerarHashSemente(semente);
    let estadoRng = (hashBase % 2147483646) + 1;
    const proximoRng = (): number => {
      estadoRng = (estadoRng * 16807) % 2147483647;
      return (estadoRng - 1) / 2147483646;
    };

    const novosPontos: PontoArvore[] = [];
    const tentativas = this.capacidadeMaxima * 3;

    for (let i = 0; i < tentativas && novosPontos.length < this.capacidadeMaxima; i++) {
      // Distribui em anel/área evitando o centro da metrópole (r < 155)
      const angulo = proximoRng() * Math.PI * 2;
      const distRadial = 155 + proximoRng() * (raioMaximo - 155);
      const x = Math.cos(angulo) * distRadial;
      const z = Math.sin(angulo) * distRadial;

      const amostra = amostrarTerrenoPorSemente(x, z, semente);

      if (amostra.biomaVisual === 'agua' || amostra.biomaVisual === 'pico_rochoso') {
        continue;
      }

      const y = obterAlturaTerreno(x, z);
      // Evita água e topos ultra escarpados
      if (y < 0.6 || y > 15.0) continue;

      const corHex =
        PALETA_OUTONO_TOTAL_WAR[
          Math.floor(proximoRng() * PALETA_OUTONO_TOTAL_WAR.length)
        ]!;

      novosPontos.push({
        x,
        y,
        z,
        escala: 0.85 + proximoRng() * 0.8,
        rotacao: proximoRng() * Math.PI * 2,
        cor: new THREE.Color(corHex),
      });
    }

    this.pontosArvores = novosPontos;
  }

  public atualizarLodPorDistancia(
    posicaoCamera: THREE.Vector3,
    distanciaCamera: number,
    qualidade: QualidadeVegetacao
  ): void {
    this.qualidadeAtual = qualidade;
    if (!this.malhaAltaDetalhe || !this.malhaBaixoDetalhe) return;

    // Na qualidade baixa ou câmera muito afastada (> 550), desativa detalhes secundários
    if (qualidade === 'baixa' || distanciaCamera > 550) {
      this.malhaAltaDetalhe.count = 0;
      this.malhaBaixoDetalhe.count = 0;
      this.malhaAltaDetalhe.visible = false;
      this.malhaBaixoDetalhe.visible = false;
      this.nivelLodAtivo = 'lod2_oculto';
      return;
    }

    const limitePontos =
      qualidade === 'alta'
        ? this.pontosArvores.length
        : Math.floor(this.pontosArvores.length * 0.5);

    const limiarLodAltaSq = qualidade === 'alta' ? 260 * 260 : 160 * 160;
    const limiarMaxSq = 480 * 480;

    const matriz = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();
    const quat = new THREE.Quaternion();
    const esc = new THREE.Vector3();

    let countAlta = 0;
    let countBaixa = 0;

    for (let i = 0; i < limitePontos; i++) {
      const pt = this.pontosArvores[i]!;
      const dx = pt.x - posicaoCamera.x;
      const dy = pt.y - posicaoCamera.y;
      const dz = pt.z - posicaoCamera.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > limiarMaxSq) continue;

      pos.set(pt.x, pt.y, pt.z);
      rot.set(0, pt.rotacao, 0);
      quat.setFromEuler(rot);
      esc.set(pt.escala, pt.escala, pt.escala);
      matriz.compose(pos, quat, esc);

      if (distSq <= limiarLodAltaSq && qualidade === 'alta') {
        this.malhaAltaDetalhe.setMatrixAt(countAlta, matriz);
        if (this.malhaAltaDetalhe.instanceColor) {
          this.malhaAltaDetalhe.setColorAt(countAlta, pt.cor);
        }
        countAlta++;
      } else {
        this.malhaBaixoDetalhe.setMatrixAt(countBaixa, matriz);
        if (this.malhaBaixoDetalhe.instanceColor) {
          this.malhaBaixoDetalhe.setColorAt(countBaixa, pt.cor);
        }
        countBaixa++;
      }
    }

    this.malhaAltaDetalhe.count = countAlta;
    this.malhaBaixoDetalhe.count = countBaixa;
    this.malhaAltaDetalhe.visible = countAlta > 0;
    this.malhaBaixoDetalhe.visible = countBaixa > 0;

    if (countAlta > 0) {
      this.malhaAltaDetalhe.instanceMatrix.needsUpdate = true;
      if (this.malhaAltaDetalhe.instanceColor) {
        this.malhaAltaDetalhe.instanceColor.needsUpdate = true;
      }
    }
    if (countBaixa > 0) {
      this.malhaBaixoDetalhe.instanceMatrix.needsUpdate = true;
      if (this.malhaBaixoDetalhe.instanceColor) {
        this.malhaBaixoDetalhe.instanceColor.needsUpdate = true;
      }
    }

    this.nivelLodAtivo = countAlta > 0 ? 'lod0_alta' : countBaixa > 0 ? 'lod1_media' : 'lod2_oculto';
  }

  public obterEstadoLod(): {
    qualidade: QualidadeVegetacao;
    nivelLodAtivo: 'lod0_alta' | 'lod1_media' | 'lod2_oculto';
    instanciasAlta: number;
    instanciasBaixa: number;
  } {
    return {
      qualidade: this.qualidadeAtual,
      nivelLodAtivo: this.nivelLodAtivo,
      instanciasAlta: this.malhaAltaDetalhe?.count ?? 0,
      instanciasBaixa: this.malhaBaixoDetalhe?.count ?? 0,
    };
  }

  public destruir(): void {
    if (this.malhaAltaDetalhe) {
      this.cena.remove(this.malhaAltaDetalhe);
      this.malhaAltaDetalhe.geometry.dispose();
      (this.malhaAltaDetalhe.material as THREE.Material).dispose();
      this.malhaAltaDetalhe = null;
    }
    if (this.malhaBaixoDetalhe) {
      this.cena.remove(this.malhaBaixoDetalhe);
      this.malhaBaixoDetalhe.geometry.dispose();
      (this.malhaBaixoDetalhe.material as THREE.Material).dispose();
      this.malhaBaixoDetalhe = null;
    }
  }
}
