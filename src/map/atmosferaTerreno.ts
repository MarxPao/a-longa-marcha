import * as THREE from 'three';
import { LAYOUT_PADRAO, PALETA_MAPA, obterRaioCidadePorNivel } from '../config/layout';
import type { Projeto, SementeTerreno } from '../domain';

/**
 * Gerenciador de Atmosfera do Mapa Plano (Seções 3 e 4.6):
 * - Sem rios gerados por altura (terreno 100% plano)
 * - Névoa de tinta nas bordas do mapa e sobre áreas sem projeto ativo
 * - Névoa de moral baixa (< 45%) e partículas douradas de crescimento
 * - Respeito estrito a `reduzirMovimento`
 */
export class GerenciadorAtmosferaMapa {
  private readonly cena: THREE.Scene;
  private malhaNevoaGuerra: THREE.InstancedMesh | null = null;
  private malhaNevoaMoralBaixa: THREE.InstancedMesh | null = null;
  private pontosParticulasOuro: THREE.Points | null = null;

  private celulasAtivasNevoaGuerra = 0;
  private reduzirMovimento = false;
  private tempoAcumulado = 0;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.inicializarNevoaDeBorda(240);
    this.inicializarNevoaMoralBaixa();
    this.inicializarParticulasCrescimento();
  }

  private inicializarNevoaDeBorda(capacidade: number): void {
    const geoDisco = new THREE.CircleGeometry(1, 14);
    geoDisco.rotateX(-Math.PI / 2);

    const matTintaAguada = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.tinta,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    this.malhaNevoaGuerra = new THREE.InstancedMesh(geoDisco, matTintaAguada, capacidade);
    this.malhaNevoaGuerra.name = 'atmosfera-nevoa-de-guerra';
    this.malhaNevoaGuerra.count = 0;
    this.malhaNevoaGuerra.frustumCulled = false;
    this.malhaNevoaGuerra.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaNevoaGuerra);
  }

  private inicializarNevoaMoralBaixa(): void {
    const geoAnelNevoa = new THREE.RingGeometry(1.0, 1.45, 20);
    geoAnelNevoa.rotateX(-Math.PI / 2);

    const matNevoa = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.nevoa,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.malhaNevoaMoralBaixa = new THREE.InstancedMesh(geoAnelNevoa, matNevoa, 512);
    this.malhaNevoaMoralBaixa.name = 'atmosfera-nevoa-moral-baixa';
    this.malhaNevoaMoralBaixa.count = 0;
    this.malhaNevoaMoralBaixa.frustumCulled = false;
    this.malhaNevoaMoralBaixa.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaNevoaMoralBaixa);
  }

  private inicializarParticulasCrescimento(): void {
    const qtd = 140;
    const posicoes = new Float32Array(qtd * 3);
    for (let i = 0; i < qtd; i++) {
      posicoes[i * 3] = 0;
      posicoes[i * 3 + 1] = -999;
      posicoes[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));

    const mat = new THREE.PointsMaterial({
      color: PALETA_MAPA.ouro,
      size: 2.8,
      transparent: true,
      opacity: 0.85,
    });

    this.pontosParticulasOuro = new THREE.Points(geo, mat);
    this.pontosParticulasOuro.name = 'atmosfera-particulas-crescimento';
    this.cena.add(this.pontosParticulasOuro);
  }

  public gerarRiosPorSemente(
    _semente: SementeTerreno,
    _obterAlturaTerreno: (x: number, z: number) => number
  ): void {
    // Seção 3: Terreno plano sem rios gerados por altura
  }

  /**
   * Atualiza a névoa de tinta nas bordas do mapa, névoa de moral baixa e partículas douradas.
   */
  public atualizarEstadoAtmosfera(
    projetosAtivos: Projeto[],
    moralPorProjeto: Map<string, number>,
    fasePorProjeto: Map<string, number>,
    _obterAlturaTerreno: (x: number, z: number) => number,
    raioMapa = LAYOUT_PADRAO.raioMinimoMapaAbsoluto
  ): void {
    // 1. Névoa de tinta nas bordas do mapa circular
    if (this.malhaNevoaGuerra) {
      const mat = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const esc = new THREE.Vector3();
      let countNevoa = 0;

      // Dois anéis de nuvens de tinta ao redor da borda externa do mapa
      const totalPorAnel = 96;
      for (let anel = 0; anel < 2; anel++) {
        const rBase = raioMapa * (0.94 + anel * 0.08);
        for (let i = 0; i < totalPorAnel && countNevoa < 240; i++) {
          const ang = (i / totalPorAnel) * Math.PI * 2 + anel * 0.03;
          const variacaoR = ((i * 13) % 7) * 8;
          const r = rBase + variacaoR;
          const escalaDisco = 42 + ((i * 7) % 5) * 9;

          pos.set(Math.cos(ang) * r, 0.35 + anel * 0.1, Math.sin(ang) * r);
          esc.set(escalaDisco, 1, escalaDisco);
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
          const fase = fasePorProjeto.get(p.id) ?? 1;
          const raioCid = obterRaioCidadePorNivel(fase);
          pos.set(p.x, 1.2, p.z);
          esc.set(raioCid, 1, raioCid);
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
        const fase = fasePorProjeto.get(cidade.id) ?? 2;
        const raioCid = obterRaioCidadePorNivel(fase);
        const ang = (i * 1.37) % (Math.PI * 2);
        const raio = raioCid * (0.35 + ((i % 5) * 0.12));
        const yBase = 6 + (i % 6) * 2.2;
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
    this.pontosParticulasOuro.position.y = Math.sin(this.tempoAcumulado * 2.2) * 1.2;
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
      riosRenderizados: 0,
      celulasNevoaGuerraAtivas: this.celulasAtivasNevoaGuerra,
      cidadesComNevoaMoralBaixa: this.malhaNevoaMoralBaixa?.count ?? 0,
      particulasAtivas: Boolean(this.pontosParticulasOuro?.visible),
      reduzirMovimento: this.reduzirMovimento,
    };
  }

  public destruir(): void {
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
