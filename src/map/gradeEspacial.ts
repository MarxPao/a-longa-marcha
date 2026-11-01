/**
 * Grade Espacial em Hash 2D para consultas espaciais O(1) no mapa estratégico.
 * Conforme Seção 5.3: "A seleção por clique usa um índice espacial em grade, sem varrer todos os objetos".
 */

export interface ItemGrade<T> {
  id: string;
  x: number;
  z: number;
  dados: T;
}

export class GradeEspacial<T> {
  private tamanhoCelula: number;
  private celulas: Map<string, ItemGrade<T>[]> = new Map();
  private itensPorId: Map<string, ItemGrade<T>> = new Map();

  constructor(tamanhoCelula = 30) {
    this.tamanhoCelula = Math.max(5, tamanhoCelula);
  }

  private chaveCelula(x: number, z: number): string {
    const cx = Math.floor(x / this.tamanhoCelula);
    const cz = Math.floor(z / this.tamanhoCelula);
    return `${cx}:${cz}`;
  }

  public limpar(): void {
    this.celulas.clear();
    this.itensPorId.clear();
  }

  public inserir(id: string, x: number, z: number, dados: T): void {
    this.remover(id);

    const item: ItemGrade<T> = { id, x, z, dados };
    const chave = this.chaveCelula(x, z);

    let lista = this.celulas.get(chave);
    if (!lista) {
      lista = [];
      this.celulas.set(chave, lista);
    }
    lista.push(item);
    this.itensPorId.set(id, item);
  }

  public remover(id: string): boolean {
    const itemExistente = this.itensPorId.get(id);
    if (!itemExistente) return false;

    const chave = this.chaveCelula(itemExistente.x, itemExistente.z);
    const lista = this.celulas.get(chave);
    if (lista) {
      const idx = lista.findIndex((it) => it.id === id);
      if (idx !== -1) {
        lista.splice(idx, 1);
        if (lista.length === 0) {
          this.celulas.delete(chave);
        }
      }
    }
    this.itensPorId.delete(id);
    return true;
  }

  public obterPorId(id: string): ItemGrade<T> | undefined {
    return this.itensPorId.get(id);
  }

  public totalItens(): number {
    return this.itensPorId.size;
  }

  public buscarNoRaio(x: number, z: number, raio: number): ItemGrade<T>[] {
    const resultados: ItemGrade<T>[] = [];
    const raioQuadrado = raio * raio;

    const minCx = Math.floor((x - raio) / this.tamanhoCelula);
    const maxCx = Math.floor((x + raio) / this.tamanhoCelula);
    const minCz = Math.floor((z - raio) / this.tamanhoCelula);
    const maxCz = Math.floor((z + raio) / this.tamanhoCelula);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const lista = this.celulas.get(`${cx}:${cz}`);
        if (!lista) continue;

        for (const item of lista) {
          const dx = item.x - x;
          const dz = item.z - z;
          const distQuadrada = dx * dx + dz * dz;
          if (distQuadrada <= raioQuadrado) {
            resultados.push(item);
          }
        }
      }
    }

    return resultados;
  }

  public buscarMaisProximo(
    x: number,
    z: number,
    raioMaximo = 25
  ): { item: ItemGrade<T>; distancia: number } | null {
    const candidatos = this.buscarNoRaio(x, z, raioMaximo);
    if (candidatos.length === 0) return null;

    let maisProximo: ItemGrade<T> | null = null;
    let menorDistancia = Infinity;

    for (const cand of candidatos) {
      const dx = cand.x - x;
      const dz = cand.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < menorDistancia) {
        menorDistancia = dist;
        maisProximo = cand;
      }
    }

    if (!maisProximo) return null;
    return { item: maisProximo, distancia: menorDistancia };
  }
}
