import { LAYOUT_PADRAO, type ConfigLayoutMapa } from '../../config/layout';
import type {
  Fluxo,
  Item,
  ItemDeLista,
  Ligacao,
  Loja,
  Projeto,
  TipoLigacao,
  UUID,
  VinculoCliente,
} from '../../domain';
import { diferencaDias } from '../tempo';
import { gerarHashSemente } from '../terreno-puro';
import { deriveShops, type OpcoesDeriveShops } from './deriveShops';
import {
  layoutWorld,
  type EstadoEntradaTrade,
  type ResultadoLayoutMundo,
} from './layoutWorld';
import { routeRoads } from './routeRoads';

export interface EstadoEntradaFlows extends EstadoEntradaTrade {
  ligacoes?: readonly Ligacao[];
  tiposLigacao?: readonly TipoLigacao[];
  itens?: readonly Item[];
  itensDeLista?: readonly ItemDeLista[];
  vinculosCliente?: readonly VinculoCliente[];
}

export interface OpcoesDeriveFlows extends OpcoesDeriveShops {
  layout?: ResultadoLayoutMundo;
  lojas?: readonly Loja[];
  tetoGlobalNpcsOverride?: number;
}

export function mapearTipoCargaProduto(tipoLoja = '', icone = '', nome = ''): string {
  const chave = `${tipoLoja} ${icone} ${nome}`.toLowerCase();
  if (
    chave.includes('padaria') ||
    chave.includes('pao') ||
    chave.includes('pão') ||
    chave.includes('grao') ||
    chave.includes('grão') ||
    chave.includes('saco')
  ) {
    return 'sacos';
  }
  if (chave.includes('taverna') || chave.includes('barril') || chave.includes('bebida')) {
    return 'barris';
  }
  if (
    chave.includes('escriba') ||
    chave.includes('pergaminho') ||
    chave.includes('soft') ||
    chave.includes('codigo')
  ) {
    return 'pergaminhos';
  }
  return 'caixas';
}

/**
 * Calcula a quantidade de NPCs para um volume mensal conforme a fórmula da Seção 4.5:
 * n = clamp(round(k * log2(1 + volume / volumeBase)), 0, nMax)
 * com k = 2, volumeBase = R$ 500 (50.000 centavos), nMax = 12, e no mínimo 1 se volume > 0.
 */
export function calcularQuantidadeNpcsPorRota(
  volumeMensalCentavos: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  if (volumeMensalCentavos <= 0) return 0;
  const razao = volumeMensalCentavos / Math.max(1, cfg.fluxoVolumeBaseCentavos);
  const bruto = Math.round(cfg.fluxoK * Math.log2(1 + razao));
  return Math.max(1, Math.min(cfg.fluxoNMaxPorRota, bruto));
}

/**
 * Gera semente determinística para os NPCs de uma rota e semana: hash(rotaId, semana).
 */
export function gerarSementeRotaSemana(rotaId: string, semana = '2026-11-01'): number {
  return gerarHashSemente(`${rotaId}::${semana}`);
}

/**
 * Deriva todos os fluxos econômicos reais (Produção, Insumo e Ligação entre cidades),
 * aplica a fórmula logarítmica de NPCs com teto global proporcional (sem cortar rota inteira)
 * e roteia as polilinhas Catmull-Rom de cada fluxo (Seções 4.5 e 5).
 */
