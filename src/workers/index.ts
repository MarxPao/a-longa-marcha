import type { Data, DumpBanco, SementeTerreno, UUID } from '../domain';
import { fecharTurnoSemanal, gerarHashSemente, type ResultadoFechamentoTurno } from '../engine';

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

  // Se estiver no navegador com suporte a Worker e URL
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
          // Fallback síncrono
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
