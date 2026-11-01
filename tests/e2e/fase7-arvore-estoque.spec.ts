import { expect, test } from '@playwright/test';

test.describe('Fase 7 — Árvore Tecnológica e Estoque Completo', () => {
  test('1. Árvore Tecnológica: fios dourados, bloqueio de ciclos, pré-requisitos, ranking e luz azul P&D no mapa', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpFixo = seedDemo('pequeno', 'semente-imperial-fase7');
      dumpFixo.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpFixo);
    });

    await page.waitForTimeout(300);

    // Conta luzes azuis P&D iniciais no mapa
    const luzesIniciais = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: { obterTotalLuzesPdAtivas: () => number };
      };
      return w.__MAP_VIEW__?.obterTotalLuzesPdAtivas() ?? 0;
    });

    // Abre a Árvore Tecnológica pela tecla G
    await page.keyboard.press('g');
    const modalArvore = page.getByTestId('modal-arvore-tecnologica');
    await expect(modalArvore).toBeVisible();

    // Verifica seção "O Que Pesquisar Primeiro"
    const secaoRanking = page.getByTestId('secao-ranking-pesquisa');
    await expect(secaoRanking).toBeVisible();

    // Cria duas novas tecnologias: Tech Base Alfa e Tech Avançada Beta
    await page.getByTestId('input-nome-nova-tech').fill('Tech Base Alfa');
    await page.getByTestId('input-horas-nova-tech').fill('15');
    await page.getByTestId('botao-criar-tecnologia').click();
    await expect(page.getByTestId('alerta-sucesso-arvore')).toContainText(
      'Tech Base Alfa'
    );

    await page.getByTestId('input-nome-nova-tech').fill('Tech Avançada Beta');
    await page.getByTestId('input-horas-nova-tech').fill('30');
    await page.getByTestId('botao-criar-tecnologia').click();
    await expect(page.getByTestId('alerta-sucesso-arvore')).toContainText(
      'Tech Avançada Beta'
    );

    // Vincula Tech Avançada Beta dependendo de Tech Base Alfa
    await page
      .getByTestId('select-tech-dependente')
      .selectOption({ label: 'Tech Avançada Beta' });
    await page
      .getByTestId('select-tech-prerequisito')
      .selectOption({ label: 'Tech Base Alfa' });
    await page.getByTestId('botao-vincular-prerequisito').click();
    await expect(page.getByTestId('alerta-sucesso-arvore')).toContainText(
      'Fio dourado de pré-requisito conectado'
    );

    // Verifica que o SVG de fios dourados possui pelo menos um path renderizado
    const totalFios = await page
      .getByTestId('svg-fios-arvore')
      .locator('path[data-testid^="fio-dourado-"]')
      .count();
    expect(totalFios).toBeGreaterThanOrEqual(1);

    // Tenta criar ciclo: fazer Tech Base Alfa depender de Tech Avançada Beta
    await page
      .getByTestId('select-tech-dependente')
      .selectOption({ label: 'Tech Base Alfa' });
    await page
      .getByTestId('select-tech-prerequisito')
      .selectOption({ label: 'Tech Avançada Beta' });
    await page.getByTestId('botao-vincular-prerequisito').click();

    const alertaErro = page.getByTestId('alerta-erro-arvore');
    await expect(alertaErro).toBeVisible();
    await expect(alertaErro).toContainText('Ciclo detectado');

    // Obtém os IDs das tecnologias criadas a partir dos selects
    const idAlfa = await page
      .getByTestId('select-tech-prerequisito')
      .locator('option', { hasText: 'Tech Base Alfa' })
      .getAttribute('value');
    const idBeta = await page
      .getByTestId('select-tech-dependente')
      .locator('option', { hasText: 'Tech Avançada Beta' })
      .getAttribute('value');
    expect(idAlfa).toBeTruthy();
    expect(idBeta).toBeTruthy();

    // Tenta colocar Tech Avançada Beta em "Pesquisando" enquanto Tech Base Alfa ainda é "ideia" -> deve bloquear!
    await page.getByTestId(`botao-pesquisar-${idBeta}`).click();
    await expect(alertaErro).toBeVisible();
    await expect(alertaErro).toContainText('Tech Base Alfa');

    // Agora domina Tech Base Alfa -> libera Tech Avançada Beta
    await page.getByTestId(`botao-dominar-${idAlfa}`).click();
    await expect(page.getByTestId(`estado-tech-${idAlfa}`)).toHaveText('dominada');

    // Agora Tech Avançada Beta pode ir para "pesquisando" e depois "dominada"
    await page.getByTestId(`botao-pesquisar-${idBeta}`).click();
    await expect(page.getByTestId(`estado-tech-${idBeta}`)).toHaveText('pesquisando');

    await page.getByTestId(`botao-dominar-${idBeta}`).click();
    await expect(page.getByTestId(`estado-tech-${idBeta}`)).toHaveText('dominada');

    // Aplica Tech Avançada Beta a uma cidade que ainda não tinha tecnologia aplicada
    const opcoesProjeto = page
      .getByTestId('select-aplicar-projeto')
      .locator('option');
    const totalOpcoesProj = await opcoesProjeto.count();
    expect(totalOpcoesProj).toBeGreaterThan(1);

    await page.getByTestId('select-aplicar-tech').selectOption(idBeta!);
    // Seleciona a última cidade da lista para garantir nova luz P&D
    const ultimoProjVal = await opcoesProjeto
      .nth(totalOpcoesProj - 1)
      .getAttribute('value');
    await page.getByTestId('select-aplicar-projeto').selectOption(ultimoProjVal!);
    await page.getByTestId('botao-aplicar-tech-arvore').click();

    await expect(page.getByTestId('alerta-sucesso-arvore')).toContainText(
      'aplicada à cidade com sucesso'
    );

    // Verifica que o mapa 3D atualizou as luzes azuis P&D nas cidades
    const luzesFinais = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: { obterTotalLuzesPdAtivas: () => number };
      };
      return w.__MAP_VIEW__?.obterTotalLuzesPdAtivas() ?? 0;
    });
    expect(luzesFinais).toBeGreaterThanOrEqual(1);
    expect(luzesFinais).toBeGreaterThanOrEqual(luzesIniciais);

    await page.getByTestId('botao-fechar-arvore').click();
    await expect(modalArvore).toBeHidden();
  });

  test('2. Estoque Completo: Fornecedor, Armazém, Item, BOM em falta, Compra Sugerida, Entrada cobrindo BOM e bloqueio de saldo negativo', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpFixo = seedDemo('pequeno', 'semente-imperial-fase7');
      dumpFixo.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpFixo);
    });

    await page.waitForTimeout(300);

    // Abre o modal de Estoque Global
    await page.getByTestId('botao-abrir-estoque').click();
    const modalEstoque = page.getByTestId('modal-estoque-global');
    await expect(modalEstoque).toBeVisible();

    // Vai para a aba de Cadastros (Fornecedores, Armazéns e Itens)
    await page.getByTestId('aba-estoque-cadastros').click();

    // 1. Cadastra Fornecedor
    await page.getByTestId('input-nome-fornecedor').fill('Fundição Imperial Han');
    await page.getByTestId('input-contato-fornecedor').fill('han@fundicao.imp');
    await page.getByTestId('input-prazo-fornecedor').fill('5');
    await page.getByTestId('botao-criar-fornecedor').click();
    await expect(page.getByTestId('alerta-sucesso-estoque')).toContainText(
      'Fundição Imperial Han'
    );

    // 2. Cadastra Armazém
    await page.getByTestId('input-nome-armazem').fill('Depósito Norte');
    await page.getByTestId('input-local-armazem').fill('Fronteira Setentrional');
    await page.getByTestId('botao-criar-armazem').click();
    await expect(page.getByTestId('alerta-sucesso-estoque')).toContainText(
      'Depósito Norte'
    );

    // 3. Cadastra Item vinculado ao fornecedor
    await page.getByTestId('input-nome-item').fill('Lingote de Aço Damasco');
    await page.getByTestId('input-unidade-item').fill('kg');
    await page.getByTestId('input-custo-item').fill('120');
    await page.getByTestId('input-minimo-item').fill('10');
    await page
      .getByTestId('select-fornecedor-item')
      .selectOption({ label: 'Fundição Imperial Han' });
    await page.getByTestId('botao-criar-item').click();
    await expect(page.getByTestId('alerta-sucesso-estoque')).toContainText(
      'Lingote de Aço Damasco'
    );

    // 4. Vai para a aba BOM & Compra Sugerida
    await page.getByTestId('aba-estoque-bom').click();

    const idItemCriado = await page
      .getByTestId('select-bom-item')
      .locator('option', { hasText: 'Lingote de Aço Damasco' })
      .getAttribute('value');
    expect(idItemCriado).toBeTruthy();

    // Adiciona necessidade de 25 kg na BOM de uma cidade
    await page.getByTestId('select-bom-item').selectOption(idItemCriado!);
    await page.getByTestId('input-bom-quantidade').fill('25');
    await page.getByTestId('botao-adicionar-bom-global').click();

    // Verifica que aparece em Compra Sugerida com fornecedor Fundição Imperial Han e 25 kg
    const cardCompra = page.getByTestId(`compra-sugerida-item-${idItemCriado}`);
    await expect(cardCompra).toBeVisible();
    await expect(cardCompra).toContainText('Comprar 25 kg de Lingote de Aço Damasco');
    await expect(cardCompra).toContainText('Fundição Imperial Han (5d)');

    // 5. Vai para a aba Saldos & Movimentos
    await page.getByTestId('aba-estoque-saldos').click();

    const idArmazemCriado = await page
      .getByTestId('select-movimento-armazem')
      .locator('option', { hasText: 'Depósito Norte (Fronteira Setentrional)' })
      .getAttribute('value');
    expect(idArmazemCriado).toBeTruthy();

    // Tenta dar saída de 5 kg com saldo 0 -> deve bloquear saldo negativo!
    await page.getByTestId('select-movimento-item').selectOption(idItemCriado!);
    await page.getByTestId('select-movimento-armazem').selectOption(idArmazemCriado!);
    await page.getByTestId('select-movimento-tipo').selectOption('saida');
    await page.getByTestId('input-movimento-quantidade').fill('5');
    await page.getByTestId('botao-registrar-movimento').click();

    const alertaErroEstoque = page.getByTestId('alerta-erro-estoque');
    await expect(alertaErroEstoque).toBeVisible();
    await expect(alertaErroEstoque).toContainText('Saldo insuficiente');

    // Registra entrada de 30 kg -> cobre a BOM (25 kg) e o estoque mínimo (10 kg)
    await page.getByTestId('select-movimento-tipo').selectOption('entrada');
    await page.getByTestId('input-movimento-quantidade').fill('30');
    await page.getByTestId('botao-registrar-movimento').click();

    await expect(page.getByTestId('alerta-sucesso-estoque')).toContainText(
      'Movimento (entrada: 30) registrado'
    );
    await expect(page.getByTestId(`valor-saldo-item-${idItemCriado}`)).toContainText(
      '30 kg'
    );

    // Volta na aba BOM & Compra Sugerida e confirma que o item saiu da lista de compra sugerida e a BOM está coberta
    await page.getByTestId('aba-estoque-bom').click();
    await expect(cardCompra).toBeHidden();
    await expect(page.getByTestId('secao-compra-sugerida-global')).not.toContainText(
      'Lingote de Aço Damasco'
    );
  });
});
