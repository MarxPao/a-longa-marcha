import { describe, it, expect } from 'vitest';
import { PALETA_MAPA, obterCorPaleta, ChavePaletaMapa } from '../../src/config/layout';
import * as fs from 'fs';
import * as path from 'path';

describe('Validação da Paleta do Mapa (Fase 2c - R3.1 e R6)', () => {
  it('contém todas as chaves arquiteturais e fundamentais esperadas', () => {
    const chavesEsperadas: ChavePaletaMapa[] = [
      'pergaminho',
      'tinta',
      'laca',
      'jade',
      'ouro',
      'bronze',
      'nevoa',
      'luzSol',
      'terraClara',
      'madeiraEscura',
      'rebocoClaro',
      'telhaCinzaAzulada',
      'pedraBase',
    ];

    for (const chave of chavesEsperadas) {
      expect(PALETA_MAPA[chave]).toBeDefined();
      expect(typeof PALETA_MAPA[chave]).toBe('string');
      expect(PALETA_MAPA[chave]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(obterCorPaleta(chave)).toBe(PALETA_MAPA[chave]);
    }
  });

  it('lança erro explícito (fail-fast) ao acessar chave inexistente via Proxy PALETA_MAPA', () => {
    expect(() => {
      // @ts-expect-error teste proposital de chave inválida
      const _invalida = PALETA_MAPA['corInexistente'];
    }).toThrowError(/\[PALETA_MAPA\] Chave de paleta inexistente: "corInexistente"/);
  });

  it('lança erro explícito (fail-fast) ao chamar obterCorPaleta com chave inválida ou vazia', () => {
    expect(() => obterCorPaleta('fantasma')).toThrowError(
      /\[PALETA_MAPA\] Chave de paleta inválida ou ausente: "fantasma"/
    );
    expect(() => obterCorPaleta('')).toThrowError(
      /\[PALETA_MAPA\] Chave de paleta inválida ou ausente: ""/
    );
  });

  it('garante que nenhum arquivo em src/ consome chave de paleta inexistente', () => {
    const dirSrc = path.resolve(__dirname, '../../src');
    const chavesValidas = new Set(Object.keys(PALETA_MAPA));

    function varrerArquivos(dir: string): string[] {
      const arquivos: string[] = [];
      const itens = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of itens) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          arquivos.push(...varrerArquivos(fullPath));
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
          arquivos.push(fullPath);
        }
      }
      return arquivos;
    }

    const arquivos = varrerArquivos(dirSrc);
    const regexPaleta = /PALETA_MAPA\.([a-zA-Z0-9_]+)|PALETA_MAPA\[['"]([a-zA-Z0-9_]+)['"]\]|obterCorPaleta\(['"]([a-zA-Z0-9_]+)['"]\)/g;

    const violacoes: { arquivo: string; chave: string }[] = [];

    for (const arquivo of arquivos) {
      const conteudo = fs.readFileSync(arquivo, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = regexPaleta.exec(conteudo)) !== null) {
        const chave = match[1] || match[2] || match[3];
        if (chave && !chavesValidas.has(chave)) {
          violacoes.push({ arquivo: path.relative(dirSrc, arquivo), chave });
        }
      }
    }

    expect(violacoes).toEqual([]);
  });
});
