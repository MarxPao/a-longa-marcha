import Dexie, { type Table } from 'dexie';
import {
  criarDumpVazio,
  validarDumpBancoOuFalhar,
  validarRegistroTabela,
  type Base,
  type BloqueioTarefa,
  type DumpBanco,
  type Meta,
  type NomeTabelaBase,
  type PreRequisitoTecnologia,
  type UUID,
} from '../../domain';
import type { FiltroListagem, Repository } from '../types';

interface MetaRegistroIndexedDB {
  id: string;
  meta: Meta;
}

export class BancoDexieCampanha extends Dexie {
  setores!: Table<Base, string>;
  projetos!: Table<Base, string>;
  frentes!: Table<Base, string>;
  tarefas!: Table<Base, string>;
  bloqueiosTarefa!: Table<BloqueioTarefa, [string, string]>;
  clientes!: Table<Base, string>;
  vinculosCliente!: Table<Base, string>;
  lancamentos!: Table<Base, string>;
  fornecedores!: Table<Base, string>;
  armazens!: Table<Base, string>;
  itens!: Table<Base, string>;
  saldos!: Table<Base, string>;
  movimentos!: Table<Base, string>;
  itensDeLista!: Table<Base, string>;
  tecnologias!: Table<Base, string>;
  preRequisitosTecnologia!: Table<PreRequisitoTecnologia, [string, string]>;
  aplicacoes!: Table<Base, string>;
  tiposLigacao!: Table<Base, string>;
  ligacoes!: Table<Base, string>;
  registrosDeHoras!: Table<Base, string>;
  eventos!: Table<Base, string>;
  instantaneos!: Table<Base, string>;
  estagios!: Table<Base, string>;
  categoriasLancamento!: Table<Base, string>;
  meta!: Table<MetaRegistroIndexedDB, string>;

  constructor(nomeBanco: string = 'a-longa-marcha-db') {
    super(nomeBanco);

    this.version(1).stores({
      setores: 'id, ordem, arquivadoEm',
      projetos: 'id, setorId, estagioId, arquivadoEm',
      frentes: 'id, projetoId, paiId, arquivadoEm',
      tarefas: 'id, projetoId, frenteId, status, prazo, prioridade, arquivadoEm',
      bloqueiosTarefa: '[tarefaId+bloqueadaPorId], tarefaId, bloqueadaPorId',
      clientes: 'id, statusRelacao, arquivadoEm',
      vinculosCliente: 'id, clienteId, projetoId, arquivadoEm',
      lancamentos: 'id, projetoId, categoriaId, data, tipo, arquivadoEm',
      fornecedores: 'id, arquivadoEm',
      armazens: 'id, arquivadoEm',
      itens: 'id, fornecedorId, tipo, arquivadoEm',
      saldos: 'id, itemId, armazemId, arquivadoEm',
      movimentos: 'id, itemId, armazemId, data, tipo, arquivadoEm',
      itensDeLista: 'id, projetoId, itemId, status, arquivadoEm',
      tecnologias: 'id, estado, arquivadoEm',
      preRequisitosTecnologia:
        '[tecnologiaId+preRequisitoId], tecnologiaId, preRequisitoId',
      aplicacoes: 'id, tecnologiaId, projetoId, arquivadoEm',
      tiposLigacao: 'id, arquivadoEm',
      ligacoes: 'id, origemId, destinoId, tipoId, arquivadoEm',
      registrosDeHoras: 'id, projetoId, tarefaId, data, arquivadoEm',
      eventos: 'id, projetoId, data, tipo, fechamentoId, arquivadoEm',
      instantaneos: 'id, semana, fechamentoId, arquivadoEm',
      estagios: 'id, ordem, arquivadoEm',
      categoriasLancamento: 'id, ordem, arquivadoEm',
      meta: 'id',
    });
  }
}

export class RepositorioDexie implements Repository {
  private readonly db: BancoDexieCampanha;
  private readonly inicializado: Promise<void>;

  constructor(nomeBanco: string = 'a-longa-marcha-db') {
    this.db = new BancoDexieCampanha(nomeBanco);
    this.inicializado = this.garantirMetaInicial();
  }

  private async garantirMetaInicial(): Promise<void> {
    await this.db.open();
    const registroMeta = await this.db.meta.get('meta');
    if (!registroMeta) {
      const dumpVazio = criarDumpVazio();
      await this.db.meta.put({
        id: 'meta',
        meta: dumpVazio.meta,
      });
    }
  }

