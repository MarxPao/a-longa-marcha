import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EsquemaSementeTerreno } from '../../src/domain';
import { amostrarTerrenoPorSemente, gerarHashSemente } from '../../src/engine';

describe('Fase 0 — Motor puro de semente e relevo determinístico', () => {
  it('gera sempre o mesmo hash numérico para a mesma semente e hashes distintos para sementes diferentes', () => {
    const h1 = gerarHashSemente('longa-marcha-2026');
    const h2 = gerarHashSemente('longa-marcha-2026');
    const h3 = gerarHashSemente('rio-amarelo-karst');

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(Number.isInteger(h1)).toBe(true);
    expect(h1).toBeGreaterThan(0);
  });

  it('amostra alturas e biomas de forma determinística a partir da semente', () => {
    const a1 = amostrarTerrenoPorSemente(24, -18, 'longa-marcha-2026');
    const a2 = amostrarTerrenoPorSemente(24, -18, 'longa-marcha-2026');
    const aOutra = amostrarTerrenoPorSemente(24, -18, 'tres-reinos-jade');

    expect(a1).toEqual(a2);
    expect(a1.altura).not.toBe(aOutra.altura);
    expect(['agua', 'vale_rio', 'planicie', 'colina_karst', 'pico_rochoso']).toContain(
      a1.biomaVisual
    );
  });

  it('valida semente com Zod (aceita válida e rejeita vazia ou longa demais)', () => {
    expect(EsquemaSementeTerreno.safeParse('longa-marcha-2026').success).toBe(true);
    expect(EsquemaSementeTerreno.safeParse('   ').success).toBe(false);
    expect(EsquemaSementeTerreno.safeParse('x'.repeat(65)).success).toBe(false);
  });
});

describe('Fase 0 — Lint de camadas (Anexo B / Seção 5.2)', () => {
  const raizProjeto = resolve(__dirname, '../..');
  const cliDepcruise = resolve(
    raizProjeto,
    'node_modules/dependency-cruiser/bin/dependency-cruise.mjs'
  );
  const configDepcruise = resolve(raizProjeto, '.dependency-cruiser.cjs');

  it('aprova a árvore src/ limpa sem violações de camada', () => {
    const saida = execFileSync(
      process.execPath,
      [cliDepcruise, 'src', '--config', configDepcruise],
      { cwd: raizProjeto, encoding: 'utf8' }
    );
    expect(saida).toContain('no dependency violations found');
  });

  it('quebra o lint:camadas quando src/engine importa react (violação proposital provada por teste)', () => {
    const arquivoViolacao = resolve(raizProjeto, 'src/engine/__violacao_proposital_temp__.ts');
    try {
      writeFileSync(
        arquivoViolacao,
        "import React from 'react';\nexport const proibido = React.version;\n",
        'utf8'
      );

      let falhouComViolacao = false;
      let mensagemSaida = '';
      try {
        execFileSync(
          process.execPath,
          [cliDepcruise, 'src/engine/__violacao_proposital_temp__.ts', '--config', configDepcruise],
          { cwd: raizProjeto, encoding: 'utf8', stdio: 'pipe' }
        );
      } catch (erro: unknown) {
        falhouComViolacao = true;
        if (erro && typeof erro === 'object' && 'stdout' in erro && 'stderr' in erro) {
          mensagemSaida = `${String(erro.stdout)}\n${String(erro.stderr)}`;
        }
      }

      expect(falhouComViolacao).toBe(true);
      expect(mensagemSaida).toContain('engine-puro');
    } finally {
      if (existsSync(arquivoViolacao)) {
        unlinkSync(arquivoViolacao);
      }
    }
  });
});
