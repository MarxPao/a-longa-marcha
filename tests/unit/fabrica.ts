import type {
  Base,
  ItemDeLista,
  Item,
  Lancamento,
  Projeto,
  RegistroDeHoras,
  Saldo,
  Tarefa,
  VinculoCliente,
} from '../../src/domain';

const T = '2026-10-31T12:00:00.000Z';
let seq = 0;
export const base = (id?: string): Base => ({
  id: id ?? `id-${++seq}`,
  criadoEm: T,
  atualizadoEm: T,
  arquivadoEm: null,
});

export function projeto(o: Partial<Projeto> = {}): Projeto {
  return {
    ...base(),
    nome: 'P',
    descricao: '',
    setorId: 'setor-1',
    x: 0,
    z: 0,
    estagioId: null,
    horasAlvoSemana: 10,
    autonomia: 'direto',
    notas: '',
    notaLicoes: null,
    ...o,
  };
}

export function tarefa(o: Partial<Tarefa> = {}): Tarefa {
  return {
    ...base(),
    titulo: 'T',
    descricao: '',
    projetoId: 'p1',
    frenteId: null,
    status: 'pendente',
    prioridade: 3,
    prazo: null,
    estimativaHoras: null,
    concluidaEm: null,
    recorrencia: null,
    origemRecorrenciaId: null,
    ...o,
  };
}

export function horas(o: Partial<RegistroDeHoras> = {}): RegistroDeHoras {
  return {
    ...base(),
    data: '2026-10-20',
    projetoId: 'p1',
    tarefaId: null,
    horas: 1,
    tecnologiaId: null,
    ...o,
  };
}

export function lanc(o: Partial<Lancamento> = {}): Lancamento {
  return {
    ...base(),
    data: '2026-10-10',
    tipo: 'receita',
    valorCentavos: 100000,
    categoriaId: 'cat',
    projetoId: 'p1',
    clienteId: null,
    recorrencia: null,
    origemRecorrenciaId: null,
    ...o,
  };
}

export function vinculo(o: Partial<VinculoCliente> = {}): VinculoCliente {
  return {
    ...base(),
    clienteId: 'c1',
    projetoId: 'p1',
    receitaRecorrenteCentavos: 100000,
    inicio: '2026-01-01',
    fim: null,
    ...o,
  };
}

export function item(o: Partial<Item> = {}): Item {
  return {
    ...base(),
    nome: 'I',
    unidade: 'un',
    custoUnitarioCentavos: 1000,
    estoqueMinimo: 0,
    fornecedorId: null,
    tipo: 'insumo',
    ...o,
  };
}

export function saldo(o: Partial<Saldo> = {}): Saldo {
  return { ...base(), itemId: 'i1', armazemId: 'a1', quantidade: 0, ...o };
}

export function itemLista(o: Partial<ItemDeLista> = {}): ItemDeLista {
  return {
    ...base(),
    projetoId: 'p1',
    itemId: 'i1',
    quantidade: 1,
    status: 'falta',
    ...o,
  };
}

/** Lançamentos mensais de receita/custo nos meses (AAAA-MM) informados. */
export function mensais(
  meses: string[],
  receita: number,
  custo: number,
  extra: Partial<Lancamento> = {}
): Lancamento[] {
  const r: Lancamento[] = [];
  for (const m of meses) {
    if (receita > 0)
      r.push(lanc({ data: `${m}-10`, tipo: 'receita', valorCentavos: receita, ...extra }));
    if (custo > 0)
      r.push(lanc({ data: `${m}-12`, tipo: 'custo', valorCentavos: custo, ...extra }));
  }
  return r;
}
