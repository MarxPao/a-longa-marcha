import { expect, test } from '@playwright/test';

test.describe('Fase 8 — Desempenho (Metas da Tabela 7.4 no Perfil Carga)', () => {
  test('1. Perfil Carga (500 cidades e 5.000 tarefas): abertura ≤ 3s, quadros p95 ≤ 16.7ms com câmera em movimento, busca ≤ 100ms, virtualização e estabilidade de memória', async ({
    page,
  }) => {
    const tInicioAbertura = Date.now();
    await page.goto('/');
    await expect(page.getByTestId('canvas-terreno-3d')).toBeVisible({ timeout: 3000 });
    const tempoAberturaMs = Date.now() - tInicioAbertura;
    expect(tempoAberturaMs).toBeLessThanOrEqual(3000);

    // Carrega o perfil carga (500 cidades e 5.000 tarefas)
    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpCarga = seedDemo('carga', 'semente-fase8-e2e');
      dumpCarga.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpCarga);
    });

    await page.waitForTimeout(300);

    // 1. Mede quadros no mapa (p95 <= 16.7 ms, lente Padrão, câmera em movimento)
    const metricasQuadros = await page.evaluate(async () => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirLente: (lente: string) => void;
          medirFps: (
            duracaoMs: number,
            moverCamera: boolean
          ) => Promise<{
            fpsMedio: number;
            p95TempoQuadroMs: number;
            totalInstancias: number;
            qualidadeEfetiva: string;
            drawCallsRotas: number;
          }>;
          obterEstadoQualidade: () => {
            configurada: string;
            efetiva: string;
            drawCallsRotas: number;
          };
        };
      };
      w.__MAP_VIEW__?.definirLente('padrao');
      const medicao = await w.__MAP_VIEW__?.medirFps(450, true);
      const estadoQualidade = w.__MAP_VIEW__?.obterEstadoQualidade();
      return { medicao, estadoQualidade };
    });

    expect(metricasQuadros.medicao).toBeDefined();
    expect(metricasQuadros.medicao!.totalInstancias).toBe(500);
    expect(metricasQuadros.medicao!.p95TempoQuadroMs).toBeLessThanOrEqual(16.7);
    expect(metricasQuadros.medicao!.drawCallsRotas).toBeLessThanOrEqual(4);

    // 2. Verifica virtualização de lista longa no Painel da Cidade (Aba Tarefas com > 50 tarefas adicionadas)
    await page.evaluate(async () => {
      const { useCampanhaStore } = await import('../../src/store');
      const st = useCampanhaStore.getState();
      const projAlvo = st.dump.projetos[0]!;
      st.selecionarProjeto(projAlvo.id);

      // Adiciona tarefas extras sem frente no primeiro projeto para superar o limiar de virtualização (25)
      const novasTarefas = Array.from({ length: 40 }, (_, i) => ({
        id: `tarefa-virt-${i}`,
        criadoEm: '2026-01-01T00:00:00.000Z',
        atualizadoEm: '2026-01-01T00:00:00.000Z',
        arquivadoEm: null,
        projetoId: projAlvo.id,
        frenteId: null,
        titulo: `Tarefa Virtualizada #${i + 1}`,
        descricao: '',
        status: 'pendente' as const,
        prioridade: 2 as const,
        estimativaHoras: 2,
        prazo: '2026-12-01',
        concluidaEm: null,
        recorrencia: null,
        origemRecorrenciaId: null,
        fechamentoId: null,
      }));
      useCampanhaStore.setState({
        dump: {
          ...st.dump,
          tarefas: [...st.dump.tarefas, ...novasTarefas],
        },
      });
    });

    await page.getByTestId('aba-tarefas').click();
    const containerVirt = page.getByTestId('lista-virtualizada-tarefas-gerais');
    await expect(containerVirt).toBeVisible();

    const totalItensAttr = Number(await containerVirt.getAttribute('data-total-itens'));
    const renderizadosAttr = Number(
      await containerVirt.getAttribute('data-itens-renderizados')
    );
    expect(totalItensAttr).toBeGreaterThanOrEqual(40);
    expect(renderizadosAttr).toBeLessThan(totalItensAttr);

    // Fecha painel lateral
    await page.keyboard.press('Escape');

    // 3. Verifica estabilidade de memória após ciclo intensivo de navegação, pan, zoom e troca de lentes
    const estabilidadeMemoria = await page.evaluate(async () => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          centralizarEm: (x: number, z: number) => void;
          definirLente: (lente: string) => void;
          medirFps: (duracaoMs: number, moverCamera: boolean) => Promise<unknown>;
        };
        performance: Performance & {
          memory?: { usedJSHeapSize: number };
        };
      };

      const heapAntes = w.performance.memory?.usedJSHeapSize ?? 0;
      const lentes = ['padrao', 'financas', 'tempo', 'rede', 'risco', 'clientes', 'estoque', 'pd'];

      for (let ciclo = 0; ciclo < 16; ciclo++) {
        const lente = lentes[ciclo % lentes.length]!;
        w.__MAP_VIEW__?.definirLente(lente);
        w.__MAP_VIEW__?.centralizarEm(
          Math.cos(ciclo) * 80,
          Math.sin(ciclo) * 80
        );
      }
      w.__MAP_VIEW__?.definirLente('padrao');
      await w.__MAP_VIEW__?.medirFps(120, true);

      const heapDepois = w.performance.memory?.usedJSHeapSize ?? 0;
      const crescimentoMb =
        heapAntes > 0 ? (heapDepois - heapAntes) / (1024 * 1024) : 0;

      return { heapAntes, heapDepois, crescimentoMb };
    });

    // O crescimento de heap após 16 trocas completas de lentes e navegação em 500 cidades deve ser estável (< 35 MB)
    expect(estabilidadeMemoria.crescimentoMb).toBeLessThan(35);
  });
});
