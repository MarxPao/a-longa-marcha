import {
  LAYOUT_PADRAO,
  obterMedidaLojaPorTamanho,
  type ConfigLayoutMapa,
} from '../../config/layout';
import type { Loja, Projeto, UUID } from '../../domain';
import { diferencaDias } from '../tempo';
import {
  layoutWorld,
  type EstadoEntradaTrade,
  type ResultadoLayoutMundo,
} from './layoutWorld';

export interface OpcoesDeriveShops extends Partial<ConfigLayoutMapa> {
  hoje?: string;
  layout?: ResultadoLayoutMundo;
  produtosRecemCriadosIds?: ReadonlySet<UUID>;
  produtosRecemArquivadosIds?: ReadonlySet<UUID>;
}

interface CandidataLoja {
  produtoId: string;
  projetoId: string;
  setorId: string;
  nomeProduto: string;
  tipoLoja: string;
  icone: string;
  bancaSemProduto: boolean;
  receitaMensal: number;
  estado: 'abrindo' | 'aberta' | 'fechada' | 'sumindo';
}

/**
 * Deriva as lojas da Metrópole Central a partir dos Produtos e Lançamentos reais (Seções 4.3 e 5):
 * - Receita mensal do produto = média móvel de 3 meses (90 dias / 3) dos lançamentos de receita com `produtoId`.
 * - Receita sem produto vira uma banca genérica do projeto, com selo "associe um produto".
 * - Sem receita há 60 dias -> estado 'fechada' (sem NPCs).
 * - Sem receita há 180 dias -> some (omitida da lista).
 * - Produto arquivado recentemente -> estado 'sumindo'.
 * - Tamanho por percentil da receita entre todos: P até 50%, M até 85%, G acima.
 * - Posicionamento em arcos concêntricos no bairro do setor: maior receita mensal mais perto da praça,
 *   espaçamento uniforme, sem sobreposição.
 */
