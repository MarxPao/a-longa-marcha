import type { Data, Recorrencia } from '../domain';
import { diaNoMes, mesDe, somarDias, somarMeses } from './tempo';

/**
 * Calcula a próxima data de uma recorrência a partir de uma data de referência.
 * Respeita diaRef em meses curtos (dia 31 em fevereiro cai no último dia).
 * Retorna null se ultrapassar recorrencia.ate.
 */
export function proximaDataRecorrencia(
  dataAtual: Data,
  recorrencia: Recorrencia
): Data | null {
  const intervalo = Math.max(1, recorrencia.intervalo || 1);
  let proxima: Data;

  switch (recorrencia.periodicidade) {
    case 'semanal': {
      proxima = somarDias(dataAtual, 7 * intervalo);
      break;
    }
    case 'mensal': {
      const ymAtual = mesDe(dataAtual);
      const proximoYm = somarMeses(ymAtual, intervalo);
      proxima = diaNoMes(proximoYm, recorrencia.diaRef);
      break;
    }
    case 'trimestral': {
      const ymAtual = mesDe(dataAtual);
      const proximoYm = somarMeses(ymAtual, 3 * intervalo);
      proxima = diaNoMes(proximoYm, recorrencia.diaRef);
      break;
    }
    case 'anual': {
      const ymAtual = mesDe(dataAtual);
      const proximoYm = somarMeses(ymAtual, 12 * intervalo);
      proxima = diaNoMes(proximoYm, recorrencia.diaRef);
      break;
    }
  }

  if (recorrencia.ate && proxima > recorrencia.ate) {
    return null;
  }

  return proxima;
}

/**
 * Retorna todas as datas que uma recorrência materializaria dentro do intervalo [inicio, fim].
 * `dataOrigem` é a data do lançamento/tarefa original que deu origem à recorrência.
 */
export function datasRecorrenciaNoIntervalo(
  recorrencia: Recorrencia,
  dataOrigem: Data,
  intervaloInicio: Data,
  intervaloFim: Data
): Data[] {
  const ocorrencias: Data[] = [];
  let atual: Data | null = dataOrigem;

  // Se a própria data de origem cair no intervalo e for diferente de dataOrigem
  // (normalmente geramos a partir da próxima)
  while (atual !== null) {
    const proxima: Data | null = proximaDataRecorrencia(atual, recorrencia);
    if (!proxima) break;
    if (proxima > intervaloFim) break;
    if (proxima >= intervaloInicio) {
      ocorrencias.push(proxima);
    }
    atual = proxima;
  }

  return ocorrencias;
}
