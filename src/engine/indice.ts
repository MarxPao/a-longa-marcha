import type {
  BloqueioTarefa,
  DumpBanco,
  Instantaneo,
  Item,
  ItemDeLista,
  Lancamento,
  Ligacao,
  Produto,
  Projeto,
  RegistroDeHoras,
  Saldo,
  Tarefa,
  UUID,
  VinculoCliente,
  Data,
} from '../domain';
import { diferencaDias } from './tempo';

function agrupar<T>(itens: readonly T[], chave: (t: T) => UUID | null): Map<UUID, T[]> {
  const mapa = new Map<UUID, T[]>();
  for (const it of itens) {
    const k = chave(it);
    if (k === null) continue;
    const lista = mapa.get(k);
    if (lista) lista.push(it);
    else mapa.set(k, [it]);
  }
  return mapa;
}

/**
 * Índices sobre o estado para que recalcular UM projeto nunca varra todas as tarefas/lançamentos.
 * É só leitura; reconstruí-lo custa O(registros) (medido nos testes de desempenho).
 */
export interface IndiceEstado {
  dump: DumpBanco;
  projetos: Map<UUID, Projeto>;
  produtosPorProjeto: Map<UUID, Produto[]>;
  autonomos: UUID[];
  tarefasPorProjeto: Map<UUID, Tarefa[]>;
  registrosPorProjeto: Map<UUID, RegistroDeHoras[]>;
  lancamentosPorProjeto: Map<UUID, Lancamento[]>;
  vinculosPorProjeto: Map<UUID, VinculoCliente[]>;
  vinculosPorCliente: Map<UUID, VinculoCliente[]>;
  listaPorProjeto: Map<UUID, ItemDeLista[]>;
  listaPorItem: Map<UUID, ItemDeLista[]>;
  saldosPorItem: Map<UUID, Saldo[]>;
  itensPorFornecedor: Map<UUID, Item[]>;
  projetosPorSetor: Map<UUID, UUID[]>;
  ligacoesPorProjeto: Map<UUID, Ligacao[]>;
  tarefaPorId: Map<UUID, Tarefa>;
  bloqueiosPorTarefa: Map<UUID, BloqueioTarefa[]>;
  /** tarefa bloqueadora → tarefas que ela bloqueia */
  bloqueadasPor: Map<UUID, UUID[]>;
  instantaneos: Instantaneo[];
  cache: { mediaDiretos?: { hoje: Data; valor: number | null } };
}

export function construirIndice(dump: DumpBanco): IndiceEstado {
  const bloqueiosPorTarefa = agrupar(dump.bloqueiosTarefa, (b) => b.tarefaId);
  const bloqueadasPor = new Map<UUID, UUID[]>();
  for (const b of dump.bloqueiosTarefa) {
    const l = bloqueadasPor.get(b.bloqueadaPorId);
    if (l) l.push(b.tarefaId);
    else bloqueadasPor.set(b.bloqueadaPorId, [b.tarefaId]);
  }
  const ligacoesPorProjeto = new Map<UUID, Ligacao[]>();
  for (const l of dump.ligacoes) {
    for (const id of [l.origemId, l.destinoId]) {
      const lista = ligacoesPorProjeto.get(id);
      if (lista) lista.push(l);
      else ligacoesPorProjeto.set(id, [l]);
    }
  }
  const projetosPorSetor = new Map<UUID, UUID[]>();
  for (const p of dump.projetos) {
    const lista = projetosPorSetor.get(p.setorId);
    if (lista) lista.push(p.id);
    else projetosPorSetor.set(p.setorId, [p.id]);
  }
  return {
    dump,
    projetos: new Map(dump.projetos.map((p) => [p.id, p])),
    produtosPorProjeto: agrupar(dump.produtos ?? [], (p) => p.projetoId),
    autonomos: dump.projetos.filter((p) => p.autonomia === 'autonomo' && p.arquivadoEm === null).map((p) => p.id),
    tarefasPorProjeto: agrupar(dump.tarefas, (t) => t.projetoId),
    registrosPorProjeto: agrupar(dump.registrosDeHoras, (r) => r.projetoId),
    lancamentosPorProjeto: agrupar(dump.lancamentos, (l) => l.projetoId),
    vinculosPorProjeto: agrupar(dump.vinculosCliente, (v) => v.projetoId),
    vinculosPorCliente: agrupar(dump.vinculosCliente, (v) => v.clienteId),
    listaPorProjeto: agrupar(dump.itensDeLista, (l) => l.projetoId),
    listaPorItem: agrupar(dump.itensDeLista, (l) => l.itemId),
    saldosPorItem: agrupar(dump.saldos, (s) => s.itemId),
    itensPorFornecedor: agrupar(dump.itens, (i) => i.fornecedorId),
    projetosPorSetor,
    ligacoesPorProjeto,
    tarefaPorId: new Map(dump.tarefas.map((t) => [t.id, t])),
    bloqueiosPorTarefa,
    bloqueadasPor,
    instantaneos: [...dump.instantaneos].sort((a, b) => (a.semana < b.semana ? -1 : a.semana > b.semana ? 1 : 0)),
    cache: {},
  };
}

/** Média de horas semanais (últimas 4 semanas) dos projetos diretos ativos; null se não há diretos. Em cache por `hoje`. */
export function mediaHorasSemanaisDiretos(indice: IndiceEstado, hoje: Data): number | null {
  const c = indice.cache.mediaDiretos;
  if (c && c.hoje === hoje) return c.valor;
  let soma = 0;
  let n = 0;
  for (const p of indice.projetos.values()) {
    if (p.autonomia !== 'direto' || p.arquivadoEm !== null) continue;
    let horas28 = 0;
    for (const r of indice.registrosPorProjeto.get(p.id) ?? []) {
      if (r.arquivadoEm === null && r.data <= hoje && diferencaDias(hoje, r.data) <= 27) horas28 += r.horas;
    }
    soma += horas28 / 4;
    n++;
  }
  const valor = n === 0 ? null : soma / n;
  indice.cache.mediaDiretos = { hoje, valor };
  return valor;
}
