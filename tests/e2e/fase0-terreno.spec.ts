import { expect, test } from '@playwright/test';

test.describe('Fase 0 — Página de teste do terreno por semente', () => {
  test('abre a página inicial, renderiza o canvas 3D e recalcula o terreno ao trocar a semente', async ({
    page,
  }) => {
    const errosPagina: string[] = [];
    page.on('pageerror', (err) => errosPagina.push(err.message));

    await page.goto('/');

    await expect(page.getByTestId('titulo-app')).toHaveText('A Longa Marcha');
    await expect(page.getByTestId('canvas-terreno-3d')).toBeVisible();
    await expect(page.getByTestId('semente-ativa-valor')).toHaveText('longa-marcha-2026');

    const hashInicial = await page.getByTestId('hash-semente-valor').textContent();
    expect(hashInicial).toBeTruthy();

    await page.getByTestId('input-semente').fill('rio-amarelo-karst');
    await page.getByTestId('botao-gerar-terreno').click();

    await expect(page.getByTestId('semente-ativa-valor')).toHaveText('rio-amarelo-karst');
    const hashNovo = await page.getByTestId('hash-semente-valor').textContent();
    expect(hashNovo).not.toBe(hashInicial);
    expect(errosPagina).toEqual([]);
  });
});
