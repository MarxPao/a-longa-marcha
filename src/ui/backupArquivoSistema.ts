import type { DumpBanco } from '../domain';

export interface ResultadoBackupSistema {
  metodo: 'file_system_access_api' | 'download_navegador';
  nomeArquivo: string;
  bytesGravados: number;
}

interface FileSystemWritableFileStreamLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
}

interface FileSystemDirectoryHandleLike {
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemFileHandleLike>;
}

interface WindowComFileSystemApi {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandleLike>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike>;
}

/**
 * Salva o dump JSON da campanha em uma pasta ou arquivo escolhido pelo usuário via File System Access API
 * (onde o navegador suportar, como Chrome/Edge desktop), com fallback transparente para download padrão (Seções 5.5, 9.1 e Fase 10).
 */
export async function salvarBackupJsonEmPastaEscolhida(
  dump: DumpBanco,
  prefixo = 'a-longa-marcha-backup'
): Promise<ResultadoBackupSistema> {
  const dataIso = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `${prefixo}-${dataIso}.json`;
  const conteudo = JSON.stringify(dump, null, 2);
  const bytesGravados = new TextEncoder().encode(conteudo).byteLength;

  const win = (typeof window !== 'undefined' ? window : {}) as unknown as WindowComFileSystemApi;

  if (typeof win.showDirectoryPicker === 'function') {
    const dirHandle = await win.showDirectoryPicker({ mode: 'readwrite' });
    const fileHandle = await dirHandle.getFileHandle(nomeArquivo, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(conteudo);
    await writable.close();
    return {
      metodo: 'file_system_access_api',
      nomeArquivo,
      bytesGravados,
    };
  }

  if (typeof win.showSaveFilePicker === 'function') {
    const fileHandle = await win.showSaveFilePicker({
      suggestedName: nomeArquivo,
      types: [
        {
          description: 'Arquivo de Campanha JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(conteudo);
    await writable.close();
    return {
      metodo: 'file_system_access_api',
      nomeArquivo,
      bytesGravados,
    };
  }

  // Fallback universal para navegadores sem File System Access API
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);

  return {
    metodo: 'download_navegador',
    nomeArquivo,
    bytesGravados,
  };
}
