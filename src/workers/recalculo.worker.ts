import type { Data, DumpBanco, UUID } from '../domain';
import {
  calcularDerivadosGlobais,
  calcularDerivadosProjeto,
  construirIndice,
  type DerivadosGlobais,
  type DerivadosProjeto,
} from '../engine';

export interface MensagemRecalculoRequest {
  tipo: 'RECALCULAR_PESADO';
  requestId: string;
  dump: DumpBanco;
  hoje: Data;
}

export interface MensagemRecalculoResponse {
  tipo: 'RECALCULAR_PESADO_RESPOSTA';
  requestId: string;
  derivadosEntries: Array<[UUID, DerivadosProjeto]>;
  derivadosGlobais: DerivadosGlobais;
  duracaoMs: number;
}

if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('message', (evento: MessageEvent<MensagemRecalculoRequest>) => {
    const dados = evento.data;
    if (dados?.tipo === 'RECALCULAR_PESADO') {
      const t0 = performance.now();
      const indice = construirIndice(dados.dump);
      const mapa = new Map<UUID, DerivadosProjeto>();

      for (const proj of dados.dump.projetos) {
        const d = calcularDerivadosProjeto(
          indice,
          proj.id,
          dados.hoje,
          dados.dump.meta.config
        );
        mapa.set(proj.id, d);
      }

      const derivadosGlobais = calcularDerivadosGlobais(
        indice,
        dados.hoje,
        dados.dump.meta.config
      );
      const duracaoMs = performance.now() - t0;

      const resposta: MensagemRecalculoResponse = {
        tipo: 'RECALCULAR_PESADO_RESPOSTA',
        requestId: dados.requestId,
        derivadosEntries: Array.from(mapa.entries()),
        derivadosGlobais,
        duracaoMs,
      };
      self.postMessage(resposta);
    }
  });
}
