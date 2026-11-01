import {
  EsquemaAplicacao,
  EsquemaArmazem,
  EsquemaBloqueioTarefa,
  EsquemaCategoriaLancamento,
  EsquemaCliente,
  EsquemaEstagio,
  EsquemaEvento,
  EsquemaFornecedor,
  EsquemaFrente,
  EsquemaInstantaneo,
  EsquemaItem,
  EsquemaItemDeLista,
  EsquemaLancamento,
  EsquemaLigacao,
  EsquemaMovimento,
  EsquemaPreRequisitoTecnologia,
  EsquemaProjeto,
  EsquemaRegistroDeHoras,
  EsquemaSaldo,
  EsquemaSetor,
  EsquemaTarefa,
  EsquemaTecnologia,
  EsquemaTipoLigacao,
  EsquemaVinculoCliente,
  type Base,
  type Config,
  type DumpBanco,
  type TabelasDump,
  type UUID,
} from '../domain';

export type TabelaColecao = keyof TabelasDump;

export function validarRegistro<T>(tabela: TabelaColecao, dados: unknown): T {
  switch (tabela) {
    case 'setores':
      return EsquemaSetor.parse(dados) as unknown as T;
    case 'projetos':
      return EsquemaProjeto.parse(dados) as unknown as T;
    case 'frentes':
      return EsquemaFrente.parse(dados) as unknown as T;
    case 'tarefas':
      return EsquemaTarefa.parse(dados) as unknown as T;
    case 'bloqueiosTarefa':
      return EsquemaBloqueioTarefa.parse(dados) as unknown as T;
    case 'clientes':
      return EsquemaCliente.parse(dados) as unknown as T;
    case 'vinculosCliente':
      return EsquemaVinculoCliente.parse(dados) as unknown as T;
    case 'lancamentos':
      return EsquemaLancamento.parse(dados) as unknown as T;
    case 'fornecedores':
      return EsquemaFornecedor.parse(dados) as unknown as T;
    case 'armazens':
      return EsquemaArmazem.parse(dados) as unknown as T;
    case 'itens':
      return EsquemaItem.parse(dados) as unknown as T;
    case 'saldos':
      return EsquemaSaldo.parse(dados) as unknown as T;
    case 'movimentos':
      return EsquemaMovimento.parse(dados) as unknown as T;
    case 'itensDeLista':
      return EsquemaItemDeLista.parse(dados) as unknown as T;
    case 'tecnologias':
      return EsquemaTecnologia.parse(dados) as unknown as T;
    case 'preRequisitosTecnologia':
      return EsquemaPreRequisitoTecnologia.parse(dados) as unknown as T;
    case 'aplicacoes':
      return EsquemaAplicacao.parse(dados) as unknown as T;
    case 'tiposLigacao':
      return EsquemaTipoLigacao.parse(dados) as unknown as T;
    case 'ligacoes':
      return EsquemaLigacao.parse(dados) as unknown as T;
    case 'registrosDeHoras':
      return EsquemaRegistroDeHoras.parse(dados) as unknown as T;
    case 'eventos':
      return EsquemaEvento.parse(dados) as unknown as T;
    case 'instantaneos':
      return EsquemaInstantaneo.parse(dados) as unknown as T;
    case 'estagios':
      return EsquemaEstagio.parse(dados) as unknown as T;
    case 'categoriasLancamento':
      return EsquemaCategoriaLancamento.parse(dados) as unknown as T;
    default:
      throw new Error(`Tabela desconhecida: ${String(tabela)}`);
  }
}

export type TipoComando =
  | 'CRIAR_ENTIDADE'
  | 'ATUALIZAR_ENTIDADE'
  | 'ARQUIVAR_ENTIDADE'
  | 'DESARQUIVAR_ENTIDADE'
  | 'ATUALIZAR_CONFIG'
  | 'FECHAR_TURNO'
  | 'DESFAZER_TURNO'
  | 'IMPORTAR_DUMP';

export interface ComandoBase {
  readonly id: UUID;
  readonly tipo: TipoComando;
  readonly descricao: string;
  readonly timestamp: number;
}

export interface ComandoCriarEntidade<T extends Base = Base> extends ComandoBase {
  readonly tipo: 'CRIAR_ENTIDADE';
  readonly tabela: TabelaColecao;
  readonly entidade: T;
}

export interface ComandoAtualizarEntidade<T extends Base = Base> extends ComandoBase {
  readonly tipo: 'ATUALIZAR_ENTIDADE';
  readonly tabela: TabelaColecao;
  readonly idEntidade: UUID;
  readonly antes: T;
  readonly depois: T;
}

export interface ComandoArquivarEntidade<T extends Base = Base> extends ComandoBase {
  readonly tipo: 'ARQUIVAR_ENTIDADE';
  readonly tabela: TabelaColecao;
  readonly idEntidade: UUID;
  readonly antes: T;
  readonly depois: T;
}

export interface ComandoDesarquivarEntidade<T extends Base = Base> extends ComandoBase {
  readonly tipo: 'DESARQUIVAR_ENTIDADE';
  readonly tabela: TabelaColecao;
  readonly idEntidade: UUID;
  readonly antes: T;
  readonly depois: T;
}

export interface ComandoAtualizarConfig extends ComandoBase {
  readonly tipo: 'ATUALIZAR_CONFIG';
  readonly antes: Config;
  readonly depois: Config;
}

export interface ComandoFecharTurno extends ComandoBase {
  readonly tipo: 'FECHAR_TURNO';
  readonly fechamentoId: UUID;
  readonly dumpAntes: DumpBanco;
  readonly dumpDepois: DumpBanco;
}

export interface ComandoDesfazerTurno extends ComandoBase {
  readonly tipo: 'DESFAZER_TURNO';
  readonly fechamentoId: UUID;
  readonly dumpAntes: DumpBanco;
  readonly dumpDepois: DumpBanco;
}

export interface ComandoImportarDump extends ComandoBase {
  readonly tipo: 'IMPORTAR_DUMP';
  readonly dumpAntes: DumpBanco;
  readonly dumpDepois: DumpBanco;
}

export type Comando =
  | ComandoCriarEntidade
  | ComandoAtualizarEntidade
  | ComandoArquivarEntidade
  | ComandoDesarquivarEntidade
  | ComandoAtualizarConfig
  | ComandoFecharTurno
  | ComandoDesfazerTurno
  | ComandoImportarDump;
