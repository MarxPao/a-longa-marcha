import type {
  Centavos,
  Data,
  DumpBanco,
  Evento,
  Instantaneo,
  Lancamento,
  Tarefa,
  UUID,
} from '../domain';
import { avaliarConquistas, type ConquistaDesbloqueada } from './conquistas';
import { calcularDerivadosProjeto } from './derivados';
import { type AlertaDetector, executarDetectores } from './detectores';
import { criarEvento } from './eventos';
import { construirIndice } from './indice';
import { datasRecorrenciaNoIntervalo, proximaDataRecorrencia } from './recorrencia';
import {
  fimDaSemana,
  inicioDaSemana,
  proximaSemana,
} from './tempo';

export interface PreviaFechamento {
  semana: Data;
  horasPlanejadas: number;
  horasRegistradas: number;
  saldoHoras: number;
  receitaCentavos: Centavos;
  custoCentavos: Centavos;
  tarefasConcluidas: number;
  mudancasFase: Array<{ projetoId: UUID; projetoNome: string; de: number; para: number }>;
  mudancasSaude: Array<{ projetoId: UUID; projetoNome: string; de: number; para: number }>;
  alertas: AlertaDetector[];
  conquistas: ConquistaDesbloqueada[];
}

export interface ResultadoFechamentoTurno {
  dumpAtualizado: DumpBanco;
  fechamentoId: UUID;
  semanaFechada: Data;
  proximaSemana: Data;
  jaFechada: boolean;
  novosLancamentos: Lancamento[];
  novasTarefas: Tarefa[];
  novosEventos: Evento[];
  instantaneoCriado: Instantaneo | null;
  conquistasDesbloqueadas: ConquistaDesbloqueada[];
}

function gerarUUID(): UUID {
  return crypto.randomUUID();
}

function instanteUTC(): string {
  return new Date().toISOString();
}

/**
 * Executa uma prévia (dry-run) do fechamento da semana sem persistir nada.
 */
export function previaFechamentoTurno(
  dump: DumpBanco,
  semana: Data
): PreviaFechamento {
  const indice = construirIndice(dump);
  const config = dump.meta.config;
  const fimSemana = fimDaSemana(semana);

  const projetosAtivos = dump.projetos.filter((p) => p.arquivadoEm === null);
  const horasPlanejadas = projetosAtivos.reduce((s, p) => s + p.horasAlvoSemana, 0);

  let horasRegistradas = 0;
  for (const h of dump.registrosDeHoras) {
    if (h.arquivadoEm === null && h.data >= semana && h.data <= fimSemana) {
      horasRegistradas += h.horas;
    }
  }

  let receitaCentavos = 0;
  let custoCentavos = 0;
  for (const l of dump.lancamentos) {
    if (l.arquivadoEm === null && l.data >= semana && l.data <= fimSemana) {
      if (l.tipo === 'receita') receitaCentavos += l.valorCentavos;
      if (l.tipo === 'custo') custoCentavos += l.valorCentavos;
    }
  }

  let tarefasConcluidas = 0;
  for (const t of dump.tarefas) {
    if (t.arquivadoEm === null && t.status === 'feita' && t.concluidaEm && t.concluidaEm >= semana && t.concluidaEm <= fimSemana) {
      tarefasConcluidas++;
    }
  }

  // Mudanças de fase e saúde em relação ao último instantâneo
  let ultimoInstantaneo: Instantaneo | null = null;
  for (const inst of dump.instantaneos) {
    if (inst.arquivadoEm === null && inst.semana < semana) {
      if (!ultimoInstantaneo || inst.semana > ultimoInstantaneo.semana) {
        ultimoInstantaneo = inst;
      }
    }
  }

  const mudancasFase: PreviaFechamento['mudancasFase'] = [];
  const mudancasSaude: PreviaFechamento['mudancasSaude'] = [];

  for (const p of projetosAtivos) {
    const der = calcularDerivadosProjeto(indice, p.id, semana, config);
    const estadoAnt = ultimoInstantaneo?.porProjeto[p.id];
    if (estadoAnt) {
      if (der.fase.fase !== estadoAnt.fase) {
        mudancasFase.push({
          projetoId: p.id,
          projetoNome: p.nome,
          de: estadoAnt.fase,
          para: der.fase.fase,
        });
      }
      if (Math.abs(der.saude.pontuacao - estadoAnt.saude) >= 1) {
        mudancasSaude.push({
          projetoId: p.id,
          projetoNome: p.nome,
          de: estadoAnt.saude,
          para: der.saude.pontuacao,
        });
      }
    }
  }

  const alertas = executarDetectores(dump, fimSemana, semana, config, indice);
  const conquistas = avaliarConquistas(dump, semana, undefined, { indice });

  return {
    semana,
    horasPlanejadas,
    horasRegistradas,
    saldoHoras: config.horasSemanaisDisponiveis - horasRegistradas,
    receitaCentavos,
    custoCentavos,
    tarefasConcluidas,
    mudancasFase,
    mudancasSaude,
    alertas,
    conquistas,
  };
}

