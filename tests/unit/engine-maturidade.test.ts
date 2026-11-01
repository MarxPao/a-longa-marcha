import { describe, expect, it } from 'vitest';
import { configPadrao } from '../../src/domain';
import {
  aplicarHisterese,
  calcularFase,
  faseBruta,
  validarArquivamentoRuinas,
  type DadosFase,
} from '../../src/engine';
import { horas, lanc, mensais, projeto, tarefa, vinculo } from './fabrica';

const cfg = configPadrao;
const HOJE = '2026-10-31'; // último dia do mês: outubro conta como mês completo
const ULT6 = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const ULT3 = ['2026-08', '2026-09', '2026-10'];

function dados(o: Partial<DadosFase> = {}): DadosFase {
  return {
    projeto: projeto({ id: 'p1' }),
    tarefas: [],
    registrosDeHoras: [],
    lancamentos: [],
    vinculos: [],
    mediaHorasSemanaisDiretos: null,
    ...o,
  };
}
const clientes = (n: number) =>
  Array.from({ length: n }, (_, i) => vinculo({ clienteId: `c${i + 1}` }));

describe('Maturidade — fase bruta (tabela 7.2)', () => {
  it('4,9 h e nenhuma tarefa feita → Faísca; 5 h → Expedição', () => {
    expect(faseBruta(dados({ registrosDeHoras: [horas({ horas: 4.9 })] }), HOJE, cfg)).toBe(1);
    expect(faseBruta(dados({ registrosDeHoras: [horas({ horas: 5 })] }), HOJE, cfg)).toBe(2);
  });

  it('1 tarefa concluída → Expedição', () => {
    expect(faseBruta(dados({ tarefas: [tarefa({ status: 'feita', concluidaEm: '2026-10-01' })] }), HOJE, cfg)).toBe(2);
  });

  it('projeto recém-criado, sem nada → Faísca', () => {
    expect(faseBruta(dados(), HOJE, cfg)).toBe(1);
  });

  it('primeira receita sem cliente recorrente → Assentamento', () => {
    expect(faseBruta(dados({ lancamentos: [lanc({ valorCentavos: 5000 })] }), HOJE, cfg)).toBe(3);
  });

  it('lançamento de receita futuro ou de valor 0 não conta como primeira receita', () => {
    expect(faseBruta(dados({ lancamentos: [lanc({ data: '2026-12-01' }), lanc({ valorCentavos: 0 })] }), HOJE, cfg)).toBe(1);
  });

  it('1 cliente com receita recorrente ativa → Vila; vínculo encerrado não conta', () => {
    const l = [lanc()];
    expect(faseBruta(dados({ lancamentos: l, vinculos: clientes(1) }), HOJE, cfg)).toBe(4);
    expect(faseBruta(dados({ lancamentos: l, vinculos: [vinculo({ fim: '2026-09-30' })] }), HOJE, cfg)).toBe(3);
  });

  it('3 clientes e receita cobrindo custo por 3 meses → Cidade; só por 2 meses → Vila', () => {
    const v = clientes(3);
    expect(faseBruta(dados({ vinculos: v, lancamentos: mensais(ULT3, 200000, 100000) }), HOJE, cfg)).toBe(5);
    expect(faseBruta(dados({ vinculos: v, lancamentos: mensais(ULT3.slice(1), 200000, 100000) }), HOJE, cfg)).toBe(4);
  });

  it('receita exatamente igual ao custo cobre; um centavo a menos não', () => {
    const v = clientes(3);
    expect(faseBruta(dados({ vinculos: v, lancamentos: mensais(ULT3, 100000, 100000) }), HOJE, cfg)).toBe(5);
    expect(faseBruta(dados({ vinculos: v, lancamentos: mensais(ULT3, 99999, 100000) }), HOJE, cfg)).toBe(4);
  });

  it('mês corrente incompleto não entra na regra dos meses seguidos', () => {
    const v = clientes(3);
    const l = mensais(['2026-07', '2026-08', '2026-09'], 200000, 100000);
    expect(faseBruta(dados({ vinculos: v, lancamentos: l }), '2026-10-15', cfg)).toBe(5);
  });

  it('Metrópole: 10 clientes com margem positiva por 6 meses', () => {
    expect(faseBruta(dados({ vinculos: clientes(10), lancamentos: mensais(ULT6, 200000, 100000) }), HOJE, cfg)).toBe(6);
    expect(faseBruta(dados({ vinculos: clientes(10), lancamentos: mensais(ULT6.slice(1), 200000, 100000) }), HOJE, cfg)).toBe(5);
  });

  it('Metrópole: receita mensal acima do limiar com margem positiva por 6 meses', () => {
    const limiar = cfg.maturidade.limiarReceitaMensalMetropoleCentavos;
    const l = mensais(ULT6, limiar + 1, 100000);
    expect(faseBruta(dados({ vinculos: clientes(3), lancamentos: l }), HOJE, cfg)).toBe(6);
    const igual = mensais(ULT6, limiar, 100000);
    expect(faseBruta(dados({ vinculos: clientes(3), lancamentos: igual }), HOJE, cfg)).toBe(5);
  });

  it('Legado: Metrópole autônoma com horas semanais < 10% da média dos diretos', () => {
    const base = {
      projeto: projeto({ id: 'p1', autonomia: 'autonomo' as const }),
      vinculos: clientes(10),
      lancamentos: mensais(ULT6, 200000, 100000),
    };
    // 0 h nas últimas 4 semanas; média dos diretos = 10 h/sem → Legado
    expect(faseBruta(dados({ ...base, mediaHorasSemanaisDiretos: 10 }), HOJE, cfg)).toBe(7);
    // 4 h em 4 semanas = 1 h/sem = exatamente 10% → não é "abaixo": continua Metrópole
    const regs = [horas({ data: '2026-10-20', horas: 4 })];
    expect(faseBruta(dados({ ...base, registrosDeHoras: regs, mediaHorasSemanaisDiretos: 10 }), HOJE, cfg)).toBe(6);
    // projeto direto nunca é Legado
    expect(faseBruta(dados({ ...base, projeto: projeto({ id: 'p1' }), mediaHorasSemanaisDiretos: 10 }), HOJE, cfg)).toBe(6);
    // sem média de diretos conhecida não vira Legado
    expect(faseBruta(dados({ ...base, mediaHorasSemanaisDiretos: null }), HOJE, cfg)).toBe(6);
  });
});

