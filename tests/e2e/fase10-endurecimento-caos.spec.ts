import { expect, test } from '@playwright/test';

test.describe('Fase 10 — Endurecimento, Perfil Caos, Backup File System Access API e Entrega v1.0', () => {
  test('1. Perfil Caos (Seção 7.3): carrega dados patológicos (nomes de 500 caracteres, emojis, valores zero, datas futuras e setores arquivados) sem nenhum erro e sem NaN/undefined na tela', async ({
    page,
  }) => {
    const errosConsole: string[] = [];
    const errosPagina: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errosConsole.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errosPagina.push(err.message);
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Carrega o perfil caos
    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpCaos = seedDemo('caos', 'semente-imperial-caos-v1');
      dumpCaos.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpCaos);
      useCampanhaStore.getState().selecionarProjeto(dumpCaos.projetos[0]?.id ?? null);
    });

    await page.waitForTimeout(350);

    // Percorre as 6 abas do Painel da Cidade sob o perfil caos
    await expect(page.getByTestId('painel-lateral-projeto')).toBeVisible();
    for (const abaId of [
      'aba-visao-geral',
      'aba-tarefas',
      'aba-clientes',
      'aba-financas',
      'aba-estoque',
      'aba-pd',
    ]) {
      await page.getByTestId(abaId).click();
      const textoTela = await page.evaluate(() => document.body.innerText);
      expect(textoTela).not.toContain('NaN');
      expect(textoTela).not.toContain('undefined');
    }

    // Abre Vista em Lista sob o perfil caos e confere ausência de NaN/undefined
    await page.getByTestId('botao-alternar-vista').click();
    await expect(page.getByTestId('vista-lista-projetos')).toBeVisible();
    const textoLista = await page.evaluate(() => document.body.innerText);
    expect(textoLista).not.toContain('NaN');
    expect(textoLista).not.toContain('undefined');

    // Volta ao mapa e abre a Árvore Tecnológica no perfil caos
    await page.getByTestId('botao-alternar-vista').click();
    await page.getByTestId('botao-abrir-arvore').click();
    await expect(page.getByTestId('modal-arvore-tecnologica')).toBeVisible();
    const textoArvore = await page.evaluate(() => document.body.innerText);
    expect(textoArvore).not.toContain('NaN');
    expect(textoArvore).not.toContain('undefined');
    await page.getByTestId('botao-fechar-arvore').click();

    expect(errosConsole).toEqual([]);
    expect(errosPagina).toEqual([]);
  });

  test('2. Backup em Pasta Escolhida (File System Access API), Aviso de Persistência (Seção 5.5) e Lembrete no Fechamento de Turno (Seção 6.4)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpDemo = seedDemo('pequeno', 'semente-imperial-fase10');
      dumpDemo.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpDemo);
    });

    // Registra mock da File System Access API (showDirectoryPicker) no contexto da janela
    await page.evaluate(() => {
      const w = window as unknown as {
        __ULTIMO_ARQUIVO_SALVO__?: { nome: string; conteudo: string };
        showDirectoryPicker?: () => Promise<unknown>;
      };

      w.showDirectoryPicker = async () => ({
        getFileHandle: async (nome: string) => ({
          createWritable: async () => {
            let buffer = '';
            return {
              write: async (chunk: string) => {
                buffer += chunk;
              },
              close: async () => {
                w.__ULTIMO_ARQUIVO_SALVO__ = { nome, conteudo: buffer };
              },
            };
          },
        }),
      });
    });

    // Abre Configurações -> Aba Dados
    await page.getByTestId('botao-configuracoes').click();
    await page.getByTestId('aba-editor-dados').click();

    // Verifica aviso obrigatório de persistência no navegador (Seção 5.5)
    const aviso = page.getByTestId('aviso-persistencia-navegador');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('IndexedDB');

    // Clica em "Salvar em Pasta Escolhida" (File System Access API)
    await page.getByTestId('botao-salvar-pasta-sistema').click();
    await expect(page.getByTestId('status-backup-pasta')).toContainText(
      'Pasta escolhida'
    );

    const arquivoSalvo = await page.evaluate(() => {
      const w = window as unknown as {
        __ULTIMO_ARQUIVO_SALVO__?: { nome: string; conteudo: string };
      };
      return w.__ULTIMO_ARQUIVO_SALVO__ ?? null;
    });
    expect(arquivoSalvo).not.toBeNull();
    expect(arquivoSalvo!.nome).toMatch(/^a-longa-marcha-backup-.*\.json$/);
    const jsonParseado = JSON.parse(arquivoSalvo!.conteudo) as {
      versaoEsquema: number;
      projetos: unknown[];
    };
    expect(jsonParseado.versaoEsquema).toBe(1);
    expect(jsonParseado.projetos.length).toBeGreaterThanOrEqual(10);

    // Fecha modal de configurações e abre Fechamento de Turno
    await page.keyboard.press('Escape');
    await page.getByTestId('botao-fechar-turno').click();
    await expect(page.getByTestId('modal-fechar-turno')).toBeVisible();

    await page.getByTestId('botao-confirmar-fechamento-turno').click();

    // Verifica botões de backup em destaque após o fechamento de turno
    await expect(page.getByTestId('botao-exportar-backup-turno')).toBeVisible();
    await expect(page.getByTestId('botao-salvar-pasta-turno')).toBeVisible();
  });
});