/**
 * Executa o fechamento do turno semanal (Seção 3.1) em 6 etapas puras e idempotentes.
 *
 * Etapas:
 * 1. Materializar recorrências (lançamentos e tarefas).
 * 2. Recalcular todo o estado derivado.
 * 3. Disparar detectores de inteligência (Seção 3.6).
 * 4. Avaliar conquistas (Seção 3.9).
 * 5. Gravar Instantâneo semanal com fechamentoId.
 * 6. Abrir a próxima semana.
 */
export function fecharTurnoSemanal(
  dumpOriginal: DumpBanco,
  semana: Data,
  options?: { fechamentoId?: UUID; agora?: string }
): ResultadoFechamentoTurno {
  const semanaCanonica = inicioDaSemana(semana);
  const fimSemana = fimDaSemana(semanaCanonica);
  const proximaSem = proximaSemana(semanaCanonica);

  // Idempotência: Se já houver um Instantâneo gravado para esta mesma semana, não duplica nada!
  const instantaneoExistente = dumpOriginal.instantaneos.find(
    (i) => i.semana === semanaCanonica && i.arquivadoEm === null
  );

  if (instantaneoExistente) {
    return {
      dumpAtualizado: dumpOriginal,
      fechamentoId: instantaneoExistente.fechamentoId,
      semanaFechada: semanaCanonica,
      proximaSemana: proximaSem,
      jaFechada: true,
      novosLancamentos: [],
      novasTarefas: [],
      novosEventos: [],
      instantaneoCriado: instantaneoExistente,
      conquistasDesbloqueadas: [],
    };
  }

  const fechamentoId = options?.fechamentoId ?? gerarUUID();
  const agora = options?.agora ?? instanteUTC();

  const novosLancamentos: Lancamento[] = [];
  const novasTarefas: Tarefa[] = [];
  const novosEventos: Evento[] = [];

  // --------------------------------------------------------------------------
  // Etapa 1: Materializar Recorrências
  // --------------------------------------------------------------------------
  // a) Lançamentos recorrentes
  const lancamentosRecorrentes = dumpOriginal.lancamentos.filter(
    (l) => l.arquivadoEm === null && l.recorrencia !== null
  );

  const lancamentosRecorrentesCriados = new Set<string>();
  for (const l of dumpOriginal.lancamentos) {
    if (l.origemRecorrenciaId && l.arquivadoEm === null) {
      lancamentosRecorrentesCriados.add(`${l.origemRecorrenciaId}:${l.data}`);
    }
  }

  for (const l of lancamentosRecorrentes) {
    if (!l.recorrencia) continue;
    const datasNoIntervalo = datasRecorrenciaNoIntervalo(
      l.recorrencia,
      l.data,
      semanaCanonica,
      fimSemana
    );

    for (const dt of datasNoIntervalo) {
      const chave = `${l.id}:${dt}`;
      if (!lancamentosRecorrentesCriados.has(chave)) {
        lancamentosRecorrentesCriados.add(chave);
        const novoLanc: Lancamento = {
          id: gerarUUID(),
          criadoEm: agora,
          atualizadoEm: agora,
          arquivadoEm: null,
          data: dt,
          tipo: l.tipo,
          valorCentavos: l.valorCentavos,
          categoriaId: l.categoriaId,
          projetoId: l.projetoId,
          clienteId: l.clienteId,
          recorrencia: null,
          origemRecorrenciaId: l.id,
        };
        novosLancamentos.push(novoLanc);
      }
    }
  }

  // b) Tarefas recorrentes concluídas: gera a próxima tarefa
  const tarefasRecorrentes = dumpOriginal.tarefas.filter(
    (t) => t.arquivadoEm === null && t.recorrencia !== null && t.status === 'feita'
  );

  const tarefasRecorrentesCriadas = new Set<string>();
  for (const t of dumpOriginal.tarefas) {
    if (t.origemRecorrenciaId && t.prazo && t.arquivadoEm === null) {
      tarefasRecorrentesCriadas.add(`${t.origemRecorrenciaId}:${t.prazo}`);
    }
  }

  for (const t of tarefasRecorrentes) {
    if (!t.recorrencia || !t.prazo) continue;
    const proximoPrazo = proximaDataRecorrencia(t.prazo, t.recorrencia);
    if (proximoPrazo) {
      const chave = `${t.id}:${proximoPrazo}`;
      if (!tarefasRecorrentesCriadas.has(chave)) {
        tarefasRecorrentesCriadas.add(chave);
        const novaTarefa: Tarefa = {
          id: gerarUUID(),
          criadoEm: agora,
          atualizadoEm: agora,
          arquivadoEm: null,
          titulo: t.titulo,
          descricao: t.descricao,
          projetoId: t.projetoId,
          frenteId: t.frenteId,
          status: 'pendente',
          prioridade: t.prioridade,
          prazo: proximoPrazo,
          estimativaHoras: t.estimativaHoras,
          concluidaEm: null,
          recorrencia: t.recorrencia,
          origemRecorrenciaId: t.id,
        };
        novasTarefas.push(novaTarefa);
      }
    }
  }

  // Dump com imutabilidade estrutural limpa
  const dump: DumpBanco = {
    ...dumpOriginal,
    meta: {
      ...dumpOriginal.meta,
      conquistas: { ...dumpOriginal.meta.conquistas },
    },
    lancamentos: novosLancamentos.length > 0 ? [...dumpOriginal.lancamentos, ...novosLancamentos] : dumpOriginal.lancamentos,
    tarefas: novasTarefas.length > 0 ? [...dumpOriginal.tarefas, ...novasTarefas] : dumpOriginal.tarefas,
    eventos: [...dumpOriginal.eventos],
    instantaneos: [...dumpOriginal.instantaneos],
  };

  // --------------------------------------------------------------------------
  // Etapa 2: Recalcular Todo o Estado Derivado
  // --------------------------------------------------------------------------
  const indice = construirIndice(dump);
  const config = dump.meta.config;
  const projetosAtivos = dump.projetos.filter((p) => p.arquivadoEm === null);

  // Mapear fases anteriores antes de recalcular para detectar promoções de fase
  const fasesAnteriores: Record<UUID, number> = {};
  let ultimoInstantaneo: Instantaneo | null = null;
  for (const inst of dump.instantaneos) {
    if (inst.arquivadoEm === null && inst.semana < semanaCanonica) {
      if (!ultimoInstantaneo || inst.semana > ultimoInstantaneo.semana) {
        ultimoInstantaneo = inst;
      }
    }
  }

  if (ultimoInstantaneo) {
    for (const [pId, info] of Object.entries(ultimoInstantaneo.porProjeto)) {
      fasesAnteriores[pId] = info.fase;
    }
  }

  const porProjeto: Record<UUID, { saude: number; fase: number; moral: number }> = {};
  for (const p of projetosAtivos) {
    const der = calcularDerivadosProjeto(indice, p.id, semanaCanonica, config);
    porProjeto[p.id] = {
      saude: der.saude.pontuacao,
      fase: der.fase.fase,
      moral: der.moral.moral,
    };
  }

  // --------------------------------------------------------------------------
  // Etapa 3: Disparar Detectores de Inteligência (Seção 3.6)
  // --------------------------------------------------------------------------
  const alertas = executarDetectores(dump, fimSemana, semanaCanonica, config, indice);
  for (const alerta of alertas) {
    const ev = criarEvento({
      id: gerarUUID(),
      tipo: alerta.nivel === 'vermelho' ? 'negativo' : 'ambiguo',
      tipoEvento: alerta.tipoEvento,
      titulo: alerta.titulo,
      projetoId: alerta.projetoId,
      data: fimSemana,
      origem: 'detector',
      agora,
      resultado: `${alerta.motivo} Sugestão: ${alerta.acaoSugerida}.`,
      fechamentoId,
    });
    dump.eventos.push(ev);
    novosEventos.push(ev);
  }

  // --------------------------------------------------------------------------
  // Etapa 4: Avaliar Conquistas (Seção 3.9)
  // --------------------------------------------------------------------------
  const novasConquistas = avaliarConquistas(dump, semanaCanonica, fasesAnteriores, {
    porProjeto,
    indice,
  });
  for (const conq of novasConquistas) {
    dump.meta.conquistas[conq.id] = {
      desbloqueadaEm: semanaCanonica,
      projetoId: conq.projetoId,
    };

    const evConq = criarEvento({
      id: gerarUUID(),
      tipo: 'positivo',
      tipoEvento: `conquista:${conq.id}`,
      titulo: `Conquista Desbloqueada: ${conq.titulo}`,
      projetoId: conq.projetoId,
      data: fimSemana,
      origem: 'conquista',
      agora,
      resultado: conq.descricao,
      fechamentoId,
    });
    dump.eventos.push(evConq);
    novosEventos.push(evConq);
  }

  // --------------------------------------------------------------------------
  // Etapa 5: Gravar o Instantâneo da Semana
  // --------------------------------------------------------------------------
  let receitaSemanaCentavos = 0;
  let custoSemanaCentavos = 0;
  for (const l of dump.lancamentos) {
    if (l.arquivadoEm === null && l.data >= semanaCanonica && l.data <= fimSemana) {
      if (l.tipo === 'receita') receitaSemanaCentavos += l.valorCentavos;
      if (l.tipo === 'custo') custoSemanaCentavos += l.valorCentavos;
    }
  }

  let horasSemana = 0;
  for (const h of dump.registrosDeHoras) {
    if (h.arquivadoEm === null && h.data >= semanaCanonica && h.data <= fimSemana) {
      horasSemana += h.horas;
    }
  }

  const instantaneo: Instantaneo = {
    id: gerarUUID(),
    criadoEm: agora,
    atualizadoEm: agora,
    arquivadoEm: null,
    semana: semanaCanonica,
    receitaCentavos: receitaSemanaCentavos,
    custoCentavos: custoSemanaCentavos,
    horas: horasSemana,
    porProjeto,
    fechamentoId,
  };
  dump.instantaneos.push(instantaneo);

  // --------------------------------------------------------------------------
  // Etapa 6: Abrir a Próxima Semana
  // --------------------------------------------------------------------------
  return {
    dumpAtualizado: dump,
    fechamentoId,
    semanaFechada: semanaCanonica,
    proximaSemana: proximaSem,
    jaFechada: false,
    novosLancamentos,
    novasTarefas,
    novosEventos,
    instantaneoCriado: instantaneo,
    conquistasDesbloqueadas: novasConquistas,
  };
}

