import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Auditoria de Luminância e Fim do Preto nos Materiais (Fase 2c - R5)', () => {
  test('Página ?debug=materials&sombras=0: nenhum modelo com luminância < 0.25 ou > 2% pixels pretos', async ({
    page,
  }) => {
    // Garante que o diretório de evidências visuais exista
    const pastaEvidencias = path.resolve(process.cwd(), 'docs/visual/h0');
    if (!fs.existsSync(pastaEvidencias)) {
      fs.mkdirSync(pastaEvidencias, { recursive: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?debug=materials&sombras=0');

    // Aguarda o canvas da cena de depuração
    const canvasDebug = page.locator('canvas[data-testid="canvas-debug-materials"]');
    await expect(canvasDebug).toBeVisible({ timeout: 10000 });

    // Aguarda inicialização completa da API de depuração
    await page.waitForFunction(() => {
      const w = window as unknown as {
        __DEBUG_MATERIALS__?: {
          obterStatus: () => { pronto: boolean; totalItens: number };
          auditarLuminancia: () => unknown[];
        };
      };
      return w.__DEBUG_MATERIALS__?.obterStatus().pronto === true;
    }, { timeout: 10000 });

    // Aguarda 1 segundo para renderização estável de frames
    await page.waitForTimeout(1000);

    // Executa auditoria de luminância nas silhuetas dos modelos
    const resultados = await page.evaluate(() => {
      const w = window as unknown as {
        __DEBUG_MATERIALS__: {
          auditarLuminancia: () => Array<{
            id: string;
            nome: string;
            luminanciaMedia: number;
            pctPixelsAbaixo005: number;
            aprovado: boolean;
          }>;
        };
      };
      return w.__DEBUG_MATERIALS__.auditarLuminancia();
    });

    console.log('Resultados da auditoria de luminância:', JSON.stringify(resultados, null, 2));

    expect(resultados.length).toBeGreaterThanOrEqual(10);

    // Validação estrita por modelo: nenhum pixel preto por falta de atributo de cor ou albedo zerado
    for (const res of resultados) {
      expect(
        res.luminanciaMedia,
        `Modelo "${res.nome}" (${res.id}) tem luminância média abaixo de 0.25: ${res.luminanciaMedia}`
      ).toBeGreaterThanOrEqual(0.25);

      expect(
        res.pctPixelsAbaixo005,
        `Modelo "${res.nome}" (${res.id}) tem mais de 2% de pixels pretos (<0.05): ${(res.pctPixelsAbaixo005 * 100).toFixed(1)}%`
      ).toBeLessThanOrEqual(0.02);

      expect(res.aprovado).toBe(true);
    }

    // Captura da página de materiais para revisão do usuário
    const caminhoDebugScreenshot = path.join(pastaEvidencias, 'debug-materials-h0.png');
    await page.screenshot({ path: caminhoDebugScreenshot, fullPage: true });
    expect(fs.existsSync(caminhoDebugScreenshot)).toBe(true);
  });

  test('Captura da cidade com novos materiais no mapa de campanha', async ({ page }) => {
    const pastaEvidencias = path.resolve(process.cwd(), 'docs/visual/h0');
    if (!fs.existsSync(pastaEvidencias)) {
      fs.mkdirSync(pastaEvidencias, { recursive: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Carrega dados de exemplo para povoar as cidades
    const btnConfig = page.getByTestId('botao-configuracoes');
    if (await btnConfig.isVisible()) {
      await btnConfig.click();
      await page.getByTestId('aba-editor-dados').click();
      await page.getByTestId('botao-carregar-dados-exemplo').click();
      await page.getByTestId('botao-fechar-editor-registros').click();
      await page.waitForTimeout(600);
    }

    // Foca a câmera em nível cidade para visualização nítida
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('cidade');
    });

    await page.waitForTimeout(1000);

    // Captura da cidade no mapa
    const caminhoCidadeScreenshot = path.join(pastaEvidencias, 'cidade-h0.png');
    await page.screenshot({ path: caminhoCidadeScreenshot, fullPage: true });
    expect(fs.existsSync(caminhoCidadeScreenshot)).toBe(true);
  });
});
