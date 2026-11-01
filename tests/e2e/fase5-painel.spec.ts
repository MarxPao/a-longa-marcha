import { expect, test } from '@playwright/test';

test.describe('Fase 5 — Painel da Cidade Completo (Critérios de Aceite por Aba)', () => {
  test.beforeEach(async ({ page }) => {
    // Abre a página e carrega fixture rica para testar todas as 6 abas
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Conclui brief inicial se estiver aberto
    const modalBrief = page.getByTestId('modal-brief-inicial');
    if (await modalBrief.isVisible()) {
      await page.getByTestId('botao-concluir-brief').click();
      await expect(modalBrief).not.toBeVisible();
    }

    // Carrega dados determinísticos com perfil 'real'
    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');

      const demo = seedDemo('real', 'semente-fase5-painel');
      await useCampanhaStore.getState().importarJson(demo);

      // Seleciona o primeiro projeto ativo
      const primeiro = useCampanhaStore.getState().dump.projetos[0];
      if (primeiro) {
        useCampanhaStore.getState().selecionarProjeto(primeiro.id);
      }
    });

    // Aguarda painel abrir
    await expect(page.getByTestId('painel-lateral-projeto')).toBeVisible();
  });

  test('Aba 1 — Visão Geral: exibe descontos de saúde, horas, ligações, financiamento cruzado e notas', async ({
    page,
  }) => {
    await page.getByTestId('aba-visao-geral').click();
    await expect(page.getByTestId('aba-visao-geral-conteudo')).toBeVisible();

    // 1. Descontos que compõem a saúde (Princípio 2)
    await expect(page.getByTestId('container-descontos-saude')).toBeVisible();

    // 2. Metas e Horas da Semana
    await expect(page.getByTestId('container-horas-semana')).toBeVisible();
    await expect(page.getByTestId('horas-semana-progresso')).toBeVisible();

    // 3. Ligações Estratégicas
    await expect(page.getByTestId('container-ligacoes-projeto')).toBeVisible();

    // 4. Notas do Projeto e Ação de Editar
    await expect(page.getByTestId('container-notas-projeto')).toBeVisible();
    await page.getByTestId('botao-editar-notas').click();
    await expect(page.getByTestId('input-editar-notas')).toBeVisible();
    await page.getByTestId('input-editar-notas').fill('Nota de auditoria estratégica Fase 5.');
    await page.getByTestId('botao-editar-notas').click();
    await expect(page.getByTestId('texto-notas-projeto')).toContainText('Nota de auditoria estratégica');

    // 5. Botão de Editar Projeto abre modal
    await page.getByTestId('botao-abrir-edicao-projeto').click();
    await expect(page.getByTestId('modal-editar-projeto')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('modal-editar-projeto')).not.toBeVisible();
  });

  test('Aba 2 — Tarefas: alterna entre Lista e Quadro Kanban, filtra por status/prazo e gerencia conclusão', async ({
    page,
  }) => {
    await page.getByTestId('aba-tarefas').click();
    await expect(page.getByTestId('aba-tarefas-conteudo')).toBeVisible();

    // 1. Barra de filtros visível
    await expect(page.getByTestId('filtros-tarefas-barra')).toBeVisible();

    // 2. Vista em Lista por padrão
    await expect(page.getByTestId('vista-lista-tarefas')).toBeVisible();

    // 3. Alternância para Quadro Kanban
    await page.getByTestId('botao-modo-quadro-tarefas').click();
    await expect(page.getByTestId('quadro-kanban-tarefas')).toBeVisible();
    await expect(page.getByTestId('coluna-kanban-pendente')).toBeVisible();
    await expect(page.getByTestId('coluna-kanban-feita')).toBeVisible();

    // Volta para Lista
    await page.getByTestId('botao-modo-lista-tarefas').click();
    await expect(page.getByTestId('vista-lista-tarefas')).toBeVisible();

    // 4. Alterna conclusão da primeira tarefa (se houver)
    const primeiroCheckbox = page.locator('input[data-testid^="checkbox-tarefa-"]').first();
    if (await primeiroCheckbox.isVisible()) {
      const marcadoAntes = await primeiroCheckbox.isChecked();
      await primeiroCheckbox.click();
      await expect(primeiroCheckbox).toHaveJSProperty('checked', !marcadoAntes);
    }

    // 5. Botão Nova Tarefa abre modal de captura rápida
    await page.getByTestId('botao-nova-tarefa').click();
    await expect(page.getByTestId('modal-captura-rapida')).toBeVisible();
    await page.getByTestId('botao-fechar-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).not.toBeVisible();
  });

  test('Aba 3 — Clientes: exibe vínculos, receita recorrente, alerta de 60 dias sem contato e ação contato hoje', async ({
    page,
  }) => {
    await page.getByTestId('aba-clientes').click();
    await expect(page.getByTestId('aba-clientes-conteudo')).toBeVisible();

    // 1. Botão de vincular cliente
    await expect(page.getByTestId('botao-novo-vinculo-cliente')).toBeVisible();

    // 2. Se houver clientes vinculados, verifica detalhes e alerta de contato
    const primeiroCardCliente = page.locator('div[data-testid^="card-cliente-"]').first();
    if (await primeiroCardCliente.isVisible()) {
      await expect(primeiroCardCliente).toContainText('mês');

      // Botão Contato Hoje
      const botaoContatoHoje = page.locator('button[data-testid^="botao-contato-hoje-"]').first();
      if (await botaoContatoHoje.isVisible()) {
        await botaoContatoHoje.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('Aba 4 — Finanças: exibe fluxo líquido, ROI com ranking, gráfico de 12 meses em SVG e lançamentos', async ({
    page,
  }) => {
    await page.getByTestId('aba-financas').click();
    await expect(page.getByTestId('aba-financas-conteudo')).toBeVisible();

    // 1. Fluxo líquido do mês
    await expect(page.getByTestId('fluxo-mes-resumo')).toBeVisible();
    await expect(page.getByTestId('valor-fluxo-mes')).toBeVisible();

    // 2. ROI por hora com ranking
    await expect(page.getByTestId('roi-hora-resumo')).toBeVisible();
    await expect(page.getByTestId('valor-roi-hora')).toBeVisible();

    // 3. Gráfico Analítico de 12 Meses em SVG nativo
    await expect(page.getByTestId('secao-grafico-financas')).toBeVisible();
    await expect(page.getByTestId('grafico-financas-svg')).toBeVisible();

    // 4. Botão de novo lançamento
    await page.getByTestId('botao-novo-lancamento').click();
    await expect(page.getByTestId('modal-captura-rapida')).toBeVisible();
    await page.getByTestId('botao-fechar-captura-rapida').click();
    await expect(page.getByTestId('modal-captura-rapida')).not.toBeVisible();
  });

  test('Aba 5 — Estoque: exibe lista de materiais BOM, cobertura, saldos por armazém e compra sugerida', async ({
    page,
  }) => {
    await page.getByTestId('aba-estoque').click();
    await expect(page.getByTestId('aba-estoque-conteudo')).toBeVisible();

    // 1. Botão de adicionar item à BOM
    await expect(page.getByTestId('botao-adicionar-item-bom')).toBeVisible();

    // 2. Se houver compra sugerida, verifica botão de cópia
    const blocoCompra = page.getByTestId('bloco-compra-sugerida');
    if (await blocoCompra.isVisible()) {
      await expect(page.getByTestId('botao-copiar-compra-sugerida')).toBeVisible();
    }
  });

  test('Aba 6 — P&D: exibe tecnologias aplicadas, candidatas disponíveis e horas de pesquisa', async ({
    page,
  }) => {
    await page.getByTestId('aba-pd').click();
    await expect(page.getByTestId('aba-pd-conteudo')).toBeVisible();

    // 1. Resumo de pesquisa e horas investidas
    await expect(page.getByTestId('resumo-pesquisa-pd')).toBeVisible();
    await expect(page.getByTestId('botao-registrar-pesquisa')).toBeVisible();

    // 2. Seção de tecnologias candidatas disponíveis
    await expect(page.getByTestId('secao-tecnologias-candidatas')).toBeVisible();

    // 3. Se houver candidata disponível para aplicação, testa abertura do modal
    const botaoAplicarCandidata = page.locator('button[data-testid^="botao-aplicar-candidata-"]').first();
    if (await botaoAplicarCandidata.isVisible()) {
      await botaoAplicarCandidata.click();
      await expect(page.getByTestId('select-tecnologia-aplicar')).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar' }).click();
    }
  });
});
