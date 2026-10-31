import { z } from 'zod';

// ============================================================================
// Tipos Primitivos e Esquemas Base (Anexo A e Seção 9.2)
// ============================================================================

export type UUID = string;
export type Data = string; // AAAA-MM-DD
export type Instante = string; // ISO 8601 em UTC
export type Centavos = number; // inteiro, nunca ponto flutuante

export const EsquemaUUID = z.string().trim().min(1, 'UUID obrigatório');

export const EsquemaData = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD')
  .refine((val) => {
    const partes = val.split('-').map(Number);
    const ano = partes[0] ?? 0;
    const mes = partes[1] ?? 0;
    const dia = partes[2] ?? 0;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
    const dt = new Date(Date.UTC(ano, mes - 1, dia));
    return (
      dt.getUTCFullYear() === ano &&
      dt.getUTCMonth() === mes - 1 &&
      dt.getUTCDate() === dia
    );
  }, 'Data de calendário inválida');

export const EsquemaInstante = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'Instante deve estar em formato ISO 8601 UTC'
  );

export const EsquemaCentavos = z
  .number()
  .int('Valor em centavos deve ser inteiro (proibido ponto flutuante)');

export interface Base {
  id: UUID;
  criadoEm: Instante;
  atualizadoEm: Instante;
  arquivadoEm: Instante | null;
}

export const EsquemaBase = z.object({
  id: EsquemaUUID,
  criadoEm: EsquemaInstante,
  atualizadoEm: EsquemaInstante,
  arquivadoEm: EsquemaInstante.nullable(),
});

export interface Recorrencia {
  periodicidade: 'semanal' | 'mensal' | 'trimestral' | 'anual';
  intervalo: number;
  diaRef: number;
  ate: Data | null;
}

export const EsquemaRecorrencia: z.ZodType<Recorrencia> = z.object({
  periodicidade: z.enum(['semanal', 'mensal', 'trimestral', 'anual']),
  intervalo: z.number().int().positive('Intervalo de recorrência deve ser inteiro positivo'),
  diaRef: z.number().int().min(1).max(31),
  ate: EsquemaData.nullable(),
});

// ============================================================================
// 17 Entidades Principais + Entidades Auxiliares (Anexo A e Seção 9.2)
// ============================================================================

export interface Setor extends Base {
  nome: string;
  cor: string;
  icone: string;
  bioma: string;
  regiao: [number, number][];
  ordem: number;
}

export const EsquemaSetor: z.ZodType<Setor> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do setor obrigatório'),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser hexadecimal #RRGGBB'),
  icone: z.string().trim().min(1),
  bioma: z.string().trim().min(1),
  regiao: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(3),
  ordem: z.number().int().min(0),
});

export interface Projeto extends Base {
  nome: string;
  descricao: string;
  setorId: UUID;
  x: number;
  z: number;
  estagioId: UUID | null;
  horasAlvoSemana: number;
  autonomia: 'direto' | 'esparso' | 'autonomo';
  notas: string;
  notaLicoes: string | null;
}

export const EsquemaProjeto: z.ZodType<Projeto> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do projeto obrigatório'),
  descricao: z.string(),
  setorId: EsquemaUUID,
  x: z.number().finite(),
  z: z.number().finite(),
  estagioId: EsquemaUUID.nullable(),
  horasAlvoSemana: z.number().finite().min(0, 'Horas-alvo não podem ser negativas'),
  autonomia: z.enum(['direto', 'esparso', 'autonomo']),
  notas: z.string(),
  notaLicoes: z.string().nullable(),
});

export interface Frente extends Base {
  nome: string;
  projetoId: UUID;
  paiId: UUID | null;
  estado: 'ativa' | 'pausada' | 'concluida';
}

export const EsquemaFrente: z.ZodType<Frente> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome da frente obrigatório'),
  projetoId: EsquemaUUID,
  paiId: EsquemaUUID.nullable(),
  estado: z.enum(['ativa', 'pausada', 'concluida']),
});

