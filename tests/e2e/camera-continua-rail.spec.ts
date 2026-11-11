import { expect, test } from '@playwright/test';

test.describe('Câmera Rail Contínua e Níveis Semânticos (Fase 2b — Seção 3)', () => {
  test('Transita continuamente pelos 4 níveis semânticos: Império, Setor, Cidade e Rua', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Carrega dados de exemplo para povoar o império
    await page.getByTestId('botao-configuracoes').click();
    await page.getByTestId('aba-editor-dados').click();
    await page.getByTestId('botao-carregar-dados-exemplo').click();
    await page.getByTestId('botao-fechar-editor-registros').click();
    await page.waitForTimeout(400);

    const hudEscala = page.getByTestId('hud-escala-camera');
    await expect(hudEscala).toBeVisible();

    // 1. Nível Império (d / distFit >= 0.45)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('imperio');
    });
    await expect(hudEscala).toHaveAttribute('data-nivel', 'imperio');
    await expect(hudEscala).toContainText('Império');

    // 2. Nível Setor (0.15 <= d / distFit < 0.45)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('setor');
    });
    await expect(hudEscala).toHaveAttribute('data-nivel', 'setor');
    await expect(hudEscala).toContainText('Setor');

    // 3. Nível Cidade e Bairro (0.04 <= d / distFit < 0.15)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('cidade');
    });
    await expect(hudEscala).toHaveAttribute('data-nivel', 'cidade');
    await expect(hudEscala).toContainText('Cidade');

    // 4. Nível Rua (d / distFit < 0.04)
    await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          definirNivelZoom: (nivel: string) => void;
        };
      };
      w.__MAP_VIEW__?.definirNivelZoom('rua');
    });
    await expect(hudEscala).toHaveAttribute('data-nivel', 'rua');
    await expect(hudEscala).toContainText('Rua');

    // 5. Teste do botão "Ir à metrópole" e vôo suave contínuo
    const botaoMetropole = page.getByTestId('botao-focar-metropole-central');
    await expect(botaoMetropole).toBeVisible();
    await botaoMetropole.click();

    // Aguarda o vôo logarítmico convergir para a metrópole
    await page.waitForTimeout(1400);
    const poseFinal = await page.evaluate(() => {
      const w = window as unknown as {
        __MAP_VIEW__?: {
          obterEstadoCamera: () => {
            alvo: { x: number; z: number };
            distancia: number;
            nivelSemantico: string;
          };
        };
      };
      return (
        w.__MAP_VIEW__?.obterEstadoCamera() ?? {
          alvo: { x: 999, z: 999 },
          distancia: 0,
          nivelSemantico: '',
        }
      );
    });

    expect(Math.abs(poseFinal.alvo.x)).toBeLessThan(10);
    expect(Math.abs(poseFinal.alvo.z)).toBeLessThan(10);
  });
});
