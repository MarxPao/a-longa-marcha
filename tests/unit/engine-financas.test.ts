import { describe, expect, it } from 'vitest';
import { configPadrao } from '../../src/domain';
import {
  caixa,
  calcularRunway,
  concentracaoClientes,
  concentracaoFornecedores,
  custoDeOportunidade,
  financiamentoCruzado,
  fluxoMensal,
  ocorrenciasNoMes,
  projecaoSeisMeses,
  rankingRoi,
  roiPorHora,
  runwayDe,
} from '../../src/engine';
import { base, item, itemLista, lanc, mensais } from './fabrica';

const R = (reais: number) => reais * 100; // reais → centavos (inteiros)

describe('Finanças (tabela 7.2)', () => {
  it('caixa de R$ 30.000 com custo líquido médio de R$ 5.000/mês → runway 6,0 meses', () => {
    const r = runwayDe(R(30000), [R(-5000), R(-5000), R(-5000)]);
    expect(r).toEqual({ tipo: 'meses', meses: 6 });
  });

  it('média dos 3 meses: custos líquidos 3k, 5k, 7k → média 5k', () => {
    expect(runwayDe(R(30000), [R(-3000), R(-5000), R(-7000)])).toEqual({ tipo: 'meses', meses: 6 });
  });

  it('fluxo líquido dos últimos 3 meses positivo → sustentável', () => {
    expect(runwayDe(R(1000), [R(2000), R(500), R(100)])).toEqual({ tipo: 'sustentavel' });
    expect(runwayDe(R(1000), [R(0), R(0), R(0)])).toEqual({ tipo: 'sustentavel' });
  });

  it('média positiva com um mês negativo ainda é sustentável (usa a média)', () => {
    expect(runwayDe(R(1000), [R(-100), R(500), R(500)]).tipo).toBe('sustentavel');
  });

  it('caixa zero ou negativo com queima → 0 mês', () => {
    expect(runwayDe(0, [R(-100), R(-100), R(-100)])).toEqual({ tipo: 'meses', meses: 0 });
    expect(runwayDe(R(-50), [R(-100), R(-100), R(-100)])).toEqual({ tipo: 'meses', meses: 0 });
  });

  it('calcularRunway a partir dos lançamentos: usa os 3 últimos meses completos', () => {
    const ls = [
      lanc({ data: '2026-01-05', tipo: 'receita', valorCentavos: R(60000) }),
      ...mensais(['2026-07', '2026-08', '2026-09'], 0, R(5000)),
    ];
    const r = calcularRunway(ls, '2026-10-15');
    // caixa = 60.000 − 15.000 = 45.000; queima média 5.000 → 9 meses
    expect(r).toEqual({ tipo: 'meses', meses: 9 });
  });

  it('R$ 6.000 de receita em 40 h → R$ 150/h (15.000 centavos); receita com 0 h → sem valor, nunca infinito', () => {
    expect(roiPorHora(R(6000), 40)).toBe(R(150));
    expect(roiPorHora(R(6000), 0)).toBeNull();
    expect(roiPorHora(0, 0)).toBeNull();
  });

  it('ROI por hora é inteiro em centavos (arredonda), mesmo com horas fracionadas', () => {
    expect(Number.isInteger(roiPorHora(10000, 3) as number)).toBe(true);
    expect(roiPorHora(10000, 3)).toBe(3333);
  });

  it('ranking de ROI: maior primeiro, sem valor por último, empate por id', () => {
    const r = rankingRoi([
      { projetoId: 'b', receitaCentavos: R(100), horas: 1 },
      { projetoId: 'a', receitaCentavos: R(100), horas: 1 },
      { projetoId: 'z', receitaCentavos: R(500), horas: 0 },
      { projetoId: 'm', receitaCentavos: R(900), horas: 3 },
    ]);
    expect(r.map((x) => x.projetoId)).toEqual(['m', 'a', 'b', 'z']);
    expect(r[3]?.centavosPorHora).toBeNull();
  });

  it('recorrência mensal no dia 31 cai no último dia dos meses curtos', () => {
    const t = lanc({
      data: '2026-01-31',
      recorrencia: { periodicidade: 'mensal', intervalo: 1, diaRef: 31, ate: null },
    });
    expect(ocorrenciasNoMes(t, '2026-02')).toEqual(['2026-02-28']);
    expect(ocorrenciasNoMes(t, '2026-04')).toEqual(['2026-04-30']);
    expect(ocorrenciasNoMes(t, '2026-03')).toEqual(['2026-03-31']);
    expect(ocorrenciasNoMes(t, '2028-02')).toEqual(['2028-02-29']); // bissexto
    expect(ocorrenciasNoMes(t, '2025-12')).toEqual([]); // antes do início
  });

  it('recorrência respeita intervalo, periodicidade e data final', () => {
    const tri = lanc({ data: '2026-01-15', recorrencia: { periodicidade: 'trimestral', intervalo: 1, diaRef: 15, ate: null } });
    expect(ocorrenciasNoMes(tri, '2026-04')).toEqual(['2026-04-15']);
    expect(ocorrenciasNoMes(tri, '2026-03')).toEqual([]);
    const anual = lanc({ data: '2026-03-10', recorrencia: { periodicidade: 'anual', intervalo: 1, diaRef: 10, ate: null } });
    expect(ocorrenciasNoMes(anual, '2027-03')).toEqual(['2027-03-10']);
    expect(ocorrenciasNoMes(anual, '2027-04')).toEqual([]);
    const bi = lanc({ data: '2026-01-10', recorrencia: { periodicidade: 'mensal', intervalo: 2, diaRef: 10, ate: '2026-05-31' } });
    expect(ocorrenciasNoMes(bi, '2026-03')).toEqual(['2026-03-10']);
    expect(ocorrenciasNoMes(bi, '2026-02')).toEqual([]);
    expect(ocorrenciasNoMes(bi, '2026-07')).toEqual([]); // depois do fim
    const sem = lanc({ data: '2026-10-05', recorrencia: { periodicidade: 'semanal', intervalo: 1, diaRef: 1, ate: null } });
    expect(ocorrenciasNoMes(sem, '2026-10')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    expect(ocorrenciasNoMes(lanc(), '2026-10')).toEqual([]); // sem recorrência
  });

  it('projeção de 6 meses soma só recorrentes (ignora avulsos futuros e ocorrências já materializadas)', () => {
    const rec = lanc({
      data: '2026-01-31',
      valorCentavos: R(1000),
      recorrencia: { periodicidade: 'mensal', intervalo: 1, diaRef: 31, ate: null },
    });
    const custoRec = lanc({
      data: '2026-01-05',
      tipo: 'custo',
      valorCentavos: R(400),
      recorrencia: { periodicidade: 'mensal', intervalo: 1, diaRef: 5, ate: '2026-12-31' },
    });
    const avulsoFuturo = lanc({ data: '2026-12-01', valorCentavos: R(99999) });
    const materializada = lanc({ data: '2026-10-31', valorCentavos: R(1000), origemRecorrenciaId: rec.id });
    const p = projecaoSeisMeses([rec, custoRec, avulsoFuturo, materializada], '2026-10-31');
    expect(p.map((m) => m.mes)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
    expect(p[0]).toMatchObject({ receitaCentavos: R(1000), custoCentavos: R(400), liquidoCentavos: R(600) });
    expect(p[1]?.custoCentavos).toBe(R(400));
    expect(p[2]?.custoCentavos).toBe(0); // custo recorrente terminou em 2026-12
    expect(p[2]?.receitaCentavos).toBe(R(1000));
    expect(p.every((m) => Number.isInteger(m.liquidoCentavos))).toBe(true);
  });

  it('caixa soma os lançamentos até hoje (não conta futuros nem arquivados)', () => {
    const ls = [
      lanc({ data: '2026-10-01', valorCentavos: R(100) }),
      lanc({ data: '2026-10-02', tipo: 'custo', valorCentavos: R(30) }),
      lanc({ data: '2026-11-01', valorCentavos: R(999) }),
      lanc({ data: '2026-10-03', valorCentavos: R(500), arquivadoEm: '2026-10-04T00:00:00.000Z' }),
    ];
    expect(caixa(ls, '2026-10-31')).toBe(R(70));
  });

  it('fluxo mensal por projeto e consolidado', () => {
    const ls = [
      lanc({ data: '2026-10-01', valorCentavos: 1000, projetoId: 'a' }),
      lanc({ data: '2026-10-02', tipo: 'custo', valorCentavos: 400, projetoId: 'a' }),
      lanc({ data: '2026-10-03', valorCentavos: 700, projetoId: 'b' }),
      lanc({ data: '2026-09-30', valorCentavos: 5000, projetoId: 'a' }),
    ];
    expect(fluxoMensal(ls, '2026-10', 'a')).toEqual({ receitaCentavos: 1000, custoCentavos: 400, liquidoCentavos: 600 });
    expect(fluxoMensal(ls, '2026-10')).toEqual({ receitaCentavos: 1700, custoCentavos: 400, liquidoCentavos: 1300 });
  });
});

describe('Financiamento cruzado, custo de oportunidade e risco', () => {
  const tipos = [{ ...base('t-fin'), nome: 'financia', cor: '#B8923A', direcional: true }, { ...base('t-dep'), nome: 'depende de', cor: '#8E1F1A', direcional: true }];
  const lig = (id: string, o: string, d: string, tipoId = 't-fin') => ({ ...base(id), origemId: o, destinoId: d, tipoId, forca: 2 as const });

  it('projeto lucrativo cobre o prejuízo de outro, limitado pelo menor valor', () => {
    const r = financiamentoCruzado([lig('l1', 'a', 'b')], tipos, { a: R(1000), b: R(-400) });
    expect(r).toEqual([{ ligacaoId: 'l1', origemId: 'a', destinoId: 'b', coberturaCentavos: R(400), prejuizoDestinoCentavos: R(400) }]);
    const parcial = financiamentoCruzado([lig('l1', 'a', 'b')], tipos, { a: R(100), b: R(-400) });
    expect(parcial[0]?.coberturaCentavos).toBe(R(100));
  });

  it('origem sem lucro ou destino sem prejuízo não cobre nada; outros tipos de ligação são ignorados', () => {
    expect(financiamentoCruzado([lig('l1', 'a', 'b')], tipos, { a: R(-10), b: R(-400) })[0]?.coberturaCentavos).toBe(0);
    expect(financiamentoCruzado([lig('l1', 'a', 'b')], tipos, { a: R(100), b: R(50) })[0]?.coberturaCentavos).toBe(0);
    expect(financiamentoCruzado([lig('l2', 'a', 'b', 't-dep')], tipos, { a: R(100), b: R(-50) })).toEqual([]);
  });

  it('a mesma origem não financia além do próprio lucro (divide em ordem de id)', () => {
    const r = financiamentoCruzado([lig('l1', 'a', 'b'), lig('l2', 'a', 'c')], tipos, { a: R(500), b: R(-400), c: R(-400) });
    expect(r.map((x) => x.coberturaCentavos)).toEqual([R(400), R(100)]);
  });

  it('custo de oportunidade: mover horas de A (R$ 100/h) para B (R$ 150/h) ganha R$ 50/h', () => {
    const r = custoDeOportunidade({ roiOrigemCentavosPorHora: R(100), roiDestinoCentavosPorHora: R(150), horas: 10 });
    expect(r).toEqual({ diferencaCentavosPorHora: R(50), diferencaTotalCentavos: R(500) });
    expect(custoDeOportunidade({ roiOrigemCentavosPorHora: R(150), roiDestinoCentavosPorHora: R(100), horas: 2 })?.diferencaTotalCentavos).toBe(R(-100));
  });

  it('custo de oportunidade sem histórico (ROI nulo) → sem valor', () => {
    expect(custoDeOportunidade({ roiOrigemCentavosPorHora: null, roiDestinoCentavosPorHora: R(150), horas: 10 })).toBeNull();
    expect(custoDeOportunidade({ roiOrigemCentavosPorHora: R(1), roiDestinoCentavosPorHora: null, horas: 10 })).toBeNull();
  });

  it('concentração por cliente: parcela da receita total, ordenada; receita sem cliente fica em "semCliente"', () => {
    const ls = [
      lanc({ clienteId: 'c1', valorCentavos: 4100 }),
      lanc({ clienteId: 'c2', valorCentavos: 5900 }),
      lanc({ clienteId: null, valorCentavos: 1000 }),
      lanc({ clienteId: 'c1', tipo: 'custo', valorCentavos: 9999 }),
    ];
    const r = concentracaoClientes(ls);
    expect(r.receitaTotalCentavos).toBe(11000);
    expect(r.clientes.map((c) => c.clienteId)).toEqual(['c2', 'c1']);
    expect(r.clientes[0]?.parte).toBeCloseTo(5900 / 11000, 10);
    expect(r.semClienteCentavos).toBe(1000);
  });

  it('concentração sem receita: lista vazia e sem divisão por zero', () => {
    const r = concentracaoClientes([]);
    expect(r).toEqual({ receitaTotalCentavos: 0, semClienteCentavos: 0, clientes: [] });
  });

  it('concentração por fornecedor: valor de materiais e nº de projetos que dependem', () => {
    const itens = [item({ id: 'i1', fornecedorId: 'f1', custoUnitarioCentavos: 100 }), item({ id: 'i2', fornecedorId: 'f1', custoUnitarioCentavos: 50 }), item({ id: 'i3', fornecedorId: 'f2', custoUnitarioCentavos: 100 })];
    const listas = [
      itemLista({ projetoId: 'p1', itemId: 'i1', quantidade: 2 }),
      itemLista({ projetoId: 'p2', itemId: 'i2', quantidade: 2 }),
      itemLista({ projetoId: 'p2', itemId: 'i3', quantidade: 1 }),
    ];
    const r = concentracaoFornecedores(listas, itens);
    expect(r.valorTotalCentavos).toBe(400);
    const f1 = r.fornecedores.find((f) => f.fornecedorId === 'f1');
    expect(f1).toMatchObject({ valorCentavos: 300, projetos: 2 });
    expect(f1?.parte).toBeCloseTo(0.75, 10);
    expect(r.fornecedores[0]?.fornecedorId).toBe('f1');
  });

  it('config padrão ainda é a do Anexo A (sementeTerreno vazia)', () => {
    expect(configPadrao.mapa.sementeTerreno).toBe('');
  });
});