export interface Tarefa extends Base {
  titulo: string;
  descricao: string;
  projetoId: UUID;
  frenteId: UUID | null;
  status: 'pendente' | 'em_andamento' | 'bloqueada' | 'feita';
  prioridade: 1 | 2 | 3 | 4;
  prazo: Data | null;
  estimativaHoras: number | null;
  concluidaEm: Data | null;
  recorrencia: Recorrencia | null;
  origemRecorrenciaId: UUID | null;
}

export const EsquemaTarefa: z.ZodType<Tarefa> = EsquemaBase.extend({
  titulo: z.string().trim().min(1, 'Título da tarefa obrigatório'),
  descricao: z.string(),
  projetoId: EsquemaUUID,
  frenteId: EsquemaUUID.nullable(),
  status: z.enum(['pendente', 'em_andamento', 'bloqueada', 'feita']),
  prioridade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  prazo: EsquemaData.nullable(),
  estimativaHoras: z.number().finite().min(0).nullable(),
  concluidaEm: EsquemaData.nullable(),
  recorrencia: EsquemaRecorrencia.nullable(),
  origemRecorrenciaId: EsquemaUUID.nullable(),
});

export interface BloqueioTarefa {
  tarefaId: UUID;
  bloqueadaPorId: UUID;
}

export const EsquemaBloqueioTarefa: z.ZodType<BloqueioTarefa> = z
  .object({
    tarefaId: EsquemaUUID,
    bloqueadaPorId: EsquemaUUID,
  })
  .refine((b) => b.tarefaId !== b.bloqueadaPorId, {
    message: 'Uma tarefa não pode bloquear a si mesma',
    path: ['bloqueadaPorId'],
  });

export interface Cliente extends Base {
  nome: string;
  contato: string;
  statusRelacao: 'prospecto' | 'ativo' | 'em_risco' | 'inativo';
  ultimoContato: Data | null;
  observacoes: string;
}

export const EsquemaCliente: z.ZodType<Cliente> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do cliente obrigatório'),
  contato: z.string(),
  statusRelacao: z.enum(['prospecto', 'ativo', 'em_risco', 'inativo']),
  ultimoContato: EsquemaData.nullable(),
  observacoes: z.string(),
});

export interface VinculoCliente extends Base {
  clienteId: UUID;
  projetoId: UUID;
  receitaRecorrenteCentavos: Centavos;
  inicio: Data;
  fim: Data | null;
}

export const EsquemaVinculoCliente: z.ZodType<VinculoCliente> = EsquemaBase.extend({
  clienteId: EsquemaUUID,
  projetoId: EsquemaUUID,
  receitaRecorrenteCentavos: EsquemaCentavos.min(0),
  inicio: EsquemaData,
  fim: EsquemaData.nullable(),
});

export interface Lancamento extends Base {
  data: Data;
  tipo: 'receita' | 'custo';
  valorCentavos: Centavos;
  categoriaId: UUID;
  projetoId: UUID;
  clienteId: UUID | null;
  recorrencia: Recorrencia | null;
  origemRecorrenciaId: UUID | null;
}

export const EsquemaLancamento: z.ZodType<Lancamento> = EsquemaBase.extend({
  data: EsquemaData,
  tipo: z.enum(['receita', 'custo']),
  valorCentavos: EsquemaCentavos.min(0, 'Valor do lançamento não pode ser negativo'),
  categoriaId: EsquemaUUID,
  projetoId: EsquemaUUID,
  clienteId: EsquemaUUID.nullable(),
  recorrencia: EsquemaRecorrencia.nullable(),
  origemRecorrenciaId: EsquemaUUID.nullable(),
});

export interface Fornecedor extends Base {
  nome: string;
  contato: string;
  prazoEntregaDias: number;
  observacoes: string;
}

export const EsquemaFornecedor: z.ZodType<Fornecedor> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do fornecedor obrigatório'),
  contato: z.string(),
  prazoEntregaDias: z.number().int().min(0),
  observacoes: z.string(),
});

export interface Armazem extends Base {
  nome: string;
  local: string;
  observacoes: string;
}

export const EsquemaArmazem: z.ZodType<Armazem> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do armazém obrigatório'),
  local: z.string(),
  observacoes: z.string(),
});

