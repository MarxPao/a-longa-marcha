import type { ItemDeLista, Saldo, UUID } from '../domain';

export interface CoberturaItem {
  itemDeListaId: UUID;
  projetoId: UUID;
  itemId: UUID;
  necessario: number;
  /** Quantidade que ainda restava no estoque no momento de atender este item. */
  disponivel: number;
  falta: number;
  coberto: boolean;
}

/**
 * Cobertura de materiais: saldo (soma dos armazéns) menos o que está reservado, repartido entre os itens
 * em "falta" por ordem de id (determinístico) — dois projetos disputando o mesmo item não se cobrem duas
 * vezes. Itens reservados/prontos nunca são lacuna.
 */
export function coberturaMateriais(
  itensDeLista: readonly ItemDeLista[],
  saldos: readonly Saldo[]
): CoberturaItem[] {
  const total = new Map<UUID, number>();
  for (const s of saldos) {
    if (s.arquivadoEm === null) total.set(s.itemId, (total.get(s.itemId) ?? 0) + s.quantidade);
  }
  const reservado = new Map<UUID, number>();
  for (const l of itensDeLista) {
    if (l.arquivadoEm === null && l.status === 'reservado') {
      reservado.set(l.itemId, (reservado.get(l.itemId) ?? 0) + l.quantidade);
    }
  }
  const restante = new Map<UUID, number>();
  for (const [itemId, qtd] of total) restante.set(itemId, Math.max(0, qtd - (reservado.get(itemId) ?? 0)));

  const ordenados = [...itensDeLista]
    .filter((l) => l.arquivadoEm === null)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const saida: CoberturaItem[] = [];
  for (const l of ordenados) {
    if (l.status !== 'falta') {
      saida.push({ itemDeListaId: l.id, projetoId: l.projetoId, itemId: l.itemId, necessario: l.quantidade, disponivel: l.quantidade, falta: 0, coberto: true });
      continue;
    }
    const sobra = restante.get(l.itemId) ?? 0;
    const usado = Math.min(sobra, l.quantidade);
    restante.set(l.itemId, sobra - usado);
    saida.push({
      itemDeListaId: l.id,
      projetoId: l.projetoId,
      itemId: l.itemId,
      necessario: l.quantidade,
      disponivel: sobra,
      falta: l.quantidade - usado,
      coberto: usado >= l.quantidade,
    });
  }
  return saida;
}
