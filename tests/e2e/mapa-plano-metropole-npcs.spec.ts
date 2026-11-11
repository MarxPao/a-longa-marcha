import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe('Mapa Plano com Metrópole Central, Mercado Vivo e Fluxo de NPCs (Seções 1 a 8)', () => {
  test('1. Padaria do Zé (Produção alimentícia, produto Pão, receita > 0): gera loja padaria no bairro do setor e NPCs com sacos de pão até a loja', async ({
    page,
  }) => {
    const errosConsole: string[] = [];
    page.on('pageerror', (err) => errosConsole.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Sem dados, a metrópole aparece vazia com a dica "adicione um produto" (Seção 2, Princípio 1)
    await expect(page.getByTestId('dica-metropole-vazia')).toBeVisible();
    await expect(page.getByTestId('botao-carregar-demo-mercado')).toHaveCount(0);

    // Carrega dados de exemplo por Importar/Configurações (Etapa G0)
    await page.getByTestId('botao-configuracoes').click();
    await page.getByTestId('aba-editor-dados').click();
    await page.getByTestId('botao-carregar-dados-exemplo').click();
    await page.getByTestId('botao-fechar-editor-registros').click();
    await page.waitForTimeout(400);

    const estadoPadaria = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterLayoutMundo: () => {
            metropole: { x: number; z: number; raio: number; nivel: number };
            cunhas: Array<{ setorId: string; vazia: boolean }>;
            cidades: Array<{ projetoId: string; x: number; z: number; raio: number }>;
          } | null;
          obterLojas: () => Array<{
            produtoId: string;
            projetoId: string;
            setorId: string;
            tamanho: 'P' | 'M' | 'G';
            estado: string;
            receitaMensal: number;
            tipoLoja?: string;
            nomeProduto?: string;
          }>;
          obterFluxos: () => Array<{
            id: string;
            tipo: string;
            origemId: string;
            destinoId: string;
            volumeMensal: number;
            produtoIds: string[];
          }>;
          obterEstadoMetropole: () => {
            totalLojasVisiveis: number;
            lojasAbertas: number;
            lojasFechadas: number;
            lojasAbrindo: number;
            cunhasRenderizadas: number;
          };
          obterEstadoNpcs: () => {
            totalNpcsAtivos: number;
            totalRotasComFluxo: number;
            modoRenderizacao: 'modelos_completos' | 'particulas_distantes';
            contagemPorCarga: Record<string, number>;
          };
        };
      };
      const mv = w.__MAP_VIEW__;
      if (!mv) return null;

      const layout = mv.obterLayoutMundo();
      const lojas = mv.obterLojas();
      const fluxos = mv.obterFluxos();
      const lojaPadaria = lojas.find(
        (l) => l.produtoId === 'prod-2' || l.nomeProduto === 'Pão'
      );
      const fluxoPadaria = fluxos.find(
        (f) => f.origemId === 'proj-2' && f.tipo === 'producao'
      );

      return {
        metropole: layout?.metropole ?? null,
        lojaPadaria: lojaPadaria ?? null,
        fluxoPadaria: fluxoPadaria ?? null,
        estadoMetropole: mv.obterEstadoMetropole(),
        estadoNpcs: mv.obterEstadoNpcs(),
      };
    });

    expect(estadoPadaria).not.toBeNull();
    // Metrópole Central deve estar em (0, 0) com raio >= 140 u
    expect(estadoPadaria!.metropole?.x).toBe(0);
    expect(estadoPadaria!.metropole?.z).toBe(0);
    expect(estadoPadaria!.metropole?.raio).toBeGreaterThanOrEqual(140);

    // Loja do produto "Pão" da "Padaria do Zé" no setor "Produção alimentícia" (setor-2)
    expect(estadoPadaria!.lojaPadaria).not.toBeNull();
    expect(estadoPadaria!.lojaPadaria?.projetoId).toBe('proj-2');
    expect(estadoPadaria!.lojaPadaria?.setorId).toBe('setor-2');
    expect(estadoPadaria!.lojaPadaria?.tipoLoja).toBe('padaria');
    expect(estadoPadaria!.lojaPadaria?.estado).toBe('aberta');
    expect(estadoPadaria!.lojaPadaria?.receitaMensal).toBeGreaterThan(0);

    // Fluxo de produção da Padaria do Zé até a Metrópole Central e NPCs carregando sacos
    expect(estadoPadaria!.fluxoPadaria).not.toBeNull();
    expect(estadoPadaria!.fluxoPadaria?.produtoIds).toContain('prod-2');
    expect(estadoPadaria!.estadoNpcs.totalNpcsAtivos).toBeGreaterThan(0);
    expect(estadoPadaria!.estadoNpcs.contagemPorCarga.sacos).toBeGreaterThan(0);

    // Clicar na loja da Padaria do Zé abre o painel do projeto na aba Finanças com o produto "Pão" destacado
    await page.evaluate(async () => {
      const { useCampanhaStore } = await import('../../src/store');
      useCampanhaStore.getState().selecionarLojaNoMapa('proj-2', 'prod-2');
    });

    await expect(page.getByTestId('painel-lateral-projeto')).toBeVisible();
    await expect(page.getByTestId('painel-projeto-nome')).toHaveText('Padaria do Zé');
    await expect(page.getByTestId('aba-financas-conteudo')).toBeVisible();
    await expect(page.getByTestId('secao-produtos-mercado')).toBeVisible();
    await expect(page.getByTestId('nome-produto-destacado')).toHaveText('Pão');
    await expect(page.getByTestId('badge-produto-destacado')).toBeVisible();

    expect(errosConsole).toEqual([]);
  });

  test('2. Ciclo de vida das lojas: 60 dias sem receita fecha a loja (persianas, 0 NPCs) e 180 dias faz a loja sumir', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('botao-configuracoes').click();
    await page.getByTestId('aba-editor-dados').click();
    await page.getByTestId('botao-carregar-dados-exemplo').click();
    await page.getByTestId('botao-fechar-editor-registros').click();
    await page.waitForTimeout(300);

    // Avança 75 dias sem novos lançamentos (de 2026-10-19 a 2027-01-02 -> 79 dias desde 2026-10-15, > 60 dias e <= 180 dias)
    const apos60Dias = await page.evaluate(async () => {
      const { useCampanhaStore } = await import('../../src/store');
      useCampanhaStore.getState().avancarDataSimulada(75);

      await new Promise((r) => setTimeout(r, 120));

      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterLojas: () => Array<{ produtoId: string; estado: string; receitaMensal: number }>;
          obterFluxos: () => Array<{ origemId: string; tipo: string }>;
          obterEstadoMetropole: () => { lojasFechadas: number; lojasAbertas: number };
        };
      };
      const lojaPadaria = w.__MAP_VIEW__
        ?.obterLojas()
        .find((l) => l.produtoId === 'prod-2');
      const fluxoProducaoPadaria = w.__MAP_VIEW__
        ?.obterFluxos()
        .find((f) => f.origemId === 'proj-2' && f.tipo === 'producao');

      return {
        lojaPadaria: lojaPadaria ?? null,
        fluxoProducaoPadaria: fluxoProducaoPadaria ?? null,
        estadoMetropole: w.__MAP_VIEW__?.obterEstadoMetropole() ?? null,
      };
    });

    expect(apos60Dias.lojaPadaria).not.toBeNull();
    expect(apos60Dias.lojaPadaria?.estado).toBe('fechada');
    expect(apos60Dias.fluxoProducaoPadaria).toBeNull();
    expect(apos60Dias.estadoMetropole?.lojasFechadas).toBeGreaterThan(0);

    // Avança mais 120 dias (total > 180 dias sem receita) -> loja some
    const apos180Dias = await page.evaluate(async () => {
      const { useCampanhaStore } = await import('../../src/store');
      useCampanhaStore.getState().avancarDataSimulada(120);

      await new Promise((r) => setTimeout(r, 120));

      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterLojas: () => Array<{ produtoId: string; estado: string }>;
        };
      };
      return w.__MAP_VIEW__?.obterLojas().find((l) => l.produtoId === 'prod-2') ?? null;
    });

    expect(apos180Dias).toBeNull();
  });

  test('3. Determinismo de layout e 4. Arrasto incremental de cidade com transição de 400 ms sem mover outras cidades', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('botao-configuracoes').click();
    await page.getByTestId('aba-editor-dados').click();
    await page.getByTestId('botao-carregar-dados-exemplo').click();
    await page.getByTestId('botao-fechar-editor-registros').click();
    await page.waitForTimeout(300);

    // Critério 3: Mesmo estado aberto duas vezes gera exatamente o mesmo layout
    const comparacaoDeterminismo = await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterLayoutMundo: () => unknown;
          obterLojas: () => unknown;
          obterEstradas: () => unknown;
        };
      };

      const snap1 = JSON.stringify({
        layout: w.__MAP_VIEW__?.obterLayoutMundo(),
        lojas: w.__MAP_VIEW__?.obterLojas(),
        estradas: w.__MAP_VIEW__?.obterEstradas(),
      });

      const demo2 = seedDemo('demo', 'imperio-de-projetos-demo-2026');
      demo2.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(demo2);
      await new Promise((r) => setTimeout(r, 100));

      const snap2 = JSON.stringify({
        layout: w.__MAP_VIEW__?.obterLayoutMundo(),
        lojas: w.__MAP_VIEW__?.obterLojas(),
        estradas: w.__MAP_VIEW__?.obterEstradas(),
      });

      return { identicos: snap1 === snap2, tamanhoSnap: snap1.length };
    });

    expect(comparacaoDeterminismo.tamanhoSnap).toBeGreaterThan(1000);
    expect(comparacaoDeterminismo.identicos).toBe(true);

    // Critério 4: Arrastar uma cidade não move nenhuma outra e recalcula só as estradas dela (transição 400ms)
    const resultadoArrasto = await page.evaluate(async () => {
      const { useCampanhaStore } = await import('../../src/store');
      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterLayoutMundo: () => {
            cidades: Array<{ projetoId: string; x: number; z: number }>;
          } | null;
          obterEstadoEstradas: () => { transicoesAtivas: number };
          moverCidadeIncremental: (id: string, x: number, z: number) => string[];
        };
      };
      const mv = w.__MAP_VIEW__;
      if (!mv) return null;

      const antes = mv.obterLayoutMundo()!.cidades.map((c) => ({ ...c }));
      const alvo = antes.find((c) => c.projetoId === 'proj-2')!;
      const novoX = alvo.x + 35;
      const novoZ = alvo.z - 25;

      // Aciona o arrasto incremental da cidade (exatamente como MapView executa ao soltar o mouse na Seção 4.6)
      const recalculadas = mv.moverCidadeIncremental('proj-2', novoX, novoZ);
      const transicoesAtivasImediatas = mv.obterEstadoEstradas().transicoesAtivas;

      // Persiste na store da campanha
      await useCampanhaStore.getState().atualizarEntidade<{
        id: string;
        criadoEm: string;
        atualizadoEm: string;
        arquivadoEm: string | null;
        x: number;
        z: number;
        posicao: { x: number; z: number };
      }>('projetos', 'proj-2', {
        x: novoX,
        z: novoZ,
        posicao: { x: novoX, z: novoZ },
      });

      const depois = mv.obterLayoutMundo()!.cidades;

      let outrasMovidas = 0;
      for (const cidAntes of antes) {
        if (cidAntes.projetoId === 'proj-2') continue;
        const cidDepois = depois.find((c) => c.projetoId === cidAntes.projetoId)!;
        if (
          Math.abs(cidAntes.x - cidDepois.x) > 1e-6 ||
          Math.abs(cidAntes.z - cidDepois.z) > 1e-6
        ) {
          outrasMovidas++;
        }
      }

      const alvoDepois = depois.find((c) => c.projetoId === 'proj-2')!;
      return {
        outrasMovidas,
        alvoDepois,
        novoX,
        novoZ,
        transicoesAtivas: transicoesAtivasImediatas,
        totalRecalculadas: recalculadas.length,
      };
    });

    expect(resultadoArrasto).not.toBeNull();
    expect(resultadoArrasto!.outrasMovidas).toBe(0);
    expect(resultadoArrasto!.alvoDepois.x).toBeCloseTo(resultadoArrasto!.novoX, 1);
    expect(resultadoArrasto!.alvoDepois.z).toBeCloseTo(resultadoArrasto!.novoZ, 1);
    expect(resultadoArrasto!.transicoesAtivas).toBeGreaterThan(0);
  });

  test('5. Filtros por setor/produto, lentes, desempenho (FPS) e capturas nos 3 níveis de zoom', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('botao-configuracoes').click();
    await page.getByTestId('aba-editor-dados').click();
    await page.getByTestId('botao-carregar-dados-exemplo').click();
    await page.getByTestId('botao-fechar-editor-registros').click();
    await page.waitForTimeout(500);

    // Fecha painel lateral caso esteja aberto para captura limpa do mapa
    const botaoFecharPainel = page.getByTestId('botao-fechar-painel-projeto');
    if (await botaoFecharPainel.isVisible()) {
      await botaoFecharPainel.click();
    }

    const pastaArtefatos = resolve(process.cwd(), 'test-results/screenshots-mapa-plano');
    mkdirSync(pastaArtefatos, { recursive: true });

    // 1. Captura Zoom Próximo (Metrópole Central, lojas, placas e NPCs em modelo 3D completo)
    const estadoProximo = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirPoseCamera: (x: number, z: number, dist: number, elev?: number) => void;
          obterEstadoNpcs: () => { modoRenderizacao: string; totalNpcsAtivos: number };
        };
      };
      w.__MAP_VIEW__?.definirPoseCamera(0, 0, 175, 38);
      return w.__MAP_VIEW__?.obterEstadoNpcs() ?? null;
    });
    expect(estadoProximo?.modoRenderizacao).toBe('modelos_completos');
    await page.waitForTimeout(350);
    await page.screenshot({
      path: resolve(pastaArtefatos, 'zoom-proximo-metropole.png'),
    });

    // 2. Captura Zoom Médio (Metrópole Central, portões, cunhas, estradas Catmull-Rom e cidades próximas)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: { definirPoseCamera: (x: number, z: number, dist: number, elev?: number) => void };
      };
      w.__MAP_VIEW__?.definirPoseCamera(0, 0, 460, 44);
    });
    await page.waitForTimeout(350);
    await page.screenshot({
      path: resolve(pastaArtefatos, 'zoom-medio-bairros-cidades.png'),
    });

    // 3. Captura Zoom Distante (Império completo, cunhas radiais, névoa nas bordas e partículas de fluxo)
    const estadoDistante = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirPoseCamera: (x: number, z: number, dist: number, elev?: number) => void;
          obterEstadoNpcs: () => { modoRenderizacao: string; totalNpcsAtivos: number };
        };
      };
      w.__MAP_VIEW__?.definirPoseCamera(0, 0, 920, 50);
      return w.__MAP_VIEW__?.obterEstadoNpcs() ?? null;
    });
    expect(estadoDistante?.modoRenderizacao).toBe('particulas_distantes');
    await page.waitForTimeout(350);
    await page.screenshot({
      path: resolve(pastaArtefatos, 'zoom-distante-imperio.png'),
    });

    // 4. Testa filtro por produto isolado ("Pão" -> prod-2)
    await page.getByTestId('select-filtro-mapa-produto').selectOption('prod-2');
    await page.waitForTimeout(200);
    await expect(page.getByTestId('botao-limpar-filtros-mapa')).toBeVisible();
    await page.getByTestId('botao-limpar-filtros-mapa').click();

    // 5. Mede FPS no cenário de demonstração (40 cidades, 70 lojas, ~350 NPCs) e no cenário de carga (500 cidades)
    const metricasDesempenho = await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirPoseCamera: (x: number, z: number, dist: number, elev?: number) => void;
          medirFps: (ms: number) => Promise<{
            fpsMedio: number;
            p95TempoQuadroMs: number;
            totalInstancias: number;
          }>;
          obterEstadoNpcs: () => { totalNpcsAtivos: number };
          obterEstadoMetropole: () => { lojasAbertas: number };
        };
      };
      const mv = w.__MAP_VIEW__!;
      mv.definirPoseCamera(0, 0, 360, 42);
      const fpsDemo = await mv.medirFps(500);
      const npcsDemo = mv.obterEstadoNpcs().totalNpcsAtivos;
      const lojasDemo = mv.obterEstadoMetropole().lojasAbertas;

      const carga = seedDemo('carga', 'semente-carga-500-cidades');
      carga.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(carga);
      await new Promise((r) => setTimeout(r, 150));

      const fpsCarga = await mv.medirFps(500);
      const npcsCarga = mv.obterEstadoNpcs().totalNpcsAtivos;
      const lojasCarga = mv.obterEstadoMetropole().lojasAbertas;

      return {
        fpsDemo,
        npcsDemo,
        lojasDemo,
        fpsCarga,
        npcsCarga,
        lojasCarga,
      };
    });

    console.log('METRICAS_FPS_MAPA_PLANO:', JSON.stringify(metricasDesempenho));
    expect(metricasDesempenho.fpsDemo.fpsMedio).toBeGreaterThan(0);
    expect(metricasDesempenho.fpsCarga.fpsMedio).toBeGreaterThan(0);
    expect(metricasDesempenho.lojasCarga).toBeGreaterThanOrEqual(120);
    expect(metricasDesempenho.npcsCarga).toBeLessThanOrEqual(1500);
  });
});