export interface Item extends Base {
  nome: string;
  unidade: string;
  custoUnitarioCentavos: Centavos;
  estoqueMinimo: number;
  fornecedorId: UUID | null;
  tipo: 'insumo' | 'equipamento';
}

export const EsquemaItem: z.ZodType<Item> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do item obrigatório'),
  unidade: z.string().trim().min(1, 'Unidade obrigatória'),
  custoUnitarioCentavos: EsquemaCentavos.min(0),
  estoqueMinimo: z.number().finite().min(0),
  fornecedorId: EsquemaUUID.nullable(),
  tipo: z.enum(['insumo', 'equipamento']),
});

export interface Saldo extends Base {
  itemId: UUID;
  armazemId: UUID;
  quantidade: number;
}

export const EsquemaSaldo: z.ZodType<Saldo> = EsquemaBase.extend({
  itemId: EsquemaUUID,
  armazemId: EsquemaUUID,
  quantidade: z.number().finite(),
});

export interface Movimento extends Base {
  itemId: UUID;
  armazemId: UUID;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  data: Data;
  projetoId: UUID | null;
}

export const EsquemaMovimento: z.ZodType<Movimento> = EsquemaBase.extend({
  itemId: EsquemaUUID,
  armazemId: EsquemaUUID,
  tipo: z.enum(['entrada', 'saida', 'ajuste']),
  quantidade: z.number().finite(),
  data: EsquemaData,
  projetoId: EsquemaUUID.nullable(),
});

export interface ItemDeLista extends Base {
  projetoId: UUID;
  itemId: UUID;
  quantidade: number;
  status: 'falta' | 'reservado' | 'pronto';
}

export const EsquemaItemDeLista: z.ZodType<ItemDeLista> = EsquemaBase.extend({
  projetoId: EsquemaUUID,
  itemId: EsquemaUUID,
  quantidade: z.number().finite().positive('Quantidade necessária deve ser maior que zero'),
  status: z.enum(['falta', 'reservado', 'pronto']),
});

export interface Tecnologia extends Base {
  nome: string;
  descricao: string;
  estado: 'ideia' | 'pesquisando' | 'dominada';
  estimativaHoras: number;
}

export const EsquemaTecnologia: z.ZodType<Tecnologia> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome da tecnologia obrigatório'),
  descricao: z.string(),
  estado: z.enum(['ideia', 'pesquisando', 'dominada']),
  estimativaHoras: z.number().finite().min(0),
});

export interface PreRequisitoTecnologia {
  tecnologiaId: UUID;
  preRequisitoId: UUID;
}

export const EsquemaPreRequisitoTecnologia: z.ZodType<PreRequisitoTecnologia> = z
  .object({
    tecnologiaId: EsquemaUUID,
    preRequisitoId: EsquemaUUID,
  })
  .refine((p) => p.tecnologiaId !== p.preRequisitoId, {
    message: 'Uma tecnologia não pode ser pré-requisito de si mesma',
    path: ['preRequisitoId'],
  });

export interface Aplicacao extends Base {
  tecnologiaId: UUID;
  projetoId: UUID;
  efeito: 'custo' | 'velocidade' | 'receita_nova';
  valorEstimadoCentavos: Centavos | null;
}

export const EsquemaAplicacao: z.ZodType<Aplicacao> = EsquemaBase.extend({
  tecnologiaId: EsquemaUUID,
  projetoId: EsquemaUUID,
  efeito: z.enum(['custo', 'velocidade', 'receita_nova']),
  valorEstimadoCentavos: EsquemaCentavos.nullable(),
});

export interface TipoLigacao extends Base {
  nome: string;
  cor: string;
  direcional: boolean;
}

export const EsquemaTipoLigacao: z.ZodType<TipoLigacao> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome do tipo de ligação obrigatório'),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser hexadecimal #RRGGBB'),
  direcional: z.boolean(),
});

export interface Ligacao extends Base {
  origemId: UUID;
  destinoId: UUID;
  tipoId: UUID;
  forca: 1 | 2 | 3;
}

