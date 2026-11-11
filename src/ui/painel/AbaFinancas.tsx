import React, { useState } from 'react';
import { OPCOES_ICONE_PRODUTO, OPCOES_TIPO_LOJA } from '../../config/layout';
import { inferirTipoLojaPadrao, type Lancamento, type Produto, type Projeto, type UUID } from '../../domain';
import { useCampanhaStore } from '../../store';
import { formatarData, formatarHoras, formatarMoeda } from '../formatadores';
import { ListaVirtualizada } from '../ListaVirtualizada';
import { GraficoFinancasSvg, type DadoMesFinanceiro } from './GraficoFinancasSvg';

interface Props {
  projeto: Projeto;
}

export function AbaFinancas({ projeto }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const produtoDestacadoId = useCampanhaStore((s) => s.produtoDestacadoId);
  const definirProdutoDestacado = useCampanhaStore((s) => s.definirProdutoDestacado);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);
  const arquivarEntidade = useCampanhaStore((s) => s.arquivarEntidade);

  const padraoInicial = inferirTipoLojaPadrao(projeto.nome, projeto.setorId);
  const [formProdutoAberto, setFormProdutoAberto] = useState(false);
  const [editandoProdutoId, setEditandoProdutoId] = useState<UUID | null>(null);
  const [nomeProduto, setNomeProduto] = useState('');
  const [categoriaProduto, setCategoriaProduto] = useState('Principal');
  const [tipoLojaProduto, setTipoLojaProduto] = useState(padraoInicial.tipoLoja);
  const [iconeProduto, setIconeProduto] = useState(padraoInicial.icone);

  const produtosDoProjeto = dump.produtos.filter(
    (p) => p.projetoId === projeto.id && p.arquivadoEm === null
  );

  const lancamentos = dump.lancamentos.filter(
    (l) => l.projetoId === projeto.id && l.arquivadoEm === null
  );

  const lancamentosReceitaSemProduto = lancamentos.filter(
    (l) => l.tipo === 'receita' && (!l.produtoId || !produtosDoProjeto.some((p) => p.id === l.produtoId))
  );

  const abrirCriacaoProduto = () => {
    const sugerido = inferirTipoLojaPadrao(projeto.nome, projeto.setorId);
    setEditandoProdutoId(null);
    setNomeProduto('');
    setCategoriaProduto('Principal');
    setTipoLojaProduto(sugerido.tipoLoja);
    setIconeProduto(sugerido.icone);
    setFormProdutoAberto(true);
  };

  const abrirEdicaoProduto = (prod: Produto) => {
    setEditandoProdutoId(prod.id);
    setNomeProduto(prod.nome);
    setCategoriaProduto(prod.categoria);
    setTipoLojaProduto(prod.tipoLoja);
    setIconeProduto(prod.icone);
    setFormProdutoAberto(true);
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeProduto.trim()) return;

    if (editandoProdutoId) {
      await atualizarEntidade<Produto>('produtos', editandoProdutoId, {
        nome: nomeProduto.trim(),
        categoria: categoriaProduto.trim() || 'Geral',
        tipoLoja: tipoLojaProduto,
        icone: iconeProduto,
      });
    } else {
      const criado = await criarEntidade<Produto>('produtos', {
        projetoId: projeto.id,
        nome: nomeProduto.trim(),
        categoria: categoriaProduto.trim() || 'Geral',
        tipoLoja: tipoLojaProduto,
        icone: iconeProduto,
        ativo: true,
      });
      definirProdutoDestacado(criado.id);

      // Se havia lançamentos de receita sem produto, vincula automaticamente ao primeiro produto criado
      if (produtosDoProjeto.length === 0 && lancamentosReceitaSemProduto.length > 0) {
        for (const lanc of lancamentosReceitaSemProduto) {
          await atualizarEntidade<Lancamento>('lancamentos', lanc.id, {
            produtoId: criado.id,
          });
        }
      }
    }

    setFormProdutoAberto(false);
    setEditandoProdutoId(null);
  };

  const associarReceitasAoPrimeiroProdutoOuCriar = async () => {
    const primeiroProduto = produtosDoProjeto[0];
    if (!primeiroProduto) {
      abrirCriacaoProduto();
      return;
    }
    for (const lanc of lancamentosReceitaSemProduto) {
      await atualizarEntidade<Lancamento>('lancamentos', lanc.id, {
        produtoId: primeiroProduto.id,
      });
    }
    definirProdutoDestacado(primeiroProduto.id);
  };

  const derivado = derivadosPorProjeto.get(projeto.id);
  const fluxoMes = derivado?.fluxoMes;
  const roi = derivado?.roi;

  // Monta histórico de meses + projeção para o gráfico SVG de 12 meses (Seção 6.5)
  const mesAtualYM = semanaAtual.slice(0, 7);
  const dadosGrafico: DadoMesFinanceiro[] = [];

  // Mês Atual
  dadosGrafico.push({
    mesRotulo: mesAtualYM.slice(2),
    receitaCentavos: fluxoMes?.receitaCentavos ?? 0,
    custoCentavos: fluxoMes?.custoCentavos ?? 0,
    projetado: false,
  });

  // Projeção dos próximos 5 meses com recorrências ativas
  const vinculosAtivos = dump.vinculosCliente.filter(
    (v) => v.projetoId === projeto.id && v.arquivadoEm === null
  );
  const receitaRecorrenteMes = vinculosAtivos.reduce(
    (acc, v) => acc + v.receitaRecorrenteCentavos,
    0
  );

  for (let i = 1; i <= 5; i++) {
    dadosGrafico.push({
      mesRotulo: `+${i}m`,
      receitaCentavos: receitaRecorrenteMes,
      custoCentavos: fluxoMes?.custoCentavos ?? 0,
      projetado: true,
    });
  }

  // Financiamento cruzado envolvendo este projeto
  const ligacoesFinancia = dump.ligacoes.filter((l) => {
    if (l.arquivadoEm !== null) return false;
    const tipo = dump.tiposLigacao.find((t) => t.id === l.tipoId);
    const ehFinancia = tipo?.nome === 'financia' || l.tipoId.includes('financia');
    return ehFinancia && (l.origemId === projeto.id || l.destinoId === projeto.id);
  });

  // Ranking relativo de ROI
  const todosRois = Array.from(derivadosPorProjeto.values())
    .map((d) => d.roi.centavosPorHora ?? 0)
    .sort((a, b) => b - a);
  const rankingRoi = roi?.centavosPorHora != null ? todosRois.indexOf(roi.centavosPorHora) + 1 : 1;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      data-testid="aba-financas-conteudo"
    >
      {/* Resumo do Fluxo do Mês e ROI por Hora */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem',
        }}
      >
        <div
          style={{
            background: '#fffdf7',
            padding: '0.6rem',
            borderRadius: '4px',
            border: '1px solid var(--pergaminho-escuro)',
          }}
          data-testid="fluxo-mes-resumo"
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--bronze)', fontWeight: 600 }}>
            Fluxo Líquido ({mesAtualYM})
          </span>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: (fluxoMes?.liquidoCentavos ?? 0) >= 0 ? '#3E7C68' : 'var(--laca)',
              marginTop: '0.2rem',
            }}
            data-testid="valor-fluxo-mes"
          >
            {formatarMoeda(fluxoMes?.liquidoCentavos ?? 0)}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#666', marginTop: '0.2rem' }}>
            +{formatarMoeda(fluxoMes?.receitaCentavos ?? 0)} / -
            {formatarMoeda(fluxoMes?.custoCentavos ?? 0)}
          </div>
        </div>

        <div
          style={{
            background: '#fffdf7',
            padding: '0.6rem',
            borderRadius: '4px',
            border: '1px solid var(--pergaminho-escuro)',
          }}
          data-testid="roi-hora-resumo"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--bronze)', fontWeight: 600 }}>
              ROI por Hora
            </span>
            <span style={{ fontSize: '0.68rem', color: '#B8923A', fontWeight: 700 }}>
              #{rankingRoi} no Império
            </span>
          </div>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#B8923A',
              marginTop: '0.2rem',
            }}
            data-testid="valor-roi-hora"
          >
            {formatarMoeda(roi?.centavosPorHora ?? 0)} / h
          </div>
          <div style={{ fontSize: '0.68rem', color: '#666', marginTop: '0.2rem' }}>
            Total: {formatarMoeda(roi?.receitaCentavos ?? 0)} em {formatarHoras(roi?.horas ?? 0)}
          </div>
        </div>
      </div>

      {/* Gráfico Analítico de 12 Meses em SVG (Seção 6.5) */}
      <div data-testid="secao-grafico-financas">
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--tinta)',
            display: 'block',
            marginBottom: '0.3rem',
          }}
        >
          📊 Histórico & Projeção Mensal de 6 Meses
        </span>
        <GraficoFinancasSvg dados={dadosGrafico} />
      </div>

      {/* Financiamento Cruzado Detalhado */}
      {ligacoesFinancia.length > 0 && (
        <div
          style={{
            background: 'rgba(184, 146, 58, 0.08)',
            border: '1px solid var(--ouro)',
            padding: '0.6rem',
            borderRadius: '4px',
            fontSize: '0.78rem',
          }}
          data-testid="bloco-financiamento-cruzado"
        >
          <span style={{ fontWeight: 700, color: '#6e5114' }}>
            🤝 Financiamento Cruzado (Seção 3.5):
          </span>
          {ligacoesFinancia.map((l) => {
            const ehOrigem = l.origemId === projeto.id;
            const outroProj = dump.projetos.find((p) => p.id === (ehOrigem ? l.destinoId : l.origemId));
            return (
              <div key={l.id} style={{ marginTop: '0.2rem' }}>
                {ehOrigem ? (
                  <span>
                    Este projeto <strong>financia e cobre déficits</strong> de <em>{outroProj?.nome}</em>.
                  </span>
                ) : (
                  <span>
                    Este projeto <strong>recebe suporte financeiro</strong> de <em>{outroProj?.nome}</em>.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Seção de Produtos & Lojas na Metrópole Central (Seções 4.3, 4.6 e 5) */}
      <div
        data-testid="secao-produtos-mercado"
        style={{
          background: '#fffdf7',
          border: '1px solid var(--pergaminho-escuro)',
          borderRadius: '4px',
          padding: '0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--tinta)' }}>
            🏪 Produtos &amp; Lojas na Metrópole ({produtosDoProjeto.length})
          </span>
          <button
            type="button"
            className="botao-campanha botao-campanha-ouro"
            data-testid="botao-novo-produto-mercado"
            onClick={abrirCriacaoProduto}
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
          >
            + Novo Produto
          </button>
        </div>

        {/* Selo e atalho para receita sem produto (Seção 5) */}
        {lancamentosReceitaSemProduto.length > 0 && (
          <div
            data-testid="selo-associe-produto"
            style={{
              background: '#fff3cd',
              border: '1px solid #ffecb5',
              color: '#664d03',
              padding: '0.45rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.76rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              ⚠️ <strong>Associe um produto:</strong> {lancamentosReceitaSemProduto.length} receita(s) sem produto geram banca genérica na Metrópole.
            </span>
            <button
              type="button"
              className="botao-campanha botao-campanha-ouro"
              data-testid="botao-atalho-associar-produto"
              onClick={() => void associarReceitasAoPrimeiroProdutoOuCriar()}
              style={{ fontSize: '0.7rem', padding: '0.18rem 0.45rem', whiteSpace: 'nowrap' }}
            >
              Vincular Produto
            </button>
          </div>
        )}

        {/* Formulário de criação / edição de Produto */}
        {formProdutoAberto && (
          <form
            onSubmit={(e) => void salvarProduto(e)}
            data-testid="form-novo-produto-mercado"
            style={{
              background: 'rgba(184, 146, 58, 0.08)',
              border: '1px solid var(--ouro)',
              borderRadius: '4px',
              padding: '0.55rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              <div className="campo-form">
                <label className="rotulo-form">Nome do Produto:</label>
                <input
                  type="text"
                  className="input-texto"
                  data-testid="input-novo-produto-nome"
                  value={nomeProduto}
                  onChange={(e) => setNomeProduto(e.target.value)}
                  placeholder="Ex: Pão Artesanal"
                  required
                />
              </div>
              <div className="campo-form">
                <label className="rotulo-form">Categoria:</label>
                <input
                  type="text"
                  className="input-texto"
                  data-testid="input-novo-produto-categoria"
                  value={categoriaProduto}
                  onChange={(e) => setCategoriaProduto(e.target.value)}
                  placeholder="Ex: Panificação"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              <div className="campo-form">
                <label className="rotulo-form">Modelo da Loja (shopRegistry):</label>
                <select
                  className="select-form"
                  data-testid="select-novo-produto-tipo-loja"
                  value={tipoLojaProduto}
                  onChange={(e) => {
                    const novaChave = e.target.value;
                    setTipoLojaProduto(novaChave);
                    const opcao = OPCOES_TIPO_LOJA.find((o) => o.chave === novaChave);
                    if (opcao) setIconeProduto(opcao.iconePadrao);
                  }}
                >
                  {OPCOES_TIPO_LOJA.map((op) => (
                    <option key={op.chave} value={op.chave}>
                      {op.titulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo-form">
                <label className="rotulo-form">Ícone da Placa:</label>
                <select
                  className="select-form"
                  data-testid="select-novo-produto-icone"
                  value={iconeProduto}
                  onChange={(e) => setIconeProduto(e.target.value)}
                >
                  {OPCOES_ICONE_PRODUTO.map((ic) => (
                    <option key={ic.chave} value={ic.chave}>
                      {ic.simbolo} {ic.rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <button
                type="button"
                className="botao-campanha"
                onClick={() => {
                  setFormProdutoAberto(false);
                  setEditandoProdutoId(null);
                }}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="botao-campanha botao-campanha-jade"
                data-testid="botao-salvar-novo-produto"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
              >
                {editandoProdutoId ? 'Salvar Loja' : 'Criar Loja'}
              </button>
            </div>
          </form>
        )}

        {/* Lista de Produtos do Projeto */}
        {produtosDoProjeto.length === 0 ? (
          <p style={{ fontSize: '0.76rem', color: 'var(--bronze)', margin: 0 }}>
            Nenhum produto cadastrado. Cadastre um produto para abrir sua loja especializada na Metrópole Central.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {produtosDoProjeto.map((prod) => {
              const destacado = produtoDestacadoId === prod.id;
              const infoIcone = OPCOES_ICONE_PRODUTO.find((i) => i.chave === prod.icone);
              const infoTipoLoja = OPCOES_TIPO_LOJA.find((t) => t.chave === prod.tipoLoja);
              const soma90d = lancamentos
                .filter((l) => l.tipo === 'receita' && l.produtoId === prod.id)
                .reduce((acc, l) => acc + l.valorCentavos, 0);
              const mediaMensalCentavos = Math.round(soma90d / 3);

              return (
                <div
                  key={prod.id}
                  data-testid={`card-produto-${prod.id}`}
                  data-destacado={destacado ? 'true' : 'false'}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.42rem 0.55rem',
                    borderRadius: '4px',
                    border: destacado ? '2px solid var(--ouro)' : '1px solid var(--pergaminho-escuro)',
                    background: destacado ? 'rgba(184, 146, 58, 0.16)' : '#ffffff',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>{infoIcone?.simbolo ?? '📦'}</span>
                      <span data-testid={destacado ? 'nome-produto-destacado' : undefined}>
                        {prod.nome}
                      </span>
                      {destacado && (
                        <span
                          data-testid="badge-produto-destacado"
                          style={{
                            fontSize: '0.65rem',
                            background: 'var(--ouro)',
                            color: '#1F1B16',
                            padding: '0.08rem 0.35rem',
                            borderRadius: '3px',
                            fontWeight: 700,
                          }}
                        >
                          Loja Selecionada
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.12rem' }}>
                      {infoTipoLoja?.titulo ?? prod.tipoLoja} · {prod.categoria} · Média:{' '}
                      <strong style={{ color: '#3E7C68' }}>{formatarMoeda(mediaMensalCentavos)}/mês</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      type="button"
                      className="botao-campanha"
                      data-testid={`botao-editar-produto-${prod.id}`}
                      onClick={() => abrirEdicaoProduto(prod)}
                      style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                      title="Editar modelo de loja e ícone"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="botao-campanha botao-campanha-laca"
                      data-testid={`botao-arquivar-produto-${prod.id}`}
                      onClick={() => void arquivarEntidade('produtos', prod.id)}
                      style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                      title="Arquivar produto (desmonta loja na Metrópole)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de Lançamentos Recentes */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
            Lançamentos ({lancamentos.length})
          </span>
          <button
            type="button"
            className="botao-campanha botao-campanha-ouro"
            data-testid="botao-novo-lancamento"
            onClick={() => abrirModal('capturaRapida', 'lancamento')}
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
          >
            + Novo Lançamento
          </button>
        </div>

        {lancamentos.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--bronze)', padding: '0.6rem', textAlign: 'center' }}>
            Nenhum lançamento registrado neste projeto.
          </p>
        ) : (
          <ListaVirtualizada
            itens={lancamentos}
            alturaItemPx={44}
            alturaViewportPx={240}
            obterChave={(l) => l.id}
            testId="lista-virtualizada-lancamentos"
            renderizarItem={(l) => {
              const categoria = dump.categoriasLancamento.find((c) => c.id === l.categoriaId);
              const prodVinculado = produtosDoProjeto.find((p) => p.id === l.produtoId);
              return (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.4rem 0.6rem',
                    backgroundColor: '#fffdf7',
                    border: '1px solid var(--pergaminho-escuro)',
                    borderRadius: '3px',
                    fontSize: '0.8rem',
                  }}
                  data-testid={`item-lancamento-${l.id}`}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{categoria?.nome ?? 'Geral'}</span>
                    {prodVinculado && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(62, 124, 104, 0.14)',
                          color: '#2A594A',
                          padding: '0.08rem 0.35rem',
                          borderRadius: '3px',
                          marginLeft: '0.35rem',
                          fontWeight: 600,
                        }}
                      >
                        🏪 {prodVinculado.nome}
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: '#666', marginLeft: '0.4rem' }}>
                      {formatarData(l.data)}
                    </span>
                    {Boolean(l.recorrencia) && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: '#e9ecef',
                          padding: '0.1rem 0.3rem',
                          borderRadius: '2px',
                          marginLeft: '0.3rem',
                        }}
                      >
                        Recorrente
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: l.tipo === 'receita' ? '#3E7C68' : 'var(--laca)',
                    }}
                  >
                    {l.tipo === 'receita' ? '+' : '-'} {formatarMoeda(l.valorCentavos)}
                  </span>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
