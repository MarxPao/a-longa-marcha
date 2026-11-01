import React from 'react';
import type { Projeto } from '../../domain';
import { useCampanhaStore } from '../../store';
import { formatarData, formatarHoras, formatarMoeda } from '../formatadores';
import { GraficoFinancasSvg, type DadoMesFinanceiro } from './GraficoFinancasSvg';

interface Props {
  projeto: Projeto;
}

export function AbaFinancas({ projeto }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);

  const lancamentos = dump.lancamentos.filter(
    (l) => l.projetoId === projeto.id && l.arquivadoEm === null
  );

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 220, overflowY: 'auto' }}>
            {lancamentos.map((l) => {
              const categoria = dump.categoriasLancamento.find((c) => c.id === l.categoriaId);
              return (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