export const EsquemaLigacao: z.ZodType<Ligacao> = EsquemaBase.extend({
  origemId: EsquemaUUID,
  destinoId: EsquemaUUID,
  tipoId: EsquemaUUID,
  forca: z.union([z.literal(1), z.literal(2), z.literal(3)]),
}).refine((l) => l.origemId !== l.destinoId, {
  message: 'Uma ligação deve conectar dois projetos distintos',
  path: ['destinoId'],
});

export interface RegistroDeHoras extends Base {
  data: Data;
  projetoId: UUID;
  tarefaId: UUID | null;
  horas: number;
  tecnologiaId: UUID | null;
}

export const EsquemaRegistroDeHoras: z.ZodType<RegistroDeHoras> = EsquemaBase.extend({
  data: EsquemaData,
  projetoId: EsquemaUUID,
  tarefaId: EsquemaUUID.nullable(),
  horas: z.number().finite().positive('Horas registradas devem ser maiores que zero'),
  tecnologiaId: EsquemaUUID.nullable(),
});

export interface Evento extends Base {
  tipo: 'positivo' | 'negativo' | 'ambiguo';
  tipoEvento: string;
  titulo: string;
  projetoId: UUID | null;
  data: Data;
  origem: 'detector' | 'manual' | 'conquista';
  resposta: 'ignorar' | 'mitigar' | 'aproveitar' | null;
  resultado: string;
  fechamentoId: UUID | null;
}

export const EsquemaEvento: z.ZodType<Evento> = EsquemaBase.extend({
  tipo: z.enum(['positivo', 'negativo', 'ambiguo']),
  tipoEvento: z.string().trim().min(1),
  titulo: z.string().trim().min(1, 'Título do evento obrigatório'),
  projetoId: EsquemaUUID.nullable(),
  data: EsquemaData,
  origem: z.enum(['detector', 'manual', 'conquista']),
  resposta: z.enum(['ignorar', 'mitigar', 'aproveitar']).nullable(),
  resultado: z.string(),
  fechamentoId: EsquemaUUID.nullable(),
});

export interface InstantaneoProjeto {
  saude: number;
  fase: number;
  moral: number;
}

export interface Instantaneo extends Base {
  semana: Data;
  receitaCentavos: Centavos;
  custoCentavos: Centavos;
  horas: number;
  porProjeto: Record<UUID, InstantaneoProjeto>;
  fechamentoId: UUID;
}

export const EsquemaInstantaneo: z.ZodType<Instantaneo> = EsquemaBase.extend({
  semana: EsquemaData,
  receitaCentavos: EsquemaCentavos.min(0),
  custoCentavos: EsquemaCentavos.min(0),
  horas: z.number().finite().min(0),
  porProjeto: z.record(
    EsquemaUUID,
    z.object({
      saude: z.number().finite().min(0).max(100),
      fase: z.number().int().min(0).max(7),
      moral: z.number().finite().min(0).max(1),
    })
  ),
  fechamentoId: EsquemaUUID,
});

export interface ListaEditavel extends Base {
  nome: string;
  ordem: number;
}

export type Estagio = ListaEditavel;
export type CategoriaLancamento = ListaEditavel;

export const EsquemaListaEditavel: z.ZodType<ListaEditavel> = EsquemaBase.extend({
  nome: z.string().trim().min(1, 'Nome obrigatório'),
  ordem: z.number().int().min(0),
});

export const EsquemaEstagio = EsquemaListaEditavel;
export const EsquemaCategoriaLancamento = EsquemaListaEditavel;

// ============================================================================
// Config, Conquistas e Meta (Anexo A)
// ============================================================================

export type DiaInicioSemana =
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'
  | 'domingo';

export type QualidadeGrafica = 'auto' | 'baixa' | 'media' | 'alta';

export type LenteMapa =
  | 'padrao'
  | 'financas'
  | 'tempo'
  | 'rede'
  | 'risco'
  | 'clientes'
  | 'estoque'
  | 'pd';