describe('Maturidade — histerese (tabela 7.2)', () => {
  it('Cidade abaixo da regra por 1 mês → permanece Cidade', () => {
    const r = aplicarHisterese([5, 4], 5, cfg);
    expect(r.fase).toBe(5);
    expect(r.mesesAbaixo).toBe(1);
  });

  it('Cidade abaixo da regra por 2 meses seguidos → desce para a mais alta fase satisfeita', () => {
    const r = aplicarHisterese([4, 4], 5, cfg);
    expect(r.fase).toBe(4);
    expect(r.mesesAbaixo).toBe(0);
    expect(r.desceu).toBe(true);
  });

  it('mês abaixo, mês cumprindo, mês abaixo → contador zera; permanece na fase', () => {
    const r = aplicarHisterese([4, 5, 4], 5, cfg);
    expect(r.fase).toBe(5);
    expect(r.mesesAbaixo).toBe(1);
  });

  it('subir é imediato, no mesmo fechamento, com evento de conquista', () => {
    const r = aplicarHisterese([5], 4, cfg);
    expect(r.fase).toBe(5);
    expect(r.evento).toEqual({ de: 4, para: 5 });
  });

  it('descida usa a fase bruta do último mês (pode cair mais de um nível)', () => {
    expect(aplicarHisterese([3, 2], 5, cfg).fase).toBe(2);
  });

  it('mesesParaDescer é configurável', () => {
    const c = { ...cfg, maturidade: { ...cfg.maturidade, mesesParaDescer: 3 } };
    expect(aplicarHisterese([4, 4], 5, c).fase).toBe(5);
    expect(aplicarHisterese([4, 4, 4], 5, c).fase).toBe(4);
  });

  it('sem fase inicial, parte do primeiro mês; série vazia mantém a fase inicial', () => {
    expect(aplicarHisterese([3, 3], null, cfg).fase).toBe(3);
    expect(aplicarHisterese([], 4, cfg).fase).toBe(4);
    expect(aplicarHisterese([], null, cfg).fase).toBe(1);
  });
});

describe('Maturidade — calcularFase com Instantâneos', () => {
  const instantaneo = (semana: string, fase: number) => ({
    semana,
    porProjeto: { p1: { saude: 80, fase, moral: 0.8 } },
  });

  it('Cidade até agosto; setembro e outubro abaixo da regra → desce para Vila', () => {
    const d = dados({ vinculos: clientes(3), lancamentos: mensais(['2026-06', '2026-07', '2026-08'], 200000, 100000) });
    const r = calcularFase(d, HOJE, [instantaneo('2026-08-31', 5)], cfg);
    expect(r.fase).toBe(4);
    expect(r.desceu).toBe(true);
  });

  it('Cidade até setembro; só outubro abaixo da regra (1 mês) → permanece Cidade', () => {
    const d = dados({ vinculos: clientes(3), lancamentos: mensais(['2026-06', '2026-07', '2026-08', '2026-09'], 200000, 100000) });
    const r = calcularFase(d, HOJE, [instantaneo('2026-10-26', 5)], cfg);
    expect(r.fase).toBe(5);
    expect(r.desceu).toBe(false);
  });

  it('sem Instantâneos, dados que sustentam Cidade hoje → Cidade, sem evento de descida', () => {
    const d = dados({ vinculos: clientes(3), lancamentos: mensais(ULT3, 200000, 100000) });
    const r = calcularFase(d, HOJE, [], cfg);
    expect(r.fase).toBe(5);
    expect(r.desceu).toBe(false);
  });

  it('subida hoje (acima do histórico) é imediata e gera evento', () => {
    const d = dados({ vinculos: clientes(3), lancamentos: mensais(ULT3, 200000, 100000) });
    const r = calcularFase(d, HOJE, [instantaneo('2026-09-28', 4)], cfg);
    expect(r.fase).toBe(5);
    expect(r.evento).toEqual({ de: 4, para: 5 });
  });

  it('projeto arquivado com nota de lições → Ruínas (fase 0)', () => {
    const d = dados({ projeto: projeto({ id: 'p1', arquivadoEm: '2026-10-01T00:00:00.000Z', notaLicoes: 'aprendi X' }) });
    expect(calcularFase(d, HOJE, [], cfg).fase).toBe(0);
  });

  it('projeto arquivado sem nota (apenas oculto) mantém a fase inferida', () => {
    const d = dados({ projeto: projeto({ id: 'p1', arquivadoEm: '2026-10-01T00:00:00.000Z' }), registrosDeHoras: [horas({ horas: 6 })] });
    expect(calcularFase(d, HOJE, [], cfg).fase).toBe(2);
  });
});

describe('Maturidade — arquivar como Ruínas', () => {
  it('sem nota de lições → comando rejeitado; com nota → aceito', () => {
    expect(validarArquivamentoRuinas(null).ok).toBe(false);
    expect(validarArquivamentoRuinas('   ').ok).toBe(false);
    expect(validarArquivamentoRuinas('Lição aprendida').ok).toBe(true);
  });
});
