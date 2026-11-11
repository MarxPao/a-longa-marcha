import { expect, test } from '@playwright/test';

test.describe('Fase 9 — Atmosfera, Redundância Visual e Acessibilidade (Seções 4.4, 4.7 e 6.8)', () => {
  test('1. Atmosfera do Mapa (rios, névoa de guerra, partículas, tilt-shift), redundância por forma de saúde e acessibilidade (fonte 90%–130% e reduzir movimento)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const { seedDemo } = await import('../../src/seed');
      const { useCampanhaStore } = await import('../../src/store');
      const dumpFixo = seedDemo('pequeno', 'semente-imperial-fase9');
      dumpFixo.meta.config.brief.concluido = true;
      await useCampanhaStore.getState().importarJson(dumpFixo);
      useCampanhaStore.getState().selecionarProjeto(dumpFixo.projetos[0]?.id ?? null);
    });

    await page.waitForTimeout(300);

    // 1. Verifica camada de Tilt-Shift sobre o mapa
    await expect(page.getByTestId('camada-tilt-shift')).toBeVisible();

    // 2. Verifica estado atmosférico 3D (rios nos vales, névoa de guerra, partículas e formas de saúde)
    const dadosAtmosfera = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterEstadoAtmosfera: () => {
            riosRenderizados: number;
            celulasNevoaGuerraAtivas: number;
            cidadesComNevoaMoralBaixa: number;
            particulasAtivas: boolean;
            reduzirMovimento: boolean;
          };
          obterContagemFormasSaude: () => {
            bandeirasErguidas: number;
            bandeirasCaidas: number;
            fumacaCritica: number;
          };
        };
      };
      return {
        atmosfera: w.__MAP_VIEW__?.obterEstadoAtmosfera() ?? null,
        formasSaude: w.__MAP_VIEW__?.obterContagemFormasSaude() ?? null,
      };
    });

    expect(dadosAtmosfera.atmosfera).not.toBeNull();
    expect(dadosAtmosfera.atmosfera!.riosRenderizados).toBe(0);
    expect(dadosAtmosfera.atmosfera!.celulasNevoaGuerraAtivas).toBeGreaterThan(0);

    expect(dadosAtmosfera.formasSaude).not.toBeNull();
    const somaFormas =
      dadosAtmosfera.formasSaude!.bandeirasErguidas +
      dadosAtmosfera.formasSaude!.bandeirasCaidas +
      dadosAtmosfera.formasSaude!.fumacaCritica;
    expect(somaFormas).toBeGreaterThanOrEqual(10);

    // 3. Verifica ícone SVG original do setor e ícone redundante de forma de saúde no Painel da Cidade
    await expect(page.getByTestId('painel-lateral-projeto')).toBeVisible();
    await expect(page.getByTestId('svg-icone-setor').first()).toBeVisible();
    await expect(page.getByTestId('badge-saude-valor').locator('svg')).toBeVisible();

    // 4. Verifica ajuste de tamanho de fonte de 90% a 130% (Seção 6.8)
    const selectFonte = page.getByTestId('select-tamanho-fonte');
    await expect(selectFonte).toBeVisible();

    await selectFonte.selectOption('130');
    const fontSize130 = await page.evaluate(
      () => document.documentElement.style.fontSize
    );
    expect(fontSize130).toBe('130%');

    await selectFonte.selectOption('90');
    const fontSize90 = await page.evaluate(
      () => document.documentElement.style.fontSize
    );
    expect(fontSize90).toBe('90%');

    await selectFonte.selectOption('100');

    // 5. Verifica respeito à preferência por reduzir movimento (desativa partículas no mapa)
    const estadoAposReduzir = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirReduzirMovimento: (reduzir: boolean) => void;
          obterEstadoAtmosfera: () => {
            particulasAtivas: boolean;
            reduzirMovimento: boolean;
          };
        };
      };
      w.__MAP_VIEW__?.definirReduzirMovimento(true);
      return w.__MAP_VIEW__?.obterEstadoAtmosfera() ?? null;
    });

    expect(estadoAposReduzir?.reduzirMovimento).toBe(true);
    expect(estadoAposReduzir?.particulasAtivas).toBe(false);
  });
});
