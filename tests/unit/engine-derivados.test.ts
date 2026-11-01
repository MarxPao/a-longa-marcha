import { describe, expect, it } from 'vitest';
import { configPadrao, type DumpBanco } from '../../src/domain';
import {
  calcularDerivadosGlobais,
  calcularDerivadosProjeto,
  construirIndice,
  projetosInvalidados,
  recalcularProjetos,
} from '../../src/engine';
import { seedDemo } from '../../src/seed';
import { base, horas, item, itemLista, lanc, projeto, saldo, tarefa, vinculo } from './fabrica';
import { criarDumpVazio } from '../../src/domain';

const HOJE = '2026-10-31';
const cfg = configPadrao;

function mini(): DumpBanco {
  const d = criarDumpVazio();
  d.setores.push({ ...base('s1'), nome: 'S', cor: '#112233', icone: 'x', bioma: 'b', regiao: [[0, 0], [1, 0], [1, 1]], ordem: 0 });
  d.projetos.push(
    projeto({ id: 'p1', setorId: 's1', autonomia: 'direto', horasAlvoSemana: 10 }),
    projeto({ id: 'p2', setorId: 's1', autonomia: 'autonomo', horasAlvoSemana: 2 }),
    projeto({ id: 'p3', setorId: 's1', autonomia: 'direto' })
  );
  d.tarefas.push(
    tarefa({ id: 't1', projetoId: 'p1', prazo: '2026-10-01' }),
    tarefa({ id: 't2', projetoId: 'p1', status: 'feita', concluidaEm: '2026-10-25' }),
    tarefa({ id: 't3', projetoId: 'p3' })
  );
  d.bloqueiosTarefa.push({ tarefaId: 't3', bloqueadaPorId: 't1' });
  d.registrosDeHoras.push(horas({ projetoId: 'p1', data: '2026-10-25', horas: 12 }));
  d.lancamentos.push(lanc({ projetoId: 'p1', data: '2026-10-10', valorCentavos: 600000 }), lanc({ projetoId: 'p1', data: '2026-10-11', tipo: 'custo', valorCentavos: 100000 }));
  d.vinculosCliente.push(vinculo({ projetoId: 'p1', clienteId: 'c1' }));
  d.itens.push(item({ id: 'i1', fornecedorId: 'f1' }));
  d.saldos.push(saldo({ itemId: 'i1', quantidade: 5 }));
  d.itensDeLista.push(itemLista({ id: 'l1', projetoId: 'p1', itemId: 'i1', quantidade: 3 }), itemLista({ id: 'l2', projetoId: 'p3', itemId: 'i1', quantidade: 3 }));
  d.tiposLigacao.push({ ...base('tf'), nome: 'financia', cor: '#B8923A', direcional: true });
  d.ligacoes.push({ ...base('lg1'), origemId: 'p1', destinoId: 'p3', tipoId: 'tf', forca: 2 });
  return d;
}

describe('Derivados de um projeto (integração das regras)', () => {
  const idx = construirIndice(mini());

  it('p1: calcula horas, moral, fase, saúde com descontos e fluxo do mês', () => {
    const r = calcularDerivadosProjeto(idx, 'p1', HOJE, cfg);
    expect(r.horasJanela).toBe(12);
    expect(r.horasTotais).toBe(12);
    expect(r.moral.parteHoras).toBe(0.6); // 12 / (2 × 10) = 0,6
    expect(r.fase.fase).toBe(4); // Vila: 1 vínculo ativo + receita
    expect(r.fluxoMes).toEqual({ receitaCentavos: 600000, custoCentavos: 100000, liquidoCentavos: 500000 });
    expect(r.tarefasVencidas).toBe(1);
    expect(r.saude.descontos.map((d) => d.causa)).toEqual(['tarefas_vencidas']);
    expect(r.saude.pontuacao).toBe(90);
    expect(r.roi).toEqual({ receitaCentavos: 600000, horas: 12, centavosPorHora: 50000 });
  });

  it('p3 está bloqueado por dependência aberta (t1) e por material em falta (saldo 5 < 3 + 3)', () => {
    const r = calcularDerivadosProjeto(idx, 'p3', HOJE, cfg);
    expect(r.bloqueios.porTarefa).toBe(1);
    expect(r.bloqueios.porMaterial).toBe(1);
    expect(r.saude.descontos.find((d) => d.causa === 'bloqueios')?.pontos).toBe(20);
  });

  it('derivados são determinísticos (mesma entrada, mesma saída)', () => {
    expect(calcularDerivadosProjeto(idx, 'p1', HOJE, cfg)).toEqual(calcularDerivadosProjeto(idx, 'p1', HOJE, cfg));
  });

  it('projeto inexistente → erro claro', () => {
    expect(() => calcularDerivadosProjeto(idx, 'nao-existe', HOJE, cfg)).toThrow();
  });
});

