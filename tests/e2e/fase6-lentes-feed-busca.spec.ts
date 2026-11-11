import { expect, test } from '@playwright/test';

test.describe('Fase 6 — Lentes do Mapa, Minimapa, Feed de Eventos e Busca Global', () => {
  test('1. As 8 lentes (teclas 1 a 8): alternam cores sem recriar a cena Three.js e geram capturas com semente fixa', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Carrega campanha determinística com semente fixa
    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpFixo = seedDemo('pequeno', 'semente-imperial-fase6');
      dumpFixo.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpFixo);
    });

    await page.waitForTimeout(400);

    // Fixa a semente do terreno
    const inputSemente = page.getByTestId('input-semente');
    await inputSemente.fill('semente-imperial-fase6');
    await page.getByTestId('botao-gerar-terreno').click();

    // Fecha painel lateral se estiver aberto para foco total no mapa e minimapa
    await page.keyboard.press('Escape');

    // Captura UUID original da cena Three.js para provar que trocar de lente não recria a cena
    const uuidCenaInicial = await page.evaluate(() => {
      const mv = (
        window as unknown as {
          __MAP_VIEW__?: { obterUuidCena: () => string };
        }
      ).__MAP_VIEW__;
      return mv?.obterUuidCena() ?? null;
    });
    expect(uuidCenaInicial).toBeTruthy();

    const lentesEsperadas = [
      { tecla: '1', id: 'padrao', rotulo: 'Padrão' },
      { tecla: '2', id: 'financas', rotulo: 'Finanças' },
      { tecla: '3', id: 'tempo', rotulo: 'Tempo' },
      { tecla: '4', id: 'rede', rotulo: 'Rede' },
      { tecla: '5', id: 'risco', rotulo: 'Risco' },
      { tecla: '6', id: 'clientes', rotulo: 'Clientes' },
      { tecla: '7', id: 'estoque', rotulo: 'Estoque' },
      { tecla: '8', id: 'pd', rotulo: 'P&D' },
    ];

    for (const lente of lentesEsperadas) {
      await page.keyboard.press(lente.tecla);

      await expect(page.getByTestId('nome-lente-ativa')).toHaveText(lente.rotulo);

      const estadoMapa = await page.evaluate(() => {
        const mv = (
          window as unknown as {
            __MAP_VIEW__?: {
              obterUuidCena: () => string;
              obterLenteAtual: () => string;
            };
          }
        ).__MAP_VIEW__;
        return {
          uuidCena: mv?.obterUuidCena() ?? null,
          lenteNoMapa: mv?.obterLenteAtual() ?? null,
        };
      });

      expect(estadoMapa.lenteNoMapa).toBe(lente.id);
      expect(estadoMapa.uuidCena).toBe(uuidCenaInicial);

      // Captura de referência da lente com semente fixa
      const screenshot = await page.screenshot({ fullPage: false });
      await testInfo.attach(`lente-${lente.tecla}-${lente.id}.png`, {
        body: screenshot,
        contentType: 'image/png',
      });
    }
  });

  test('2. Minimapa interativo e Feed de Eventos com selo de alerta animado', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dump = seedDemo('pequeno', 'semente-feed-minimapa');
      dump.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dump);
    });

    await page.waitForTimeout(400);

    // Verifica que o minimapa está visível e clicável
    const canvasMinimapa = page.getByTestId('canvas-minimapa');
    await expect(canvasMinimapa).toBeVisible();

    // Clica no canto superior direito do minimapa para mover a câmera
    await canvasMinimapa.click({ position: { x: 160, y: 30 } });

    await page.waitForTimeout(300);
    const estadoCam = await page.evaluate(() => {
      const mv = (
        window as unknown as {
          __MAP_VIEW__?: {
            obterEstadoCamera: () => { alvo: { x: number; z: number } };
          };
        }
      ).__MAP_VIEW__;
      return mv?.obterEstadoCamera().alvo ?? { x: 0, z: 0 };
    });
    expect(estadoCam.x).toBeGreaterThan(10);
    expect(estadoCam.z).toBeLessThan(-10);

    // Verifica o selo de alerta do mensageiro e abre o feed de eventos
    const botaoSelo = page.getByTestId('selo-alerta-mensageiro');
    await expect(botaoSelo).toBeVisible();
    await botaoSelo.click();

    const painelFeed = page.getByTestId('painel-feed-eventos');
    await expect(painelFeed).toBeVisible();
    await expect(painelFeed).toContainText('Crônicas e Cartas do Império');
  });

  test('3. Busca Global (atalho /): executa em ≤ 100 ms no perfil carga e voa a câmera até a cidade', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Carrega o perfil carga (500 projetos, 5.000 tarefas) e retorna o projeto alvo
    const projetoAlvo = await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpCarga = seedDemo('carga', 'semente-busca-carga');
      dumpCarga.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpCarga);
      const dumpAtual = useCampanhaStore.getState().dump;
      const alvo = dumpAtual.projetos[Math.min(250, dumpAtual.projetos.length - 1)]!;
      const posX = alvo.posicao?.x ?? alvo.x;
      const posZ = alvo.posicao?.z ?? alvo.z;
      return { id: alvo.id, nome: alvo.nome, x: posX, z: posZ };
    });

    await page.waitForTimeout(600);

    // Fecha qualquer painel inicial
    await page.keyboard.press('Escape');

    // Abre a busca global com o atalho '/'
    await page.keyboard.press('/');
    const modalBusca = page.getByTestId('modal-busca-global');
    await expect(modalBusca).toBeVisible();

    const inputBusca = page.getByTestId('input-busca-global');
    await inputBusca.fill(projetoAlvo.nome);

    // Verifica que o tempo reportado por tecla é <= 100 ms
    const textoTempo = await page.getByTestId('tempo-busca-ms').textContent();
    const valorMs = parseFloat((textoTempo ?? '0').replace('ms', '').trim());
    expect(valorMs).toBeLessThanOrEqual(100);

    // Confirma o primeiro resultado para disparar o voo de câmera e abrir o painel da cidade
    const primeiroResultado = page.getByTestId('resultado-busca-0');
    await expect(primeiroResultado).toBeVisible();
    await primeiroResultado.click();

    // Verifica que o modal fechou e o painel do projeto alvo abriu
    await expect(modalBusca).toBeHidden();
    await expect(page.getByTestId('painel-projeto-nome')).toHaveText(projetoAlvo.nome);

    // Aguarda o voo da câmera se aproximar das coordenadas do projeto alvo
    await page.waitForTimeout(1400);
    const alvoCamera = await page.evaluate(() => {
      const mv = (
        window as unknown as {
          __MAP_VIEW__?: {
            obterEstadoCamera: () => { alvo: { x: number; z: number } };
          };
        }
      ).__MAP_VIEW__;
      return mv?.obterEstadoCamera().alvo ?? { x: 0, z: 0 };
    });

    const dist = Math.hypot(alvoCamera.x - projetoAlvo.x, alvoCamera.z - projetoAlvo.z);
    expect(dist).toBeLessThan(25);
  });
});
