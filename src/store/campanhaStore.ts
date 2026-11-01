import { create } from 'zustand';
import {
  EsquemaConfig,
  EsquemaDumpBanco,
  criarDumpVazio,
  type Base,
  type Config,
  type Data,
  type DumpBanco,
  type LenteMapa,
  type UUID,
} from '../domain';
import {
  calcularDerivadosGlobais,
  construirIndice,
  desfazerFechamentoTurno,
  fecharTurnoSemanal,
  previaFechamentoTurno,
  projetosInvalidados,
  recalcularProjetos,
  somarDias,
  type DerivadosGlobais,
  type DerivadosProjeto,
  type IndiceEstado,
  type PreviaFechamento,
  type ResultadoFechamentoTurno,
} from '../engine';
import { RepositorioDexie, RepositorioMemoria, type Repository } from '../repository';
import {
  validarRegistro,
  type Comando,
  type ComandoArquivarEntidade,
  type ComandoAtualizarConfig,
  type ComandoAtualizarEntidade,
  type ComandoCriarEntidade,
  type ComandoDesarquivarEntidade,
  type ComandoDesfazerTurno,
  type ComandoFecharTurno,
  type ComandoImportarDump,
  type TabelaColecao,
} from './comandos';

export interface FiltroListaProjetos {
  setorId: UUID | null;
  busca: string;
  ordenacao: 'nome' | 'saude' | 'fase' | 'moral' | 'horas';
  direcao: 'asc' | 'desc';
}

export type TipoModal =
  | 'brief'
  | 'fecharTurno'
  | 'editorRegistros'
  | 'capturaRapida'
  | 'criarProjeto'
  | 'buscaGlobal'
  | null;

export type TipoCapturaRapida = 'horas' | 'tarefa' | 'lancamento' | 'evento' | null;

export interface EstadoCampanha {
  // Dados fundamentais
  dump: DumpBanco;
  indice: IndiceEstado;
  derivadosPorProjeto: Map<UUID, DerivadosProjeto>;
  derivadosGlobais: DerivadosGlobais;
  historicoComandos: Comando[];
  semanaAtual: Data;
  repositorio: Repository;

  // Estado de UI
  projetoSelecionadoId: UUID | null;
  modalAberto: TipoModal;
  tipoCapturaRapida: TipoCapturaRapida;
  vistaAtiva: 'mapa' | 'lista';
  lenteAtiva: LenteMapa;
  filtroLista: FiltroListaProjetos;
  ultimoProjetoIdUsado: UUID | null;
  resumoFechamentoRecente: ResultadoFechamentoTurno | null;
  ultimoFechamentoId: UUID | null;
  carregando: boolean;
  notificacao: { tipo: 'sucesso' | 'erro' | 'aviso'; mensagem: string } | null;

  // Ações
  inicializar: (repo?: Repository, dumpInicial?: DumpBanco) => Promise<void>;
  desfazer: () => Promise<boolean>;
  podeDesfazer: () => boolean;

  // CRUD Comandos
  criarEntidade: <T extends Base>(
    tabela: TabelaColecao,
    dados: Omit<T, 'id' | 'criadoEm' | 'atualizadoEm' | 'arquivadoEm'> & Partial<Base>
  ) => Promise<T>;
  atualizarEntidade: <T extends Base>(
    tabela: TabelaColecao,
    id: UUID,
    alteracoes: Partial<T>
  ) => Promise<T>;
  arquivarEntidade: (tabela: TabelaColecao, id: UUID, notasRuinas?: string) => Promise<void>;
  desarquivarEntidade: (tabela: TabelaColecao, id: UUID) => Promise<void>;
  atualizarConfig: (configParcial: Partial<Config>) => Promise<void>;

  // Fechamento de Turno
  obterPreviaTurno: () => PreviaFechamento;
  fecharTurno: () => Promise<ResultadoFechamentoTurno>;
  desfazerUltimoTurno: () => Promise<boolean>;

