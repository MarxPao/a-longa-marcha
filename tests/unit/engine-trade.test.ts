import { describe, expect, it } from 'vitest';
import {
  LAYOUT_PADRAO,
  obterMedidaLojaPorTamanho,
  obterRaioCidadePorNivel,
  obterRaioMetropolePorNivel,
} from '../../src/config/layout';
import {
  deriveFlows,
  deriveShops,
  layoutWorld,
  recalcularEstradasDaCidade,
  routeRoads,
} from '../../src/engine/trade';
import { seedDemo } from '../../src/seed';

describe('Motor de Comércio, Metrópole Central e Layout Plano (src/engine/trade)', () => {
  it('1. Escalas de layout.ts (Seção 4.1): raios de metrópole (140..200 u), cidades (14..44 u) e lojas (6, 9, 13 u)', () => {
    expect(obterRaioMetropolePorNivel(0)).toBe(140);
    expect(obterRaioMetropolePorNivel(4)).toBe(200);
    expect(obterRaioCidadePorNivel(1)).toBe(14);
    expect(obterRaioCidadePorNivel(7)).toBe(44);
    expect(obterMedidaLojaPorTamanho('P')).toBe(6);
    expect(obterMedidaLojaPorTamanho('M')).toBe(9);
    expect(obterMedidaLojaPorTamanho('G')).toBe(13);
    expect(LAYOUT_PADRAO.anelLivreMuralhaPrimeiraCidade).toBe(60);
    expect(LAYOUT_PADRAO.NPC_VISUAL_SCALE).toBe(2);
    expect(LAYOUT_PADRAO.estradaTroncoLargura).toBe(5);
    expect(LAYOUT_PADRAO.estradaRamalLargura).toBe(3);
    expect(LAYOUT_PADRAO.estradaTrilhaLargura).toBe(2);
  });

  it('2. Determinismo (Critério de Aceite 3): o mesmo estado gera exatamente o mesmo layout em duas execuções', () => {
    const dump = seedDemo('demo', 'semente-determinismo-trade');
    const layout1 = layoutWorld(dump);
    const layout2 = layoutWorld(structuredClone(dump));

    expect(layout1.raioMapa).toBe(layout2.raioMapa);
    expect(layout1.metropole.raio).toBe(layout2.metropole.raio);
    expect(layout1.cunhas).toEqual(layout2.cunhas);
    expect(layout1.cidades).toEqual(layout2.cidades);
  });

  it('3. Cunhas de setores e setor vazio (Seção 4.2): ângulos >= 20°, soma 360°, setor vazio vira cunha estreita em névoa', () => {
    const dump = seedDemo('pequeno', 'semente-setor-vazio');
    // Remove projetos do último setor para deixá-lo vazio
    const ultimoSetorId = dump.setores[dump.setores.length - 1]!.id;
    dump.projetos = dump.projetos.filter((p) => p.setorId !== ultimoSetorId);

    const layout = layoutWorld(dump);
    const somaGraus = layout.cunhas.reduce((acc, c) => acc + c.anguloGraus, 0);
    expect(Math.round(somaGraus)).toBe(360);

    for (const c of layout.cunhas) {
      expect(c.anguloGraus).toBeGreaterThanOrEqual(19.99);
    }

    const cunhaVazia = layout.cunhasPorSetorId.get(ultimoSetorId);
    expect(cunhaVazia?.vazia).toBe(true);
    expect(cunhaVazia?.projetosAtivosCount).toBe(0);
  });

  it('4. Anti-colisão com 500 projetos (Seção 4.2 e Etapa 2): separação mínima >= r1 + r2 + 12 u e raioMapa >= 840 u', () => {
    const dumpCarga = seedDemo('carga', 'semente-500-cidades-colisao');
    const layout = layoutWorld(dumpCarga, { iteracoesRelaxamentoColisao: 150 });

    expect(layout.cidades).toHaveLength(500);
    expect(layout.raioMapa).toBeGreaterThanOrEqual(840);

    const rMinMetropole =
      layout.metropole.raio + LAYOUT_PADRAO.anelLivreMuralhaPrimeiraCidade;

    let violacoesAnel = 0;
    let violacoesColisao = 0;
    for (let i = 0; i < layout.cidades.length; i++) {
      const cA = layout.cidades[i]!;
      if (cA.distanciaCentro < rMinMetropole + cA.raio - 0.5) {
        violacoesAnel++;
      }

      for (let j = i + 1; j < layout.cidades.length; j++) {
        const cB = layout.cidades[j]!;
        const dist = Math.hypot(cB.x - cA.x, cB.z - cA.z);
        const sepMin = cA.raio + cB.raio + LAYOUT_PADRAO.separacaoMinimaExtraCidades;
        if (dist < sepMin - 0.5) {
          violacoesColisao++;
        }
      }
    }
    expect(violacoesAnel).toBe(0);
    expect(violacoesColisao).toBe(0);
  });

  it('5. Critério de Aceite 1 — "Padaria do Zé" (setor Produção alimentícia, produto Pão, receita > 0): gera padaria no bairro do setor e fluxo de NPCs com sacos de pão', () => {
    const dumpDemo = seedDemo('demo', 'semente-padaria-do-ze');
    expect(dumpDemo.setores).toHaveLength(9);
    expect(dumpDemo.projetos).toHaveLength(40);
    expect(dumpDemo.produtos).toHaveLength(70);
    expect(dumpDemo.ligacoes).toHaveLength(60);

    const padariaProj = dumpDemo.projetos.find((p) => p.nome === 'Padaria do Zé');
    expect(padariaProj).toBeDefined();

    const setorAlimentos = dumpDemo.setores.find(
      (s) => s.nome === 'Produção alimentícia'
    );
    expect(padariaProj?.setorId).toBe(setorAlimentos?.id);

    const lojas = deriveShops(dumpDemo, { hoje: '2026-11-01' });
    const lojaPadaria = lojas.find(
      (l) => l.projetoId === padariaProj?.id && l.nomeProduto === 'Pão'
    );
    expect(lojaPadaria).toBeDefined();
    expect(lojaPadaria?.tipoLoja).toBe('padaria');
    expect(lojaPadaria?.setorId).toBe(setorAlimentos?.id);
    expect(lojaPadaria?.estado).toBe('aberta');
    expect(lojaPadaria?.receitaMensal).toBeGreaterThan(0);

    const fluxos = deriveFlows(dumpDemo, { hoje: '2026-11-01', lojas });
    const fluxoPao = fluxos.find(
      (f) =>
        f.tipo === 'producao' &&
        f.origemId === padariaProj?.id &&
        f.destinoId === lojaPadaria?.produtoId
    );
    expect(fluxoPao).toBeDefined();
    expect(fluxoPao?.tipoCarga).toBe('sacos');
    expect(fluxoPao?.quantidadeNpcs).toBeGreaterThanOrEqual(1);
    expect(fluxoPao?.rota.length).toBeGreaterThan(3);
  });

  it('6. Critério de Aceite 2 — Ciclo de vida da loja: sem receita há 60 dias fecha (sem NPCs); com 180 dias some', () => {
    const dump = seedDemo('pequeno', 'semente-ciclo-vida-loja');
    const padariaProj = dump.projetos.find((p) => p.nome === 'Padaria do Zé')!;
    const prodPao = dump.produtos.find(
      (pr) => pr.projetoId === padariaProj.id && pr.nome === 'Pão'
    )!;

    // Lançamento em 2026-10-28 -> em 2026-11-01 (4 dias depois) está aberta
    const lojasAtivas = deriveShops(dump, { hoje: '2026-11-01' });
    const lojaAberta = lojasAtivas.find((l) => l.produtoId === prodPao.id);
    expect(lojaAberta?.estado).toBe('aberta');

    // Avança 65 dias sem novos lançamentos (2027-01-01 -> 65 dias desde 2026-10-28) -> fecha e não gera NPCs
    const lojas60d = deriveShops(dump, { hoje: '2027-01-01' });
    const lojaFechada = lojas60d.find((l) => l.produtoId === prodPao.id);
    expect(lojaFechada).toBeDefined();
    expect(lojaFechada?.estado).toBe('fechada');
    expect(lojaFechada?.receitaMensal).toBe(0);

    const fluxos60d = deriveFlows(dump, { hoje: '2027-01-01', lojas: lojas60d });
    expect(fluxos60d.find((f) => f.destinoId === prodPao.id)).toBeUndefined();

    // Avança 185 dias sem lançamentos (2027-05-05 -> > 180 dias desde 2026-10-28) -> some
    const lojas180d = deriveShops(dump, { hoje: '2027-05-05' });
    expect(lojas180d.find((l) => l.produtoId === prodPao.id)).toBeUndefined();
  });

  it('7. Critério de Aceite 4 — Arrastar uma cidade não move as outras e recalcula só as estradas dela', () => {
    const dump = seedDemo('pequeno', 'semente-arrasto-incremental');
    const layoutInicial = layoutWorld(dump);
    const lojas = deriveShops(dump, { layout: layoutInicial });
    const fluxos = deriveFlows(dump, { layout: layoutInicial, lojas });
    const estradasIniciais = routeRoads(layoutInicial, fluxos, undefined, lojas);

    const cidadeAlvo = layoutInicial.cidades[0]!;
    const novoX = cidadeAlvo.x + 45;
    const novoZ = cidadeAlvo.z - 30;

    const resultadoIncremental = recalcularEstradasDaCidade(
      layoutInicial,
      estradasIniciais,
      fluxos,
      cidadeAlvo.projetoId,
      novoX,
      novoZ,
      undefined,
      lojas
    );

    // Todas as outras cidades permanecem com exatamente as mesmas coordenadas (mesma referência de objeto!)
    for (const c of resultadoIncremental.layout.cidades) {
      if (c.projetoId === cidadeAlvo.projetoId) {
        expect(c.x).toBe(Math.round(novoX * 100) / 100);
        expect(c.z).toBe(Math.round(novoZ * 100) / 100);
        expect(c.fixadaPeloUsuario).toBe(true);
      } else {
        const original = layoutInicial.cidadesPorProjetoId.get(c.projetoId)!;
        expect(c).toBe(original);
        expect(c.x).toBe(original.x);
        expect(c.z).toBe(original.z);
      }
    }

    // Estradas que não tocam a cidade movida não foram recalculadas (mantêm referência idêntica)
    expect(resultadoIncremental.idsEstradasRecalculadas).toContain(
      `estrada-ramal-${cidadeAlvo.projetoId}`
    );
    for (const e of resultadoIncremental.estradas.estradas) {
      if (!resultadoIncremental.idsEstradasRecalculadas.includes(e.id)) {
        expect(e).toBe(estradasIniciais.estradasPorId.get(e.id));
      }
    }
  });
});
