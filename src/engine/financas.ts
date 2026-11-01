import type { Data, Lancamento, Ligacao, TipoLigacao, UUID } from '../domain';
import {
  deDiasUTC,
  diaNoMes,
  diferencaMeses,
  fimDoMes,
  mesDe,
  mesesTerminandoEm,
  paraDiasUTC,
  somarMeses,
  ultimoMesCompleto,
} from './tempo';

export interface FluxoMensal {
  receitaCentavos: number;
  custoCentavos: number;
  liquidoCentavos: number;
}

const ativo = (l: Lancamento): boolean => l.arquivadoEm === null;

/** Saldo acumulado dos lançamentos até hoje (futuros e arquivados não contam). */
export function caixa(lancamentos: readonly Lancamento[], hoje: Data): number {
  let total = 0;
  for (const l of lancamentos) {
    if (!ativo(l) || l.data > hoje) continue;
    total += l.tipo === 'receita' ? l.valorCentavos : -l.valorCentavos;
  }
  return total;
}

/** Fluxo de um mês civil, consolidado ou de um projeto. `ate` limita aos lançamentos já ocorridos. */
export function fluxoMensal(
  lancamentos: readonly Lancamento[],
  ym: string,
  projetoId?: UUID,
  ate?: Data
): FluxoMensal {
  let receitaCentavos = 0;
  let custoCentavos = 0;
  for (const l of lancamentos) {
    if (!ativo(l) || mesDe(l.data) !== ym) continue;
    if (projetoId !== undefined && l.projetoId !== projetoId) continue;
    if (ate !== undefined && l.data > ate) continue;
    if (l.tipo === 'receita') receitaCentavos += l.valorCentavos;
    else custoCentavos += l.valorCentavos;
  }
  return { receitaCentavos, custoCentavos, liquidoCentavos: receitaCentavos - custoCentavos };
}

const MESES_POR_PERIODO = { mensal: 1, trimestral: 3, anual: 12 } as const;

/**
 * Datas em que a recorrência do lançamento cai no mês `ym` (a própria data do lançamento é a 1ª ocorrência).
 * Dia 31 cai no último dia dos meses curtos (9.2).
 */
export function ocorrenciasNoMes(l: Lancamento, ym: string): Data[] {
  const rec = l.recorrencia;
  if (rec === null) return [];
  const limite = rec.ate;
  if (rec.periodicidade === 'semanal') {
    const passo = 7 * rec.intervalo;
    const inicio = paraDiasUTC(l.data);
    const primeiroDoMes = paraDiasUTC(`${ym}-01`);
    const ultimoDoMes = paraDiasUTC(fimDoMes(ym));
    const k0 = Math.max(0, Math.ceil((primeiroDoMes - inicio) / passo));
    const saida: Data[] = [];
    for (let d = inicio + k0 * passo; d <= ultimoDoMes; d += passo) {
      const data = deDiasUTC(d);
      if (limite !== null && data > limite) break;
      if (mesDe(data) === ym) saida.push(data);
    }
    return saida;
  }
  const passoMeses = rec.intervalo * MESES_POR_PERIODO[rec.periodicidade];
  const diff = diferencaMeses(ym, mesDe(l.data));
  if (diff < 0 || diff % passoMeses !== 0) return [];
  const data = diff === 0 ? l.data : diaNoMes(ym, rec.diaRef);
  if (limite !== null && data > limite) return [];
  return [data];
}

export interface ProjecaoMes extends FluxoMensal {
  mes: string;
}

/** Projeção dos próximos 6 meses só com lançamentos recorrentes: não adivinha vendas (3.5). */
export function projecaoSeisMeses(lancamentos: readonly Lancamento[], hoje: Data): ProjecaoMes[] {
  const modelos = lancamentos.filter((l) => ativo(l) && l.recorrencia !== null && l.origemRecorrenciaId === null);
  const primeiro = somarMeses(mesDe(hoje), 1);
  return Array.from({ length: 6 }, (_, i) => {
    const mes = somarMeses(primeiro, i);
    let receitaCentavos = 0;
    let custoCentavos = 0;
    for (const m of modelos) {
      const n = ocorrenciasNoMes(m, mes).filter((d) => d > hoje).length;
      if (m.tipo === 'receita') receitaCentavos += n * m.valorCentavos;
      else custoCentavos += n * m.valorCentavos;
    }
    return { mes, receitaCentavos, custoCentavos, liquidoCentavos: receitaCentavos - custoCentavos };
  });
}

export type Runway = { tipo: 'sustentavel' } | { tipo: 'meses'; meses: number };

