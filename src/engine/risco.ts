import type { Item, ItemDeLista, Lancamento, UUID } from '../domain';

export interface ConcentracaoClientes {
  receitaTotalCentavos: number;
  semClienteCentavos: number;
  clientes: { clienteId: UUID; receitaCentavos: number; parte: number }[];
}

/** Parcela da receita por cliente (receitas ativas; receita sem cliente fica à parte). */
export function concentracaoClientes(lancamentos: readonly Lancamento[]): ConcentracaoClientes {
  const porCliente = new Map<UUID, number>();
  let total = 0;
  let semCliente = 0;
  for (const l of lancamentos) {
    if (l.arquivadoEm !== null || l.tipo !== 'receita') continue;
    total += l.valorCentavos;
    if (l.clienteId === null) semCliente += l.valorCentavos;
    else porCliente.set(l.clienteId, (porCliente.get(l.clienteId) ?? 0) + l.valorCentavos);
  }
  const clientes = [...porCliente.entries()]
    .map(([clienteId, receitaCentavos]) => ({ clienteId, receitaCentavos, parte: total > 0 ? receitaCentavos / total : 0 }))
    .sort((a, b) => b.receitaCentavos - a.receitaCentavos || (a.clienteId < b.clienteId ? -1 : 1));
  return { receitaTotalCentavos: total, semClienteCentavos: semCliente, clientes };
}

export interface ConcentracaoFornecedores {
  valorTotalCentavos: number;
  semFornecedorCentavos: number;
  fornecedores: { fornecedorId: UUID; valorCentavos: number; projetos: number; parte: number }[];
}

/** Parcela do valor de materiais (listas de materiais × custo unitário) e nº de projetos por fornecedor. */
export function concentracaoFornecedores(
  listas: readonly ItemDeLista[],
  itens: readonly Item[]
): ConcentracaoFornecedores {
  const itemPorId = new Map(itens.map((i) => [i.id, i]));
  const valor = new Map<UUID, number>();
  const projetos = new Map<UUID, Set<UUID>>();
  let total = 0;
  let semFornecedor = 0;
  for (const l of listas) {
    const it = itemPorId.get(l.itemId);
    if (l.arquivadoEm !== null || it === undefined) continue;
    const v = Math.round(l.quantidade * it.custoUnitarioCentavos);
    total += v;
    if (it.fornecedorId === null) {
      semFornecedor += v;
      continue;
    }
    valor.set(it.fornecedorId, (valor.get(it.fornecedorId) ?? 0) + v);
    const set = projetos.get(it.fornecedorId) ?? new Set<UUID>();
    set.add(l.projetoId);
    projetos.set(it.fornecedorId, set);
  }
  const fornecedores = [...valor.entries()]
    .map(([fornecedorId, valorCentavos]) => ({
      fornecedorId,
      valorCentavos,
      projetos: projetos.get(fornecedorId)?.size ?? 0,
      parte: total > 0 ? valorCentavos / total : 0,
    }))
    .sort((a, b) => b.valorCentavos - a.valorCentavos || (a.fornecedorId < b.fornecedorId ? -1 : 1));
  return { valorTotalCentavos: total, semFornecedorCentavos: semFornecedor, fornecedores };
}
