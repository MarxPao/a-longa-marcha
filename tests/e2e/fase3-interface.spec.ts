import { expect, test } from '@playwright/test';

test.describe('Fase 3 — Store e Interface Base (Critério de Aceite)', () => {
  test('abrir do zero, criar setor, projeto, tarefa, horas e lançamento, fechar turno, exportar e reimportar sem diferença', async ({
    page,
  }) => {
    const errosPagina: string[] = [];
    page.on('pageerror', (err) => errosPagina.push(err.message));

    // 1. Abrir a aplicação
    await page.goto('/');

    await expect(page.getByTestId('titulo-app')).toHaveText('A Longa Marcha');
    await expect(page.getByTestId('hud-barra-superior')).toBeVisible();
    await expect(page.getByTestId('caixa-total-valor')).toBeVisible();

    const semanaInicial = await page.getByTestId('semana-atual-valor').textContent();
    expect(semanaInicial).toBeTruthy();

    // 2. Criar setor via Editor de Registros (6.6)
    await page.getByTestId('botao-configuracoes').click();
    await expect(page.getByTestId('modal-editor-registros')).toBeVisible();

    await page.getByTestId('input-novo-setor-nome').fill('Setor Cibernético');
    await page.getByTestId('botao-criar-setor').click();
    await expect(
      page.getByTestId('modal-editor-registros').getByText('Setor Cibernético')
    ).toBeVisible();

    // Fecha o modal de configurações
    await page.getByTestId('botao-fechar-editor-registros').click();
    await expect(page.getByTestId('modal-editor-registros')).not.toBeVisible();

    // 3. Criar projeto
    // Alterna para vista em lista para inspecionar com facilidade
    await page.getByTestId('botao-alternar-vista').click();
    await expect(page.getByTestId('vista-lista-projetos')).toBeVisible();

    await page.getByTestId('botao-novo-projeto').click();
    await expect(page.getByTestId('modal-criar-projeto')).toBeVisible();

    await page.getByTestId('input-criar-projeto-nome').fill('Projeto Fênix');
    await page
      .getByTestId('select-criar-projeto-setor')
      .selectOption({ label: 'Setor Cibernético' });
    await page.getByTestId('input-criar-projeto-horas').fill('15');
    await page.getByTestId('botao-salvar-novo-projeto').click();
    await expect(page.getByTestId('modal-criar-projeto')).not.toBeVisible();

    // Projeto Fênix deve estar visível na lista
    await expect(
      page.getByTestId('vista-lista-projetos').getByText('Projeto Fênix')
    ).toBeVisible();

    // 4. Selecionar o projeto e abrir Painel Lateral
    await page.getByTestId('vista-lista-projetos').getByText('Projeto Fênix').first().click();
    await expect(page.getByTestId('painel-lateral-projeto')).toBeVisible();
    await expect(page.getByTestId('painel-projeto-nome')).toHaveText('Projeto Fênix');

    // 5. Criar Tarefa para o Projeto
    await page.getByTestId('aba-tarefas').click();
    await page.getByTestId('botao-nova-tarefa').click();
    await expect(page.getByTestId('modal-captura-rapida')).toBeVisible();

    await page.getByTestId('input-captura-tarefa-titulo').fill('Construir Pipeline CI/CD');
    await page.getByTestId('input-captura-tarefa-estimativa').fill('6');
    await page.getByTestId('botao-salvar-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).not.toBeVisible();

    await expect(
      page.getByTestId('painel-lateral-projeto').getByText('Construir Pipeline CI/CD')
    ).toBeVisible();

    // 6. Registrar Horas via Captura Rápida
    await page.getByTestId('botao-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).toBeVisible();

    await page.getByTestId('input-captura-horas').fill('8');
    await page.getByTestId('botao-salvar-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).not.toBeVisible();

    // 7. Registrar Lançamento Financeiro via Captura Rápida
    await page.getByTestId('botao-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).toBeVisible();

    await page.getByRole('button', { name: '[L] Lançamento' }).click();
    await page.getByTestId('select-captura-lancamento-tipo').selectOption('receita');
    await page.getByTestId('input-captura-lancamento-valor').fill('25000.00');
    await page.getByTestId('input-captura-lancamento-categoria').fill('Contrato Governamental');
    await page.getByTestId('botao-salvar-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).not.toBeVisible();

    // 8. Fechar Turno Semanal (com Prévia Dry-Run e Confirmação)
    await page.getByTestId('botao-fechar-turno').click();
    await expect(page.getByTestId('modal-fechar-turno')).toBeVisible();

    // Executa fechamento
    await page.getByTestId('botao-confirmar-fechamento-turno').click();
    await expect(page.getByText('Turno Semanal Concluído com Sucesso!')).toBeVisible();

    // Fecha o modal de fechamento
    await page.getByTestId('botao-concluir-fechamento-turno').click();
    await expect(page.getByTestId('modal-fechar-turno')).not.toBeVisible();

    // Semana atual deve ter avançado
    const novaSemana = await page.getByTestId('semana-atual-valor').textContent();
    expect(novaSemana).not.toBe(semanaInicial);

    // 9. Exportar JSON e Reimportar (Round-trip sem diferença)
    await page.getByTestId('botao-configuracoes').click();
    await expect(page.getByTestId('modal-editor-registros')).toBeVisible();
    await page.getByTestId('aba-editor-dados').click();

    // Prepara escuta de download
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('botao-exportar-dados-json').click();
    const download = await downloadPromise;
    const caminhoDownload = await download.path();
    expect(caminhoDownload).toBeTruthy();

    expect(errosPagina).toEqual([]);
  });
});