describe('Derivados globais', () => {
  it('caixa, runway, ROI ranking, projeção e concentração', () => {
    const g = calcularDerivadosGlobais(construirIndice(mini()), HOJE, cfg);
    expect(g.caixaCentavos).toBe(500000);
    expect(g.projecaoSeisMeses).toHaveLength(6);
    expect(g.rankingRoi[0]?.projetoId).toBe('p1');
    expect(g.concentracaoClientes.receitaTotalCentavos).toBe(600000);
    expect(g.runway).toBeDefined();
  });
});

describe('Recálculo incremental — quais projetos cada mudança invalida', () => {
  const idx = construirIndice(mini());
  const so = (s: Set<string> | 'todos') => (s === 'todos' ? s : [...s].sort());

  it('tarefa → seu projeto e os projetos das tarefas que ela bloqueia', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'tarefas', depois: tarefa({ id: 't1', projetoId: 'p1' }) }))).toEqual(['p1', 'p3']);
  });

  it('tarefa que muda de projeto invalida os dois (antes e depois)', () => {
    const r = projetosInvalidados(idx, { tabela: 'tarefas', antes: tarefa({ id: 'tx', projetoId: 'p1' }), depois: tarefa({ id: 'tx', projetoId: 'p2' }) });
    expect(so(r)).toEqual(['p1', 'p2']);
  });

  it('config → todos', () => {
    expect(projetosInvalidados(idx, { tabela: 'config' })).toBe('todos');
  });

  it('item de estoque compartilhado → todos os projetos que o usam', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'saldos', depois: saldo({ itemId: 'i1' }) }))).toEqual(['p1', 'p3']);
    expect(so(projetosInvalidados(idx, { tabela: 'itens', depois: item({ id: 'i1' }) }))).toEqual(['p1', 'p3']);
    expect(so(projetosInvalidados(idx, { tabela: 'fornecedores', depois: { ...base('f1') } }))).toEqual(['p1', 'p3']);
  });

  it('lista de materiais → o projeto e quem disputa o mesmo item', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'itensDeLista', depois: itemLista({ projetoId: 'p1', itemId: 'i1' }) }))).toEqual(['p1', 'p3']);
  });

  it('lançamento → projeto e projetos ligados a ele', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'lancamentos', depois: lanc({ projetoId: 'p1' }) }))).toEqual(['p1', 'p3']);
  });

  it('horas de projeto direto → ele e os autônomos (a média dos diretos muda o Legado)', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'registrosDeHoras', depois: horas({ projetoId: 'p1' }) }))).toEqual(['p1', 'p2']);
  });

  it('horas de projeto autônomo → só ele', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'registrosDeHoras', depois: horas({ projetoId: 'p2' }) }))).toEqual(['p2']);
  });

  it('cliente → projetos vinculados; vínculo → seu projeto; ligação → os dois extremos', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'clientes', depois: { ...base('c1') } }))).toEqual(['p1']);
    expect(so(projetosInvalidados(idx, { tabela: 'vinculosCliente', depois: vinculo({ projetoId: 'p2' }) }))).toEqual(['p2']);
    expect(so(projetosInvalidados(idx, { tabela: 'ligacoes', depois: { ...base('x'), origemId: 'p2', destinoId: 'p3' } }))).toEqual(['p2', 'p3']);
  });

  it('setor → seus projetos; tabelas sem efeito nos derivados → vazio', () => {
    expect(so(projetosInvalidados(idx, { tabela: 'setores', depois: { ...base('s1') } }))).toEqual(['p1', 'p2', 'p3']);
    expect(so(projetosInvalidados(idx, { tabela: 'estagios', depois: { ...base('e') } }))).toEqual([]);
  });

  it('mudar horas-alvo ou autonomia de um projeto direto também invalida os autônomos', () => {
    const antes = projeto({ id: 'p1', horasAlvoSemana: 10 });
    const depois = projeto({ id: 'p1', horasAlvoSemana: 20 });
    expect(so(projetosInvalidados(idx, { tabela: 'projetos', antes, depois }))).toEqual(['p1', 'p2']);
    const renomeado = projeto({ id: 'p1', horasAlvoSemana: 10, nome: 'outro' });
    expect(so(projetosInvalidados(idx, { tabela: 'projetos', antes, depois: renomeado }))).toEqual(['p1']);
  });

  it('recalcularProjetos devolve só os projetos pedidos', () => {
    const m = recalcularProjetos(idx, new Set(['p1', 'p3']), HOJE, cfg);
    expect([...m.keys()].sort()).toEqual(['p1', 'p3']);
    expect(recalcularProjetos(idx, 'todos', HOJE, cfg).size).toBe(3);
  });
});

