import type { Config, Data, UUID } from '../domain';
import { coberturaMateriais } from './materiais';
import { calcularFase, type ResultadoFase } from './maturidade';
import { calcularMoral, mediaQuinzenalHistorica, receitaRecorrenteEmDia, type ResultadoMoral } from './moral';
import {
  caixa,
  calcularRunway,
  financiamentoCruzado,
  fluxoMensal,
  projecaoSeisMeses,
  rankingRoi,
  roiPorHora,
  type Financiamento,
  type FluxoMensal,
  type LinhaRoi,
  type ProjecaoMes,
  type Runway,
} from './financas';
import { mediaHorasSemanaisDiretos, type IndiceEstado } from './indice';
import { concentracaoClientes, concentracaoFornecedores, type ConcentracaoClientes, type ConcentracaoFornecedores } from './risco';
import { calcularSaude, contarBloqueios, contarTarefasVencidas, type ResultadoBloqueios, type ResultadoSaude } from './saude';
import { diferencaDias, mesDe, somarDias } from './tempo';

export interface DerivadosProjeto {
  projetoId: UUID;
  horasJanela: number;
  horasTotais: number;
  tarefasConcluidasJanela: number;
  moral: ResultadoMoral;
  fase: ResultadoFase;
  saude: ResultadoSaude;
  fluxoMes: FluxoMensal;
  tarefasVencidas: number;
  bloqueios: ResultadoBloqueios;
  roi: { receitaCentavos: number; horas: number; centavosPorHora: number | null };
}

/** Calcula todos os derivados de UM projeto usando só os índices dele (sem varrer o resto). */
export function calcularDerivadosProjeto(
  indice: IndiceEstado,
  projetoId: UUID,
  hoje: Data,
  config: Config
): DerivadosProjeto {
  const projeto = indice.projetos.get(projetoId);
  if (!projeto) throw new Error(`Projeto desconhecido: ${projetoId}`);
  const tarefas = indice.tarefasPorProjeto.get(projetoId) ?? [];
  const registros = indice.registrosPorProjeto.get(projetoId) ?? [];
  const lancamentos = indice.lancamentosPorProjeto.get(projetoId) ?? [];
  const vinculos = indice.vinculosPorProjeto.get(projetoId) ?? [];
  const janela = config.moral.janelaDias;
  const inicioJanela = somarDias(hoje, -(janela - 1));

  // horas e tarefas
  let horasJanela = 0;
  let horasTotais = 0;
  let primeiraAtividade: Data = projeto.criadoEm.slice(0, 10);
  for (const r of registros) {
    if (r.arquivadoEm !== null || r.data > hoje) continue;
    horasTotais += r.horas;
    if (r.data >= inicioJanela) horasJanela += r.horas;
    if (r.data < primeiraAtividade) primeiraAtividade = r.data;
  }
  let concluidasJanela = 0;
  let concluidasAntes = 0;
  for (const t of tarefas) {
    if (t.arquivadoEm !== null || t.status !== 'feita' || t.concluidaEm === null || t.concluidaEm > hoje) continue;
    if (t.concluidaEm >= inicioJanela) concluidasJanela++;
    else concluidasAntes++;
    if (t.concluidaEm < primeiraAtividade) primeiraAtividade = t.concluidaEm;
  }
  for (const l of lancamentos) if (l.arquivadoEm === null && l.data < primeiraAtividade) primeiraAtividade = l.data;
  const diasHistorico = Math.max(0, diferencaDias(inicioJanela, primeiraAtividade));

  // moral
  const autonomo = projeto.autonomia === 'autonomo';
  const moral = calcularMoral(
    {
      horasJanela,
      horasAlvoSemana: projeto.horasAlvoSemana,
      tarefasConcluidasJanela: concluidasJanela,
      mediaQuinzenalTarefas: mediaQuinzenalHistorica(concluidasAntes, diasHistorico, janela),
      autonomo,
      receitaEmDia: autonomo ? receitaRecorrenteEmDia(vinculos, lancamentos, hoje, config) : null,
    },
    config
  );

  // fase
  const fase = calcularFase(
    {
      projeto,
      tarefas,
      registrosDeHoras: registros,
      lancamentos,
      vinculos,
      mediaHorasSemanaisDiretos: mediaHorasSemanaisDiretos(indice, hoje),
    },
    hoje,
    indice.instantaneos,
    config
  );

  // bloqueios (dependência + material)
  const bloqueiosDoProjeto = tarefas.flatMap((t) => indice.bloqueiosPorTarefa.get(t.id) ?? []);
  let semCobertura = 0;
  const vistos = new Set<UUID>();
  for (const l of indice.listaPorProjeto.get(projetoId) ?? []) {
    if (l.arquivadoEm !== null || l.status !== 'falta' || vistos.has(l.itemId)) continue;
    vistos.add(l.itemId);
    const cobertura = coberturaMateriais(indice.listaPorItem.get(l.itemId) ?? [], indice.saldosPorItem.get(l.itemId) ?? []);
    semCobertura += cobertura.filter((c) => c.projetoId === projetoId && !c.coberto).length;
  }
  const bloqueios = contarBloqueios(tarefas, bloqueiosDoProjeto, indice.tarefaPorId, semCobertura);

  // saúde
  const fluxoMes = fluxoMensal(lancamentos, mesDe(hoje), projetoId, hoje);
  const tarefasVencidas = contarTarefasVencidas(tarefas, hoje);
  const saude = calcularSaude(
    {
      tarefasVencidas,
      nivelFase: fase.fase,
      fluxoMesCentavos: fluxoMes.liquidoCentavos,
      moral: moral.moral,
      bloqueiosAtivos: bloqueios.total,
    },
    config
  );

  // ROI (acumulado do projeto até hoje)
  let receitaCentavos = 0;
  for (const l of lancamentos) {
    if (l.arquivadoEm === null && l.tipo === 'receita' && l.data <= hoje) receitaCentavos += l.valorCentavos;
  }
  return {
    projetoId,
    horasJanela,
    horasTotais,
    tarefasConcluidasJanela: concluidasJanela,
    moral,
    fase,
    saude,
    fluxoMes,
    tarefasVencidas,
    bloqueios,
    roi: { receitaCentavos, horas: horasTotais, centavosPorHora: roiPorHora(receitaCentavos, horasTotais) },
  };
}

