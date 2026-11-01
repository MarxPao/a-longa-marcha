import type {
  Config,
  Data,
  Instantaneo,
  Lancamento,
  Projeto,
  RegistroDeHoras,
  Tarefa,
  UUID,
  VinculoCliente,
} from '../domain';
import {
  diferencaDias,
  fimDoMes,
  mesDe,
  mesesTerminandoEm,
  ultimoMesCompleto,
} from './tempo';

/** Dados de UM projeto necessários para inferir a fase. */
export interface DadosFase {
  projeto: Projeto;
  tarefas: readonly Tarefa[];
  registrosDeHoras: readonly RegistroDeHoras[];
  lancamentos: readonly Lancamento[];
  vinculos: readonly VinculoCliente[];
  /** Média de horas semanais dos projetos diretos (para Legado); null se desconhecida. */
  mediaHorasSemanaisDiretos: number | null;
}

/** Nível visual da fase: 0 Ruínas, 1 Faísca … 7 Legado. */
export type NivelFase = number;

interface ReceitaCustoMes {
  receita: number;
  custo: number;
}

function agruparMeses(lancamentos: readonly Lancamento[], em: Data): Map<string, ReceitaCustoMes> {
  const mapa = new Map<string, ReceitaCustoMes>();
  for (const l of lancamentos) {
    if (l.arquivadoEm !== null || l.data > em) continue;
    const ym = mesDe(l.data);
    const acc = mapa.get(ym) ?? { receita: 0, custo: 0 };
    if (l.tipo === 'receita') acc.receita += l.valorCentavos;
    else acc.custo += l.valorCentavos;
    mapa.set(ym, acc);
  }
  return mapa;
}

function clientesAtivosEm(vinculos: readonly VinculoCliente[], em: Data): number {
  if (vinculos.length === 0) return 0;
  if (vinculos.length === 1) {
    const v = vinculos[0]!;
    if (v.arquivadoEm === null && v.receitaRecorrenteCentavos > 0 && v.inicio <= em && (v.fim === null || v.fim >= em)) {
      return 1;
    }
    return 0;
  }
  const ids = new Set<UUID>();
  for (const v of vinculos) {
    if (v.arquivadoEm !== null || v.receitaRecorrenteCentavos <= 0) continue;
    if (v.inicio <= em && (v.fim === null || v.fim >= em)) ids.add(v.clienteId);
  }
  return ids.size;
}

/**
 * Fase pela regra, sem histerese (3.4): cada regra é avaliada de cima para baixo e vale a mais alta
 * satisfeita. Considera apenas dados até `em`. Meses "seguidos" são sempre meses civis completos.
 */
export function faseBruta(
  d: DadosFase,
  em: Data,
  config: Config,
  mapaMensalPrecomputado?: Map<string, ReceitaCustoMes>
): NivelFase {
  const m = config.maturidade;

  let horasTotais = 0;
  for (const r of d.registrosDeHoras) if (r.arquivadoEm === null && r.data <= em) horasTotais += r.horas;
  let concluidas = 0;
  for (const t of d.tarefas) {
    if (t.arquivadoEm === null && t.status === 'feita' && (t.concluidaEm === null || t.concluidaEm <= em)) concluidas++;
  }
  const temReceita = d.lancamentos.some(
    (l) => l.arquivadoEm === null && l.tipo === 'receita' && l.valorCentavos > 0 && l.data <= em
  );
  const clientes = clientesAtivosEm(d.vinculos, em);

  // Fast-path para projetos sem clientes nem receita (Faísca ou Expedição)
  if (!temReceita && clientes === 0) {
    if (concluidas >= m.tarefasExpedicao || horasTotais >= m.horasExpedicao) return 2;
    return 1;
  }

  const mensal = mapaMensalPrecomputado ?? agruparMeses(d.lancamentos, em);
  const ultimoMes = ultimoMesCompleto(em);

  // Metrópole (e Legado)
  const meses6 = mesesTerminandoEm(ultimoMes, m.mesesMetropole);
  const margemPositiva = meses6.every((ym) => {
    const v = mensal.get(ym);
    return v !== undefined && v.receita - v.custo > 0;
  });
  const receitaUltimoMes = mensal.get(ultimoMes)?.receita ?? 0;
  const metropole =
    (clientes >= m.clientesMetropole || receitaUltimoMes > m.limiarReceitaMensalMetropoleCentavos) &&
    margemPositiva;
  if (metropole) {
    if (d.projeto.autonomia === 'autonomo' && d.mediaHorasSemanaisDiretos !== null) {
      let horas28 = 0;
      for (const r of d.registrosDeHoras) {
        if (r.arquivadoEm === null && r.data <= em && diferencaDias(em, r.data) <= 27) horas28 += r.horas;
      }
      // horas semanais = horas28 / 4; comparação multiplicada por 4 para não dividir
      if (horas28 < m.legadoPercentualHoras * d.mediaHorasSemanaisDiretos * 4) return 7;
    }
    return 6;
  }

  // Cidade
  const meses3 = mesesTerminandoEm(ultimoMes, m.mesesCidade);
  const cobreCusto = meses3.every((ym) => {
    const v = mensal.get(ym);
    return v !== undefined && v.receita > 0 && v.receita >= v.custo;
  });
  if (clientes >= m.clientesCidade && cobreCusto) return 5;
  if (clientes >= 1) return 4;
  if (temReceita) return 3;
  if (concluidas >= m.tarefasExpedicao || horasTotais >= m.horasExpedicao) return 2;
  return 1;
}

