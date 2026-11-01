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

export class RepositorioMemoria implements Repository {
  private tabelasBase: Map<string, Map<UUID, Base>> = new Map();
  private bloqueiosTarefa: BloqueioTarefa[] = [];
  private preRequisitosTecnologia: PreRequisitoTecnologia[] = [];
  private meta: Meta;

  constructor(dumpInicial?: DumpBanco) {
    const dump = dumpInicial ? structuredClone(dumpInicial) : criarDumpVazio();
    this.meta = dump.meta;
    this.carregarDeDump(dump);
  }

  private obterTabela(nome: string): Map<UUID, Base> {
    let tabela = this.tabelasBase.get(nome);
    if (!tabela) {
      tabela = new Map();
      this.tabelasBase.set(nome, tabela);
    }
    return tabela;
  }

  private carregarDeDump(dump: DumpBanco): void {
    this.tabelasBase.clear();
    this.meta = structuredClone(dump.meta);
    this.bloqueiosTarefa = structuredClone(dump.bloqueiosTarefa);
    this.preRequisitosTecnologia = structuredClone(dump.preRequisitosTecnologia);

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
      const mapa = this.obterTabela(chave);
      const registros = dump[chave] as unknown as Base[];
      if (Array.isArray(registros)) {
        for (const reg of registros) {
          mapa.set(reg.id, structuredClone(reg));
        }
      }
    }
  }

  async listar<T extends Base>(tabela: string, filtro?: FiltroListagem): Promise<T[]> {
    const mapa = this.obterTabela(tabela);
    const resultado: T[] = [];
    const incluirArquivados = Boolean(filtro?.incluirArquivados);

    for (const item of mapa.values()) {
      if (!incluirArquivados && item.arquivadoEm !== null) {
        continue;
      }

      if (filtro) {
        let atendeFiltro = true;
        for (const [campo, valor] of Object.entries(filtro)) {
          if (campo === 'incluirArquivados') continue;
          if ((item as unknown as Record<string, unknown>)[campo] !== valor) {
            atendeFiltro = false;
            break;
          }
        }
        if (!atendeFiltro) continue;
      }

      resultado.push(structuredClone(item) as T);
    }

    return resultado;
  }

  async obter<T extends Base>(tabela: string, id: UUID): Promise<T | null> {
    const mapa = this.obterTabela(tabela);
    const item = mapa.get(id);
    if (!item) return null;
    return structuredClone(item) as T;
  }

  async salvar<T extends Base>(tabela: string, registro: T): Promise<T> {
    const validado = validarRegistroTabela(tabela as NomeTabelaBase, registro);
    const mapa = this.obterTabela(tabela);
    mapa.set(validado.id, structuredClone(validado));
    return structuredClone(validado) as T;
  }

  async arquivar(tabela: string, id: UUID): Promise<void> {
    const mapa = this.obterTabela(tabela);
    const item = mapa.get(id);
    if (!item) return;
    const agora = new Date().toISOString();
    const atualizado = {
      ...item,
      arquivadoEm: agora,
      atualizadoEm: agora,
    };
    validarRegistroTabela(tabela as NomeTabelaBase, atualizado);
    mapa.set(id, atualizado);
  }

  async transacao<R>(fn: () => Promise<R>): Promise<R> {
    return await fn();
  }

  async exportar(): Promise<DumpBanco> {
    const dump = criarDumpVazio();
    dump.versaoEsquema = this.meta.versaoEsquema;
    dump.meta = structuredClone(this.meta);
    dump.bloqueiosTarefa = structuredClone(this.bloqueiosTarefa);
    dump.preRequisitosTecnologia = structuredClone(this.preRequisitosTecnologia);

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
      const mapa = this.obterTabela(chave);
      (dump[chave] as unknown as Base[]) = Array.from(mapa.values()).map((v) =>
        structuredClone(v)
      );
    }

    return dump;
  }

  async importar(dump: unknown): Promise<void> {
    const dumpValidado = validarDumpBancoOuFalhar(dump);
    this.carregarDeDump(dumpValidado);
  }

  async versaoEsquema(): Promise<number> {
    return this.meta.versaoEsquema;
  }
}

export function criarRepositorioMemoria(dumpInicial?: DumpBanco): Repository {
  return new RepositorioMemoria(dumpInicial);
}
