import { describe, expect, it } from 'vitest';
import { EsquemaDumpBanco } from '../../src/domain';
import { seedDemo } from '../../src/seed';

describe('Fase 1 — Gerador determinístico seedDemo(perfil, semente) (Seção 7.3)', () => {
  it('produz sempre os mesmos dados para a mesma semente e dados diferentes para outra semente', () => {
    const d1 = seedDemo('pequeno', 'semente-fixa-1');
    const d2 = seedDemo('pequeno', 'semente-fixa-1');
    const d3 = seedDemo('pequeno', 'semente-fixa-2');

    expect(d1).toEqual(d2);
    expect(d1.projetos[0]?.x).not.toBe(d3.projetos[0]?.x);
  });

  it('perfil pequeno: 12 projetos, 80 tarefas, 12 semanas de histórico, válido no Zod', () => {
    const dump = seedDemo('pequeno', 'campanha-pequena');
    expect(dump.projetos).toHaveLength(12);
    expect(dump.tarefas).toHaveLength(80);
    expect(dump.instantaneos).toHaveLength(12);
    expect(EsquemaDumpBanco.safeParse(dump).success).toBe(true);
  });

  it('perfil real: 60 projetos, 600 tarefas, 52 semanas de histórico, válido no Zod', () => {
    const dump = seedDemo('real', 'campanha-real');
    expect(dump.projetos).toHaveLength(60);
    expect(dump.tarefas).toHaveLength(600);
    expect(dump.instantaneos).toHaveLength(52);
    expect(EsquemaDumpBanco.safeParse(dump).success).toBe(true);
  });

  it('perfil carga: gera 500 projetos, 5.000 tarefas e 104 semanas em menos de 5 s (Critério de Aceite Fase 1)', () => {
    const inicio = performance.now();
    const dump = seedDemo('carga', 'campanha-carga-500');
    const duracaoMs = performance.now() - inicio;

    expect(dump.projetos).toHaveLength(500);
    expect(dump.tarefas).toHaveLength(5000);
    expect(dump.instantaneos).toHaveLength(104);
    expect(duracaoMs).toBeLessThan(5000);
    expect(EsquemaDumpBanco.safeParse(dump).success).toBe(true);
  });

  it('perfil caos: inclui dados patológicos (nomes de 500 chars, emojis, valores zero, datas futuras, setor arquivado) sem NaN', () => {
    const dump = seedDemo('caos', 'campanha-caos');
    expect(dump.projetos.some((p) => p.nome.length === 500)).toBe(true);
    expect(dump.projetos.some((p) => p.nome.includes('🐉'))).toBe(true);
    expect(dump.lancamentos.some((l) => l.valorCentavos === 0)).toBe(true);
    expect(dump.tarefas.some((t) => (t.prazo ?? '') > '2030-01-01')).toBe(true);
    expect(dump.setores.some((s) => s.arquivadoEm !== null)).toBe(true);
    expect(EsquemaDumpBanco.safeParse(dump).success).toBe(true);
  });
});
