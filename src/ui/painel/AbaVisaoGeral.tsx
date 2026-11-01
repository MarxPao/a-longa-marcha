import React, { useState } from 'react';
import type { Projeto } from '../../domain';
import { useCampanhaStore } from '../../store';
import { textosPtBr } from '../../textos/pt-BR';
import { formatarHoras } from '../formatadores';

interface Props {
  projeto: Projeto;
  descontos: { pontos: number; detalhe: string }[];
  horasNaSemana: number;
  abrirModalRuinas: () => void;
  abrirModalEditar: () => void;
}

export function AbaVisaoGeral({
  projeto,
  descontos,
  horasNaSemana,
  abrirModalRuinas,
  abrirModalEditar,
}: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);

  const [editandoNotas, setEditandoNotas] = useState(false);
  const [textoNotas, setTextoNotas] = useState(projeto.notas);

  // Ligações envolvendo este projeto
  const ligacoesDoProjeto = dump.ligacoes.filter(
    (l) =>
      l.arquivadoEm === null &&
      (l.origemId === projeto.id || l.destinoId === projeto.id)
  );

  // Financiamento cruzado (tipo 'financia')
  const ligacoesFinancia = ligacoesDoProjeto.filter((l) => {
    const tipo = dump.tiposLigacao.find((t) => t.id === l.tipoId);
    return tipo?.nome === 'financia' || l.tipoId.includes('financia');
  });

  const salvarNotas = async () => {
    await atualizarEntidade<Projeto>('projetos', projeto.id, {
      notas: textoNotas,
    });
    setEditandoNotas(false);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      data-testid="aba-visao-geral-conteudo"
    >
      {/* Princípio 2: Lista dos descontos que compõem a saúde */}
      <div className="descontos-saude-container" data-testid="container-descontos-saude">
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--laca)',
            display: 'block',
            marginBottom: '0.4rem',
          }}
        >
          {textosPtBr.painelProjeto.descontosSaudeTitulo}
        </span>

        {descontos.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: '#0f5132' }} data-testid="sem-descontos-saude">
            {textosPtBr.painelProjeto.semDescontos}
          </p>
        ) : (
          descontos.map((d, idx) => (
            <div key={idx} className="desconto-item" data-testid={`desconto-item-${idx}`}>
              <span>⚠️ -{d.pontos} pts:</span>
              <span>{d.detalhe}</span>
            </div>
          ))
        )}
      </div>

      {/* Metas e Horas da Semana */}
      <div
        style={{
          background: '#fffdf7',
          padding: '0.8rem',
          borderRadius: '4px',
          border: '1px solid var(--pergaminho-escuro)',
        }}
        data-testid="container-horas-semana"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.4rem',
            fontSize: '0.82rem',
          }}
        >
          <span style={{ fontWeight: 600 }}>{textosPtBr.painelProjeto.horasSemana}:</span>
          <span data-testid="horas-semana-progresso">
            {formatarHoras(horasNaSemana)} / {formatarHoras(projeto.horasAlvoSemana)}
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#eee',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(
                100,
                projeto.horasAlvoSemana > 0
                  ? (horasNaSemana / projeto.horasAlvoSemana) * 100
                  : 100
              )}%`,
              height: '100%',
              backgroundColor:
                horasNaSemana >= projeto.horasAlvoSemana ? '#3E7C68' : '#B8923A',
            }}
          />
        </div>
      </div>

      {/* Ligações Estratégicas e Financiamento Cruzado */}
      <div
        style={{
          background: '#fffdf7',
          padding: '0.8rem',
          borderRadius: '4px',
          border: '1px solid var(--pergaminho-escuro)',
        }}
        data-testid="container-ligacoes-projeto"
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--tinta)' }}>
          🔗 Ligações Estratégicas ({ligacoesDoProjeto.length})
        </span>

        {ligacoesDoProjeto.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--bronze)', marginTop: '0.3rem' }}>
            Nenhuma ligação ativa. Use Shift+Arrastar no mapa para ligar a outra cidade.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
            {ligacoesDoProjeto.map((l) => {
              const ehOrigem = l.origemId === projeto.id;
              const outroId = ehOrigem ? l.destinoId : l.origemId;
              const outroProj = dump.projetos.find((p) => p.id === outroId);
              const tipo = dump.tiposLigacao.find((t) => t.id === l.tipoId);

              return (
                <div
                  key={l.id}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.3rem 0.5rem',
                    background: '#f8f5eb',
                    borderRadius: '3px',
                    borderLeft: `3px solid ${tipo?.cor ?? '#B8923A'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                  data-testid={`ligacao-item-${l.id}`}
                >
                  <span>
                    <strong>{ehOrigem ? '➔ Envia para' : '⬅ Recebe de'}:</strong>{' '}
                    {outroProj?.nome ?? 'Cidade'} ({tipo?.nome ?? 'ligação'})
                  </span>
                  <span style={{ color: 'var(--bronze)' }}>Força {l.forca}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumo de Financiamento Cruzado */}
        {ligacoesFinancia.length > 0 && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.4rem',
              background: 'rgba(184, 146, 58, 0.1)',
              borderRadius: '3px',
              fontSize: '0.75rem',
              color: '#6e5114',
            }}
            data-testid="financiamento-cruzado-resumo"
          >
            💰 <strong>Financiamento Cruzado Ativo:</strong> {ligacoesFinancia.length} rota(s) de suporte financeiro conectada(s).
          </div>
        )}
      </div>

      {/* Notas do Projeto com Edição */}
      <div
        style={{
          background: '#fffdf7',
          padding: '0.8rem',
          borderRadius: '4px',
          border: '1px solid var(--pergaminho-escuro)',
          fontSize: '0.82rem',
        }}
        data-testid="container-notas-projeto"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <strong>📝 Notas e Orientações:</strong>
          <button
            type="button"
            className="botao-campanha"
            style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
            onClick={() => (editandoNotas ? void salvarNotas() : setEditandoNotas(true))}
            data-testid="botao-editar-notas"
          >
            {editandoNotas ? 'Salvar' : 'Editar'}
          </button>
        </div>

        {editandoNotas ? (
          <textarea
            className="textarea-form"
            value={textoNotas}
            onChange={(e) => setTextoNotas(e.target.value)}
            style={{ minHeight: '60px', width: '100%' }}
            data-testid="input-editar-notas"
          />
        ) : (
          <p
            style={{ margin: 0, whiteSpace: 'pre-wrap', color: projeto.notas ? 'var(--tinta)' : 'var(--bronze)' }}
            data-testid="texto-notas-projeto"
          >
            {projeto.notas || 'Nenhuma nota registrada para este projeto.'}
          </p>
        )}
      </div>

      {/* Ações Rápidas da Aba Visão Geral */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="botao-campanha"
          style={{ flex: 1 }}
          onClick={abrirModalEditar}
          data-testid="botao-abrir-edicao-projeto"
        >
          ✏️ Editar Projeto
        </button>
        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          style={{ flex: 1 }}
          onClick={() => abrirModal('capturaRapida', 'horas')}
          data-testid="botao-registrar-horas-visao-geral"
        >
          ⏱️ Registrar Horas
        </button>
        <button
          type="button"
          className="botao-campanha botao-campanha-laca"
          data-testid="botao-arquivar-projeto"
          onClick={abrirModalRuinas}
        >
          🏚️ {textosPtBr.painelProjeto.botoes.arquivarRuinas}
        </button>
      </div>
    </div>
  );
}