/** Runway (3.5): caixa ÷ custo líquido médio mensal; fluxo médio não negativo → sustentável. */
export function runwayDe(caixaCentavos: number, liquidosMensais: readonly number[]): Runway {
  const soma = liquidosMensais.reduce((a, b) => a + b, 0);
  if (liquidosMensais.length === 0 || soma >= 0) return { tipo: 'sustentavel' };
  if (caixaCentavos <= 0) return { tipo: 'meses', meses: 0 };
  // caixa ÷ (queima total ÷ n) = caixa × n ÷ queima total — evita dividir a média antes
  return { tipo: 'meses', meses: (caixaCentavos * liquidosMensais.length) / -soma };
}

/** Runway a partir dos lançamentos: usa os 3 últimos meses civis completos. */
export function calcularRunway(lancamentos: readonly Lancamento[], hoje: Data): Runway {
  const meses = mesesTerminandoEm(ultimoMesCompleto(hoje), 3);
  const liquidos = meses.map((ym) => fluxoMensal(lancamentos, ym).liquidoCentavos);
  return runwayDe(caixa(lancamentos, hoje), liquidos);
}

/** ROI por hora em centavos inteiros; null quando não há horas (nunca infinito). */
export function roiPorHora(receitaCentavos: number, horas: number): number | null {
  if (!(horas > 0)) return null;
  return Math.round(receitaCentavos / horas);
}

export interface EntradaRoi {
  projetoId: UUID;
  receitaCentavos: number;
  horas: number;
}
export interface LinhaRoi extends EntradaRoi {
  centavosPorHora: number | null;
}

/** Ranking de ROI: maior primeiro, sem valor por último, empate por id. */
export function rankingRoi(entradas: readonly EntradaRoi[]): LinhaRoi[] {
  return entradas
    .map((e) => ({ ...e, centavosPorHora: roiPorHora(e.receitaCentavos, e.horas) }))
    .sort((a, b) => {
      if (a.centavosPorHora === null && b.centavosPorHora !== null) return 1;
      if (b.centavosPorHora === null && a.centavosPorHora !== null) return -1;
      const diff = (b.centavosPorHora ?? 0) - (a.centavosPorHora ?? 0);
      if (diff !== 0) return diff;
      return a.projetoId < b.projetoId ? -1 : a.projetoId > b.projetoId ? 1 : 0;
    });
}

export interface Financiamento {
  ligacaoId: UUID;
  origemId: UUID;
  destinoId: UUID;
  coberturaCentavos: number;
  prejuizoDestinoCentavos: number;
}

/**
 * Financiamento cruzado (3.5): para cada ligação do tipo "financia", quanto do lucro da origem cobre o
 * prejuízo do destino. Uma origem não financia além do próprio lucro (divide em ordem de id).
 */
export function financiamentoCruzado(
  ligacoes: readonly Ligacao[],
  tipos: readonly TipoLigacao[],
  liquidoPorProjeto: Readonly<Record<UUID, number>>
): Financiamento[] {
  const idsFinancia = new Set(
    tipos.filter((t) => t.arquivadoEm === null && t.nome.trim().toLowerCase() === 'financia').map((t) => t.id)
  );
  const restante = new Map<UUID, number>();
  return ligacoes
    .filter((l) => l.arquivadoEm === null && idsFinancia.has(l.tipoId))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((l) => {
      if (!restante.has(l.origemId)) restante.set(l.origemId, Math.max(0, liquidoPorProjeto[l.origemId] ?? 0));
      const prejuizoDestinoCentavos = Math.max(0, -(liquidoPorProjeto[l.destinoId] ?? 0));
      const coberturaCentavos = Math.min(restante.get(l.origemId) ?? 0, prejuizoDestinoCentavos);
      restante.set(l.origemId, (restante.get(l.origemId) ?? 0) - coberturaCentavos);
      return { ligacaoId: l.id, origemId: l.origemId, destinoId: l.destinoId, coberturaCentavos, prejuizoDestinoCentavos };
    });
}

/** Custo de oportunidade (3.5): diferença estimada ao mover horas, pelo ROI histórico; null sem histórico. */
export function custoDeOportunidade(e: {
  roiOrigemCentavosPorHora: number | null;
  roiDestinoCentavosPorHora: number | null;
  horas: number;
}): { diferencaCentavosPorHora: number; diferencaTotalCentavos: number } | null {
  if (e.roiOrigemCentavosPorHora === null || e.roiDestinoCentavosPorHora === null) return null;
  const diferencaCentavosPorHora = e.roiDestinoCentavosPorHora - e.roiOrigemCentavosPorHora;
  return { diferencaCentavosPorHora, diferencaTotalCentavos: Math.round(e.horas * diferencaCentavosPorHora) };
}
