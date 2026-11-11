import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  criarCasaTaipaPalha,
  criarCeleiroElevado,
  criarMoinhoAgua,
  criarArmazemLongo,
  criarPorticoComercial,
  criarBarracaMercado,
  criarMuralhaModular,
  criarPortaoModular,
  criarEdificioModularProcedural,
} from '../../src/map/arquiteturaModular';

describe('Kit de Arquitetura Modular — Agricultura e Comércio (Fase 2c — Etapa H2)', () => {
  const tiposAgricultura = [
    { nome: 'casa_taipa_palha', fn: criarCasaTaipaPalha },
    { nome: 'celeiro_elevado', fn: criarCeleiroElevado },
    { nome: 'moinho_agua', fn: criarMoinhoAgua },
  ];

  const tiposComercio = [
    { nome: 'armazem_longo', fn: criarArmazemLongo },
    { nome: 'portico_comercial', fn: criarPorticoComercial },
    { nome: 'barraca_mercado', fn: criarBarracaMercado },
  ];

  for (const { nome, fn } of [...tiposAgricultura, ...tiposComercio]) {
    it(`gera 6 variantes distintas para o tipo "${nome}" com atributos de cor válidos e sem NaNs`, () => {
      const contagensVertices: number[] = [];

      for (let v = 0; v < 6; v++) {
        const geo = fn(v);
        expect(geo).toBeInstanceOf(THREE.BufferGeometry);

        const pos = geo.getAttribute('position');
        const norm = geo.getAttribute('normal');
        const cor = geo.getAttribute('color');

        expect(pos).toBeDefined();
        expect(norm).toBeDefined();
        expect(cor).toBeDefined();
        expect(pos.count).toBeGreaterThan(24);

        contagensVertices.push(pos.count);

        // Verifica ausência de NaNs e respeito ao albedo mínimo #2A2420
        for (let i = 0; i < pos.count; i++) {
          expect(Number.isNaN(pos.getX(i))).toBe(false);
          expect(Number.isNaN(pos.getY(i))).toBe(false);
          expect(Number.isNaN(pos.getZ(i))).toBe(false);

          const r = cor.getX(i);
          const g = cor.getY(i);
          const b = cor.getZ(i);

          expect(r).toBeGreaterThanOrEqual(0.165);
          expect(g).toBeGreaterThanOrEqual(0.141);
          expect(b).toBeGreaterThanOrEqual(0.125);
        }
      }

      // Garante que há variação geométrica real entre as variantes
      const variantesUnicas = new Set(contagensVertices);
      expect(variantesUnicas.size).toBeGreaterThanOrEqual(2);
    });
  }

  it('gera segmento de muralha fortificada com ameias e contrafortes de cantaria', () => {
    const muralha = criarMuralhaModular();
    expect(muralha).toBeInstanceOf(THREE.BufferGeometry);

    const pos = muralha.getAttribute('position');
    const cor = muralha.getAttribute('color');
    expect(pos.count).toBeGreaterThan(40);

    for (let i = 0; i < pos.count; i++) {
      expect(cor.getX(i)).toBeGreaterThanOrEqual(0.165);
    }
  });

  it('gera portão fortificado Han monumental com torres de flanco e pavilhão superior', () => {
    const portao = criarPortaoModular();
    expect(portao).toBeInstanceOf(THREE.BufferGeometry);

    const pos = portao.getAttribute('position');
    const cor = portao.getAttribute('color');
    expect(pos.count).toBeGreaterThan(60);

    for (let i = 0; i < pos.count; i++) {
      expect(cor.getX(i)).toBeGreaterThanOrEqual(0.165);
    }
  });

  it('permite criação via roteador unificado criarEdificioModularProcedural', () => {
    const casa = criarEdificioModularProcedural('agricultura', 2);
    const armazem = criarEdificioModularProcedural('comercio', 1);
    const moinho = criarEdificioModularProcedural('moinho_agua', 0);
    const muralha = criarEdificioModularProcedural('muralha');
    const portao = criarEdificioModularProcedural('portao');

    expect(casa.getAttribute('position').count).toBeGreaterThan(0);
    expect(armazem.getAttribute('position').count).toBeGreaterThan(0);
    expect(moinho.getAttribute('position').count).toBeGreaterThan(0);
    expect(muralha.getAttribute('position').count).toBeGreaterThan(0);
    expect(portao.getAttribute('position').count).toBeGreaterThan(0);
  });
});