export interface Config {
  horasSemanaisDisponiveis: number;
  semana: {
    inicio: DiaInicioSemana;
    fuso: string;
  };
  moral: {
    pesoHoras: number;
    pesoTarefas: number;
    janelaDias: number;
    limiarBaixa: number;
    tarefasQuinzenaSemHistorico: number;
  };
  saude: {
    base: number;
    tarefaVencida: number;
    tetoTarefasVencidas: number;
    fluxoNegativo: number;
    moralBaixa: number;
    bloqueio: number;
    tetoBloqueios: number;
    faixaSaudavel: number;
    faixaAtencao: number;
  };
  maturidade: {
    horasExpedicao: number;
    tarefasExpedicao: number;
    clientesCidade: number;
    mesesCidade: number;
    clientesMetropole: number;
    mesesMetropole: number;
    limiarReceitaMensalMetropoleCentavos: Centavos;
    mesesParaDescer: number;
    legadoPercentualHoras: number;
  };
  detectores: {
    inanicaoAmareloDias: number;
    inanicaoVermelhoDias: number;
    concentracaoClientePercentual: number;
    projetosPorCliente: number;
    projetosPontoUnico: number;
    projetosTecnologiaAltoRetorno: number;
    setoresTrocaContexto: number;
    horasMinimasProjetoDireto: number;
    diasUltimoContatoCliente: number;
    toleranciaReceitaEmDiaDias: number;
  };
  mapa: {
    sementeTerreno: string;
    qualidade: QualidadeGrafidadeOuAuto;
    lentesAtivas: LenteMapa[];
  };
  brief: {
    concluido: boolean;
  };
}

type QualidadeGrafidadeOuAuto = QualidadeGrafica;