export interface DerivadosGlobais {
  caixaCentavos: number;
  fluxoMesCentavos: number;
  runway: Runway;
  projecaoSeisMeses: ProjecaoMes[];
  rankingRoi: LinhaRoi[];
  concentracaoClientes: ConcentracaoClientes;
  concentracaoFornecedores: ConcentracaoFornecedores;
  financiamentoCruzado: Financiamento[];
}

export function calcularDerivadosGlobais(indice: IndiceEstado, hoje: Data, _config: Config): DerivadosGlobais {
  const { dump } = indice;
  const lancs = dump.lancamentos.filter((l) => l.data <= hoje);
  const liquidoPorProjeto: Record<UUID, number> = {};
  const entradasRoi = [...indice.projetos.values()]
    .filter((p) => p.arquivadoEm === null)
    .map((p) => {
      let receita = 0;
      let liquido = 0;
      for (const l of indice.lancamentosPorProjeto.get(p.id) ?? []) {
        if (l.arquivadoEm !== null || l.data > hoje) continue;
        if (l.tipo === 'receita') receita += l.valorCentavos;
        liquido += l.tipo === 'receita' ? l.valorCentavos : -l.valorCentavos;
      }
      let horas = 0;
      for (const r of indice.registrosPorProjeto.get(p.id) ?? []) if (r.arquivadoEm === null && r.data <= hoje) horas += r.horas;
      liquidoPorProjeto[p.id] = liquido;
      return { projetoId: p.id, receitaCentavos: receita, horas };
    });
  return {
    caixaCentavos: caixa(dump.lancamentos, hoje),
    fluxoMesCentavos: fluxoMensal(dump.lancamentos, mesDe(hoje), undefined, hoje).liquidoCentavos,
    runway: calcularRunway(dump.lancamentos, hoje),
    projecaoSeisMeses: projecaoSeisMeses(dump.lancamentos, hoje),
    rankingRoi: rankingRoi(entradasRoi),
    concentracaoClientes: concentracaoClientes(lancs),
    concentracaoFornecedores: concentracaoFornecedores(dump.itensDeLista, dump.itens),
    financiamentoCruzado: financiamentoCruzado(dump.ligacoes, dump.tiposLigacao, liquidoPorProjeto),
  };
}

/** Recalcula só os projetos pedidos (ou todos); ignora ids que não estão no índice. */
export function recalcularProjetos(
  indice: IndiceEstado,
  ids: ReadonlySet<UUID> | 'todos',
  hoje: Data,
  config: Config
): Map<UUID, DerivadosProjeto> {
  const alvo = ids === 'todos' ? [...indice.projetos.keys()] : [...ids].filter((id) => indice.projetos.has(id));
  const saida = new Map<UUID, DerivadosProjeto>();
  for (const id of alvo) saida.set(id, calcularDerivadosProjeto(indice, id, hoje, config));
  return saida;
}