export function deriveShops(
  state: EstadoEntradaTrade,
  config?: OpcoesDeriveShops
): Loja[] {
  const cfg: ConfigLayoutMapa = { ...LAYOUT_PADRAO, ...config };
  const hoje = config?.hoje ?? state.hoje ?? '2026-11-01';
  const layout = config?.layout ?? layoutWorld({ ...state, hoje }, cfg);

  const projetosAtivosPorId = new Map<UUID, Projeto>();
  for (const p of state.projetos) {
    if (p.arquivadoEm === null) {
      projetosAtivosPorId.set(p.id, p);
    }
  }

  const lancamentos = state.lancamentos ?? [];
  const produtos = state.produtos ?? [];

  // Agrupa lançamentos de receita válidos (data <= hoje e não arquivados)
  const receitaJanelaPorProduto = new Map<UUID, number>();
  const ultimaDataPorProduto = new Map<UUID, string>();

  const receitaJanelaSemProdutoPorProjeto = new Map<UUID, number>();
  const ultimaDataSemProdutoPorProjeto = new Map<UUID, string>();

  const produtosIdsValidos = new Set<string>(produtos.map((p) => p.id));

  for (const lanc of lancamentos) {
    if (lanc.arquivadoEm !== null || lanc.tipo !== 'receita' || lanc.valorCentavos <= 0) {
      continue;
    }
    if (lanc.data > hoje) continue;
    if (!projetosAtivosPorId.has(lanc.projetoId)) continue;

    const dias = diferencaDias(hoje, lanc.data);
    const dentroJanela90d = dias >= 0 && dias <= cfg.janelaMediaMovelReceitaDias;

    if (lanc.produtoId && produtosIdsValidos.has(lanc.produtoId)) {
      if (dentroJanela90d) {
        receitaJanelaPorProduto.set(
          lanc.produtoId,
          (receitaJanelaPorProduto.get(lanc.produtoId) ?? 0) + lanc.valorCentavos
        );
      }
      const ant = ultimaDataPorProduto.get(lanc.produtoId);
      if (!ant || lanc.data > ant) {
        ultimaDataPorProduto.set(lanc.produtoId, lanc.data);
      }
    } else {
      if (dentroJanela90d) {
        receitaJanelaSemProdutoPorProjeto.set(
          lanc.projetoId,
          (receitaJanelaSemProdutoPorProjeto.get(lanc.projetoId) ?? 0) + lanc.valorCentavos
        );
      }
      const ant = ultimaDataSemProdutoPorProjeto.get(lanc.projetoId);
      if (!ant || lanc.data > ant) {
        ultimaDataSemProdutoPorProjeto.set(lanc.projetoId, lanc.data);
      }
    }
  }

  const candidatas: CandidataLoja[] = [];

  // 1. Avalia cada Produto cadastrado
  for (const prod of produtos) {
    const projeto = projetosAtivosPorId.get(prod.projetoId);
    if (!projeto) continue;

    const foiArquivado = prod.arquivadoEm !== null || !prod.ativo;
    if (foiArquivado) {
      if (config?.produtosRecemArquivadosIds?.has(prod.id)) {
        candidatas.push({
          produtoId: prod.id,
          projetoId: projeto.id,
          setorId: projeto.setorId,
          nomeProduto: prod.nome,
          tipoLoja: prod.tipoLoja || 'banca_generica',
          icone: prod.icone || 'caixa',
          bancaSemProduto: false,
          receitaMensal: 0,
          estado: 'sumindo',
        });
      }
      continue;
    }

    const somaJanela = receitaJanelaPorProduto.get(prod.id) ?? 0;
    const receitaMensalBruta = Math.round(somaJanela / cfg.divisorMediaMovelMeses);

    const dataCriacaoProd = (prod.criadoEm || '2026-01-01').slice(0, 10);
    const dataRefUltimaReceita =
      ultimaDataPorProduto.get(prod.id) ??
      (dataCriacaoProd <= hoje ? dataCriacaoProd : hoje);

    const diasSemReceita = Math.max(0, diferencaDias(hoje, dataRefUltimaReceita));

    // Sem receita há 180 dias -> some
    if (diasSemReceita >= cfg.diasSemReceitaParaSumirLoja) {
      continue;
    }

    // Sem receita há 60 dias -> fecha (persianas, cor desbotada, sem NPCs)
    if (diasSemReceita >= cfg.diasSemReceitaParaFecharLoja) {
      candidatas.push({
        produtoId: prod.id,
        projetoId: projeto.id,
        setorId: projeto.setorId,
        nomeProduto: prod.nome,
        tipoLoja: prod.tipoLoja || 'banca_generica',
        icone: prod.icone || 'caixa',
        bancaSemProduto: false,
        receitaMensal: 0,
        estado: 'fechada',
      });
      continue;
    }

    const estadoInicial: 'abrindo' | 'aberta' = config?.produtosRecemCriadosIds?.has(prod.id)
      ? 'abrindo'
      : 'aberta';

    candidatas.push({
      produtoId: prod.id,
      projetoId: projeto.id,
      setorId: projeto.setorId,
      nomeProduto: prod.nome,
      tipoLoja: prod.tipoLoja || 'banca_generica',
      icone: prod.icone || 'caixa',
      bancaSemProduto: false,
      receitaMensal: receitaMensalBruta,
      estado: estadoInicial,
    });
  }

  // 2. Avalia receitas sem produto -> banca genérica com selo "associe um produto"
  for (const [projetoId, ultimaData] of ultimaDataSemProdutoPorProjeto.entries()) {
    const projeto = projetosAtivosPorId.get(projetoId);
    if (!projeto) continue;

    const diasSemReceita = Math.max(0, diferencaDias(hoje, ultimaData));
    if (diasSemReceita >= cfg.diasSemReceitaParaSumirLoja) continue;

    const somaJanela = receitaJanelaSemProdutoPorProjeto.get(projetoId) ?? 0;
    const receitaMensal =
      diasSemReceita >= cfg.diasSemReceitaParaFecharLoja
        ? 0
        : Math.round(somaJanela / cfg.divisorMediaMovelMeses);

    const estado: 'aberta' | 'fechada' =
      diasSemReceita >= cfg.diasSemReceitaParaFecharLoja ? 'fechada' : 'aberta';

    candidatas.push({
      produtoId: `banca-sem-produto-${projeto.id}`,
      projetoId: projeto.id,
      setorId: projeto.setorId,
      nomeProduto: `${projeto.nome} — Associe um produto`,
      tipoLoja: 'banca_generica',
      icone: 'caixa',
      bancaSemProduto: true,
      receitaMensal,
      estado,
    });
  }

  if (candidatas.length === 0) return [];

  // 3. Tamanho por percentil da receita do produto entre todos: P até 50%, M até 85%, G acima
  const receitasOrdenadas = candidatas
    .map((c) => c.receitaMensal)
    .slice()
    .sort((a, b) => a - b);

  const nTotal = receitasOrdenadas.length;
  const calcularTamanhoPorPercentil = (receita: number): 'P' | 'M' | 'G' => {
    if (receita <= 0) return 'P';
    if (nTotal === 1) return 'M';
    let menores = 0;
    let iguais = 0;
    for (const r of receitasOrdenadas) {
      if (r < receita) menores++;
      else if (r === receita) iguais++;
    }
    const percentil = (menores + (iguais - 1) * 0.5) / Math.max(1, nTotal - 1);
    if (percentil <= cfg.percentilLojaP + 1e-9) return 'P';
    if (percentil <= cfg.percentilLojaM + 1e-9) return 'M';
    return 'G';
  };

  // 4. Alocação em arcos concêntricos por bairro do setor na Metrópole Central
  const porSetor = new Map<UUID, CandidataLoja[]>();
  for (const c of candidatas) {
    const lista = porSetor.get(c.setorId);
    if (lista) lista.push(c);
    else porSetor.set(c.setorId, [c]);
  }

  const lojasFinais: Loja[] = [];
  const rPraca = layout.metropole.raioPracaCentral;
  const rMaxBairro = layout.metropole.raio - cfg.muralhaEspessura - 8;

  // Ordena setores pela ordem das cunhas
  const setoresOrdenados = Array.from(porSetor.keys()).sort((a, b) => {
    const cA = layout.cunhasPorSetorId.get(a)?.ordem ?? 999;
    const cB = layout.cunhasPorSetorId.get(b)?.ordem ?? 999;
    return cA !== cB ? cA - cB : a.localeCompare(b);
  });

  for (const setorId of setoresOrdenados) {
    const listaSetor = porSetor.get(setorId) ?? [];
    // Maior receita mensal mais perto da praça; desempate determinístico por produtoId
    listaSetor.sort((a, b) => {
      if (b.receitaMensal !== a.receitaMensal) return b.receitaMensal - a.receitaMensal;
      return a.produtoId.localeCompare(b.produtoId);
    });

    const cunha = layout.cunhasPorSetorId.get(setorId);
    const angInicio = cunha ? cunha.anguloInicioRad : 0;
    const angFim = cunha ? cunha.anguloFimRad : Math.PI * 2;
    const larguraAngTotal = Math.max(0.18, angFim - angInicio);
    const folgaAngBorda = Math.min(0.08, larguraAngTotal * 0.14);
    const arcoUtilRad = Math.max(0.08, larguraAngTotal - folgaAngBorda * 2);

    const passoEntreAneis = cfg.lojaTamanhoG + cfg.espacamentoMinimoLojas + 2; // 19 u
    let cursor = 0;
    let anel = 0;

    while (cursor < listaSetor.length) {
      const rAnel = Math.min(
        rMaxBairro + Math.max(0, anel - 3) * 14,
        rPraca + 14 + anel * passoEntreAneis
      );
      const comprimentoArco = rAnel * arcoUtilRad;
      const espacoPorLoja = cfg.lojaTamanhoG + cfg.espacamentoMinimoLojas;
      const capacidadeAnel = Math.max(1, Math.floor(comprimentoArco / espacoPorLoja));

      const qtdNesteAnel = Math.min(capacidadeAnel, listaSetor.length - cursor);

      for (let indiceNoAnel = 0; indiceNoAnel < qtdNesteAnel; indiceNoAnel++) {
        const cand = listaSetor[cursor + indiceNoAnel]!;
        const tamanho = calcularTamanhoPorPercentil(cand.receitaMensal);
        const medida = obterMedidaLojaPorTamanho(tamanho, cfg);

        const fracao = (indiceNoAnel + 0.5) / qtdNesteAnel;
        const anguloRad = angInicio + folgaAngBorda + fracao * arcoUtilRad;
        const x = Math.round(Math.cos(anguloRad) * rAnel * 100) / 100;
        const z = Math.round(Math.sin(anguloRad) * rAnel * 100) / 100;

        lojasFinais.push({
          produtoId: cand.produtoId,
          projetoId: cand.projetoId,
          setorId: cand.setorId,
          tamanho,
          slot: { anel, indice: indiceNoAnel },
          estado: cand.estado,
          receitaMensal: cand.receitaMensal,
          nomeProduto: cand.nomeProduto,
          tipoLoja: cand.tipoLoja,
          icone: cand.icone,
          bancaSemProduto: cand.bancaSemProduto,
          x,
          z,
          anguloRad: Math.round(anguloRad * 10000) / 10000,
          medidaUnidades: medida,
        });
      }

      cursor += qtdNesteAnel;
      anel++;
    }
  }

  return lojasFinais;
}
