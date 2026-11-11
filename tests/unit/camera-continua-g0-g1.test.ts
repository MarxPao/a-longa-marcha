import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calcularDistFitMapa,
  calcularDuracaoVooSegundos,
  calcularInclinacaoSuaveCameraGraus,
  obterNivelSemanticoCamera,
} from '../../src/config/layout';

describe('G0: pipeline unico (sem demo em src/map)', () => {
  it('nenhum arquivo de src/map contem a palavra demo', () => {
    const pasta = resolve(process.cwd(), 'src/map');
    const ofensores = readdirSync(pasta)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter((f) => /demo/i.test(readFileSync(resolve(pasta, f), 'utf8')));
    expect(ofensores).toEqual([]);
  });
});

describe('G1: camera continua (funcoes puras)', () => {
  it('distFit varia com a proporcao da tela e com o raio do mundo', () => {
    const larga = calcularDistFitMapa(840, 1.78);
    const estreita = calcularDistFitMapa(840, 0.6);
    const mundoMaior = calcularDistFitMapa(1600, 1.78);
    expect(estreita).toBeGreaterThan(larga);
    expect(mundoMaior).toBeGreaterThan(larga);
  });

  it('niveis semanticos respeitam os limiares 0.45 / 0.15 / 0.04', () => {
    const fit = 1000;
    expect(obterNivelSemanticoCamera(500, fit)).toBe('imperio');
    expect(obterNivelSemanticoCamera(300, fit)).toBe('setor');
    expect(obterNivelSemanticoCamera(100, fit)).toBe('cidade');
    expect(obterNivelSemanticoCamera(30, fit)).toBe('rua');
  });

  it('inclinacao e monotona e fica entre ~32 e 70 graus', () => {
    const fit = 1000;
    let anterior = 0;
    for (const d of [20, 40, 80, 150, 300, 450, 800, 1200]) {
      const inc = calcularInclinacaoSuaveCameraGraus(d, fit);
      expect(inc).toBeGreaterThanOrEqual(31.9);
      expect(inc).toBeLessThanOrEqual(70.1);
      expect(inc).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = inc;
    }
  });

  it('duracao do voo fica entre 0.6 s e 2.2 s', () => {
    expect(calcularDuracaoVooSegundos(0)).toBe(0.6);
    expect(calcularDuracaoVooSegundos(1e9)).toBe(2.2);
    const media = calcularDuracaoVooSegundos(300);
    expect(media).toBeGreaterThan(0.6);
    expect(media).toBeLessThan(2.2);
  });
});
