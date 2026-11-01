import type { Data, DumpBanco, UUID } from '../domain';
import { fecharTurnoSemanal, type ResultadoFechamentoTurno } from '../engine';

export interface MensagemFechamentoRequest {
  tipo: 'FECHAR_TURNO';
  requestId: string;
  dump: DumpBanco;
  semana: Data;
  options?: { fechamentoId?: UUID; agora?: string };
}

export interface MensagemFechamentoResponse {
  tipo: 'FECHAR_TURNO_RESPOSTA';
  requestId: string;
  resultado: ResultadoFechamentoTurno;
  duracaoMs: number;
}

// Inicia escuta se estiver rodando em contexto de Web Worker
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('message', (evento: MessageEvent<MensagemFechamentoRequest>) => {
    const dados = evento.data;
    if (dados?.tipo === 'FECHAR_TURNO') {
      const t0 = performance.now();
      const resultado = fecharTurnoSemanal(dados.dump, dados.semana, dados.options);
      const duracaoMs = performance.now() - t0;
      const resposta: MensagemFechamentoResponse = {
        tipo: 'FECHAR_TURNO_RESPOSTA',
        requestId: dados.requestId,
        resultado,
        duracaoMs,
      };
      self.postMessage(resposta);
    }
  });
}
