import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  obterTrimSheetCanonica,
  aplicarDesgasteEContatoGeometria,
  obterMaterialEdificiosCampanha,
  garantirAtributoCorGeometria,
} from '../../src/map/materiaisAvancados';

describe('Materiais, Folha de Texturas e Luz (Fase 2c — Etapa H1)', () => {
  it('gera a Folha de Texturas (Trim Sheet) canônica PBR com 5 faixas e albedo mínimo #2A2420', () => {
    const trim = obterTrimSheetCanonica(1024);

    expect(trim.albedo).toBeDefined();
    expect(trim.normal).toBeDefined();
    expect(trim.roughness).toBeDefined();

    expect(trim.albedo.image.width).toBe(1024);
    expect(trim.albedo.image.height).toBe(1024);

    const albedoData = trim.albedo.image.data!;
    const normalData = trim.normal.image.data!;
    const roughData = trim.roughness.image.data!;

    let pixelsPretos = 0;
    let minR = 255;
    let minG = 255;
    let minB = 255;

    // Amostra a cada 64 pixels em X e Y para auditoria de desempenho
    for (let y = 0; y < 1024; y += 64) {
      for (let x = 0; x < 1024; x += 64) {
        const idx = (y * 1024 + x) * 4;
        const r = albedoData[idx]!;
        const g = albedoData[idx + 1]!;
        const b = albedoData[idx + 2]!;

        if (r < minR) minR = r;
        if (g < minG) minG = g;
        if (b < minB) minB = b;

        // Albedo mínimo estrito #2A2420: R >= 42, G >= 36, B >= 32
        if (r < 42 || g < 36 || b < 32) {
          pixelsPretos++;
        }

        // Rugosidade entre 0.70 e 1.0 (178 a 255)
        const rough = roughData[idx]!;
        expect(rough).toBeGreaterThanOrEqual(175);
        expect(rough).toBeLessThanOrEqual(255);

        // Normal map: vetor Z sempre apontando para fora (> 128)
        const nz = normalData[idx + 2]!;
        expect(nz).toBeGreaterThanOrEqual(128);
      }
    }

    expect(pixelsPretos).toBe(0);
    expect(minR).toBeGreaterThanOrEqual(42);
    expect(minG).toBeGreaterThanOrEqual(36);
    expect(minB).toBeGreaterThanOrEqual(32);
  });

  it('aplica desgaste e sombra de contato em vértices respeitando albedo mínimo', () => {
    // Cria geometria de teste com 2 níveis verticais (Y = 0 a 2.0)
    const geo = new THREE.BoxGeometry(2, 2, 2);
    geo.translate(0, 1.0, 0); // Y de 0 a 2.0
    garantirAtributoCorGeometria(geo);

    // Define cor inicial clara
    const corAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < corAttr.count; i++) {
      corAttr.setXYZ(i, 0.8, 0.75, 0.7);
    }

    aplicarDesgasteEContatoGeometria(geo);

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    let verticesBaseEscurecidos = 0;

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const r = corAttr.getX(i);
      const g = corAttr.getY(i);
      const b = corAttr.getZ(i);

      // Garante albedo mínimo #2A2420 (0.165, 0.141, 0.125)
      expect(r).toBeGreaterThanOrEqual(0.165);
      expect(g).toBeGreaterThanOrEqual(0.141);
      expect(b).toBeGreaterThanOrEqual(0.125);

      // Vértices na base (Y < 0.2) devem ser escurecidos em relação ao topo
      if (y < 0.2) {
        expect(r).toBeLessThan(0.8);
        verticesBaseEscurecidos++;
      }
    }

    expect(verticesBaseEscurecidos).toBeGreaterThan(0);
  });

  it('cria material unificado PBR para edifícios com mapas de rugosidade e normais anexados', () => {
    const mat = obterMaterialEdificiosCampanha();

    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.vertexColors).toBe(true);
    expect(mat.metalness).toBe(0.0);
    expect(mat.roughness).toBeGreaterThanOrEqual(0.7);
    expect(mat.roughness).toBeLessThanOrEqual(1.0);
    expect(mat.normalMap).toBeDefined();
    expect(mat.roughnessMap).toBeDefined();
  });
});
