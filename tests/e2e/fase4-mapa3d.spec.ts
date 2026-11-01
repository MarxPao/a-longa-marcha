import { expect, test } from '@playwright/test';

test.describe('Fase 4 — Mapa 3D Mínimo (Critérios de Aceite)', () => {
  test('renderiza cidades procedurais em InstancedMesh, clica para abrir painel e persiste movimento', async ({
    page,
  }) => {
    const errosConsole: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errosConsole.push(msg.text());
    });

    // 1. Abre a página inicial da aplicação
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Canvas 3D do mapa deve estar presente e visível
    const canvas3D = page.locator('canvas[data-testid="canvas-terreno-3d"]');
    await expect(canvas3D).toBeVisible({ timeout: 15000 });

    // 2. Se o brief inicial de campanha abrir, conclui rapidamente para liberar o mapa
    const modalBrief = page.getByTestId('modal-brief-inicial');
    if (await modalBrief.isVisible()) {
      await page.getByTestId('botao-concluir-brief').click();
      await expect(modalBrief).not.toBeVisible();
    }

    // 3. Popula com perfil 'pequeno' para teste funcional de cidades e interação
    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');

      const demo = seedDemo('pequeno', 'semente-fase4-e2e');
      await useCampanhaStore.getState().importarJson(demo);
    });

    // Aguarda sincronização do mapa com o store
    await page.waitForTimeout(600);

    // 4. Seleção de Cidade: Clicar numa cidade abre o painel direito (Critério 2)
    // Obtém ID do primeiro projeto via store do navegador
    const primeiroProjeto = await page.evaluate(async () => {
      const { useCampanhaStore } = await import('../../src/store');
      const proj = useCampanhaStore.getState().dump.projetos[0];
      return proj ? { id: proj.id, nome: proj.nome, x: proj.x, z: proj.z } : null;
    });

    expect(primeiroProjeto).not.toBeNull();
    const idAlvo = primeiroProjeto!.id;

    // Dispara intenção de seleção (simulando clique na cidade pelo MapView)
    await page.evaluate((id) => {
      const mapView = (window as unknown as {
        __MAP_VIEW__?: { aoSelecionarProjeto?: (id: string | null) => void };
      }).__MAP_VIEW__;
      mapView?.aoSelecionarProjeto?.(id);
    }, idAlvo);

    // O painel lateral direito deve abrir mostrando os dados e as 6 abas
    const painelProjeto = page.getByTestId('painel-lateral-projeto');
    await expect(painelProjeto).toBeVisible();
    await expect(page.getByTestId('painel-projeto-nome')).toContainText(primeiroProjeto!.nome);

    // 5. Mover Cidade: Arrastar persiste novas coordenadas (Critério 3)
    const novoX = 75;
    const novoZ = -45;

    await page.evaluate(
      ({ id, x, z }) => {
        const mapView = (window as unknown as {
          __MAP_VIEW__?: { aoMoverProjeto?: (id: string, x: number, z: number) => void };
        }).__MAP_VIEW__;
        mapView?.aoMoverProjeto?.(id, x, z);
      },
      { id: idAlvo, x: novoX, z: novoZ }
    );

    // Aguarda atualização assíncrona do store e persistência
    await page.waitForTimeout(400);

    const coordenadasAtualizadas = await page.evaluate(async (id) => {
      const { useCampanhaStore } = await import('../../src/store');
      const proj = useCampanhaStore.getState().dump.projetos.find((p) => p.id === id);
      return proj ? { x: proj.x, z: proj.z } : null;
    }, idAlvo);

    expect(coordenadasAtualizadas?.x).toBe(novoX);
    expect(coordenadasAtualizadas?.z).toBe(novoZ);

    // 6. Teste de Desempenho no Perfil Carga (Critério 1: Medição de FPS)
    const metricasCarga = await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');

      // Aplica perfil carga com 500 cidades instanciadas
      const demoCarga = seedDemo('carga', 'semente-carga-fps');
      await useCampanhaStore.getState().importarJson(demoCarga);

      const mapView = (window as unknown as {
        __MAP_VIEW__?: {
          medirFps: (duracao: number) => Promise<{
            fpsMedio: number;
            p95TempoQuadroMs: number;
            totalInstancias: number;
          }>;
        };
      }).__MAP_VIEW__;

      if (!mapView) return null;
      return await mapView.medirFps(400);
    });

    expect(metricasCarga).not.toBeNull();
    expect(metricasCarga!.totalInstancias).toBeGreaterThanOrEqual(400);
    expect(metricasCarga!.fpsMedio).toBeGreaterThan(0);

    // Fecha painel do projeto com Esc
    await page.keyboard.press('Escape');
    await expect(painelProjeto).not.toBeVisible();

    expect(errosConsole).toEqual([]);
  });
});
