import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { construirIndiceBusca, executarBuscaGlobal } from '../../src/domain';
import {
  construirIndice,
  projetosInvalidados,
  recalcularProjetos,
} from '../../src/engine';
import { GerenciadorRotas } from '../../src/map/rotasLigacoes';
import { GerenciadorVegetacaoLOD } from '../../src/map/vegetacaoLod';
import { criarRepositorioMemoria } from '../../src/repository';
import { seedDemo } from '../../src/seed';
import { executarRecalculoPesadoWorker } from '../../src/workers';

describe('Fase 8 — Desempenho, LOD, Batching de Rotas, Worker e Metas da Tabela 7.4', () => {
  it('1. Batching de Rotas (LineSegments): agrupa centenas de ligações do perfil carga em ≤ 4 draw calls', () => {
    const cena = new THREE.Scene();
    const gerenciador = new GerenciadorRotas(cena);
    const dumpCarga = seedDemo('carga', 'semente-fase8-rotas');

    const projetosMap = new Map(dumpCarga.projetos.map((p) => [p.id, p]));
    const tiposMap = new Map(dumpCarga.tiposLigacao.map((t) => [t.id, t]));
    const tipoPadraoId = dumpCarga.tiposLigacao[0]?.id ?? 'tipo-financia';

    const ligacoesTeste = dumpCarga.projetos.map((p, i) => ({
      id: `lig-carga-${i}`,
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      arquivadoEm: null,
      origemId: p.id,
      destinoId: dumpCarga.projetos[(i + 1) % dumpCarga.projetos.length]!.id,
      tipoId: tipoPadraoId,
      forca: 2 as const,
      notas: '',
    }));

    gerenciador.definirQualidade('media');
    gerenciador.atualizarRotas(
      ligacoesTeste,
      projetosMap,
      () => 2.5,
      tiposMap,
      'padrao'
    );

    expect(gerenciador.obterTotalRotasAtivas()).toBe(500);
    expect(gerenciador.obterTotalDrawCallsRotas()).toBeLessThanOrEqual(4);

    gerenciador.destruir();
  });

  it('2. Níveis de Detalhe (LOD) de Vegetação por distância e qualidade gráfica', () => {
    const cena = new THREE.Scene();
    const veg = new GerenciadorVegetacaoLOD(cena);
    veg.gerarVegetacaoPorSemente('semente-fase8-lod', () => 4.0);

    // Câmera próxima em qualidade alta -> ativa LOD 0 (alta detalhe)
    veg.atualizarLodPorDistancia(new THREE.Vector3(0, 40, 0), 120, 'alta');
    const estadoPerto = veg.obterEstadoLod();
    expect(estadoPerto.nivelLodAtivo).toBe('lod0_alta');
    expect(estadoPerto.instanciasAlta).toBeGreaterThan(0);

    // Câmera em distância média ou qualidade média -> ativa LOD 1 (baixo detalhe)
    veg.atualizarLodPorDistancia(new THREE.Vector3(0, 140, 0), 260, 'media');
    const estadoMedio = veg.obterEstadoLod();
    expect(estadoMedio.nivelLodAtivo).toBe('lod1_media');
    expect(estadoMedio.instanciasAlta).toBe(0);
    expect(estadoMedio.instanciasBaixa).toBeGreaterThan(0);

    // Câmera muito distante ou qualidade baixa -> ativa LOD 2 (oculto/culling)
    veg.atualizarLodPorDistancia(new THREE.Vector3(0, 300, 0), 450, 'baixa');
    const estadoLonge = veg.obterEstadoLod();
    expect(estadoLonge.nivelLodAtivo).toBe('lod2_oculto');
    expect(estadoLonge.instanciasAlta).toBe(0);
    expect(estadoLonge.instanciasBaixa).toBe(0);

    veg.destruir();
  });

  it('3. Worker para recálculos pesados (executarRecalculoPesadoWorker): recalcula 500 cidades e 5.000 tarefas', async () => {
    const dumpCarga = seedDemo('carga', 'semente-fase8-worker');
    const res = await executarRecalculoPesadoWorker(dumpCarga, '2026-10-19');

    expect(res.derivadosPorProjeto.size).toBe(500);
    expect(res.derivadosGlobais.caixaCentavos).toBeTypeOf('number');
    expect(res.duracaoMs).toBeLessThan(1000);
  });

  it('4. Importar JSON de ≥ 5 MB em ≤ 3 s (Tabela 7.4)', async () => {
    const dumpBase = seedDemo('carga', 'semente-fase8-5mb');

    // Expande notas e descrições para gerar uma fixture válida com tamanho ≥ 5 MB em JSON
    const textoLongo =
      'Registro histórico imperial de suprimentos, rotas comerciais e crônicas de campanha. '.repeat(
        95
      );
    for (const p of dumpBase.projetos) {
      p.notas = textoLongo;
    }

    const jsonString = JSON.stringify(dumpBase);
    const tamanhoBytes = Buffer.byteLength(jsonString, 'utf8');
    expect(tamanhoBytes).toBeGreaterThanOrEqual(5 * 1024 * 1024); // >= 5 MB

    const repo = criarRepositorioMemoria();
    const t0 = performance.now();
    const objetoParseado = JSON.parse(jsonString);
    await repo.importar(objetoParseado);
    const duracaoMs = performance.now() - t0;

    console.log(
      `[perf Fase 8] Importação JSON de ${(tamanhoBytes / (1024 * 1024)).toFixed(2)} MB concluída em ${duracaoMs.toFixed(1)} ms (meta: ≤ 3000 ms)`
    );
    expect(duracaoMs).toBeLessThanOrEqual(3000);
  });

  it('5. Recálculo incremental ≤ 16 ms e Busca Global ≤ 100 ms no perfil carga (Tabela 7.4)', () => {
    const dumpCarga = seedDemo('carga', 'semente-fase8-inc');
    const indice = construirIndice(dumpCarga);

    const alvo = dumpCarga.projetos[0]!;
    const t0Inc = performance.now();
    const invalidados = projetosInvalidados(indice, {
      tabela: 'tarefas',
      depois: { id: 'tar-teste', projetoId: alvo.id },
    });
    const recalculados = recalcularProjetos(
      indice,
      invalidados,
      '2026-10-19',
      dumpCarga.meta.config
    );
    const duracaoIncMs = performance.now() - t0Inc;
    expect(recalculados.size).toBe(1);
    expect(duracaoIncMs).toBeLessThanOrEqual(16);

    const indiceBusca = construirIndiceBusca(dumpCarga);
    const t0Busca = performance.now();
    const resultados = executarBuscaGlobal(indiceBusca, 'Projeto');
    const duracaoBuscaMs = performance.now() - t0Busca;
    expect(resultados.length).toBeGreaterThan(0);
    expect(duracaoBuscaMs).toBeLessThanOrEqual(100);
  });

  it('6. Pacote inicial de produção ≤ 1,5 MB comprimido (gzip), sem GLB e texturas (Tabela 7.4)', () => {
    const pastaDistAssets = path.resolve(process.cwd(), 'dist', 'assets');
    if (!fs.existsSync(pastaDistAssets)) {
      return;
    }

    const arquivos = fs
      .readdirSync(pastaDistAssets)
      .filter((f) => f.endsWith('.js') || f.endsWith('.css'));
    expect(arquivos.length).toBeGreaterThan(0);

    let totalGzipBytes = 0;
    for (const arq of arquivos) {
      const conteudo = fs.readFileSync(path.join(pastaDistAssets, arq));
      const comprimido = zlib.gzipSync(conteudo);
      totalGzipBytes += comprimido.byteLength;
    }

    const limiteBytes = 1.5 * 1024 * 1024; // 1,5 MB
    console.log(
      `[perf Fase 8] Pacote inicial comprimido (gzip): ${(totalGzipBytes / 1024).toFixed(2)} KB (meta: ≤ 1536 KB)`
    );
    expect(totalGzipBytes).toBeLessThanOrEqual(limiteBytes);
  });
});