  async listar<T extends Base>(tabela: string, filtro?: FiltroListagem): Promise<T[]> {
    await this.inicializado;
    const table = this.db.table<T, string>(tabela);
    const todos = await table.toArray();
    const incluirArquivados = Boolean(filtro?.incluirArquivados);

    return todos.filter((item) => {
      if (!incluirArquivados && item.arquivadoEm !== null) {
        return false;
      }
      if (filtro) {
        for (const [campo, valor] of Object.entries(filtro)) {
          if (campo === 'incluirArquivados') continue;
          if ((item as unknown as Record<string, unknown>)[campo] !== valor) {
            return false;
          }
        }
      }
      return true;
    });
  }

  async obter<T extends Base>(tabela: string, id: UUID): Promise<T | null> {
    await this.inicializado;
    const table = this.db.table<T, string>(tabela);
    const res = await table.get(id);
    return res ?? null;
  }

  async salvar<T extends Base>(tabela: string, registro: T): Promise<T> {
    await this.inicializado;
    const validado = validarRegistroTabela(tabela as NomeTabelaBase, registro);
    const table = this.db.table<T, string>(tabela);
    await table.put(validado);
    return validado;
  }

  async arquivar(tabela: string, id: UUID): Promise<void> {
    await this.inicializado;
    const table = this.db.table<Base, string>(tabela);
    const item = await table.get(id);
    if (!item) return;

    const agora = new Date().toISOString();
    const atualizado = {
      ...item,
      arquivadoEm: agora,
      atualizadoEm: agora,
    };
    validarRegistroTabela(tabela as NomeTabelaBase, atualizado);
    await table.put(atualizado);
  }

  async transacao<R>(fn: () => Promise<R>): Promise<R> {
    await this.inicializado;
    return await this.db.transaction('rw', this.db.tables, async () => {
      return await fn();
    });
  }

  async exportar(): Promise<DumpBanco> {
    await this.inicializado;
    return await this.db.transaction('r', this.db.tables, async () => {
      const registroMeta = await this.db.meta.get('meta');
      const meta = registroMeta ? registroMeta.meta : criarDumpVazio().meta;

      const dump = criarDumpVazio();
      dump.versaoEsquema = meta.versaoEsquema;
      dump.meta = meta;

      const chavesBase: (keyof DumpBanco)[] = [
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
      ];

      for (const chave of chavesBase) {
        (dump[chave] as unknown as Base[]) = await this.db.table(chave).toArray();
      }

      dump.bloqueiosTarefa = await this.db.bloqueiosTarefa.toArray();
      dump.preRequisitosTecnologia = await this.db.preRequisitosTecnologia.toArray();

      return dump;
    });
  }

  async importar(dumpBruto: unknown): Promise<void> {
    await this.inicializado;
    const jaValidado =
      typeof dumpBruto === 'object' &&
      dumpBruto !== null &&
      (dumpBruto as Record<string, unknown>).__validadoPelaStore === true;
    const dumpValidado = jaValidado
      ? (dumpBruto as DumpBanco)
      : validarDumpBancoOuFalhar(dumpBruto);

    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all(this.db.tables.map((table) => table.clear()));

      const operacoes: Promise<unknown>[] = [
        this.db.meta.put({
          id: 'meta',
          meta: dumpValidado.meta,
        }),
      ];

      const chavesBase: (keyof DumpBanco)[] = [
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
      ];

      for (const chave of chavesBase) {
        const registros = dumpValidado[chave] as unknown as Base[];
        if (registros && registros.length > 0) {
          operacoes.push(this.db.table(chave).bulkPut(registros));
        }
      }

      if (dumpValidado.bloqueiosTarefa.length > 0) {
        operacoes.push(this.db.bloqueiosTarefa.bulkPut(dumpValidado.bloqueiosTarefa));
      }

      if (dumpValidado.preRequisitosTecnologia.length > 0) {
        operacoes.push(
          this.db.preRequisitosTecnologia.bulkPut(dumpValidado.preRequisitosTecnologia)
        );
      }

      await Promise.all(operacoes);
    });
  }

  async versaoEsquema(): Promise<number> {
    await this.inicializado;
    const registroMeta = await this.db.meta.get('meta');
    return registroMeta?.meta.versaoEsquema ?? 1;
  }
}

export function criarRepositorioDexie(nomeBanco?: string): Repository {
  return new RepositorioDexie(nomeBanco);
}
