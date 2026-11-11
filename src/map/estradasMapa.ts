import * as THREE from 'three';
import { LAYOUT_PADRAO, PALETA_MAPA } from '../config/layout';
import type { LenteMapa, UUID } from '../domain';
import type { EstradaRoteada, Ponto2D, ResultadoEstradasMundo } from '../engine/trade';

export interface InfoHoverEstrada {
  estradaId: string;
  tipo: 'tronco' | 'ramal' | 'trilha';
  origemId: string;
  destinoId: string;
  volumeMensal: number;
  produtoIds: string[];
  pontoInicial: Ponto2D;
  pontoFinal: Ponto2D;
}

interface TransicaoEstradaAtiva {
  estradaId: string;
  pontosAntigos: Ponto2D[];
  pontosNovos: Ponto2D[];
  inicioMs: number;
  duracaoMs: number;
}

const CORES_CLIENTES_ESTRADA = [
  '#3182CE',
  '#D69E2E',
  '#38A169',
  '#DD6B20',
  '#805AD5',
  '#E53E3E',
  '#319795',
  '#B83280',
];

function corDeterministicaCliente(clienteId: string): string {
  let h = 0;
  for (let i = 0; i < clienteId.length; i++) {
    h = (h * 31 + clienteId.charCodeAt(i)) >>> 0;
  }
  return CORES_CLIENTES_ESTRADA[h % CORES_CLIENTES_ESTRADA.length]!;
}

/**
 * Gerenciador de Estradas Planas (Troncos 5 u, Ramais 3 u e Trilhas 2 u) em malha consolidada
 * de faixas (ribbon geometry) no chão (Seções 4.4, 4.6 e 6).
 */
export class GerenciadorEstradasMapa {
  private readonly cena: THREE.Scene;
  private readonly grupoEstradas: THREE.Group;
  private malhaFaixasEstradas: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  > | null = null;
  private linhaPreviaLigacao: THREE.Line | null = null;
  private marcadorExtremoA: THREE.Mesh | null = null;
  private marcadorExtremoB: THREE.Mesh | null = null;

  private estradasAtuais: EstradaRoteada[] = [];
  private estradaHoverId: string | null = null;
  private transicoesAtivas = new Map<string, TransicaoEstradaAtiva>();

  private ultimoLente: LenteMapa = 'padrao';
  private ultimoFiltroSetorId: UUID | null = null;
  private ultimoFiltroProdutoId: UUID | null = null;
  private ultimoClientePorProjetoId = new Map<UUID, UUID>();
  private obterAlturaTerreno?: (x: number, z: number) => number;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.grupoEstradas = new THREE.Group();
    this.grupoEstradas.name = 'grupo-estradas-planas';
    this.cena.add(this.grupoEstradas);

