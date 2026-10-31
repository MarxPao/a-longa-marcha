import type { Base, DumpBanco, UUID } from '../domain';

export interface FiltroListagem {
  readonly incluirArquivados?: boolean;
  readonly [campo: string]: unknown;
}

export interface Repository {
  listar<T extends Base>(tabela: string, filtro?: FiltroListagem): Promise<T[]>;
  obter<T extends Base>(tabela: string, id: UUID): Promise<T | null>;
  salvar<T extends Base>(tabela: string, registro: T): Promise<T>;
  arquivar(tabela: string, id: UUID): Promise<void>;
  transacao<R>(fn: () => Promise<R>): Promise<R>;
  exportar(): Promise<DumpBanco>;
  importar(dump: unknown): Promise<void>;
  versaoEsquema(): Promise<number>;
}

export async function solicitarArmazenamentoPersistente(): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.persist === 'function'
  ) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}
