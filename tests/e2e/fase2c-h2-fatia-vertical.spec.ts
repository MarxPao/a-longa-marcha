import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Fase 2c — Etapa H2: Fatia Vertical (Agricultura e Comércio)', () => {
  test('Captura as vistas de Setor, Cidade e Rua para Agricultura e Comércio e audita os 38 modelos', async ({
    page,
  }) => {
    const pastaEvidencias = path.resolve(process.cwd(), 'docs/visual/h2');
    if (!fs.existsSync(pastaEvidencias)) {
      fs.mkdirSync(pastaEvidencias, { recursive: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?debug=h2');
    await page.waitForLoadState('domcontentloaded');

    const canvas = page.locator('canvas[data-testid="canvas-fatia-vertical-h2"]');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Aguarda inicialização do visualizador
    await page.waitForFunction(() => {
      const w = window as unknown as {
        __FATIA_VERTICAL_H2__?: { totalModelos: number };
      };
      return typeof w.__FATIA_VERTICAL_H2__?.totalModelos === 'number';
    });

    // 1. Vista 1: Setor Agricultura (visão aérea do assentamento rural)
    await page.getByTestId('botao-vista-setor-agricultura').click();
    await page.waitForTimeout(600);
    const arqSetorAgri = path.join(pastaEvidencias, '01-setor-agricultura.png');
    await page.screenshot({ path: arqSetorAgri, fullPage: true });
    expect(fs.existsSync(arqSetorAgri)).toBe(true);

    // 2. Vista 2: Cidade Agricultura (visão média com moinho, celeiro e casas)
    await page.getByTestId('botao-vista-cidade-agricultura').click();
    await page.waitForTimeout(600);
    const arqCidadeAgri = path.join(pastaEvidencias, '02-cidade-agricultura.png');
    await page.screenshot({ path: arqCidadeAgri, fullPage: true });
    expect(fs.existsSync(arqCidadeAgri)).toBe(true);

    // 3. Vista 3: Rua Agricultura (visão rés do chão com beirais curvos, degraus e dougong)
    await page.getByTestId('botao-vista-rua-agricultura').click();
    await page.waitForTimeout(600);
    const arqRuaAgri = path.join(pastaEvidencias, '03-rua-agricultura.png');
    await page.screenshot({ path: arqRuaAgri, fullPage: true });
    expect(fs.existsSync(arqRuaAgri)).toBe(true);

    // 4. Vista 4: Setor Comércio (visão aérea da praça fortificada)
    await page.getByTestId('botao-vista-setor-comercio').click();
    await page.waitForTimeout(600);
    const arqSetorCom = path.join(pastaEvidencias, '04-setor-comercio.png');
    await page.screenshot({ path: arqSetorCom, fullPage: true });
    expect(fs.existsSync(arqSetorCom)).toBe(true);

    // 5. Vista 5: Cidade Comércio (visão média focando portão Han e armazéns longos)
    await page.getByTestId('botao-vista-cidade-comercio').click();
    await page.waitForTimeout(600);
    const arqCidadeCom = path.join(pastaEvidencias, '05-cidade-comercio.png');
    await page.screenshot({ path: arqCidadeCom, fullPage: true });
    expect(fs.existsSync(arqCidadeCom)).toBe(true);

    // 6. Vista 6: Rua Comércio (visão rés do chão na praça de comércio e feira)
    await page.getByTestId('botao-vista-rua-comercio').click();
    await page.waitForTimeout(600);
    const arqRuaCom = path.join(pastaEvidencias, '06-rua-comercio.png');
    await page.screenshot({ path: arqRuaCom, fullPage: true });
    expect(fs.existsSync(arqRuaCom)).toBe(true);

    // 7. Vista 7: Galeria com todos os 38 modelos alinhados
    await page.getByTestId('botao-vista-galeria-modelos').click();
    await page.waitForTimeout(800);
    const arqGaleria = path.join(pastaEvidencias, '07-galeria-38-modelos.png');
    await page.screenshot({ path: arqGaleria, fullPage: true });
    expect(fs.existsSync(arqGaleria)).toBe(true);

    // 8. Auditoria de luminância e ausência de preto nos 38 modelos (com sombras desligadas, conforme Seção 2 - Passo Zero)
    await page.goto('/?debug=h2&sombras=0');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => {
      const w = window as unknown as {
        __FATIA_VERTICAL_H2__?: { totalModelos: number };
      };
      return typeof w.__FATIA_VERTICAL_H2__?.totalModelos === 'number';
    });

    const resultadosAuditoria = await page.evaluate(() => {
      const w = window as unknown as {
        __FATIA_VERTICAL_H2__?: {
          auditarModelos: () => Array<{
            id: string;
            nome: string;
            luminanciaMedia: number;
            pctPixelsAbaixo005: number;
            aprovado: boolean;
          }>;
          totalModelos: number;
        };
      };
      return {
        total: w.__FATIA_VERTICAL_H2__?.totalModelos ?? 0,
        detalhes: w.__FATIA_VERTICAL_H2__?.auditarModelos() ?? [],
      };
    });

    console.log(`Modelos auditados em H2: ${resultadosAuditoria.total} modelos.`);
    expect(resultadosAuditoria.total).toBe(38);

    const reprovados = resultadosAuditoria.detalhes.filter((r) => !r.aprovado);
    if (reprovados.length > 0) {
      console.error('Modelos que reprovaram na luminância:', reprovados);
    }
    expect(reprovados).toHaveLength(0);
  });
});