export function deriveFlows(
  state: EstadoEntradaFlows,
  config?: OpcoesDeriveFlows
): Fluxo[] {
  const cfg: ConfigLayoutMapa = { ...LAYOUT_PADRAO, ...config };
  const hoje = config?.hoje ?? state.hoje ?? '2026-11-01';
  const layout = config?.layout ?? layoutWorld({ ...state, hoje }, cfg);
  const lojas = config?.lojas ?? deriveShops(state, { ...cfg, hoje, layout });

  const projetosAtivosPorId = new Map<UUID, Projeto>();
  for (const p of state.projetos) {
    if (p.arquivadoEm === null) {
      projetosAtivosPorId.set(p.id, p);
    }
  }

  const corPorSetorId = new Map<UUID, string>();
  for (const s of state.setores) {
    corPorSetorId.set(s.id, s.cor);
  }

  // Cliente dominante por projeto (para a lente Clientes da Seção 4.6)
  const clienteDominantePorProjeto = new Map<UUID, UUID>();
  const maiorReceitaClientePorProjeto = new Map<UUID, number>();
  for (const v of state.vinculosCliente ?? []) {
    if (v.arquivadoEm !== null) continue;
    const atual = maiorReceitaClientePorProjeto.get(v.projetoId) ?? -1;
    if (v.receitaRecorrenteCentavos > atual) {
      maiorReceitaClientePorProjeto.set(v.projetoId, v.receitaRecorrenteCentavos);
      clienteDominantePorProjeto.set(v.projetoId, v.clienteId);
    }
  }
  for (const l of state.lancamentos ?? []) {
    if (l.arquivadoEm !== null || l.tipo !== 'receita' || !l.clienteId) continue;
    if (!clienteDominantePorProjeto.has(l.projetoId)) {
      clienteDominantePorProjeto.set(l.projetoId, l.clienteId);
    }
  }

  const fluxosBrutos: Fluxo[] = [];

  // 1. Fluxos de Produção (cidade -> loja na Metrópole Central)
  // Apenas lojas abertas ou abrindo com receitaMensal > 0 geram fluxo (lojas fechadas não têm NPCs)
  const todosProdutosPorProjeto = new Map<UUID, string[]>();
  for (const l of lojas) {
    if (l.bancaSemProduto || (l.estado !== 'aberta' && l.estado !== 'abrindo')) continue;
    const lista = todosProdutosPorProjeto.get(l.projetoId);
    if (lista) {
      if (!lista.includes(l.produtoId)) lista.push(l.produtoId);
    } else {
      todosProdutosPorProjeto.set(l.projetoId, [l.produtoId]);
    }
  }

  for (const loja of lojas) {
    if (loja.estado !== 'aberta' && loja.estado !== 'abrindo') continue;
    if (loja.receitaMensal <= 0) continue;
    if (!projetosAtivosPorId.has(loja.projetoId)) continue;

    const corSetor = corPorSetorId.get(loja.setorId) ?? '#B8923A';
    const tipoCarga = mapearTipoCargaProduto(
      loja.tipoLoja,
      loja.icone,
      loja.nomeProduto
    );
    const idsDoProjeto = todosProdutosPorProjeto.get(loja.projetoId) ?? [loja.produtoId];
    const produtoIdsOrdenados = [
      loja.produtoId,
      ...idsDoProjeto.filter((pid) => pid !== loja.produtoId),
    ];

    fluxosBrutos.push({
      id: `fluxo-producao-${loja.projetoId}-${loja.produtoId}`,
      tipo: 'producao',
      origemId: loja.projetoId,
      destinoId: loja.produtoId,
      volumeMensal: loja.receitaMensal,
      produtoIds: produtoIdsOrdenados,
      rota: [],
      quantidadeNpcs: calcularQuantidadeNpcsPorRota(loja.receitaMensal, cfg),
      setorOrigemId: loja.setorId,
      corSetorOrigem: corSetor,
      tipoCarga,
      clienteIdDominante: clienteDominantePorProjeto.get(loja.projetoId) ?? null,
    });
  }

  // 2. Fluxos de Insumo (Metrópole Central -> cidade): volume = custos mensais de insumos do projeto
  const custoJanelaPorProjeto = new Map<UUID, number>();
  for (const lanc of state.lancamentos ?? []) {
    if (lanc.arquivadoEm !== null || lanc.tipo !== 'custo' || lanc.valorCentavos <= 0) {
      continue;
    }
    if (lanc.data > hoje) continue;
    const dias = diferencaDias(hoje, lanc.data);
    if (dias >= 0 && dias <= cfg.janelaMediaMovelReceitaDias) {
      custoJanelaPorProjeto.set(
        lanc.projetoId,
        (custoJanelaPorProjeto.get(lanc.projetoId) ?? 0) + lanc.valorCentavos
      );
    }
  }

  // Também contabiliza insumos da BOM (itensDeLista) quando existirem
  if (state.itens && state.itensDeLista) {
    const custoUnitPorItem = new Map<UUID, number>();
    for (const it of state.itens) {
      if (it.arquivadoEm === null) {
        custoUnitPorItem.set(it.id, it.custoUnitarioCentavos);
      }
    }
    for (const il of state.itensDeLista) {
      if (il.arquivadoEm !== null) continue;
      const unit = custoUnitPorItem.get(il.itemId) ?? 0;
      if (unit > 0 && il.quantidade > 0) {
        custoJanelaPorProjeto.set(
          il.projetoId,
          (custoJanelaPorProjeto.get(il.projetoId) ?? 0) + Math.round(unit * il.quantidade)
        );
      }
    }
  }

  for (const [projetoId, somaCustos] of custoJanelaPorProjeto.entries()) {
    const projeto = projetosAtivosPorId.get(projetoId);
    if (!projeto) continue;
    const custoMensal = Math.round(somaCustos / cfg.divisorMediaMovelMeses);
    if (custoMensal <= 0) continue;

    const corSetor = corPorSetorId.get(projeto.setorId) ?? '#7A5A2B';
    fluxosBrutos.push({
      id: `fluxo-insumo-${projeto.id}`,
      tipo: 'insumo',
      origemId: 'metropole-central',
      destinoId: projeto.id,
      volumeMensal: custoMensal,
      produtoIds: [],
      rota: [],
      quantidadeNpcs: calcularQuantidadeNpcsPorRota(custoMensal, cfg),
      setorOrigemId: projeto.setorId,
      corSetorOrigem: corSetor,
      tipoCarga: 'moedas_insumos',
      clienteIdDominante: clienteDominantePorProjeto.get(projeto.id) ?? null,
    });
  }

  // 3. Fluxos de Ligação (cidade -> cidade)
  const tiposPorId = new Map<UUID, TipoLigacao>();
  for (const t of state.tiposLigacao ?? []) {
    tiposPorId.set(t.id, t);
  }

  const produtosPorProjeto = new Map<UUID, string[]>();
  for (const l of lojas) {
    if (l.bancaSemProduto) continue;
    const arr = produtosPorProjeto.get(l.projetoId);
    if (arr) arr.push(l.produtoId);
    else produtosPorProjeto.set(l.projetoId, [l.produtoId]);
  }

  for (const lig of state.ligacoes ?? []) {
    if (lig.arquivadoEm !== null) continue;
    const pOrigem = projetosAtivosPorId.get(lig.origemId);
    const pDestino = projetosAtivosPorId.get(lig.destinoId);
    if (!pOrigem || !pDestino) continue;

    const volumeLigacao = lig.forca * cfg.fluxoVolumeBaseCentavos;
    if (volumeLigacao <= 0) continue;

    const tipoObj = tiposPorId.get(lig.tipoId);
    const nomeTipo = (tipoObj?.nome ?? lig.tipoId).toLowerCase();
    let tipoCarga = 'caixas';
    if (nomeTipo.includes('codigo') || nomeTipo.includes('código')) {
      tipoCarga = 'pergaminhos';
    } else if (nomeTipo.includes('financia')) {
      tipoCarga = 'moedas_insumos';
    } else if (nomeTipo.includes('insumo')) {
      tipoCarga = 'sacos';
    }

    const corSetor = corPorSetorId.get(pOrigem.setorId) ?? tipoObj?.cor ?? '#7A5A2B';
    fluxosBrutos.push({
      id: `fluxo-ligacao-${lig.id}`,
      tipo: 'ligacao',
      origemId: lig.origemId,
      destinoId: lig.destinoId,
      volumeMensal: volumeLigacao,
      produtoIds: produtosPorProjeto.get(lig.origemId) ?? [],
      rota: [],
      quantidadeNpcs: calcularQuantidadeNpcsPorRota(volumeLigacao, cfg),
      setorOrigemId: pOrigem.setorId,
      corSetorOrigem: corSetor,
      tipoCarga,
      clienteIdDominante:
        clienteDominantePorProjeto.get(lig.origemId) ??
        clienteDominantePorProjeto.get(lig.destinoId) ??
        null,
    });
  }

  // 4. Teto global de 1.500 NPCs: reduz proporcionalmente sem cortar nenhuma rota inteira
  const tetoGlobal = config?.tetoGlobalNpcsOverride ?? cfg.tetoGlobalNpcs;
  let somaNpcs = 0;
  for (const f of fluxosBrutos) {
    somaNpcs += f.quantidadeNpcs ?? 0;
  }

  if (somaNpcs > tetoGlobal && fluxosBrutos.length > 0) {
    const fator = tetoGlobal / somaNpcs;
    let novaSoma = 0;
    for (const f of fluxosBrutos) {
      const nOriginal = f.quantidadeNpcs ?? 1;
      // Garante pelo menos 1 NPC por rota ativa ("sem cortar nenhuma inteira")
      const nReduzido = Math.max(1, Math.floor(nOriginal * fator));
      f.quantidadeNpcs = nReduzido;
      novaSoma += nReduzido;
    }

    // Se ainda exceder o teto (por arredondamento e existirem < tetoGlobal rotas), reduz de 1 em 1 nas rotas com mais de 1 NPC
    if (novaSoma > tetoGlobal) {
      const ordenadosPorN = fluxosBrutos
        .slice()
        .sort((a, b) => (b.quantidadeNpcs ?? 0) - (a.quantidadeNpcs ?? 0));
      for (const f of ordenadosPorN) {
        if (novaSoma <= tetoGlobal) break;
        while ((f.quantidadeNpcs ?? 0) > 1 && novaSoma > tetoGlobal) {
          f.quantidadeNpcs = (f.quantidadeNpcs ?? 2) - 1;
          novaSoma--;
        }
      }
    }
  }

  // 5. Roteia polilinhas via routeRoads
  const resultadoEstradas = routeRoads(layout, fluxosBrutos, cfg, lojas);
  return resultadoEstradas.fluxosRoteados;
}