    this.criarLinhaPrevia();
    this.criarMarcadoresExtremosHover();
  }

  private criarLinhaPrevia(): void {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, 0.5, 0),
    ]);
    const mat = new THREE.LineDashedMaterial({
      color: PALETA_MAPA.ouro,
      dashSize: 3,
      gapSize: 1.5,
      transparent: true,
      opacity: 0.95,
    });
    this.linhaPreviaLigacao = new THREE.Line(geo, mat);
    this.linhaPreviaLigacao.computeLineDistances();
    this.linhaPreviaLigacao.visible = false;
    this.cena.add(this.linhaPreviaLigacao);
  }

  private criarMarcadoresExtremosHover(): void {
    const geoAnel = new THREE.RingGeometry(4.5, 6.8, 24);
    geoAnel.rotateX(-Math.PI / 2);
    const matAnel = new THREE.MeshBasicMaterial({
      color: PALETA_MAPA.ouro,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    this.marcadorExtremoA = new THREE.Mesh(geoAnel, matAnel);
    this.marcadorExtremoA.position.y = 0.28;
    this.marcadorExtremoA.visible = false;
    this.marcadorExtremoA.name = 'destaque-extremo-estrada-a';

    this.marcadorExtremoB = new THREE.Mesh(geoAnel.clone(), matAnel);
    this.marcadorExtremoB.position.y = 0.28;
    this.marcadorExtremoB.visible = false;
    this.marcadorExtremoB.name = 'destaque-extremo-estrada-b';

    this.grupoEstradas.add(this.marcadorExtremoA, this.marcadorExtremoB);
  }

  /**
   * Registra transição suave de 400 ms para as estradas recalculadas quando uma cidade é arrastada.
   */
  public iniciarTransicaoArrasto(
    estradasAnteriores: Map<string, EstradaRoteada>,
    estradasNovas: ResultadoEstradasMundo,
    idsRecalculados: readonly string[],
    agoraMs = performance.now()
  ): void {
    for (const id of idsRecalculados) {
      const ant = estradasAnteriores.get(id);
      const nova = estradasNovas.estradasPorId.get(id);
      if (ant && nova && ant.pontos.length === nova.pontos.length) {
        this.transicoesAtivas.set(id, {
          estradaId: id,
          pontosAntigos: ant.pontos.map((p) => ({ x: p.x, z: p.z })),
          pontosNovos: nova.pontos.map((p) => ({ x: p.x, z: p.z })),
          inicioMs: agoraMs,
          duracaoMs: LAYOUT_PADRAO.duracaoTransicaoArrastoEstradaMs,
        });
      }
    }
    this.estradasAtuais = estradasNovas.estradas;
    this.reconstruirMalhaUnificada(agoraMs);
  }

  public atualizarEstradas(
    estradas: readonly EstradaRoteada[],
    lenteAtiva: LenteMapa = 'padrao',
    filtroSetorId: UUID | null = null,
    filtroProdutoId: UUID | null = null,
    clienteDominantePorProjeto?: ReadonlyMap<UUID, UUID>,
    agoraMs = performance.now(),
    obterAlturaTerreno?: (x: number, z: number) => number
  ): void {
    this.estradasAtuais = estradas.slice();
    this.ultimoLente = lenteAtiva;
    this.ultimoFiltroSetorId = filtroSetorId;
    this.ultimoFiltroProdutoId = filtroProdutoId;
    if (obterAlturaTerreno) {
      this.obterAlturaTerreno = obterAlturaTerreno;
    }
    if (clienteDominantePorProjeto) {
      this.ultimoClientePorProjetoId = new Map(clienteDominantePorProjeto);
    }

    this.reconstruirMalhaUnificada(agoraMs);
  }

  public animarTransicoes(agoraMs = performance.now()): void {
    if (this.transicoesAtivas.size === 0) return;

    let algumaConcluiu = false;
    for (const [id, tr] of this.transicoesAtivas.entries()) {
      if (agoraMs - tr.inicioMs >= tr.duracaoMs) {
        this.transicoesAtivas.delete(id);
        algumaConcluiu = true;
      }
    }

    this.reconstruirMalhaUnificada(agoraMs);
    if (algumaConcluiu && this.transicoesAtivas.size === 0) {
      this.reconstruirMalhaUnificada(agoraMs);
    }
  }

  private obterPontosInterpolados(estrada: EstradaRoteada, agoraMs: number): Ponto2D[] {
    const tr = this.transicoesAtivas.get(estrada.id);
    if (!tr) return estrada.pontos;

    const progresso = Math.min(1, Math.max(0, (agoraMs - tr.inicioMs) / tr.duracaoMs));
    const t = 1 - Math.pow(1 - progresso, 3);
    const pts: Ponto2D[] = [];
    for (let i = 0; i < estrada.pontos.length; i++) {
      const pA = tr.pontosAntigos[i] ?? estrada.pontos[i]!;
      const pB = tr.pontosNovos[i] ?? estrada.pontos[i]!;
      pts.push({
        x: pA.x + (pB.x - pA.x) * t,
        z: pA.z + (pB.z - pA.z) * t,
      });
    }
    return pts;
  }

  private reconstruirMalhaUnificada(agoraMs = performance.now()): void {
    if (this.malhaFaixasEstradas) {
      this.grupoEstradas.remove(this.malhaFaixasEstradas);
      this.malhaFaixasEstradas.geometry.dispose();
      this.malhaFaixasEstradas.material.dispose();
      this.malhaFaixasEstradas = null;
    }

    if (this.estradasAtuais.length === 0) return;

    const posicoes: number[] = [];
    const cores: number[] = [];

    const corBase = new THREE.Color();
    const corOuro = new THREE.Color(PALETA_MAPA.ouro);
    const corBronze = new THREE.Color(PALETA_MAPA.bronze);
    const corApagada = new THREE.Color('#B5AA96');

    for (const e of this.estradasAtuais) {
      // Na lente Rede, exibe apenas trilhas cidade a cidade com destaque
      if (this.ultimoLente === 'rede' && e.tipo !== 'trilha') {
        continue;
      }

      const pontos = this.obterPontosInterpolados(e, agoraMs);
      if (pontos.length < 2) continue;

      const ehHover = this.estradaHoverId === e.id;
      const atenuadaPorSetor =
        this.ultimoFiltroSetorId !== null && e.setorId !== this.ultimoFiltroSetorId;
      const atenuadaPorProduto =
        this.ultimoFiltroProdutoId !== null &&
        !e.produtoIds.includes(this.ultimoFiltroProdutoId);
      const atenuada = atenuadaPorSetor || atenuadaPorProduto;

      let multiplicadorLargura = 1.0;
      if (this.ultimoLente === 'financas') {
        multiplicadorLargura = e.ativa ? 1.28 : 0.65;
      } else if (this.ultimoLente === 'rede' && e.tipo === 'trilha') {
        multiplicadorLargura = 1.35;
      }
      if (ehHover) multiplicadorLargura *= 1.35;
      if (atenuada) multiplicadorLargura *= 0.6;

      const meiaLargura = Math.max(0.5, (e.larguraEfetiva * multiplicadorLargura) * 0.5);
      const y =
        e.tipo === 'tronco' ? 0.15 : e.tipo === 'ramal' ? 0.14 : 0.13;

      if (ehHover) {
        corBase.set('#FFE082');
      } else if (atenuada || !e.ativa) {
        corBase.copy(corApagada);
      } else if (this.ultimoLente === 'clientes') {
        const cliId =
          this.ultimoClientePorProjetoId.get(e.origemId) ??
          this.ultimoClientePorProjetoId.get(e.destinoId);
        corBase.set(cliId ? corDeterministicaCliente(cliId) : PALETA_MAPA.bronze);
      } else if (this.ultimoLente === 'financas') {
        corBase.copy(corBronze).lerp(corOuro, Math.min(1, e.brilho * 1.15));
      } else if (this.ultimoLente === 'padrao') {
        // Lente Padrão: fluxo discreto
        corBase.copy(corBronze).lerp(corOuro, e.brilho * 0.55);
      } else {
        corBase.copy(corBronze).lerp(corOuro, e.brilho * 0.75);
      }

      for (let i = 0; i < pontos.length - 1; i++) {
        const p1 = pontos[i]!;
        const p2 = pontos[i + 1]!;
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const comp = Math.hypot(dx, dz);
        if (comp < 1e-4) continue;

        const nx = (-dz / comp) * meiaLargura;
        const nz = (dx / comp) * meiaLargura;

        const ax = p1.x + nx;
        const az = p1.z + nz;
        const bx = p1.x - nx;
        const bz = p1.z - nz;
        const cx = p2.x + nx;
        const cz = p2.z + nz;
        const dx2 = p2.x - nx;
        const dz2 = p2.z - nz;

        const ya = (this.obterAlturaTerreno?.(ax, az) ?? 0) + y;
        const yb = (this.obterAlturaTerreno?.(bx, bz) ?? 0) + y;
        const yc = (this.obterAlturaTerreno?.(cx, cz) ?? 0) + y;
        const yd = (this.obterAlturaTerreno?.(dx2, dz2) ?? 0) + y;

        // Triângulo 1 (A, B, C) e Triângulo 2 (B, D, C)
        posicoes.push(ax, ya, az, bx, yb, bz, cx, yc, cz);
        posicoes.push(bx, yb, bz, dx2, yd, dz2, cx, yc, cz);

        for (let v = 0; v < 6; v++) {
          cores.push(corBase.r, corBase.g, corBase.b);
        }
      }
    }

    if (posicoes.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });

    this.malhaFaixasEstradas = new THREE.Mesh(geo, mat);
    this.malhaFaixasEstradas.name = 'malha-faixas-estradas-unificada';
    this.malhaFaixasEstradas.frustumCulled = false;
    this.grupoEstradas.add(this.malhaFaixasEstradas);
  }

  /**
   * Detecta hover sobre uma estrada no ponto (x, z), realça os dois extremos e retorna os metadados.
   */
  public atualizarHoverEstrada(x: number, z: number): InfoHoverEstrada | null {
    let melhor: EstradaRoteada | null = null;
    let menorDist = Infinity;

    for (const e of this.estradasAtuais) {
      if (this.ultimoLente === 'rede' && e.tipo !== 'trilha') continue;
      const limiar = Math.max(4.5, e.larguraEfetiva * 1.4);

      for (let i = 0; i < e.pontos.length - 1; i++) {
        const a = e.pontos[i]!;
        const b = e.pontos[i + 1]!;
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const lenSq = vx * vx + vz * vz;
        const t =
          lenSq > 1e-4
            ? Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / lenSq))
            : 0;
        const projX = a.x + t * vx;
        const projZ = a.z + t * vz;
        const dist = Math.hypot(x - projX, z - projZ);
        if (dist <= limiar && dist < menorDist) {
          menorDist = dist;
          melhor = e;
        }
      }
    }

    const novoHoverId = melhor?.id ?? null;
    if (novoHoverId !== this.estradaHoverId) {
      this.estradaHoverId = novoHoverId;
      this.reconstruirMalhaUnificada();
    }

    if (melhor && melhor.pontos.length >= 2) {
      const pIni = melhor.pontos[0]!;
      const pFim = melhor.pontos[melhor.pontos.length - 1]!;
      if (this.marcadorExtremoA && this.marcadorExtremoB) {
        this.marcadorExtremoA.position.set(pIni.x, 0.28, pIni.z);
        this.marcadorExtremoB.position.set(pFim.x, 0.28, pFim.z);
        this.marcadorExtremoA.visible = true;
        this.marcadorExtremoB.visible = true;
      }
      return {
        estradaId: melhor.id,
        tipo: melhor.tipo,
        origemId: melhor.origemId,
        destinoId: melhor.destinoId,
        volumeMensal: melhor.volumeMensal,
        produtoIds: melhor.produtoIds,
        pontoInicial: pIni,
        pontoFinal: pFim,
      };
    }

    if (this.marcadorExtremoA && this.marcadorExtremoB) {
      this.marcadorExtremoA.visible = false;
      this.marcadorExtremoB.visible = false;
    }
    return null;
  }

  public exibirPreviaLigacao(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ): void {
    if (!this.linhaPreviaLigacao) return;
    const pos = this.linhaPreviaLigacao.geometry.attributes.position;
    if (pos) {
      pos.setXYZ(0, x1, y1 + 0.6, z1);
      pos.setXYZ(1, x2, y2 + 0.6, z2);
      pos.needsUpdate = true;
      this.linhaPreviaLigacao.computeLineDistances();
      this.linhaPreviaLigacao.visible = true;
    }
  }

  public ocultarPreviaLigacao(): void {
    if (this.linhaPreviaLigacao) {
      this.linhaPreviaLigacao.visible = false;
    }
  }

  public obterTotalDrawCalls(): number {
    return this.malhaFaixasEstradas ? 1 : 0;
  }

  public obterTotalEstradasAtivas(): number {
    return this.estradasAtuais.filter((e) => e.ativa).length;
  }

  public obterTotalTransicoesAtivas(): number {
    return this.transicoesAtivas.size;
  }

  public obterEstradasAtuais(): readonly EstradaRoteada[] {
    return this.estradasAtuais;
  }

  public destruir(): void {
    if (this.malhaFaixasEstradas) {
      this.grupoEstradas.remove(this.malhaFaixasEstradas);
      this.malhaFaixasEstradas.geometry.dispose();
      this.malhaFaixasEstradas.material.dispose();
      this.malhaFaixasEstradas = null;
    }
    if (this.linhaPreviaLigacao) {
      this.cena.remove(this.linhaPreviaLigacao);
      this.linhaPreviaLigacao.geometry.dispose();
      (this.linhaPreviaLigacao.material as THREE.Material).dispose();
    }
    this.marcadorExtremoA?.geometry.dispose();
    this.marcadorExtremoB?.geometry.dispose();
    this.cena.remove(this.grupoEstradas);
  }
}