/**
 * Desfaz o último fechamento de turno semanal pelo seu `fechamentoId`.
 * Remove todos os instantâneos, eventos, tarefas e lançamentos gerados com esse id,
 * restaurando perfeitamente o estado anterior.
 */
export function desfazerFechamentoTurno(
  dumpOriginal: DumpBanco,
  fechamentoId: UUID
): DumpBanco {
  const instantaneoAlvo = dumpOriginal.instantaneos.find(
    (i) => i.fechamentoId === fechamentoId
  );
  const semanaAlvo = instantaneoAlvo?.semana;

  // Restaurar meta.conquistas removendo as que foram desbloqueadas nesta semana
  const conquistasAtualizadas = { ...dumpOriginal.meta.conquistas };
  if (semanaAlvo) {
    for (const [id, reg] of Object.entries(conquistasAtualizadas)) {
      if (reg.desbloqueadaEm === semanaAlvo) {
        delete conquistasAtualizadas[id];
      }
    }
  }

  return {
    ...dumpOriginal,
    meta: {
      ...dumpOriginal.meta,
      conquistas: conquistasAtualizadas,
    },
    instantaneos: dumpOriginal.instantaneos.filter(
      (i) => i.fechamentoId !== fechamentoId
    ),
    eventos: dumpOriginal.eventos.filter(
      (e) => e.fechamentoId !== fechamentoId
    ),
    lancamentos: dumpOriginal.lancamentos.filter(
      (l) => l.origemRecorrenciaId === null || l.criadoEm !== instantaneoAlvo?.criadoEm
    ),
    tarefas: dumpOriginal.tarefas.filter(
      (t) => t.origemRecorrenciaId === null || t.criadoEm !== instantaneoAlvo?.criadoEm
    ),
  };
}

