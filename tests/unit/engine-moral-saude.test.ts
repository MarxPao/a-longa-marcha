import { describe, expect, it } from 'vitest';
import { configPadrao, type Config } from '../../src/domain';
import {
  calcularMoral,
  calcularSaude,
  contarBloqueios,
  contarTarefasVencidas,
  coberturaMateriais,
  mediaQuinzenalHistorica,
  receitaRecorrenteEmDia,
} from '../../src/engine';
import { itemLista, lanc, saldo, tarefa, vinculo } from './fabrica';

const cfg = configPadrao;

describe('Moral (tabela 7.2)', () => {
  it('10 h em 14 dias, meta 10 h/sem, 2 tarefas, média 2 → 0,75', () => {
    const r = calcularMoral(
      { horasJanela: 10, horasAlvoSemana: 10, tarefasConcluidasJanela: 2, mediaQuinzenalTarefas: 2, autonomo: false, receitaEmDia: null },
      cfg
    );
    expect(r.parteHoras).toBe(0.5);
    expect(r.parteTarefas).toBe(1);
    expect(r.moral).toBe(0.75);
  });

  it('40 h em 14 dias, meta 10 h/sem, 0 tarefas, média 3 → 0,50', () => {
    const r = calcularMoral(
      { horasJanela: 40, horasAlvoSemana: 10, tarefasConcluidasJanela: 0, mediaQuinzenalTarefas: 3, autonomo: false, receitaEmDia: null },
      cfg
    );
    expect(r.parteHoras).toBe(1);
    expect(r.parteTarefas).toBe(0);
    expect(r.moral).toBe(0.5);
  });

  it('sem histórico (média 0): usa 1 tarefa por quinzena e nunca divide por zero', () => {
    const r = calcularMoral(
      { horasJanela: 20, horasAlvoSemana: 10, tarefasConcluidasJanela: 1, mediaQuinzenalTarefas: 0, autonomo: false, receitaEmDia: null },
      cfg
    );
    expect(r.mediaUsada).toBe(cfg.moral.tarefasQuinzenaSemHistorico);
    expect(Number.isFinite(r.moral)).toBe(true);
    expect(r.parteTarefas).toBe(1);
  });

  it('meta de horas 0, 1 tarefa, média 2 → parte de horas dispensada; moral = 0,5', () => {
    const r = calcularMoral(
      { horasJanela: 5, horasAlvoSemana: 0, tarefasConcluidasJanela: 1, mediaQuinzenalTarefas: 2, autonomo: false, receitaEmDia: null },
      cfg
    );
    expect(r.parteHoras).toBeNull();
    expect(r.moral).toBe(0.5);
  });

  it('autônomo com 2 de 4 vínculos em dia → parte de horas = 0,5', () => {
    const hoje = '2026-10-31';
    const vins = [1, 2, 3, 4].map((n) => vinculo({ clienteId: `c${n}` }));
    const lancs = [1, 2].map((n) =>
      lanc({ clienteId: `c${n}`, data: '2026-10-15', tipo: 'receita' })
    );
    const frac = receitaRecorrenteEmDia(vins, lancs, hoje, cfg);
    expect(frac).toBe(0.5);
    const r = calcularMoral(
      { horasJanela: 0, horasAlvoSemana: 2, tarefasConcluidasJanela: 0, mediaQuinzenalTarefas: 1, autonomo: true, receitaEmDia: frac },
      cfg
    );
    expect(r.parteHoras).toBe(0.5);
  });

  it('autônomo sem vínculos vale 0 (9.2)', () => {
    expect(receitaRecorrenteEmDia([], [], '2026-10-31', cfg)).toBe(0);
  });

  it('tolerância de ±7 dias: receita de 36 dias atrás ainda está em dia, 38 não', () => {
    const v = [vinculo({ clienteId: 'c1' })];
    expect(receitaRecorrenteEmDia(v, [lanc({ clienteId: 'c1', data: '2026-09-25' })], '2026-10-31', cfg)).toBe(1);
    expect(receitaRecorrenteEmDia(v, [lanc({ clienteId: 'c1', data: '2026-09-22' })], '2026-10-31', cfg)).toBe(0);
  });

  it('média quinzenal histórica: 6 tarefas em 84 dias de histórico (6 quinzenas) = 1', () => {
    expect(mediaQuinzenalHistorica(6, 84, 14)).toBe(1);
    expect(mediaQuinzenalHistorica(0, 84, 14)).toBe(0);
    expect(mediaQuinzenalHistorica(3, 0, 14)).toBe(0);
  });
});

