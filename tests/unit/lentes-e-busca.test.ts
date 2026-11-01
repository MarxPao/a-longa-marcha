import { describe, expect, it } from 'vitest';
import {
  CORES_PALETA_MARCHA,
  calcularCorCidadePorLente,
  construirIndiceBusca,
  executarBuscaGlobal,
  type DadosContextoLente,
  type Projeto,
} from '../../src/domain';
import { seedDemo } from '../../src/seed';

function criarProjetoTeste(parcial: Partial<Projeto> = {}): Projeto {
  return {
    id: 'proj-teste-1',
    nome: 'Fortaleza de Luoyang',
    descricao: 'Centro logístico imperial',
    setorId: 'setor-1',
    x: 10,
    z: -20,
    estagioId: 'estagio-1',
    horasAlvoSemana: 10,
    autonomia: 'direto',
    notas: '',
    notaLicoes: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    arquivadoEm: null,
    ...parcial,
  };
}

describe('Fase 6 — As 8 Lentes do Mapa e Busca Global', () => {
  it('Lente 1 (Padrão): colore por faixa de saúde e cinza pedra para Ruínas', () => {
    const pAtivo = criarProjetoTeste();
    const pRuinas = criarProjetoTeste({
      id: 'proj-ruina',
      arquivadoEm: '2026-05-01T00:00:00.000Z',
      notaLicoes: 'Encerrado',
    });

    const ctxSaudavel: DadosContextoLente = {
      lente: 'padrao',
      derivadosPorProjeto: new Map([[pAtivo.id, { pontuacaoSaude: 85 }]]),
    };
    expect(calcularCorCidadePorLente(pAtivo, ctxSaudavel)).toBe(CORES_PALETA_MARCHA.jade);

    const ctxAtencao: DadosContextoLente = {
      lente: 'padrao',
      derivadosPorProjeto: new Map([[pAtivo.id, { pontuacaoSaude: 55 }]]),
    };
    expect(calcularCorCidadePorLente(pAtivo, ctxAtencao)).toBe(CORES_PALETA_MARCHA.ambar);

    const ctxCritico: DadosContextoLente = {
      lente: 'padrao',
      derivadosPorProjeto: new Map([[pAtivo.id, { pontuacaoSaude: 25 }]]),
    };
    expect(calcularCorCidadePorLente(pAtivo, ctxCritico)).toBe(CORES_PALETA_MARCHA.laca);
    expect(calcularCorCidadePorLente(pRuinas, ctxSaudavel)).toBe(CORES_PALETA_MARCHA.pedra);
  });

  it('Lente 2 (Finanças): colore por superávit, equilíbrio ou déficit mensal', () => {
    const p = criarProjetoTeste();

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'financas',
        derivadosPorProjeto: new Map([[p.id, { liquidoMesCentavos: 50000 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.jade);

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'financas',
        derivadosPorProjeto: new Map([[p.id, { liquidoMesCentavos: 0 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.ambar);

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'financas',
        derivadosPorProjeto: new Map([[p.id, { liquidoMesCentavos: -12000 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.laca);
  });

  it('Lente 3 (Tempo): compara horas registradas na semana com horasAlvoSemana', () => {
    const p = criarProjetoTeste({ horasAlvoSemana: 10 });

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'tempo',
        derivadosPorProjeto: new Map([[p.id, { horasRegistradasSemana: 12 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.jade);

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'tempo',
        derivadosPorProjeto: new Map([[p.id, { horasRegistradasSemana: 6 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.ambar);

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'tempo',
        derivadosPorProjeto: new Map([[p.id, { horasRegistradasSemana: 0 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.laca);
  });

  it('Lente 4 (Rede): destaca hubs (≥2 conexões), conectados (1) e isolados (0)', () => {
    const p = criarProjetoTeste();

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'rede',
        derivadosPorProjeto: new Map(),
        ligacoes: [],
      })
    ).toBe(CORES_PALETA_MARCHA.pedra);

    expect(
      calcularCorCidadePorLente(p, {
        lente: 'rede',
        derivadosPorProjeto: new Map(),
        ligacoes: [
          {
            id: 'l1',
            origemId: p.id,
            destinoId: 'p2',
            tipoId: 't1',
            forca: 1,
            criadoEm: '2026-01-01T00:00:00.000Z',
            atualizadoEm: '2026-01-01T00:00:00.000Z',
            arquivadoEm: null,
          },
          {
            id: 'l2',
            origemId: 'p3',
            destinoId: p.id,
            tipoId: 't1',
            forca: 2,
            criadoEm: '2026-01-01T00:00:00.000Z',
            atualizadoEm: '2026-01-01T00:00:00.000Z',
            arquivadoEm: null,
          },
        ],
      })
    ).toBe(CORES_PALETA_MARCHA.ouro);
  });

  it('Lentes 5, 6, 7 e 8 (Risco, Clientes, Estoque e P&D): avaliam regras de domínio corretamente', () => {
    const p = criarProjetoTeste();

    // Risco alto
    expect(
      calcularCorCidadePorLente(p, {
        lente: 'risco',
        derivadosPorProjeto: new Map([[p.id, { concentracaoRisco: 0.75 }]]),
      })
    ).toBe(CORES_PALETA_MARCHA.laca);

    // Estoque em falta vs coberto
    expect(
      calcularCorCidadePorLente(p, {
        lente: 'estoque',
        derivadosPorProjeto: new Map(),
        itensLista: [
          {
            id: 'il-1',
            projetoId: p.id,
            itemId: 'item-1',
            quantidade: 5,
            status: 'falta',
            criadoEm: '2026-01-01T00:00:00.000Z',
            atualizadoEm: '2026-01-01T00:00:00.000Z',
            arquivadoEm: null,
          },
        ],
      })
    ).toBe(CORES_PALETA_MARCHA.laca);

    // P&D com tecnologia aplicada
    expect(
      calcularCorCidadePorLente(p, {
        lente: 'pd',
        derivadosPorProjeto: new Map(),
        aplicacoes: [
          {
            id: 'ap-1',
            projetoId: p.id,
            tecnologiaId: 'tech-1',
            efeito: 'velocidade',
            valorEstimadoCentavos: 10000,
            criadoEm: '2026-01-01T00:00:00.000Z',
            atualizadoEm: '2026-01-01T00:00:00.000Z',
            arquivadoEm: null,
          },
        ],
      })
    ).toBe(CORES_PALETA_MARCHA.celeste);
  });

  it('Busca Global no perfil carga (500 projetos, 5.000 tarefas): executa em ≤ 100 ms por tecla (Critério de Aceite Fase 6)', () => {
    const dumpCarga = seedDemo('carga', 'semente-42');
    const indice = construirIndiceBusca(dumpCarga);

    const nomeAlvo = dumpCarga.projetos[120]?.nome.slice(0, 6) ?? 'Projet';

    const t0 = performance.now();
    const resultados = executarBuscaGlobal(indice, nomeAlvo, 18);
    const duracaoMs = performance.now() - t0;

    // Critério de Aceite da Seção 8 (Fase 6): busca em ≤ 100 ms por tecla no perfil carga
    expect(duracaoMs).toBeLessThanOrEqual(100);
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0]?.coordenadas).not.toBeNull();
  });
});
