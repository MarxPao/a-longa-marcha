import type { BloqueioTarefa, Config, Data, Tarefa, UUID } from '../domain';

export type FaixaSaude = 'saudavel' | 'atencao' | 'critico';

export interface DescontoSaude {
  causa: 'tarefas_vencidas' | 'fluxo_negativo' | 'moral_baixa' | 'bloqueios';
  pontos: number;
  /** Frase curta explicando de onde vem o desconto (princípio: todo derivado mostra a origem). */
  detalhe: string;
}

export interface EntradaSaude {
  tarefasVencidas: number;
  /** Nível visual da fase (1 Faísca … 7 Legado; 0 Ruínas). */
  nivelFase: number;
  fluxoMesCentavos: number;
  moral: number;
  bloqueiosAtivos: number;
}

export interface ResultadoSaude {
  pontuacao: number;
  faixa: FaixaSaude;
  descontos: DescontoSaude[];
}

/** Nível mínimo (Assentamento) a partir do qual fluxo negativo desconta. */
const NIVEL_ASSENTAMENTO = 3;

export function faixaDaPontuacao(pontuacao: number, config: Config): FaixaSaude {
  if (pontuacao >= config.saude.faixaSaudavel) return 'saudavel';
  if (pontuacao >= config.saude.faixaAtencao) return 'atencao';
  return 'critico';
}

/** Saúde (3.3): parte de 100 e subtrai por causa; devolve a lista de descontos (um item por causa). */
export function calcularSaude(e: EntradaSaude, config: Config): ResultadoSaude {
  const s = config.saude;
  const descontos: DescontoSaude[] = [];

  if (e.tarefasVencidas > 0) {
    const pontos = Math.min(e.tarefasVencidas * s.tarefaVencida, s.tetoTarefasVencidas);
    descontos.push({
      causa: 'tarefas_vencidas',
      pontos,
      detalhe: `${e.tarefasVencidas} tarefa(s) vencida(s)`,
    });
  }
  if (e.fluxoMesCentavos < 0 && e.nivelFase >= NIVEL_ASSENTAMENTO) {
    descontos.push({ causa: 'fluxo_negativo', pontos: s.fluxoNegativo, detalhe: 'fluxo do mês negativo' });
  }
  if (e.moral < config.moral.limiarBaixa) {
    descontos.push({
      causa: 'moral_baixa',
      pontos: s.moralBaixa,
      detalhe: `moral ${e.moral.toFixed(2)} abaixo de ${config.moral.limiarBaixa}`,
    });
  }
  if (e.bloqueiosAtivos > 0) {
    const pontos = Math.min(e.bloqueiosAtivos * s.bloqueio, s.tetoBloqueios);
    descontos.push({ causa: 'bloqueios', pontos, detalhe: `${e.bloqueiosAtivos} bloqueio(s) ativo(s)` });
  }

  const total = descontos.reduce((acc, d) => acc + d.pontos, 0);
  const pontuacao = Math.max(0, s.base - total);
  return { pontuacao, faixa: faixaDaPontuacao(pontuacao, config), descontos };
}

/** Vencida = prazo anterior a hoje e status ≠ feita (9.2). Ignora arquivadas. */
export function contarTarefasVencidas(tarefas: readonly Tarefa[], hoje: Data): number {
  let n = 0;
  for (const t of tarefas) {
    if (t.arquivadoEm === null && t.status !== 'feita' && t.prazo !== null && t.prazo < hoje) n++;
  }
  return n;
}

export interface ResultadoBloqueios {
  porTarefa: number;
  porMaterial: number;
  total: number;
}

/**
 * Bloqueio ativo (9.2): tarefa com status bloqueada OU dependência aberta (tarefa que a bloqueia ainda
 * não está feita), mais cada item de lista em falta sem cobertura. Cada tarefa conta uma vez.
 */
export function contarBloqueios(
  tarefasDoProjeto: readonly Tarefa[],
  bloqueios: readonly BloqueioTarefa[],
  todasAsTarefas: ReadonlyMap<UUID, Tarefa>,
  itensSemCobertura: number
): ResultadoBloqueios {
  const dependenciasPorTarefa = new Map<UUID, UUID[]>();
  for (const b of bloqueios) {
    const lista = dependenciasPorTarefa.get(b.tarefaId);
    if (lista) lista.push(b.bloqueadaPorId);
    else dependenciasPorTarefa.set(b.tarefaId, [b.bloqueadaPorId]);
  }
  let porTarefa = 0;
  for (const t of tarefasDoProjeto) {
    if (t.arquivadoEm !== null || t.status === 'feita') continue;
    const dependenciaAberta = (dependenciasPorTarefa.get(t.id) ?? []).some((id) => {
      const bloqueadora = todasAsTarefas.get(id);
      return bloqueadora !== undefined && bloqueadora.status !== 'feita';
    });
    if (t.status === 'bloqueada' || dependenciaAberta) porTarefa++;
  }
  return { porTarefa, porMaterial: itensSemCobertura, total: porTarefa + itensSemCobertura };
}
