import * as THREE from 'three';
import type { LenteMapa, Ligacao, Projeto, TipoLigacao, UUID } from '../domain';

export class GerenciadorRotas {
  private readonly cena: THREE.Scene;
  private linhasRotas: THREE.Line[] = [];
  private grupoRotas: THREE.Group;

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

  public atualizarRotas(
    ligacoes: Ligacao[],
    projetosPorId: Map<UUID, Projeto>,
    obterAlturaTerreno: (x: number, z: number) => number,
    tiposLigacaoPorId?: Map<UUID, TipoLigacao>,
    lenteAtiva?: LenteMapa
  ): void {
    this.limpar();

    for (const lig of ligacoes) {
      if (lig.arquivadoEm !== null) continue;
      const pOrigem = projetosPorId.get(lig.origemId);
      const pDestino = projetosPorId.get(lig.destinoId);
      if (!pOrigem || !pDestino) continue;

      const y1 = obterAlturaTerreno(pOrigem.x, pOrigem.z) + 0.6;
      const y2 = obterAlturaTerreno(pDestino.x, pDestino.z) + 0.6;

      const vOrigem = new THREE.Vector3(pOrigem.x, y1, pOrigem.z);
      const vDestino = new THREE.Vector3(pDestino.x, y2, pDestino.z);

      const dx = pDestino.x - pOrigem.x;
      const dz = pDestino.z - pOrigem.z;
      const distancia = Math.sqrt(dx * dx + dz * dz);
      const arcoAltura = Math.max(1.2, distancia * 0.08);

      const vMeio = new THREE.Vector3(
        (pOrigem.x + pDestino.x) * 0.5,
        Math.max(y1, y2) + arcoAltura,
        (pOrigem.z + pDestino.z) * 0.5
      );

      const curva = new THREE.QuadraticBezierCurve3(vOrigem, vMeio, vDestino);
      const pontos = curva.getPoints(24);
      const geometria = new THREE.BufferGeometry().setFromPoints(pontos);

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

      const material = new THREE.LineBasicMaterial({
        color: corRota,
        transparent: true,
        opacity: opacidade,
      });

      const linha = new THREE.Line(geometria, material);
      linha.name = `rota-${lig.origemId}-${lig.destinoId}`;
      this.linhasRotas.push(linha);
      this.grupoRotas.add(linha);
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
    for (const linha of this.linhasRotas) {
      this.grupoRotas.remove(linha);
      linha.geometry.dispose();
      (linha.material as THREE.Material).dispose();
    }
    this.linhasRotas = [];
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
