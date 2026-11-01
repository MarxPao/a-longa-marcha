import type { Data, Evento, Instante, UUID } from '../domain';

export interface RespostaHistorica {
  eventoId: UUID;
  data: Data;
  resposta: 'ignorar' | 'mitigar' | 'aproveitar';
  resultado: string;
}

/**
 * Cria uma nova instância imutável de Evento.
 */
export function criarEvento(params: {
  id: UUID;
  tipo: 'positivo' | 'negativo' | 'ambiguo';
  tipoEvento: string;
  titulo: string;
  projetoId: UUID | null;
  data: Data;
  origem: 'detector' | 'manual' | 'conquista';
  agora: Instante;
  resposta?: 'ignorar' | 'mitigar' | 'aproveitar' | null;
  resultado?: string;
  fechamentoId?: UUID | null;
}): Evento {
  return {
    id: params.id,
    criadoEm: params.agora,
    atualizadoEm: params.agora,
    arquivadoEm: null,
    tipo: params.tipo,
    tipoEvento: params.tipoEvento,
    titulo: params.titulo,
    projetoId: params.projetoId,
    data: params.data,
    origem: params.origem,
    resposta: params.resposta ?? null,
    resultado: params.resultado ?? '',
    fechamentoId: params.fechamentoId ?? null,
  };
}

/**
 * Registra a resposta e resultado do usuário para um evento, retornando o evento atualizado.
 */
export function responderEvento(
  evento: Evento,
  resposta: 'ignorar' | 'mitigar' | 'aproveitar',
  resultado: string,
  agora: Instante
): Evento {
  return {
    ...evento,
    resposta,
    resultado,
    atualizadoEm: agora,
  };
}

/**
 * Busca o histórico de decisões anteriores tomadas para eventos do mesmo tipo.
 * Exibe no painel o que o usuário fez em ocasiões anteriores (ignorar, mitigar, aproveitar).
 */
export function buscarHistoricoRespostasPorTipo(
  tipoEvento: string,
  eventos: Evento[]
): RespostaHistorica[] {
  const historico: RespostaHistorica[] = [];

  for (const ev of eventos) {
    if (
      ev.tipoEvento === tipoEvento &&
      ev.arquivadoEm === null &&
      ev.resposta !== null
    ) {
      historico.push({
        eventoId: ev.id,
        data: ev.data,
        resposta: ev.resposta,
        resultado: ev.resultado,
      });
    }
  }

  // Ordena por data decrescente
  historico.sort((a, b) => b.data.localeCompare(a.data));

  return historico;
}