export interface ResultadoHisterese {
  fase: NivelFase;
  mesesAbaixo: number;
  /** Desceu no último mês da série. */
  desceu: boolean;
  /** Subiu no último mês da série (gera evento de conquista). */
  evento: { de: NivelFase; para: NivelFase } | null;
}

/**
 * Histerese (3.4): subir é imediato; descer só depois de `mesesParaDescer` meses seguidos abaixo, e então
 * vai para a fase bruta do último mês. `serie` = fase bruta no fim de cada mês, do mais antigo ao mais novo.
 */
export function aplicarHisterese(
  serie: readonly NivelFase[],
  faseInicial: NivelFase | null,
  config: Config
): ResultadoHisterese {
  let fase: NivelFase = faseInicial ?? serie[0] ?? 1;
  let mesesAbaixo = 0;
  let desceu = false;
  let evento: ResultadoHisterese['evento'] = null;
  serie.forEach((bruta) => {
    desceu = false;
    evento = null;
    if (bruta >= fase) {
      if (bruta > fase) evento = { de: fase, para: bruta };
      fase = bruta;
      mesesAbaixo = 0;
    } else {
      mesesAbaixo++;
      if (mesesAbaixo >= config.maturidade.mesesParaDescer) {
        fase = bruta;
        mesesAbaixo = 0;
        desceu = true;
      }
    }
  });
  return { fase, mesesAbaixo, desceu, evento };
}

export interface ResultadoFase {
  fase: NivelFase;
  faseBrutaHoje: NivelFase;
  desceu: boolean;
  evento: { de: NivelFase; para: NivelFase } | null;
  mesesAbaixo: number;
}

type InstantaneoFase = Pick<Instantaneo, 'semana' | 'porProjeto'>;

const MESES_DE_HISTORICO = 12;

/**
 * Fase efetiva do projeto: reconstrói a fase bruta no fim de cada um dos últimos 12 meses a partir dos
 * dados, ancora na fase registrada nos Instantâneos, aplica a histerese e deixa a subida de hoje valer na hora.
 * Evento de subida e "desceu" são comparados com o último Instantâneo (assim o fechamento é idempotente).
 */
export function calcularFase(
  d: DadosFase,
  hoje: Data,
  instantaneos: readonly InstantaneoFase[],
  config: Config
): ResultadoFase {
  if (d.projeto.arquivadoEm !== null && (d.projeto.notaLicoes ?? '').trim() !== '') {
    return { fase: 0, faseBrutaHoje: 0, desceu: false, evento: null, mesesAbaixo: 0 };
  }
  const id = d.projeto.id;
  const meses = mesesTerminandoEm(ultimoMesCompleto(hoje), MESES_DE_HISTORICO);
  const mapaMensal = agruparMeses(d.lancamentos, hoje);
  const serie = meses.map((ym) => faseBruta(d, fimDoMes(ym), config, mapaMensal));

  const inicioJanela = fimDoMes(meses[0] ?? mesDe(hoje));
  let ancora: NivelFase | null = null;
  let anterior: NivelFase | null = null;

  for (const i of instantaneos) {
    if (i.semana > hoje) break;
    const pInfo = i.porProjeto[id];
    if (pInfo !== undefined) {
      if (i.semana <= inicioJanela) ancora = pInfo.fase;
      anterior = pInfo.fase;
    }
  }

  const hist = aplicarHisterese(serie, ancora, config);
  const faseBrutaHoje = faseBruta(d, hoje, config, mapaMensal);
  const fase = Math.max(hist.fase, faseBrutaHoje);
  return {
    fase,
    faseBrutaHoje,
    mesesAbaixo: hist.mesesAbaixo,
    desceu: anterior !== null ? fase < anterior : hist.desceu,
    evento: anterior !== null && fase > anterior ? { de: anterior, para: fase } : null,
  };
}

/** Arquivar como Ruínas exige uma nota de lições aprendidas (3.4). */
export function validarArquivamentoRuinas(notaLicoes: string | null): { ok: boolean; motivo?: string } {
  if (notaLicoes === null || notaLicoes.trim() === '') {
    return { ok: false, motivo: 'Para encerrar um projeto como ruínas, escreva a lição aprendida.' };
  }
  return { ok: true };
}