export const EsquemaConfig: z.ZodType<Config> = z.object({
  horasSemanaisDisponiveis: z.number().finite().positive(),
  semana: z.object({
    inicio: z.enum(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']),
    fuso: z.string().trim().min(1),
  }),
  moral: z.object({
    pesoHoras: z.number().finite().min(0).max(1),
    pesoTarefas: z.number().finite().min(0).max(1),
    janelaDias: z.number().int().positive(),
    limiarBaixa: z.number().finite().min(0).max(1),
    tarefasQuinzenaSemHistorico: z.number().finite().positive(),
  }),
  saude: z.object({
    base: z.number().finite().positive(),
    tarefaVencida: z.number().finite().min(0),
    tetoTarefasVencidas: z.number().finite().min(0),
    fluxoNegativo: z.number().finite().min(0),
    moralBaixa: z.number().finite().min(0),
    bloqueio: z.number().finite().min(0),
    tetoBloqueios: z.number().finite().min(0),
    faixaSaudavel: z.number().finite().min(0).max(100),
    faixaAtencao: z.number().finite().min(0).max(100),
  }),
  maturidade: z.object({
    horasExpedicao: z.number().finite().min(0),
    tarefasExpedicao: z.number().int().min(0),
    clientesCidade: z.number().int().min(1),
    mesesCidade: z.number().int().min(1),
    clientesMetropole: z.number().int().min(1),
    mesesMetropole: z.number().int().min(1),
    limiarReceitaMensalMetropoleCentavos: EsquemaCentavos.positive(),
    mesesParaDescer: z.number().int().min(1),
    legadoPercentualHoras: z.number().finite().min(0).max(1),
  }),
  detectores: z.object({
    inanicaoAmareloDias: z.number().int().positive(),
    inanicaoVermelhoDias: z.number().int().positive(),
    concentracaoClientePercentual: z.number().finite().min(0).max(1),
    projetosPorCliente: z.number().int().min(1),
    projetosPontoUnico: z.number().int().min(1),
    projetosTecnologiaAltoRetorno: z.number().int().min(1),
    setoresTrocaContexto: z.number().int().min(1),
    horasMinimasProjetoDireto: z.number().finite().min(0),
    diasUltimoContatoCliente: z.number().int().min(1),
    toleranciaReceitaEmDiaDias: z.number().int().min(0),
  }),
  mapa: z.object({
    sementeTerreno: z.string(),
    qualidade: z.enum(['auto', 'baixa', 'media', 'alta']),
    lentesAtivas: z
      .array(
        z.enum(['padrao', 'financas', 'tempo', 'rede', 'risco', 'clientes', 'estoque', 'pd'])
      )
      .min(1),
  }),
  brief: z.object({
    concluido: z.boolean(),
  }),
});

export const configPadrao: Config = {
  horasSemanaisDisponiveis: 40,
  semana: { inicio: 'segunda', fuso: 'America/Sao_Paulo' },
  moral: {
    pesoHoras: 0.5,
    pesoTarefas: 0.5,
    janelaDias: 14,
    limiarBaixa: 0.4,
    tarefasQuinzenaSemHistorico: 1,
  },
  saude: {
    base: 100,
    tarefaVencida: 10,
    tetoTarefasVencidas: 40,
    fluxoNegativo: 20,
    moralBaixa: 20,
    bloqueio: 10,
    tetoBloqueios: 20,
    faixaSaudavel: 70,
    faixaAtencao: 40,
  },
  maturidade: {
    horasExpedicao: 5,
    tarefasExpedicao: 1,
    clientesCidade: 3,
    mesesCidade: 3,
    clientesMetropole: 10,
    mesesMetropole: 6,
    limiarReceitaMensalMetropoleCentavos: 5000000, // a confirmar (9.1)
    mesesParaDescer: 2,
    legadoPercentualHoras: 0.1,
  },
  detectores: {
    inanicaoAmareloDias: 7,
    inanicaoVermelhoDias: 30,
    concentracaoClientePercentual: 0.4,
    projetosPorCliente: 3,
    projetosPontoUnico: 3,
    projetosTecnologiaAltoRetorno: 3,
    setoresTrocaContexto: 4,
    horasMinimasProjetoDireto: 1,
    diasUltimoContatoCliente: 60,
    toleranciaReceitaEmDiaDias: 7,
  },
  mapa: { sementeTerreno: 'longa-marcha-2026', qualidade: 'auto', lentesAtivas: ['padrao'] },
  brief: { concluido: false },
};

export interface RegistroConquista {
  desbloqueadaEm: Data;
  projetoId: UUID | null;
}

export const EsquemaRegistroConquista: z.ZodType<RegistroConquista> = z.object({
  desbloqueadaEm: EsquemaData,
  projetoId: EsquemaUUID.nullable(),
});

export interface Meta {
  versaoEsquema: number;
  config: Config;
  conquistas: Record<string, RegistroConquista>;
}

export const VERSAO_ESQUEMA_ATUAL = 1;

export const EsquemaMeta: z.ZodType<Meta> = z.object({
  versaoEsquema: z.number().int().min(1),
  config: EsquemaConfig,
  conquistas: z.record(z.string(), EsquemaRegistroConquista),
});

// ============================================================================
// Catálogo de Tabelas e Dump Completo para Exportação/Importação Atômica
// ============================================================================

export const NOMES_TABELAS_BASE = [
  'setores',
  'projetos',
  'frentes',
  'tarefas',
  'clientes',
  'vinculosCliente',
  'lancamentos',
  'fornecedores',
  'armazens',
  'itens',
  'saldos',
  'movimentos',
  'itensDeLista',
  'tecnologias',
  'aplicacoes',
  'tiposLigacao',
  'ligacoes',
  'registrosDeHoras',
  'eventos',
  'instantaneos',
  'estagios',
  'categoriasLancamento',
] as const;

export type NomeTabelaBase = (typeof NOMES_TABELAS_BASE)[number];

export const ESQUEMAS_POR_TABELA: Record<NomeTabelaBase, z.ZodType<Base>> = {
  setores: EsquemaSetor,
  projetos: EsquemaProjeto,
  frentes: EsquemaFrente,
  tarefas: EsquemaTarefa,
  clientes: EsquemaCliente,
  vinculosCliente: EsquemaVinculoCliente,
  lancamentos: EsquemaLancamento,
  fornecedores: EsquemaFornecedor,
  armazens: EsquemaArmazem,
  itens: EsquemaItem,
  saldos: EsquemaSaldo,
  movimentos: EsquemaMovimento,
  itensDeLista: EsquemaItemDeLista,
  tecnologias: EsquemaTecnologia,
  aplicacoes: EsquemaAplicacao,
  tiposLigacao: EsquemaTipoLigacao,
  ligacoes: EsquemaLigacao,
  registrosDeHoras: EsquemaRegistroDeHoras,
  eventos: EsquemaEvento,
  instantaneos: EsquemaInstantaneo,
  estagios: EsquemaEstagio,
  categoriasLancamento: EsquemaCategoriaLancamento,
};

export interface TabelasDump {
  setores: Setor[];
  projetos: Projeto[];
  frentes: Frente[];
  tarefas: Tarefa[];
  bloqueiosTarefa: BloqueioTarefa[];
  clientes: Cliente[];
  vinculosCliente: VinculoCliente[];
  lancamentos: Lancamento[];
  fornecedores: Fornecedor[];
  armazens: Armazem[];
  itens: Item[];
  saldos: Saldo[];
  movimentos: Movimento[];
  itensDeLista: ItemDeLista[];
  tecnologias: Tecnologia[];
  preRequisitosTecnologia: PreRequisitoTecnologia[];
  aplicacoes: Aplicacao[];
  tiposLigacao: TipoLigacao[];
  ligacoes: Ligacao[];
  registrosDeHoras: RegistroDeHoras[];
  eventos: Evento[];
  instantaneos: Instantaneo[];
  estagios: Estagio[];
  categoriasLancamento: CategoriaLancamento[];
}

export interface DumpBanco extends TabelasDump {
  versaoEsquema: number;
  meta: Meta;
}

export const EsquemaDumpBanco: z.ZodType<DumpBanco> = z.object({
  versaoEsquema: z.number().int().min(1),
  meta: EsquemaMeta,
  setores: z.array(EsquemaSetor),
  projetos: z.array(EsquemaProjeto),
  frentes: z.array(EsquemaFrente),
  tarefas: z.array(EsquemaTarefa),
  bloqueiosTarefa: z.array(EsquemaBloqueioTarefa),
  clientes: z.array(EsquemaCliente),
  vinculosCliente: z.array(EsquemaVinculoCliente),
  lancamentos: z.array(EsquemaLancamento),
  fornecedores: z.array(EsquemaFornecedor),
  armazens: z.array(EsquemaArmazem),
  itens: z.array(EsquemaItem),
  saldos: z.array(EsquemaSaldo),
  movimentos: z.array(EsquemaMovimento),
  itensDeLista: z.array(EsquemaItemDeLista),
  tecnologias: z.array(EsquemaTecnologia),
  preRequisitosTecnologia: z.array(EsquemaPreRequisitoTecnologia),
  aplicacoes: z.array(EsquemaAplicacao),
  tiposLigacao: z.array(EsquemaTipoLigacao),
  ligacoes: z.array(EsquemaLigacao),
  registrosDeHoras: z.array(EsquemaRegistroDeHoras),
  eventos: z.array(EsquemaEvento),
  instantaneos: z.array(EsquemaInstantaneo),
  estagios: z.array(EsquemaEstagio),
  categoriasLancamento: z.array(EsquemaCategoriaLancamento),
});

export interface ErroCampoValidacao {
  caminho: string;
  mensagem: string;
}

export class ErroValidacaoImportacao extends Error {
  public readonly errosPorCampo: readonly ErroCampoValidacao[];

  constructor(errosPorCampo: readonly ErroCampoValidacao[]) {
    const resumo = errosPorCampo.map((e) => `${e.caminho}: ${e.mensagem}`).join('; ');
    super(`Falha na validação do JSON de importação: ${resumo}`);
    this.name = 'ErroValidacaoImportacao';
    this.errosPorCampo = errosPorCampo;
  }
}

export function criarMetaPadrao(): Meta {
  return {
    versaoEsquema: VERSAO_ESQUEMA_ATUAL,
    config: structuredClone(configPadrao),
    conquistas: {},
  };
}

export function criarDumpVazio(): DumpBanco {
  const meta = criarMetaPadrao();
  return {
    versaoEsquema: VERSAO_ESQUEMA_ATUAL,
    meta,
    setores: [],
    projetos: [],
    frentes: [],
    tarefas: [],
    bloqueiosTarefa: [],
    clientes: [],
    vinculosCliente: [],
    lancamentos: [],
    fornecedores: [],
    armazens: [],
    itens: [],
    saldos: [],
    movimentos: [],
    itensDeLista: [],
    tecnologias: [],
    preRequisitosTecnologia: [],
    aplicacoes: [],
    tiposLigacao: [],
    ligacoes: [],
    registrosDeHoras: [],
    eventos: [],
    instantaneos: [],
    estagios: [],
    categoriasLancamento: [],
  };
}

/**
 * Migra um dump de versão antiga (ex: v0 legado sem campos novos ou com valores em reais)
 * para a versão atual do esquema (v1), preservando integralmente os dados antes da validação Zod.
 */
export function migrarDumpParaVersaoAtual(bruto: unknown): unknown {
  if (!bruto || typeof bruto !== 'object') {
    return bruto;
  }
  const obj = structuredClone(bruto) as Record<string, unknown>;
  const versao = typeof obj.versaoEsquema === 'number' ? obj.versaoEsquema : 0;

  if (versao < 1) {
    const baseVazia = criarDumpVazio();
    const metaAntiga =
      obj.meta && typeof obj.meta === 'object' ? (obj.meta as Record<string, unknown>) : {};
    const configAntiga =
      metaAntiga.config && typeof metaAntiga.config === 'object'
        ? (metaAntiga.config as Record<string, unknown>)
        : {};

    const configMigrada: Config = {
      ...structuredClone(configPadrao),
      ...(configAntiga as Partial<Config>),
    };

    const conquistasMigradas =
      metaAntiga.conquistas && typeof metaAntiga.conquistas === 'object'
        ? (metaAntiga.conquistas as Record<string, RegistroConquista>)
        : {};

    obj.versaoEsquema = 1;
    obj.meta = {
      versaoEsquema: 1,
      config: configMigrada,
      conquistas: conquistasMigradas,
    };

    // Garante que todas as coleções existam ao migrar de v0 -> v1
    for (const chave of Object.keys(baseVazia) as (keyof DumpBanco)[]) {
      if (chave === 'versaoEsquema' || chave === 'meta') continue;
      if (!Array.isArray(obj[chave])) {
        obj[chave] = [];
      }
    }

    // Na v0, projetos não tinham `notaLicoes` e itens não tinham `tipo` ('insumo' | 'equipamento')
    if (Array.isArray(obj.projetos)) {
      obj.projetos = obj.projetos.map((p: unknown) => {
        if (p && typeof p === 'object') {
          const proj = p as Record<string, unknown>;
          return {
            notaLicoes: null,
            ...proj,
          };
        }
        return p;
      });
    }

    if (Array.isArray(obj.itens)) {
      obj.itens = obj.itens.map((it: unknown) => {
        if (it && typeof it === 'object') {
          const itemObj = it as Record<string, unknown>;
          return {
            tipo: 'insumo',
            ...itemObj,
          };
        }
        return it;
      });
    }
  }

  return obj;
}

/**
 * Valida atomicamente um dump de banco com Zod; se qualquer campo falhar,
 * lança `ErroValidacaoImportacao` listando os erros pelo caminho exato do campo (`a.b.0.campo`).
 */
export function validarDumpBancoOuFalhar(dumpBruto: unknown): DumpBanco {
  const migrado = migrarDumpParaVersaoAtual(dumpBruto);
  const resultado = EsquemaDumpBanco.safeParse(migrado);
  if (!resultado.success) {
    const erros: ErroCampoValidacao[] = resultado.error.issues.map((issue) => ({
      caminho: issue.path.length > 0 ? issue.path.join('.') : '<raiz>',
      mensagem: issue.message,
    }));
    throw new ErroValidacaoImportacao(erros);
  }
  return resultado.data;
}

/**
 * Valida um registro individual de uma tabela base.
 */
export function validarRegistroTabela<T extends Base>(tabela: string, registro: T): T {
  const esquema = ESQUEMAS_POR_TABELA[tabela as NomeTabelaBase];
  if (!esquema) {
    throw new Error(`Tabela desconhecida: ${tabela}`);
  }
  const resultado = esquema.safeParse(registro);
  if (!resultado.success) {
    const erros: ErroCampoValidacao[] = resultado.error.issues.map((issue) => ({
      caminho: [tabela, ...issue.path].join('.'),
      mensagem: issue.message,
    }));
    throw new ErroValidacaoImportacao(erros);
  }
  return resultado.data as T;
}
