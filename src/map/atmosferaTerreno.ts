import * as THREE from 'three';
import type { Projeto, SementeTerreno } from '../domain';
import { amostrarTerrenoPorSemente, gerarHashSemente } from '../engine';

/**
 * Gerenciador de Atmosfera e Acabamento do Mapa 3D (Seções 4.4, 4.7 e Fase 9):
 * - Rios que seguem os vales
 * - Névoa de guerra com estética de tinta dissolvida em água (cobre áreas sem projeto ativo)
 * - Partículas douradas de crescimento e névoa de moral baixa
 * - Respeito estrito a `reduzirMovimento` (Seção 6.8)
 */
export class GerenciadorAtmosferaMapa {
  private readonly cena: THREE.Scene;
  private grupoRios: THREE.Group;
  private malhaNevoaGuerra: THREE.InstancedMesh | null = null;
  private malhaNevoaMoralBaixa: THREE.InstancedMesh | null = null;
  private pontosParticulasOuro: THREE.Points | null = null;

  private celulasNevoaGuerra: Array<{ x: number; z: number; escala: number }> = [];
  private celulasAtivasNevoaGuerra = 0;
  private reduzirMovimento = false;
  private tempoAcumulado = 0;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.grupoRios = new THREE.Group();
    this.grupoRios.name = 'atmosfera-rios-vales';
    this.cena.add(this.grupoRios);