describe('Saúde (tabela 7.2)', () => {
  const base = { tarefasVencidas: 0, nivelFase: 4, fluxoMesCentavos: 0, moral: 1, bloqueiosAtivos: 0 };

  it('3 vencidas, Vila, fluxo negativo, moral 0,3, 1 bloqueio → 20 crítico, com 4 descontos', () => {
    const r = calcularSaude({ tarefasVencidas: 3, nivelFase: 4, fluxoMesCentavos: -1, moral: 0.3, bloqueiosAtivos: 1 }, cfg);
    expect(r.pontuacao).toBe(20);
    expect(r.faixa).toBe('critico');
    expect(r.descontos.map((d) => [d.causa, d.pontos])).toEqual([
      ['tarefas_vencidas', 30],
      ['fluxo_negativo', 20],
      ['moral_baixa', 20],
      ['bloqueios', 10],
    ]);
  });

  it('Faísca, 1 vencida, fluxo negativo → 90 saudável (fluxo não desconta antes de Assentamento)', () => {
    const r = calcularSaude({ ...base, nivelFase: 1, tarefasVencidas: 1, fluxoMesCentavos: -5000 }, cfg);
    expect(r.pontuacao).toBe(90);
    expect(r.faixa).toBe('saudavel');
    expect(r.descontos.some((d) => d.causa === 'fluxo_negativo')).toBe(false);
  });

  it('Assentamento (nível 3) já desconta fluxo negativo; Expedição (2) não', () => {
    expect(calcularSaude({ ...base, nivelFase: 3, fluxoMesCentavos: -1 }, cfg).pontuacao).toBe(80);
    expect(calcularSaude({ ...base, nivelFase: 2, fluxoMesCentavos: -1 }, cfg).pontuacao).toBe(100);
  });

  it('5 vencidas e 3 bloqueios → tetos: 100 − 40 − 20 = 40, atenção', () => {
    const r = calcularSaude({ ...base, tarefasVencidas: 5, bloqueiosAtivos: 3 }, cfg);
    expect(r.pontuacao).toBe(40);
    expect(r.faixa).toBe('atencao');
  });

  it('moral exatamente no limiar (0,4) não desconta; abaixo desconta', () => {
    expect(calcularSaude({ ...base, moral: 0.4 }, cfg).pontuacao).toBe(100);
    expect(calcularSaude({ ...base, moral: 0.39 }, cfg).pontuacao).toBe(80);
  });

  it('fronteiras com pesos customizados: 70 saudável, 69 atenção, 40 atenção, 39 crítico', () => {
    const custom: Config = {
      ...cfg,
      saude: { ...cfg.saude, tarefaVencida: 1, tetoTarefasVencidas: 100 },
    };
    const f = (n: number) => calcularSaude({ ...base, tarefasVencidas: n }, custom);
    expect([f(30).pontuacao, f(30).faixa]).toEqual([70, 'saudavel']);
    expect([f(31).pontuacao, f(31).faixa]).toEqual([69, 'atencao']);
    expect([f(60).pontuacao, f(60).faixa]).toEqual([40, 'atencao']);
    expect([f(61).pontuacao, f(61).faixa]).toEqual([39, 'critico']);
  });

  it('a pontuação nunca fica abaixo de 0', () => {
    const custom: Config = { ...cfg, saude: { ...cfg.saude, tarefaVencida: 500, tetoTarefasVencidas: 5000 } };
    expect(calcularSaude({ ...base, tarefasVencidas: 5 }, custom).pontuacao).toBe(0);
  });
});

