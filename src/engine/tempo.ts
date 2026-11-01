import type { Data } from '../domain';

/** Utilitários de calendário em UTC, sobre strings AAAA-MM-DD. Nunca lê o relógio. */

const MS_DIA = 86_400_000;

export function paraDiasUTC(d: Data): number {
  const [a, m, dia] = d.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(a, m - 1, dia) / MS_DIA);
}

export function deDiasUTC(n: number): Data {
  const dt = new Date(n * MS_DIA);
  const a = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(dt.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
}

export function somarDias(d: Data, n: number): Data {
  return deDiasUTC(paraDiasUTC(d) + n);
}

/** a − b, em dias. */
export function diferencaDias(a: Data, b: Data): number {
  return paraDiasUTC(a) - paraDiasUTC(b);
}

/** 'AAAA-MM' de uma data. */
export function mesDe(d: Data): string {
  return d.slice(0, 7);
}

export function somarMeses(ym: string, n: number): string {
  const [a, m] = ym.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

/** Meses entre dois 'AAAA-MM' (a − b). */
export function diferencaMeses(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number) as [number, number];
  const [ba, bm] = b.split('-').map(Number) as [number, number];
  return aa * 12 + am - (ba * 12 + bm);
}

export function ultimoDiaDoMes(ym: string): number {
  const [a, m] = ym.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Data no mês `ym` no dia `dia`, limitada ao último dia do mês (dia 31 → 30/28/29). */
export function diaNoMes(ym: string, dia: number): Data {
  const d = Math.min(Math.max(1, dia), ultimoDiaDoMes(ym));
  return `${ym}-${String(d).padStart(2, '0')}`;
}

export function fimDoMes(ym: string): Data {
  return diaNoMes(ym, 31);
}

/** Último mês civil completo em `hoje`: o próprio mês se hoje é o último dia; senão o anterior. */
export function ultimoMesCompleto(hoje: Data): string {
  const ym = mesDe(hoje);
  return hoje === fimDoMes(ym) ? ym : somarMeses(ym, -1);
}

/** `n` meses terminando em `ymFim`, em ordem crescente. */
export function mesesTerminandoEm(ymFim: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(ymFim, i - (n - 1)));
}

/** Dia da semana em UTC (0=domingo, 1=segunda, ..., 6=sábado). */
export function diaDaSemanaUTC(d: Data): number {
  const [a, m, dia] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, dia)).getUTCDay();
}

/** Segunda-feira correspondente à data `d` (identificador canônico da semana). */
export function inicioDaSemana(d: Data): Data {
  const dow = diaDaSemanaUTC(d);
  const diasAtras = (dow + 6) % 7;
  return somarDias(d, -diasAtras);
}

/** Domingo correspondente à semana (segunda-feira + 6 dias). */
export function fimDaSemana(semana: Data): Data {
  return somarDias(semana, 6);
}

export function proximaSemana(semana: Data): Data {
  return somarDias(semana, 7);
}

export function semanaAnterior(semana: Data): Data {
  return somarDias(semana, -7);
}

/** Se uma data cai no intervalo [semana, semana + 6 dias]. */
export function estaNaSemana(d: Data, semana: Data): boolean {
  return d >= semana && d <= fimDaSemana(semana);
}