    this.inicializarNevoaDeGuerra();
    this.inicializarNevoaMoralBaixa();
    this.inicializarParticulasCrescimento();
  }

  private inicializarNevoaDeGuerra(): void {
    // Grade de nuvens baixas de tinta aguada cobrindo regiões distantes de cidades ativas
    const passos = 14;
    const alcance = 145;
    const celulas: Array<{ x: number; z: number; escala: number }> = [];

    for (let ix = -passos; ix <= passos; ix++) {
      for (let iz = -passos; iz <= passos; iz++) {
        const x = (ix / passos) * alcance;
        const z = (iz / passos) * alcance;
        celulas.push({ x, z, escala: 14 + ((Math.abs(ix * 7 + iz * 13) % 5) * 1.8) });
      }
    }
    this.celulasNevoaGuerra = celulas;

    const geoDisco = new THREE.CircleGeometry(1, 10);
    geoDisco.rotateX(-Math.PI / 2);

    const matTintaAguada = new THREE.MeshBasicMaterial({
      color: '#2B2823',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });

    this.malhaNevoaGuerra = new THREE.InstancedMesh(
      geoDisco,
      matTintaAguada,
      celulas.length
    );
    this.malhaNevoaGuerra.name = 'atmosfera-nevoa-de-guerra';
    this.malhaNevoaGuerra.count = 0;
    this.malhaNevoaGuerra.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaNevoaGuerra);
  }

  private inicializarNevoaMoralBaixa(): void {
    const geoAnelNevoa = new THREE.RingGeometry(1.8, 4.2, 16);
    geoAnelNevoa.rotateX(-Math.PI / 2);

    const matNevoa = new THREE.MeshBasicMaterial({
      color: '#9DAAB0',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.malhaNevoaMoralBaixa = new THREE.InstancedMesh(geoAnelNevoa, matNevoa, 512);
    this.malhaNevoaMoralBaixa.name = 'atmosfera-nevoa-moral-baixa';
    this.malhaNevoaMoralBaixa.count = 0;
    this.malhaNevoaMoralBaixa.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaNevoaMoralBaixa);
  }

  private inicializarParticulasCrescimento(): void {
    const qtd = 120;
    const posicoes = new Float32Array(qtd * 3);
    for (let i = 0; i < qtd; i++) {
      posicoes[i * 3] = 0;
      posicoes[i * 3 + 1] = -999;
      posicoes[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));

    const mat = new THREE.PointsMaterial({
      color: '#E5B842',
      size: 1.6,
      transparent: true,
      opacity: 0.85,
    });

    this.pontosParticulasOuro = new THREE.Points(geo, mat);
    this.pontosParticulasOuro.name = 'atmosfera-particulas-crescimento';
    this.cena.add(this.pontosParticulasOuro);
  }

  /**
   * Gera leitos de rios sinuosos que seguem os vales do terreno para a semente atual (Seção 4.7).
   */
  public gerarRiosPorSemente(
    semente: SementeTerreno,
    obterAlturaTerreno: (x: number, z: number) => number
  ): void {
    this.limparRios();
    const hash = gerarHashSemente(semente);

    // Dois rios imperiais principais cruzando os vales
    for (let r = 0; r < 2; r++) {
      const pontosRio: THREE.Vector3[] = [];
      const passos = 28;
      const faseOffset = ((hash >> (r * 4)) & 0xff) * 0.05;

      for (let i = 0; i <= passos; i++) {
        const t = i / passos;
        const x = -135 + t * 270;
        const desvioBase =
          Math.sin(t * Math.PI * 2.2 + faseOffset) * 38 +
          (r === 0 ? -28 : 32);

        // Procura cota mais baixa na vizinhança transversal para seguir o vale
        let melhorZ = desvioBase;
        let menorY = Infinity;
        for (let offset = -12; offset <= 12; offset += 6) {
          const zCand = desvioBase + offset;
          const amostra = amostrarTerrenoPorSemente(x, zCand, semente);
          if (amostra.altura < menorY) {
            menorY = amostra.altura;
            melhorZ = zCand;
          }
        }

        const yTerreno = obterAlturaTerreno(x, melhorZ);
        pontosRio.push(new THREE.Vector3(x, Math.max(-1.05, yTerreno + 0.18), melhorZ));
      }

      const curva = new THREE.CatmullRomCurve3(pontosRio);
      const geoRio = new THREE.TubeGeometry(curva, 36, 1.35 - r * 0.25, 5, false);
      geoRio.scale(1, 0.15, 1);

      const matRio = new THREE.MeshStandardMaterial({
        color: '#346E5F',
        roughness: 0.2,
        metalness: 0.15,
        transparent: true,
        opacity: 0.88,
      });

      const malhaRio = new THREE.Mesh(geoRio, matRio);
      malhaRio.name = `rio-imperial-${r + 1}`;
      this.grupoRios.add(malhaRio);
    }
  }

  /**
   * Atualiza névoa de guerra (áreas sem projeto ativo), névoa de moral baixa e partículas douradas.
   */
  public atualizarEstadoAtmosfera(
    projetosAtivos: Projeto[],
    moralPorProjeto: Map<string, number>,
    fasePorProjeto: Map<string, number>,
    obterAlturaTerreno: (x: number, z: number) => number
  ): void {
    // 1. Névoa de Guerra (cobre células distantes > 48 unidades de qualquer cidade ativa)
    if (this.malhaNevoaGuerra) {
      const raioDescobertaSq = 48 * 48;
      const mat = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const esc = new THREE.Vector3();
      let countNevoa = 0;

      for (const cel of this.celulasNevoaGuerra) {
        let cobertaPorCidade = false;
        for (const p of projetosAtivos) {
          const dx = cel.x - p.x;
          const dz = cel.z - p.z;
          if (dx * dx + dz * dz <= raioDescobertaSq) {
            cobertaPorCidade = true;
            break;
          }
        }

        if (!cobertaPorCidade) {
          const y = Math.max(0, obterAlturaTerreno(cel.x, cel.z)) + 1.8;
          pos.set(cel.x, y, cel.z);
          esc.set(cel.escala, 1, cel.escala);
          mat.compose(pos, quat, esc);
          this.malhaNevoaGuerra.setMatrixAt(countNevoa++, mat);
        }
      }

      this.malhaNevoaGuerra.count = countNevoa;
      this.malhaNevoaGuerra.visible = countNevoa > 0;
      this.malhaNevoaGuerra.instanceMatrix.needsUpdate = true;
      this.celulasAtivasNevoaGuerra = countNevoa;
    }

    // 2. Névoa sobre cidades com moral baixa (< 0.45)
    if (this.malhaNevoaMoralBaixa) {
      const mat = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const esc = new THREE.Vector3(1, 1, 1);
      let countMoralBaixa = 0;

      for (const p of projetosAtivos) {
        const moral = moralPorProjeto.get(p.id) ?? 0.5;
        if (moral < 0.45 && countMoralBaixa < 512) {
          const y = obterAlturaTerreno(p.x, p.z) + 1.4;
          pos.set(p.x, y, p.z);
          mat.compose(pos, quat, esc);
          this.malhaNevoaMoralBaixa.setMatrixAt(countMoralBaixa++, mat);
        }
      }

      this.malhaNevoaMoralBaixa.count = countMoralBaixa;
      this.malhaNevoaMoralBaixa.visible = countMoralBaixa > 0;
      this.malhaNevoaMoralBaixa.instanceMatrix.needsUpdate = true;
    }

    // 3. Partículas douradas de crescimento sobre cidades em fases avançadas (≥ 2)
    if (this.pontosParticulasOuro) {
      const attrPos = this.pontosParticulasOuro.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      const cidadesCrescentes = projetosAtivos.filter(
        (p) => (fasePorProjeto.get(p.id) ?? 1) >= 2
      );

      for (let i = 0; i < attrPos.count; i++) {
        if (cidadesCrescentes.length === 0 || this.reduzirMovimento) {
          attrPos.setXYZ(i, 0, -999, 0);
          continue;
        }
        const cidade = cidadesCrescentes[i % cidadesCrescentes.length]!;
        const ang = (i * 1.37) % (Math.PI * 2);
        const raio = 1.2 + (i % 5) * 0.45;
        const yBase = obterAlturaTerreno(cidade.x, cidade.z) + 2.2 + (i % 6) * 0.7;
        attrPos.setXYZ(
          i,
          cidade.x + Math.cos(ang) * raio,
          yBase,
          cidade.z + Math.sin(ang) * raio
        );
      }
      attrPos.needsUpdate = true;
      this.pontosParticulasOuro.visible =
        !this.reduzirMovimento && cidadesCrescentes.length > 0;
    }
  }

  public animarQuadro(deltaSegundos: number): void {
    if (this.reduzirMovimento || !this.pontosParticulasOuro) return;
    if (!this.pontosParticulasOuro.visible) return;

    this.tempoAcumulado += deltaSegundos;
    this.pontosParticulasOuro.position.y = Math.sin(this.tempoAcumulado * 2.2) * 0.65;
  }

  public definirReduzirMovimento(reduzir: boolean): void {
    this.reduzirMovimento = reduzir;
    if (this.pontosParticulasOuro) {
      this.pontosParticulasOuro.visible = !reduzir;
      if (reduzir) {
        this.pontosParticulasOuro.position.y = 0;
      }
    }
  }

  public obterEstadoAtmosfera(): {
    riosRenderizados: number;
    celulasNevoaGuerraAtivas: number;
    cidadesComNevoaMoralBaixa: number;
    particulasAtivas: boolean;
    reduzirMovimento: boolean;
  } {
    return {
      riosRenderizados: this.grupoRios.children.length,
      celulasNevoaGuerraAtivas: this.celulasAtivasNevoaGuerra,
      cidadesComNevoaMoralBaixa: this.malhaNevoaMoralBaixa?.count ?? 0,
      particulasAtivas: Boolean(this.pontosParticulasOuro?.visible),
      reduzirMovimento: this.reduzirMovimento,
    };
  }

  private limparRios(): void {
    for (const filho of [...this.grupoRios.children]) {
      this.grupoRios.remove(filho);
      if (filho instanceof THREE.Mesh) {
        filho.geometry.dispose();
        (filho.material as THREE.Material).dispose();
      }
    }
  }

  public destruir(): void {
    this.limparRios();
    this.cena.remove(this.grupoRios);
    if (this.malhaNevoaGuerra) {
      this.cena.remove(this.malhaNevoaGuerra);
      this.malhaNevoaGuerra.geometry.dispose();
      (this.malhaNevoaGuerra.material as THREE.Material).dispose();
    }
    if (this.malhaNevoaMoralBaixa) {
      this.cena.remove(this.malhaNevoaMoralBaixa);
      this.malhaNevoaMoralBaixa.geometry.dispose();
      (this.malhaNevoaMoralBaixa.material as THREE.Material).dispose();
    }
    if (this.pontosParticulasOuro) {
      this.cena.remove(this.pontosParticulasOuro);
      this.pontosParticulasOuro.geometry.dispose();
      (this.pontosParticulasOuro.material as THREE.Material).dispose();
    }
  }
}
