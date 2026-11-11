import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Fase 2c — Etapa H1: Materiais, Folha de Texturas, Variação e Luz', () => {
  test('Captura as 5 vistas (Império, Setor, Cidade, Rua, Metrópole) e mede taxa de quadros e tempo de render', async ({
    page,
  }) => {
    const pastaEvidencias = path.resolve(process.cwd(), 'docs/visual/h1');
    if (!fs.existsSync(pastaEvidencias)) {
      fs.mkdirSync(pastaEvidencias, { recursive: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Carrega dados de exemplo via repositório
    const btnConfig = page.getByTestId('botao-configuracoes');
    if (await btnConfig.isVisible()) {
      await btnConfig.click();
      await page.getByTestId('aba-editor-dados').click();
      const btnCarregar = page.getByTestId('botao-carregar-dados-exemplo');
      if (await btnCarregar.isVisible()) {
        await btnCarregar.click();
      }
      await page.getByTestId('botao-fechar-editor-registros').click();
      await page.waitForTimeout(600);
    }

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // 2. Mede métricas de desempenho usando o método nativo calibrado do MapView
    const metricasDesempenho = await page.evaluate(async () => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          medirFps: (
            duracaoMs: number,
            moverCamera: boolean
          ) => Promise<{
            fpsMedio: number;
            p95TempoQuadroMs: number;
            totalInstancias: number;
            qualidadeEfetiva: string;
            drawCallsRotas: number;
          }>;
        };
      };
      return await w.__MAP_VIEW__?.medirFps(600, true);
    });

    console.log('Métricas H1 (MapView.medirFps):', JSON.stringify(metricasDesempenho, null, 2));
    expect(metricasDesempenho).toBeDefined();
    expect(metricasDesempenho!.totalInstancias).toBeGreaterThanOrEqual(10);
    expect(metricasDesempenho!.drawCallsRotas).toBeLessThanOrEqual(4);

    // 3. Captura Vista 1: Império (Visão geral de campanha)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('imperio');
    });
    await page.waitForTimeout(600);
    const arqImperio = path.join(pastaEvidencias, '01-imperio.png');
    await page.screenshot({ path: arqImperio, fullPage: true });
    expect(fs.existsSync(arqImperio)).toBe(true);

    // 4. Captura Vista 2: Setor
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('setor');
    });
    await page.waitForTimeout(600);
    const arqSetor = path.join(pastaEvidencias, '02-setor.png');
    await page.screenshot({ path: arqSetor, fullPage: true });
    expect(fs.existsSync(arqSetor)).toBe(true);

    // 5. Captura Vista 3: Cidade
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('cidade');
    });
    await page.waitForTimeout(600);
    const arqCidade = path.join(pastaEvidencias, '03-cidade.png');
    await page.screenshot({ path: arqCidade, fullPage: true });
    expect(fs.existsSync(arqCidade)).toBe(true);

    // 6. Captura Vista 4: Rua (Nível da rua com proporções)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('rua');
    });
    await page.waitForTimeout(600);
    const arqRua = path.join(pastaEvidencias, '04-rua.png');
    await page.screenshot({ path: arqRua, fullPage: true });
    expect(fs.existsSync(arqRua)).toBe(true);

    // 7. Captura Vista 5: Metrópole Central de Perto
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          voarAte: (x: number, z: number, nivel?: string) => void;
        };
      };
      w.__MAP_VIEW__?.voarAte(0, 0, 'cidade');
    });
    await page.waitForTimeout(1000);
    const arqMetropole = path.join(pastaEvidencias, '05-metropole.png');
    await page.screenshot({ path: arqMetropole, fullPage: true });
    expect(fs.existsSync(arqMetropole)).toBe(true);
  });
});
