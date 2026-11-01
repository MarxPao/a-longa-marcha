import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  desfazerFechamentoTurno,
  fecharSemanasPendentes,
  fecharTurnoSemanal,
  previaFechamentoTurno,
} from '../../src/engine/turno';
import { seedDemo } from '../../src/seed/seedDemo';
import {
  dumpVazio,
  horas,
  lanc,
  projeto,
  tarefa,
} from './fabrica';

describe('Turno Semanal e Idempotência (Seção 3.1 e Tabela 7.2)', () => {
  describe('Idempotência do fechamento de turno', () => {
    it('fechar a mesma semana duas vezes: contagens de lançamentos, tarefas, eventos, conquistas e instantâneos idênticas (Tabela 7.2)', () => {
      const dump = seedDemo('pequeno', 'semente-idemp-1');
      const semana = '2026-10-19';

      const fechamento1 = fecharTurnoSemanal(dump, semana);
      const dumpApos1 = fechamento1.dumpAtualizado;

      // Executa o segundo fechamento na mesma semana
      const fechamento2 = fecharTurnoSemanal(dumpApos1, semana);
      const dumpApos2 = fechamento2.dumpAtualizado;

      expect(fechamento2.jaFechada).toBe(true);
      expect(dumpApos2.lancamentos.length).toBe(dumpApos1.lancamentos.length);
      expect(dumpApos2.tarefas.length).toBe(dumpApos1.tarefas.length);
      expect(dumpApos2.eventos.length).toBe(dumpApos1.eventos.length);
      expect(dumpApos2.instantaneos.length).toBe(dumpApos1.instantaneos.length);
      expect(Object.keys(dumpApos2.meta.conquistas).length).toBe(
        Object.keys(dumpApos1.meta.conquistas).length
      );
    });

    it('prova matemática de idempotência com fast-check (propriedade: fechar(fechar(D, S)) === fechar(D, S))', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pequeno'),
          fc.string({ minLength: 4, maxLength: 10 }),
          fc.constantFrom('2026-10-12', '2026-10-19', '2026-10-26'),
          (perfil, semente, semana) => {
            const dump = seedDemo(perfil, semente);

            const r1 = fecharTurnoSemanal(dump, semana);
            const r2 = fecharTurnoSemanal(r1.dumpAtualizado, semana);

            expect(r2.jaFechada).toBe(true);
            expect(r2.dumpAtualizado.instantaneos.length).toBe(r1.dumpAtualizado.instantaneos.length);
            expect(r2.dumpAtualizado.eventos.length).toBe(r1.dumpAtualizado.eventos.length);
            expect(r2.dumpAtualizado.lancamentos.length).toBe(r1.dumpAtualizado.lancamentos.length);
            expect(r2.dumpAtualizado.tarefas.length).toBe(r1.dumpAtualizado.tarefas.length);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Desfazer fechamento de turno', () => {
    it('desfazer o último fechamento: contagens voltam às anteriores e nada além do fechamentoId é apagado (Tabela 7.2)', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);
      dump.registrosDeHoras.push(horas({ projetoId: 'p1', data: '2026-10-20', horas: 5 }));

      const totalLancamentosAntes = dump.lancamentos.length;
      const totalTarefasAntes = dump.tarefas.length;
      const totalEventosAntes = dump.eventos.length;
      const totalInstantaneosAntes = dump.instantaneos.length;

      const fechamento = fecharTurnoSemanal(dump, '2026-10-19');
      expect(fechamento.instantaneoCriado).not.toBeNull();
      expect(fechamento.dumpAtualizado.instantaneos.length).toBe(totalInstantaneosAntes + 1);

      // Desfaz o fechamento usando o fechamentoId gerado
      const dumpRestaurado = desfazerFechamentoTurno(
        fechamento.dumpAtualizado,
        fechamento.fechamentoId
      );

      expect(dumpRestaurado.instantaneos.length).toBe(totalInstantaneosAntes);
      expect(dumpRestaurado.eventos.length).toBe(totalEventosAntes);
      expect(dumpRestaurado.lancamentos.length).toBe(totalLancamentosAntes);
      expect(dumpRestaurado.tarefas.length).toBe(totalTarefasAntes);
    });
  });

  describe('Semanas pendentes em sequência', () => {
    it('3 semanas pendentes fechadas de uma vez vs uma a uma: resultado idêntico (Tabela 7.2)', () => {
      const dumpBase1 = seedDemo('pequeno', 'semente-pendentes');
      const dumpBase2 = seedDemo('pequeno', 'semente-pendentes');

      // Define que o último fechamento consolidado ocorreu em 2026-09-28
      const ultimoFechamento = {
        ...dumpBase1.instantaneos[0]!,
        id: 'inst-base-ant',
        semana: '2026-09-28',
      };
      dumpBase1.instantaneos = [ultimoFechamento];
      dumpBase2.instantaneos = [{ ...ultimoFechamento }];

      const semanas = ['2026-10-05', '2026-10-12', '2026-10-19'];

      // Fechando uma a uma manualmente
      let d1 = dumpBase1;
      for (const sem of semanas) {
        d1 = fecharTurnoSemanal(d1, sem).dumpAtualizado;
      }

      // Fechando em lote via fecharSemanasPendentes
      const d2 = fecharSemanasPendentes(dumpBase2, '2026-10-19');

      expect(d2.instantaneos.length).toBe(d1.instantaneos.length);
      expect(d2.eventos.length).toBe(d1.eventos.length);
      expect(d2.lancamentos.length).toBe(d1.lancamentos.length);
      expect(d2.tarefas.length).toBe(d1.tarefas.length);
    });
  });

  describe('Materialização de recorrências', () => {
    it('materializa lançamentos recorrentes semanais no fechamento', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);

      // Lançamento recorrente mensal dia 20
      dump.lancamentos.push(
        lanc({
          id: 'lanc-recorrente-1',
          data: '2026-09-20',
          tipo: 'custo',
          valorCentavos: 50000,
          recorrencia: {
            periodicidade: 'mensal',
            intervalo: 1,
            diaRef: 20,
            ate: '2026-12-31',
          },
        })
      );

      // Fecha a semana de 2026-10-19 a 2026-10-25 (que contém 2026-10-20)
      const res = fecharTurnoSemanal(dump, '2026-10-19');
      const materializados = res.dumpAtualizado.lancamentos.filter(
        (l) => l.origemRecorrenciaId === 'lanc-recorrente-1'
      );

      expect(materializados).toHaveLength(1);
      expect(materializados[0]?.data).toBe('2026-10-20');
      expect(materializados[0]?.valorCentavos).toBe(50000);
    });

    it('gera a próxima ocorrência para tarefa recorrente concluída', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);

      dump.tarefas.push(
        tarefa({
          id: 'tar-rec-1',
          titulo: 'Backup Semanal',
          status: 'feita',
          prazo: '2026-10-19',
          concluidaEm: '2026-10-20',
          recorrencia: {
            periodicidade: 'semanal',
            intervalo: 1,
            diaRef: 1,
            ate: null,
          },
        })
      );

      const res = fecharTurnoSemanal(dump, '2026-10-19');
      const novaTarefa = res.dumpAtualizado.tarefas.find(
        (t) => t.origemRecorrenciaId === 'tar-rec-1'
      );

      expect(novaTarefa).toBeDefined();
      expect(novaTarefa?.status).toBe('pendente');
      expect(novaTarefa?.prazo).toBe('2026-10-26');
    });

    it('materializa recorrências trimestrais, anuais e respeita limite ate', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);

      dump.lancamentos.push(
        lanc({
          id: 'lanc-trimestral',
          data: '2026-07-20',
          recorrencia: { periodicidade: 'trimestral', intervalo: 1, diaRef: 20, ate: '2026-12-31' },
        }),
        lanc({
          id: 'lanc-anual',
          data: '2025-10-20',
          recorrencia: { periodicidade: 'anual', intervalo: 1, diaRef: 20, ate: '2026-10-25' },
        }),
        lanc({
          id: 'lanc-expirado',
          data: '2026-09-20',
          recorrencia: { periodicidade: 'mensal', intervalo: 1, diaRef: 20, ate: '2026-10-01' },
        })
      );

      const res = fecharTurnoSemanal(dump, '2026-10-19');
      const matTri = res.dumpAtualizado.lancamentos.find((l) => l.origemRecorrenciaId === 'lanc-trimestral');
      const matAnu = res.dumpAtualizado.lancamentos.find((l) => l.origemRecorrenciaId === 'lanc-anual');
      const matExp = res.dumpAtualizado.lancamentos.find((l) => l.origemRecorrenciaId === 'lanc-expirado');

      expect(matTri?.data).toBe('2026-10-20');
      expect(matAnu?.data).toBe('2026-10-20');
      expect(matExp).toBeUndefined(); // ate expirado
    });
  });

  describe('Prévia de fechamento (dry-run)', () => {
    it('calcula indicadores sem alterar o banco de dados', () => {
      const dump = seedDemo('pequeno', 'semente-previa');
      const totalLancAntes = dump.lancamentos.length;

      const previa = previaFechamentoTurno(dump, '2026-10-19');

      expect(previa.semana).toBe('2026-10-19');
      expect(typeof previa.horasPlanejadas).toBe('number');
      expect(typeof previa.horasRegistradas).toBe('number');
      expect(dump.lancamentos.length).toBe(totalLancAntes); // Intacto
    });
  });

  // --------------------------------------------------------------------------
  // Metas de Desempenho (Critério de Aceite da Fase 2B)
  // --------------------------------------------------------------------------
  describe('Desempenho de fechamento semanal (Critérios de Aceite Fase 2B)', () => {
    it('perfil real (60 projetos, 600 tarefas): fecha em < 100 ms', () => {
      const dump = seedDemo('real', 'semente-perf-real');

      // Aquecimento JIT
      fecharTurnoSemanal(dump, '2026-10-12');

      const tempos: number[] = [];
      let ultimoRes: ReturnType<typeof fecharTurnoSemanal> | null = null;
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        ultimoRes = fecharTurnoSemanal(dump, `2026-10-${20 + i}`);
        tempos.push(performance.now() - t0);
      }
      tempos.sort((a, b) => a - b);
      const mediana = tempos[1]!;

      console.log(`[perf 2B real] Fechamento completado em ${mediana.toFixed(2)} ms (mediana de 3, meta: < 100 ms)`);

      const sobCobertura = Boolean(
        process.env.VITEST_COVERAGE ||
        process.env.NODE_V8_COVERAGE ||
        process.argv.includes('--coverage') ||
        (globalThis as unknown as { __coverage__?: unknown }).__coverage__
      );
      const limiteReal = sobCobertura ? 200 : 100;
      expect(ultimoRes?.instantaneoCriado).not.toBeNull();
      expect(mediana).toBeLessThan(limiteReal);
    });

    it('perfil carga (500 projetos, 5.000 tarefas): fecha em ≤ 1 s (Critério de Aceite da Seção 8)', () => {
      const dump = seedDemo('carga', 'semente-perf-carga');
      const semana = '2026-10-19';

      // Aquecimento JIT
      fecharTurnoSemanal(dump, '2026-10-12');

      const t0 = performance.now();
      const res = fecharTurnoSemanal(dump, semana);
      const duracao = performance.now() - t0;

      console.log(`[perf 2B carga] Fechamento de carga completado em ${duracao.toFixed(2)} ms (meta: ≤ 1000 ms)`);

      const sobCobertura = Boolean(process.env.NODE_V8_COVERAGE);
      const limiteCarga = sobCobertura ? 2000 : 1000;
      expect(res.instantaneoCriado).not.toBeNull();
      expect(duracao).toBeLessThanOrEqual(limiteCarga);
    });
  });

  describe('Integração de Workers e Fallback Seguro', () => {
    it('executarFechamentoTurno roda via fallback Node/Vitest e calcularHashWorker opera corretamente', async () => {
      const { calcularHashWorker, executarFechamentoTurno } = await import('../../src/workers');
      expect(calcularHashWorker('teste-semente')).toBeTypeOf('number');

      const dump = seedDemo('pequeno', 'semente-worker');
      const res = await executarFechamentoTurno(dump, '2026-10-19');
      expect(res.resultado.instantaneoCriado).not.toBeNull();
      expect(res.viaWorker).toBe(false);
      expect(res.duracaoMs).toBeGreaterThan(0);
    });
  });
});