describe('Entradas da saúde: vencidas e bloqueios (9.2)', () => {
  it('vencida = prazo anterior a hoje e status ≠ feita (prazo = hoje não vence)', () => {
    const ts = [
      tarefa({ prazo: '2026-10-30' }),
      tarefa({ prazo: '2026-10-31' }),
      tarefa({ prazo: '2026-10-01', status: 'feita' }),
      tarefa({ prazo: null }),
      tarefa({ prazo: '2026-09-01', arquivadoEm: '2026-10-01T00:00:00.000Z' }),
    ];
    expect(contarTarefasVencidas(ts, '2026-10-31')).toBe(1);
  });

  it('bloqueio conta tarefa bloqueada, dependência aberta e item em falta sem cobertura, cada um individualmente', () => {
    const a = tarefa({ id: 'a', status: 'bloqueada' });
    const b = tarefa({ id: 'b' });
    const c = tarefa({ id: 'c', status: 'feita' });
    const d = tarefa({ id: 'd' });
    const todas = new Map([a, b, c, d].map((t) => [t.id, t]));
    const r = contarBloqueios([a, b, d], [{ tarefaId: 'b', bloqueadaPorId: 'd' }, { tarefaId: 'd', bloqueadaPorId: 'c' }], todas, 2);
    expect(r.porTarefa).toBe(2); // a (status) e b (dependência aberta); d depende de c, que está feita
    expect(r.porMaterial).toBe(2);
    expect(r.total).toBe(4);
  });

  it('tarefa feita nunca conta como bloqueada', () => {
    const a = tarefa({ id: 'a', status: 'feita' });
    expect(contarBloqueios([a], [], new Map([['a', a]]), 0).total).toBe(0);
  });
});

describe('Cobertura de materiais', () => {
  it('saldo cobre a lista: coberto; não cobre: falta a diferença', () => {
    const r = coberturaMateriais([itemLista({ id: 'l1', quantidade: 10 })], [saldo({ quantidade: 6 })]);
    expect(r[0]).toMatchObject({ itemDeListaId: 'l1', necessario: 10, disponivel: 6, falta: 4, coberto: false });
    const ok = coberturaMateriais([itemLista({ quantidade: 5 })], [saldo({ quantidade: 5 })]);
    expect(ok[0]?.coberto).toBe(true);
  });

  it('soma saldos de vários armazéns; reservados saem do disponível; dois projetos disputam o mesmo estoque', () => {
    const lista = [
      itemLista({ id: 'l1', projetoId: 'p1', quantidade: 6 }),
      itemLista({ id: 'l2', projetoId: 'p2', quantidade: 6 }),
      itemLista({ id: 'l3', projetoId: 'p3', quantidade: 2, status: 'reservado' }),
    ];
    const r = coberturaMateriais(lista, [saldo({ armazemId: 'a1', quantidade: 6 }), saldo({ armazemId: 'a2', quantidade: 6 })]);
    const por = Object.fromEntries(r.map((x) => [x.itemDeListaId, x]));
    expect(por['l1']?.coberto).toBe(true);
    expect(por['l2']?.coberto).toBe(false); // 12 − 2 reservados = 10; l1 usa 6; sobram 4 < 6
    expect(por['l2']?.falta).toBe(2);
    expect(por['l3']?.coberto).toBe(true);
  });

  it('item pronto/reservado nunca é lacuna', () => {
    const r = coberturaMateriais([itemLista({ status: 'pronto', quantidade: 9 })], []);
    expect(r[0]?.coberto).toBe(true);
  });
});