  // Portabilidade
  exportarJson: () => DumpBanco;
  importarJson: (dados: unknown) => Promise<void>;
  resetarBanco: (dumpForcado?: DumpBanco) => Promise<void>;
  concluirBrief: () => Promise<void>;

  // UI
  selecionarProjeto: (id: UUID | null) => void;
  abrirModal: (modal: TipoModal, tipoCaptura?: TipoCapturaRapida) => void;
  fecharModal: () => void;
  alternarVista: (vista: 'mapa' | 'lista') => void;
  definirLenteAtiva: (lente: LenteMapa) => void;
  definirFiltroLista: (parcial: Partial<FiltroListaProjetos>) => void;
  limparNotificacao: () => void;
}

const LIMITE_HISTORICO_COMANDOS = 20;

function clonarDump(dump: DumpBanco): DumpBanco {
  return JSON.parse(JSON.stringify(dump)) as DumpBanco;
}

function inicializarEstadoDerivado(dump: DumpBanco, hoje: Data) {
  const indice = construirIndice(dump);
  const derivadosPorProjeto = recalcularProjetos(indice, 'todos', hoje, dump.meta.config);
  const derivadosGlobais = calcularDerivadosGlobais(indice, hoje, dump.meta.config);
  return { indice, derivadosPorProjeto, derivadosGlobais };
}

// Cria dump vazio inicial
const dumpPadrao = criarDumpVazio();
const semanaInicial = '2026-10-19';
const derivadosIniciais = inicializarEstadoDerivado(dumpPadrao, semanaInicial);

