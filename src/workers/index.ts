import type { Data, DumpBanco, SementeTerreno, UUID } from '../domain';
import {
  calcularDerivadosGlobais,
  calcularDerivadosProjeto,
  construirIndice,
  fecharTurnoSemanal,
  gerarHashSemente,
  type DerivadosGlobais,
  type DerivadosProjeto,
  type ResultadoFechamentoTurno,
} from '../engine';
import type { MensagemRecalculoResponse } from './recalculo.worker';

export function calcularHashWorker(semente: SementeTerreno): number {
  return gerarHashSemente(semente);
}

/**
 * Executa o fechamento semanal delegando para Web Worker se disponível,
 * ou executando de forma síncrona/direta como fallback seguro em Node/Vitest.
 */
export async function executarFechamentoTurno(
  dump: DumpBanco,
  semana: Data,
  options?: { fechamentoId?: UUID; agora?: string }
): Promise<{ resultado: ResultadoFechamentoTurno; duracaoMs: number; viaWorker: boolean }> {
  const t0 = performance.now();

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      return await new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL('./fechamento.worker.ts', import.meta.url),
          { type: 'module' }
        );
        const reqId = crypto.randomUUID();

        const timeout = setTimeout(() => {
          worker.terminate();
          const res = fecharTurnoSemanal(dump, semana, options);
          resolve({ resultado: res, duracaoMs: performance.now() - t0, viaWorker: false });
        }, 5000);

        worker.onmessage = (e: MessageEvent) => {
          clearTimeout(timeout);
          worker.terminate();
          resolve({
            resultado: e.data.resultado,
            duracaoMs: e.data.duracaoMs,
            viaWorker: true,
          });
        };

        worker.onerror = (err) => {
          clearTimeout(timeout);
          worker.terminate();
          reject(err);
        };

        worker.postMessage({
          tipo: 'FECHAR_TURNO',
          requestId: reqId,
          dump,
          semana,
          options,
        });
      });
    } catch {
      // Fallback para execução direta
    }
  }

  const resultado = fecharTurnoSemanal(dump, semana, options);
  const duracaoMs = performance.now() - t0;
  return { resultado, duracaoMs, viaWorker: false };
}

/**
 * Executa recálculo pesado completo do estado derivado em Web Worker (Fase 8).
 * Possui fallback síncrono determinístico caso Worker não esteja disponível.
 */
export async function executarRecalculoPesadoWorker(
  dump: DumpBanco,
  hoje: Data
): Promise<{
  derivadosPorProjeto: Map<UUID, DerivadosProjeto>;
  derivadosGlobais: DerivadosGlobais;
  duracaoMs: number;
  viaWorker: boolean;
}> {
  const t0 = performance.now();

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      return await new Promise((resolve) => {
        const worker = new Worker(
          new URL('./recalculo.worker.ts', import.meta.url),
          { type: 'module' }
        );
        const reqId = crypto.randomUUID();

        const fallbackDireto = () => {
          const indice = construirIndice(dump);
          const mapa = new Map<UUID, DerivadosProjeto>();
          for (const p of dump.projetos) {
            const d = calcularDerivadosProjeto(indice, p.id, hoje, dump.meta.config);
            mapa.set(p.id, d);
          }
          const derivadosGlobais = calcularDerivadosGlobais(
            indice,
            hoje,
            dump.meta.config
          );
          resolve({
            derivadosPorProjeto: mapa,
            derivadosGlobais,
            duracaoMs: performance.now() - t0,
            viaWorker: false,
          });
        };

        const timeout = setTimeout(() => {
          worker.terminate();
          fallbackDireto();
        }, 5000);

        worker.onmessage = (e: MessageEvent<MensagemRecalculoResponse>) => {
          clearTimeout(timeout);
          worker.terminate();
          resolve({
            derivadosPorProjeto: new Map(e.data.derivadosEntries),
            derivadosGlobais: e.data.derivadosGlobais,
            duracaoMs: e.data.duracaoMs,
            viaWorker: true,
          });
        };

        worker.onerror = () => {
          clearTimeout(timeout);
          worker.terminate();
          fallbackDireto();
        };

        worker.postMessage({
          tipo: 'RECALCULAR_PESADO',
          requestId: reqId,
          dump,
          hoje,
        });
      });
    } catch {
      // Fallback abaixo
    }
  }

  const indice = construirIndice(dump);
  const mapa = new Map<UUID, DerivadosProjeto>();
  for (const p of dump.projetos) {
    const d = calcularDerivadosProjeto(indice, p.id, hoje, dump.meta.config);
    mapa.set(p.id, d);
  }
  const derivadosGlobais = calcularDerivadosGlobais(indice, hoje, dump.meta.config);
  return {
    derivadosPorProjeto: mapa,
    derivadosGlobais,
    duracaoMs: performance.now() - t0,
    viaWorker: false,
  };
}
