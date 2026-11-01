import * as THREE from 'three';
import type { LenteMapa, Ligacao, Projeto, TipoLigacao, UUID } from '../domain';

export type QualidadeRotas = 'baixa' | 'media' | 'alta';

export class GerenciadorRotas {
  private readonly cena: THREE.Scene;
  private malhasLoteRotas: THREE.LineSegments[] = [];
  private grupoRotas: THREE.Group;
  private totalRotasAtivas = 0;
  private qualidadeAtual: QualidadeRotas = 'alta';

  // Linha elástica de prévia para Shift + arrasto de ligação
  private linhaPreviaLigacao: THREE.Line | null = null;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.grupoRotas = new THREE.Group();
    this.grupoRotas.name = 'grupo-rotas-ligacoes';
    this.cena.add(this.grupoRotas);

    this.criarLinhaPrevia();
  }

  private criarLinhaPrevia(): void {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const mat = new THREE.LineDashedMaterial({
      color: '#B8923A',
      dashSize: 1.2,
      gapSize: 0.6,
      transparent: true,
      opacity: 0.9,
    });
    this.linhaPreviaLigacao = new THREE.Line(geo, mat);
    this.linhaPreviaLigacao.computeLineDistances();
    this.linhaPreviaLigacao.visible = false;
    this.cena.add(this.linhaPreviaLigacao);
  }

  public definirQualidade(qualidade: QualidadeRotas): void {
    this.qualidadeAtual = qualidade;
  }

  public obterTotalRotasAtivas(): number {
    return this.totalRotasAtivas;
  }

  public obterTotalDrawCallsRotas(): number {
    return this.malhasLoteRotas.length;
  }

  /**
   * Atualiza todas as rotas agrupando segmentos por (cor, opacidade) em LineSegments.
   * Reduz ~750 chamadas de desenho no perfil carga para ≤ 4 chamadas de desenho em lote.
   */
  public atualizarRotas(
    ligacoes: Ligacao[],
    projetosPorId: Map<UUID, Projeto>,
    obterAlturaTerreno: (x: number, z: number) => number,
    tiposLigacaoPorId?: Map<UUID, TipoLigacao>,
    lenteAtiva?: LenteMapa
  ): void {
    this.limpar();

    const segmentosPorCurva =
      this.qualidadeAtual === 'alta' ? 18 : this.qualidadeAtual === 'media' ? 10 : 6;

    // Agrupa os vértices de segmentos por chave "cor|opacidade"
    const lotesPorEstilo = new Map<
      string,
      { cor: string; opacidade: number; coordenadas: number[] }
    >();

    const vOrigem = new THREE.Vector3();
    const vMeio = new THREE.Vector3();
    const vDestino = new THREE.Vector3();
    const curva = new THREE.QuadraticBezierCurve3(vOrigem, vMeio, vDestino);

    let contadorRotas = 0;

    for (const lig of ligacoes) {
      if (lig.arquivadoEm !== null) continue;
      const pOrigem = projetosPorId.get(lig.origemId);
      const pDestino = projetosPorId.get(lig.destinoId);
      if (!pOrigem || !pDestino) continue;

      const y1 = obterAlturaTerreno(pOrigem.x, pOrigem.z) + 0.6;
      const y2 = obterAlturaTerreno(pDestino.x, pDestino.z) + 0.6;

      vOrigem.set(pOrigem.x, y1, pOrigem.z);
      vDestino.set(pDestino.x, y2, pDestino.z);

      const dx = pDestino.x - pOrigem.x;
      const dz = pDestino.z - pOrigem.z;
      const distancia = Math.sqrt(dx * dx + dz * dz);
      const arcoAltura = Math.max(1.2, distancia * 0.08);

      vMeio.set(
        (pOrigem.x + pDestino.x) * 0.5,
        Math.max(y1, y2) + arcoAltura,
        (pOrigem.z + pDestino.z) * 0.5
      );

      let corRota = '#7A5A2B'; // padrão bronze
      let opacidade = 0.7;
      const tipo = tiposLigacaoPorId?.get(lig.tipoId);
      if (tipo?.cor) {
        corRota = tipo.cor;
      }

      if (lenteAtiva === 'financas') {
        const ehFinanciamento =
          lig.tipoId.includes('financia') ||
          Boolean(tipo?.nome && tipo.nome.toLowerCase().includes('financia'));
        if (ehFinanciamento) {
          corRota = '#E5B842';
          opacidade = 1.0;
        } else {
          opacidade = 0.25;
        }
      } else if (lenteAtiva === 'rede') {
        opacidade = 1.0;
      }

      const chaveEstilo = `${corRota}|${opacidade}`;
      let lote = lotesPorEstilo.get(chaveEstilo);
      if (!lote) {
        lote = { cor: corRota, opacidade, coordenadas: [] };
        lotesPorEstilo.set(chaveEstilo, lote);
      }

      const pontos = curva.getPoints(segmentosPorCurva);
      for (let i = 0; i < pontos.length - 1; i++) {
        const pA = pontos[i]!;
        const pB = pontos[i + 1]!;
        lote.coordenadas.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      }

      contadorRotas++;
    }

    this.totalRotasAtivas = contadorRotas;

    let idxLote = 0;
    for (const lote of lotesPorEstilo.values()) {
      if (lote.coordenadas.length === 0) continue;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(lote.coordenadas, 3)
      );

      const mat = new THREE.LineBasicMaterial({
        color: lote.cor,
        transparent: true,
        opacity: lote.opacidade,
      });

      const segmentos = new THREE.LineSegments(geo, mat);
      segmentos.name = `lote-rotas-${idxLote++}`;
      this.malhasLoteRotas.push(segmentos);
      this.grupoRotas.add(segmentos);
    }
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
      pos.setXYZ(0, x1, y1 + 0.5, z1);
      pos.setXYZ(1, x2, y2 + 0.5, z2);
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

  public limpar(): void {
    for (const malha of this.malhasLoteRotas) {
      this.grupoRotas.remove(malha);
      malha.geometry.dispose();
      (malha.material as THREE.Material).dispose();
    }
    this.malhasLoteRotas = [];
    this.totalRotasAtivas = 0;
  }

  public destruir(): void {
    this.limpar();
    this.cena.remove(this.grupoRotas);
    if (this.linhaPreviaLigacao) {
      this.cena.remove(this.linhaPreviaLigacao);
      this.linhaPreviaLigacao.geometry.dispose();
      (this.linhaPreviaLigacao.material as THREE.Material).dispose();
      this.linhaPreviaLigacao = null;
    }
  }
}