/**
 * Fecha em sequência todas as semanas pendentes entre a última semana fechada e `semanaAlvo`.
 */
export function fecharSemanasPendentes(
  dumpInicial: DumpBanco,
  semanaAlvo: Data
): DumpBanco {
  const semanaFinalCanonica = inicioDaSemana(semanaAlvo);

  // Descobrir a última semana fechada
  const instantaneosOrdenados = [...dumpInicial.instantaneos]
    .filter((i) => i.arquivadoEm === null)
    .sort((a, b) => a.semana.localeCompare(b.semana));

  let semanaCursor: Data;
  if (instantaneosOrdenados.length > 0) {
    const ultimaFechada = instantaneosOrdenados[instantaneosOrdenados.length - 1]!.semana;
    semanaCursor = proximaSemana(ultimaFechada);
  } else {
    // Se nunca foi fechada nenhuma, usa a semana mais antiga encontrada ou a própria semana alvo
    let menorData = semanaFinalCanonica;
    for (const h of dumpInicial.registrosDeHoras) {
      if (h.data < menorData) menorData = h.data;
    }
    for (const l of dumpInicial.lancamentos) {
      if (l.data < menorData) menorData = l.data;
    }
    semanaCursor = inicioDaSemana(menorData);
  }

  let dumpAtual = dumpInicial;
  while (semanaCursor <= semanaFinalCanonica) {
    const res = fecharTurnoSemanal(dumpAtual, semanaCursor);
    dumpAtual = res.dumpAtualizado;
    semanaCursor = proximaSemana(semanaCursor);
  }

  return dumpAtual;
}
