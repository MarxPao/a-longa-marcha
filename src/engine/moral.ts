import type { Config, Data, Lancamento, VinculoCliente } from '../domain';
import { diferencaDias } from './tempo';

export interface EntradaMoral {
  /** Horas registradas na janela (padrão: 14 dias). */
  horasJanela: number;
  horasAlvoSemana: number;
  tarefasConcluidasJanela: number;
  /** Média histórica de tarefas concluídas por quinzena (0 = sem histórico). */
  mediaQuinzenalTarefas: number;
  autonomo: boolean;
  /** Fração 0..1 de vínculos em dia (só usada em projetos autônomos). */
  receitaEmDia: number | null;
}

export interface ResultadoMoral {
  moral: number;
  /** null = meta de horas 0, parte dispensada (9.2). */
  parteHoras: number | null;
  parteTarefas: number;
  mediaUsada: number;
}

const limitar01 = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * Moral (3.3 + 9.2): 0,5 × min(1, horas ÷ (2 × meta semanal)) + 0,5 × min(1, tarefas ÷ média quinzenal).
 * Autônomo troca a parte de horas por "receita recorrente em dia". Pesos e janela vêm de Config.
 */
export function calcularMoral(e: EntradaMoral, config: Config): ResultadoMoral {
  const { pesoHoras, pesoTarefas, janelaDias, tarefasQuinzenaSemHistorico } = config.moral;
  const mediaUsada = e.mediaQuinzenalTarefas > 0 ? e.mediaQuinzenalTarefas : tarefasQuinzenaSemHistorico;
  const parteTarefas = limitar01(e.tarefasConcluidasJanela / mediaUsada);

  let parteHoras: number | null;
  if (e.autonomo) {
    parteHoras = limitar01(e.receitaEmDia ?? 0);
  } else if (e.horasAlvoSemana <= 0) {
    parteHoras = null;
  } else {
    const horasEsperadas = (janelaDias / 7) * e.horasAlvoSemana;
    parteHoras = limitar01(e.horasJanela / horasEsperadas);
  }

  const moral =
    parteHoras === null ? parteTarefas : pesoHoras * parteHoras + pesoTarefas * parteTarefas;
  return { moral, parteHoras, parteTarefas, mediaUsada };
}

/** Tarefas concluídas por quinzena antes da janela atual (histórico do projeto). */
export function mediaQuinzenalHistorica(
  tarefasConcluidasAntesDaJanela: number,
  diasDeHistorico: number,
  janelaDias: number
): number {
  if (diasDeHistorico <= 0) return 0;
  return tarefasConcluidasAntesDaJanela / (diasDeHistorico / janelaDias);
}

/**
 * "Receita recorrente em dia" (9.2): vínculos ativos com receita registrada no período esperado
 * (últimos 30 dias + tolerância de ±N dias de Config) ÷ vínculos ativos. Sem vínculos vale 0.
 */
export function receitaRecorrenteEmDia(
  vinculos: readonly VinculoCliente[],
  lancamentos: readonly Lancamento[],
  hoje: Data,
  config: Config
): number {
  const ativos = vinculos.filter(
    (v) => v.arquivadoEm === null && v.inicio <= hoje && (v.fim === null || v.fim >= hoje)
  );
  if (ativos.length === 0) return 0;
  const janela = 30 + config.detectores.toleranciaReceitaEmDiaDias;
  const emDia = ativos.filter((v) =>
    lancamentos.some(
      (l) =>
        l.arquivadoEm === null &&
        l.tipo === 'receita' &&
        l.clienteId === v.clienteId &&
        l.data <= hoje &&
        diferencaDias(hoje, l.data) <= janela
    )
  ).length;
  return emDia / ativos.length;
}