export const useCampanhaStore = create<EstadoCampanha>((set, get) => ({
  dump: dumpPadrao,
  indice: derivadosIniciais.indice,
  derivadosPorProjeto: derivadosIniciais.derivadosPorProjeto,
  derivadosGlobais: derivadosIniciais.derivadosGlobais,
  historicoComandos: [],
  semanaAtual: semanaInicial,
  repositorio:
    typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
      ? new RepositorioDexie('a-longa-marcha-db')
      : new RepositorioMemoria(),

  projetoSelecionadoId: dumpPadrao.projetos[0]?.id ?? null,
  modalAberto: null,
  tipoCapturaRapida: null,
  vistaAtiva: 'mapa',
  lenteAtiva: 'padrao',
  filtroLista: {
    setorId: null,
    busca: '',
    ordenacao: 'nome',
    direcao: 'asc',
  },
  ultimoProjetoIdUsado: dumpPadrao.projetos[0]?.id ?? null,
  resumoFechamentoRecente: null,
  ultimoFechamentoId: null,
  carregando: false,
  notificacao: null,

  inicializar: async (repoCustomizado, dumpForcado) => {
    set({ carregando: true });
    try {
      const repo = repoCustomizado ?? get().repositorio;
      let dumpParaUsar: DumpBanco;

      if (dumpForcado) {
        dumpParaUsar = dumpForcado;
      } else {
        const dumpExistente = await repo.exportar();
        if (dumpExistente && dumpExistente.projetos.length > 0) {
          dumpParaUsar = dumpExistente;
        } else {
          // Se banco vazio, inicia com dump vazio
          dumpParaUsar = criarDumpVazio();
          await repo.importar(dumpParaUsar);
        }
      }

      const hoje = get().semanaAtual;
      const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
        dumpParaUsar,
        hoje
      );

      set({
        repositorio: repo,
        dump: dumpParaUsar,
        indice,
        derivadosPorProjeto,
        derivadosGlobais,
        projetoSelecionadoId: dumpParaUsar.projetos[0]?.id ?? null,
        ultimoProjetoIdUsado: dumpParaUsar.projetos[0]?.id ?? null,
        modalAberto: null,
        carregando: false,
      });
    } catch (err) {
      set({
        carregando: false,
        notificacao: {
          tipo: 'erro',
          mensagem: `Erro ao inicializar dados: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  },

  podeDesfazer: () => get().historicoComandos.length > 0,

  desfazer: async () => {
    const { historicoComandos, dump, semanaAtual, repositorio } = get();
    if (historicoComandos.length === 0) return false;

    const comando = historicoComandos[historicoComandos.length - 1];
    if (!comando) return false;

    const novoHistorico = historicoComandos.slice(0, -1);
    const novoDump = clonarDump(dump);

    switch (comando.tipo) {
      case 'CRIAR_ENTIDADE': {
        const lista = novoDump[comando.tabela] as Base[];
        const idx = lista.findIndex((e) => e.id === comando.entidade.id);
        if (idx >= 0) lista.splice(idx, 1);
        break;
      }
      case 'ATUALIZAR_ENTIDADE':
      case 'ARQUIVAR_ENTIDADE':
      case 'DESARQUIVAR_ENTIDADE': {
        const lista = novoDump[comando.tabela] as Base[];
        const idx = lista.findIndex((e) => e.id === comando.idEntidade);
        if (idx >= 0) {
          lista[idx] = comando.antes;
        }
        break;
      }
      case 'ATUALIZAR_CONFIG': {
        novoDump.meta.config = comando.antes;
        break;
      }
      case 'FECHAR_TURNO': {
        // Restaura dump anterior ao fechamento
        Object.assign(novoDump, comando.dumpAntes);
        break;
      }
      case 'DESFAZER_TURNO': {
        Object.assign(novoDump, comando.dumpAntes);
        break;
      }
      case 'IMPORTAR_DUMP': {
        Object.assign(novoDump, comando.dumpAntes);
        break;
      }
    }

    const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
      novoDump,
      semanaAtual
    );

    set({
      dump: novoDump,
      indice,
      derivadosPorProjeto,
      derivadosGlobais,
      historicoComandos: novoHistorico,
      notificacao: { tipo: 'aviso', mensagem: `Desfeito: ${comando.descricao}` },
    });

    try {
      await repositorio.importar(novoDump);
    } catch {
      // Ignora falhas de persistência assíncrona em modo background
    }

    return true;
  },

  criarEntidade: async (tabela, dados) => {
    const agora = new Date().toISOString();
    const id = (dados.id ?? crypto.randomUUID()) as UUID;
    const entidadeCompleta = {
      ...dados,
      id,
      criadoEm: dados.criadoEm ?? agora,
      atualizadoEm: agora,
      arquivadoEm: null,
    };

    // Validação estrita por schema Zod
    const entidadeValidada = validarRegistro(tabela, entidadeCompleta) as Base;

    const { dump, indice: indiceAtual, derivadosPorProjeto, semanaAtual, repositorio } = get();
    const novoDump = clonarDump(dump);
    (novoDump[tabela] as Base[]).push(entidadeValidada);

    // Recálculo incremental
    const novoIndice = construirIndice(novoDump);
    const invalidados = projetosInvalidados(indiceAtual, {
      tabela,
      antes: null,
      depois: entidadeValidada,
    });

    const novosDerivados = new Map(derivadosPorProjeto);
    const recalculados = recalcularProjetos(novoIndice, invalidados, semanaAtual, novoDump.meta.config);
    for (const [pId, d] of recalculados) {
      novosDerivados.set(pId, d);
    }
    const novosGlobais = calcularDerivadosGlobais(novoIndice, semanaAtual, novoDump.meta.config);

    const comando: ComandoCriarEntidade = {
      id: crypto.randomUUID() as UUID,
      tipo: 'CRIAR_ENTIDADE',
      tabela,
      entidade: entidadeValidada,
      descricao: `Criar ${tabela.slice(0, -1)} (${(entidadeValidada as { nome?: string; titulo?: string }).nome ?? (entidadeValidada as { titulo?: string }).titulo ?? id})`,
      timestamp: Date.now(),
    };

    const historicoAtualizado = [...get().historicoComandos, comando].slice(
      -LIMITE_HISTORICO_COMANDOS
    );

    let ultimoProjeto = get().ultimoProjetoIdUsado;
    if (tabela === 'projetos') {
      ultimoProjeto = id;
    } else if ('projetoId' in entidadeValidada && typeof entidadeValidada.projetoId === 'string') {
      ultimoProjeto = entidadeValidada.projetoId as UUID;
    }

    set({
      dump: novoDump,
      indice: novoIndice,
      derivadosPorProjeto: novosDerivados,
      derivadosGlobais: novosGlobais,
      historicoComandos: historicoAtualizado,
      ultimoProjetoIdUsado: ultimoProjeto,
      notificacao: { tipo: 'sucesso', mensagem: `${comando.descricao} concluído.` },
    });

    try {
      await repositorio.salvar(tabela, entidadeValidada);
    } catch {
      // Ignora erro assíncrono secundário
    }

    return entidadeValidada as never;
  },

  atualizarEntidade: async (tabela, id, alteracoes) => {
    const { dump, indice: indiceAtual, derivadosPorProjeto, semanaAtual, repositorio } = get();
    const lista = dump[tabela] as Base[];
    const existente = lista.find((e) => e.id === id);
    if (!existente) throw new Error(`Registro ${id} não encontrado na tabela ${tabela}`);

    const agora = new Date().toISOString();
    const entidadeMesclada = {
      ...existente,
      ...alteracoes,
      id,
      atualizadoEm: agora,
    };

    // Validação estrita por schema Zod
    const entidadeValidada = validarRegistro(tabela, entidadeMesclada) as Base;

    const novoDump = clonarDump(dump);
    const novaLista = novoDump[tabela] as Base[];
    const idx = novaLista.findIndex((e) => e.id === id);
    if (idx >= 0) novaLista[idx] = entidadeValidada;

    const novoIndice = construirIndice(novoDump);
    const invalidados = projetosInvalidados(indiceAtual, {
      tabela,
      antes: existente,
      depois: entidadeValidada,
    });

    const novosDerivados = new Map(derivadosPorProjeto);
    const recalculados = recalcularProjetos(novoIndice, invalidados, semanaAtual, novoDump.meta.config);
    for (const [pId, d] of recalculados) {
      novosDerivados.set(pId, d);
    }
    const novosGlobais = calcularDerivadosGlobais(novoIndice, semanaAtual, novoDump.meta.config);

    const comando: ComandoAtualizarEntidade = {
      id: crypto.randomUUID() as UUID,
      tipo: 'ATUALIZAR_ENTIDADE',
      tabela,
      idEntidade: id,
      antes: existente,
      depois: entidadeValidada,
      descricao: `Atualizar ${tabela.slice(0, -1)} (${(entidadeValidada as { nome?: string; titulo?: string }).nome ?? id})`,
      timestamp: Date.now(),
    };

    const historicoAtualizado = [...get().historicoComandos, comando].slice(
      -LIMITE_HISTORICO_COMANDOS
    );

    set({
      dump: novoDump,
      indice: novoIndice,
      derivadosPorProjeto: novosDerivados,
      derivadosGlobais: novosGlobais,
      historicoComandos: historicoAtualizado,
      notificacao: { tipo: 'sucesso', mensagem: `${comando.descricao} salvo.` },
    });

    try {
      await repositorio.salvar(tabela, entidadeValidada);
    } catch {
      // Ignora erro assíncrono secundário
    }

    return entidadeValidada as never;
  },

  arquivarEntidade: async (tabela, id, notasRuinas) => {
    const { dump, indice: indiceAtual, derivadosPorProjeto, semanaAtual, repositorio } = get();
    const lista = dump[tabela] as Base[];
    const existente = lista.find((e) => e.id === id);
    if (!existente) throw new Error(`Registro ${id} não encontrado na tabela ${tabela}`);

    const agora = new Date().toISOString();
    const alteracoes: Partial<Base> & Record<string, unknown> = {
      arquivadoEm: agora,
      atualizadoEm: agora,
    };

    if (tabela === 'projetos') {
      const notasAtuais = (existente as { notas?: string }).notas ?? '';
      const textoLicoes = (notasRuinas ?? notasAtuais).trim();
      if (!textoLicoes) {
        throw new Error('Arquivar projeto como Ruínas exige nota de lições aprendidas (Seção 3.4 e Caso 7.2)');
      }
      alteracoes.notas = textoLicoes;
    }

    const entidadeArquivada = validarRegistro(tabela, {
      ...existente,
      ...alteracoes,
    }) as Base;

    const novoDump = clonarDump(dump);
    const novaLista = novoDump[tabela] as Base[];
    const idx = novaLista.findIndex((e) => e.id === id);
    if (idx >= 0) novaLista[idx] = entidadeArquivada;

    const novoIndice = construirIndice(novoDump);
    const invalidados = projetosInvalidados(indiceAtual, {
      tabela,
      antes: existente,
      depois: entidadeArquivada,
    });

    const novosDerivados = new Map(derivadosPorProjeto);
    const recalculados = recalcularProjetos(novoIndice, invalidados, semanaAtual, novoDump.meta.config);
    for (const [pId, d] of recalculados) {
      novosDerivados.set(pId, d);
    }
    const novosGlobais = calcularDerivadosGlobais(novoIndice, semanaAtual, novoDump.meta.config);

    const comando: ComandoArquivarEntidade = {
      id: crypto.randomUUID() as UUID,
      tipo: 'ARQUIVAR_ENTIDADE',
      tabela,
      idEntidade: id,
      antes: existente,
      depois: entidadeArquivada,
      descricao: `Arquivar ${tabela.slice(0, -1)} (${(existente as { nome?: string }).nome ?? id})`,
      timestamp: Date.now(),
    };

    set({
      dump: novoDump,
      indice: novoIndice,
      derivadosPorProjeto: novosDerivados,
      derivadosGlobais: novosGlobais,
      historicoComandos: [...get().historicoComandos, comando].slice(-LIMITE_HISTORICO_COMANDOS),
      notificacao: { tipo: 'aviso', mensagem: `${comando.descricao}.` },
    });

    try {
      await repositorio.arquivar(tabela, id);
    } catch {
      // Ignora erro assíncrono secundário
    }
  },

  desarquivarEntidade: async (tabela, id) => {
    const { dump, indice: indiceAtual, derivadosPorProjeto, semanaAtual, repositorio } = get();
    const lista = dump[tabela] as Base[];
    const existente = lista.find((e) => e.id === id);
    if (!existente) throw new Error(`Registro ${id} não encontrado na tabela ${tabela}`);

    const agora = new Date().toISOString();
    const entidadeReativada = validarRegistro(tabela, {
      ...existente,
      arquivadoEm: null,
      atualizadoEm: agora,
    }) as Base;

    const novoDump = clonarDump(dump);
    const novaLista = novoDump[tabela] as Base[];
    const idx = novaLista.findIndex((e) => e.id === id);
    if (idx >= 0) novaLista[idx] = entidadeReativada;

    const novoIndice = construirIndice(novoDump);
    const invalidados = projetosInvalidados(indiceAtual, {
      tabela,
      antes: existente,
      depois: entidadeReativada,
    });

    const novosDerivados = new Map(derivadosPorProjeto);
    const recalculados = recalcularProjetos(novoIndice, invalidados, semanaAtual, novoDump.meta.config);
    for (const [pId, d] of recalculados) {
      novosDerivados.set(pId, d);
    }
    const novosGlobais = calcularDerivadosGlobais(novoIndice, semanaAtual, novoDump.meta.config);

    const comando: ComandoDesarquivarEntidade = {
      id: crypto.randomUUID() as UUID,
      tipo: 'DESARQUIVAR_ENTIDADE',
      tabela,
      idEntidade: id,
      antes: existente,
      depois: entidadeReativada,
      descricao: `Reativar ${tabela.slice(0, -1)} (${(existente as { nome?: string }).nome ?? id})`,
      timestamp: Date.now(),
    };

    set({
      dump: novoDump,
      indice: novoIndice,
      derivadosPorProjeto: novosDerivados,
      derivadosGlobais: novosGlobais,
      historicoComandos: [...get().historicoComandos, comando].slice(-LIMITE_HISTORICO_COMANDOS),
      notificacao: { tipo: 'sucesso', mensagem: `${comando.descricao}.` },
    });

    try {
      await repositorio.salvar(tabela, entidadeReativada);
    } catch {
      // Ignora erro assíncrono secundário
    }
  },

  atualizarConfig: async (configParcial) => {
    const { dump, semanaAtual, repositorio } = get();
    const configAtualizada = EsquemaConfig.parse({
      ...dump.meta.config,
      ...configParcial,
    });

    const novoDump = clonarDump(dump);
    novoDump.meta.config = configAtualizada;

    const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
      novoDump,
      semanaAtual
    );

    const comando: ComandoAtualizarConfig = {
      id: crypto.randomUUID() as UUID,
      tipo: 'ATUALIZAR_CONFIG',
      antes: dump.meta.config,
      depois: configAtualizada,
      descricao: 'Atualizar pesos e regras de Config',
      timestamp: Date.now(),
    };

    set({
      dump: novoDump,
      indice,
      derivadosPorProjeto,
      derivadosGlobais,
      historicoComandos: [...get().historicoComandos, comando].slice(-LIMITE_HISTORICO_COMANDOS),
      notificacao: { tipo: 'sucesso', mensagem: 'Configurações atualizadas com sucesso.' },
    });

    try {
      await repositorio.salvar('config', configAtualizada as unknown as Base);
    } catch {
      // Ignora erro assíncrono secundário
    }
  },

  obterPreviaTurno: () => {
    const { dump, semanaAtual } = get();
    return previaFechamentoTurno(dump, semanaAtual);
  },

  fecharTurno: async () => {
    const { dump, semanaAtual, repositorio } = get();
    const dumpAntes = clonarDump(dump);

    const resultado = fecharTurnoSemanal(dump, semanaAtual);
    const proximaSemana = somarDias(semanaAtual, 7);

    const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
      resultado.dumpAtualizado,
      proximaSemana
    );

    const comando: ComandoFecharTurno = {
      id: crypto.randomUUID() as UUID,
      tipo: 'FECHAR_TURNO',
      fechamentoId: resultado.fechamentoId,
      dumpAntes,
      dumpDepois: resultado.dumpAtualizado,
      descricao: `Fechamento da semana ${semanaAtual}`,
      timestamp: Date.now(),
    };

    set({
      dump: resultado.dumpAtualizado,
      indice,
      derivadosPorProjeto,
      derivadosGlobais,
      semanaAtual: proximaSemana,
      ultimoFechamentoId: resultado.fechamentoId,
      resumoFechamentoRecente: resultado,
      historicoComandos: [...get().historicoComandos, comando].slice(-LIMITE_HISTORICO_COMANDOS),
      notificacao: {
        tipo: 'sucesso',
        mensagem: `Turno fechado! Nova semana: ${proximaSemana}`,
      },
    });

    try {
      await repositorio.importar(resultado.dumpAtualizado);
    } catch {
      // Ignora erro assíncrono secundário
    }

    return resultado;
  },

  desfazerUltimoTurno: async () => {
    const { dump, ultimoFechamentoId, semanaAtual, repositorio } = get();
    if (!ultimoFechamentoId) return false;

    const dumpAntes = clonarDump(dump);
    const dumpRevertido = desfazerFechamentoTurno(dump, ultimoFechamentoId);
    const semanaAnterior = somarDias(semanaAtual, -7);

    const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
      dumpRevertido,
      semanaAnterior
    );

    const comando: ComandoDesfazerTurno = {
      id: crypto.randomUUID() as UUID,
      tipo: 'DESFAZER_TURNO',
      fechamentoId: ultimoFechamentoId,
      dumpAntes,
      dumpDepois: dumpRevertido,
      descricao: `Desfazer fechamento ${ultimoFechamentoId}`,
      timestamp: Date.now(),
    };

    set({
      dump: dumpRevertido,
      indice,
      derivadosPorProjeto,
      derivadosGlobais,
      semanaAtual: semanaAnterior,
      ultimoFechamentoId: null,
      resumoFechamentoRecente: null,
      historicoComandos: [...get().historicoComandos, comando].slice(-LIMITE_HISTORICO_COMANDOS),
      notificacao: { tipo: 'aviso', mensagem: 'Último fechamento de turno desfeito.' },
    });

    try {
      await repositorio.importar(dumpRevertido);
    } catch {
      // Ignora erro assíncrono secundário
    }

    return true;
  },

  exportarJson: () => {
    const dump = get().dump;
    return {
      ...dump,
      exportadoEm: new Date().toISOString(),
    };
  },

  importarJson: async (dados) => {
    // Validação atômica estrita (Seção 6.8: se falhar nada é gravado)
    const dumpValidado = EsquemaDumpBanco.parse(dados);
    const { dump: dumpAntes, semanaAtual, repositorio } = get();

    const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
      dumpValidado,
      semanaAtual
    );

    const comando: ComandoImportarDump = {
      id: crypto.randomUUID() as UUID,
      tipo: 'IMPORTAR_DUMP',
      dumpAntes: clonarDump(dumpAntes),
      dumpDepois: dumpValidado,
      descricao: 'Importar dados em JSON',
      timestamp: Date.now(),
    };

    set({
      dump: dumpValidado,
      indice,
      derivadosPorProjeto,
      derivadosGlobais,
      historicoComandos: [...get().historicoComandos, comando].slice(-LIMITE_HISTORICO_COMANDOS),
      notificacao: { tipo: 'sucesso', mensagem: 'Dados importados com sucesso.' },
    });

    await repositorio.importar(dumpValidado);
  },

  resetarBanco: async (dumpForcado) => {
    const novoDump = dumpForcado ?? criarDumpVazio();

    const semanaAtual = '2026-10-19';
    const { indice, derivadosPorProjeto, derivadosGlobais } = inicializarEstadoDerivado(
      novoDump,
      semanaAtual
    );

    set({
      dump: novoDump,
      indice,
      derivadosPorProjeto,
      derivadosGlobais,
      semanaAtual,
      historicoComandos: [],
      projetoSelecionadoId: novoDump.projetos[0]?.id ?? null,
      notificacao: { tipo: 'aviso', mensagem: 'Banco de dados reiniciado.' },
    });

    await get().repositorio.importar(novoDump);
  },

  concluirBrief: async () => {
    const { dump, atualizarConfig } = get();
    await atualizarConfig({
      brief: {
        ...dump.meta.config.brief,
        concluido: true,
      },
    });
    set({ modalAberto: null });
  },

  selecionarProjeto: (id) => {
    set({
      projetoSelecionadoId: id,
      ultimoProjetoIdUsado: id ?? get().ultimoProjetoIdUsado,
    });
  },

  abrirModal: (modal, tipoCaptura = null) => {
    set({ modalAberto: modal, tipoCapturaRapida: tipoCaptura });
  },

  fecharModal: () => {
    set({ modalAberto: null, tipoCapturaRapida: null });
  },

  alternarVista: (vista) => {
    set({ vistaAtiva: vista });
  },

  definirLenteAtiva: (lente) => {
    set({ lenteAtiva: lente });
  },

  definirFiltroLista: (parcial) => {
    set((s) => ({ filtroLista: { ...s.filtroLista, ...parcial } }));
  },

  limparNotificacao: () => {
    set({ notificacao: null });
  },
}));