describe('Desempenho — recálculo incremental no perfil carga (meta: ≤ 16 ms por projeto)', () => {
  it('500 projetos / 5.000 tarefas: recalcular 1 projeto leva ≤ 16 ms (mediana de 200 execuções, índice já construído)', () => {
    const dump = seedDemo('carga', 'perf-2a');
    const t0 = performance.now();
    const idx = construirIndice(dump);
    const construirMs = performance.now() - t0;
    // aquece o cache global (média dos diretos), medido à parte
    const f0 = performance.now();
    calcularDerivadosProjeto(idx, dump.projetos[0]!.id, HOJE, cfg);
    const frioMs = performance.now() - f0;

    const tempos: number[] = [];
    for (let i = 0; i < 200; i++) {
      const id = dump.projetos[(i * 7) % dump.projetos.length]!.id;
      const a = performance.now();
      calcularDerivadosProjeto(idx, id, HOJE, cfg);
      tempos.push(performance.now() - a);
    }
    tempos.sort((x, y) => x - y);
    const mediana = tempos[100]!;
    const p95 = tempos[189]!;
    const maximo = tempos[199]!;
    console.log(`[perf 2A] construirIndice=${construirMs.toFixed(1)}ms 1ª chamada(fria)=${frioMs.toFixed(2)}ms mediana=${mediana.toFixed(3)}ms p95=${p95.toFixed(3)}ms max=${maximo.toFixed(3)}ms`);
    expect(mediana).toBeLessThanOrEqual(16);
    expect(p95).toBeLessThanOrEqual(16);
  });

  it('perfil caos: nenhum derivado vira NaN/Infinity/undefined', () => {
    const dump = seedDemo('caos', 'caos-2a');
    const idx = construirIndice(dump);
    for (const p of dump.projetos) {
      const r = calcularDerivadosProjeto(idx, p.id, HOJE, cfg);
      const txt = JSON.stringify(r);
      expect(txt).not.toMatch(/NaN|Infinity|undefined/);
      expect(Number.isFinite(r.moral.moral)).toBe(true);
      expect(r.saude.pontuacao).toBeGreaterThanOrEqual(0);
    }
  });
});
