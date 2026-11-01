import React, { useState } from 'react';
import type { Aplicacao } from '../../domain';
import { useCampanhaStore } from '../../store';
import { formatarHoras, formatarMoeda } from '../formatadores';

interface Props {
  projetoId: string;
}

export function AbaPd({ projetoId }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);

  const [modalAplicarTecnologia, setModalAplicarTecnologia] = useState(false);
  const [tecnologiaSelecionadaId, setTecnologiaSelecionadaId] = useState<string>('');
  const [efeitoSelecionado, setEfeitoSelecionado] = useState<Aplicacao['efeito']>('velocidade');
  const [valorEstimado, setValorEstimado] = useState('20%');

  // Aplicações existentes neste projeto
  const aplicacoes = dump.aplicacoes.filter((a) => a.projetoId === projetoId);
  const tecIdsAplicadas = new Set(aplicacoes.map((a) => a.tecnologiaId));

  // Tecnologias candidatas disponíveis (estado 'dominada' que ainda não foram aplicadas)
  const tecnologiasCandidatas = dump.tecnologias.filter(
    (t) => t.estado === 'dominada' && !tecIdsAplicadas.has(t.id) && t.arquivadoEm === null
  );

  // Horas de pesquisa investidas associadas a este projeto
  const horasPesquisa = dump.registrosDeHoras
    .filter((r) => r.projetoId === projetoId && r.tecnologiaId !== null && r.arquivadoEm === null)
    .reduce((acc, r) => acc + r.horas, 0);

  const salvarAplicacaoTecnologia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tecnologiaSelecionadaId) return;

    const centavos = Math.round(parseFloat(valorEstimado || '0') * 100);
    await criarEntidade<Aplicacao>('aplicacoes', {
      projetoId,
      tecnologiaId: tecnologiaSelecionadaId,
      efeito: efeitoSelecionado,
      valorEstimadoCentavos: centavos > 0 ? centavos : null,
    });

    setModalAplicarTecnologia(false);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      data-testid="aba-pd-conteudo"
    >
      {/* Resumo de Pesquisa e Horas Investidas */}
      <div
        style={{
          background: '#fffdf7',
          padding: '0.6rem 0.8rem',
          borderRadius: '4px',
          border: '1px solid var(--pergaminho-escuro)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        data-testid="resumo-pesquisa-pd"
      >
        <div>
          <span style={{ fontSize: '0.74rem', color: 'var(--bronze)', fontWeight: 600 }}>
            Horas de Pesquisa neste Projeto
          </span>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3E7C68' }}>
            🔬 {formatarHoras(horasPesquisa)}
          </div>
        </div>

        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          data-testid="botao-registrar-pesquisa"
          onClick={() => abrirModal('capturaRapida', 'horas')}
          style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
        >
          ⏱️ Registrar Pesquisa
        </button>
      </div>

      {/* Tecnologias Aplicadas ao Projeto */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
            Tecnologias Aplicadas ({aplicacoes.length})
          </span>
          {tecnologiasCandidatas.length > 0 && (
            <button
              type="button"
              className="botao-campanha botao-campanha-ouro"
              data-testid="botao-aplicar-tecnologia"
              onClick={() => {
                setTecnologiaSelecionadaId(tecnologiasCandidatas[0]?.id ?? '');
                setModalAplicarTecnologia(true);
              }}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
            >
              + Aplicar Tecnologia
            </button>
          )}
        </div>

        {aplicacoes.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--bronze)', padding: '0.6rem', textAlign: 'center' }}>
            Nenhuma tecnologia dominada aplicada a este projeto ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {aplicacoes.map((ap) => {
              const tec = dump.tecnologias.find((t) => t.id === ap.tecnologiaId);
              return (
                <div
                  key={ap.id}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#fffdf7',
                    border: '1px solid var(--pergaminho-escuro)',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                  }}
                  data-testid={`card-aplicacao-${ap.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>🔬 {tec?.nome ?? 'Tecnologia'}</span>
                    <span
                      className="badge"
                      style={{
                        fontSize: '0.68rem',
                        background: '#d1e7dd',
                        color: '#0f5132',
                      }}
                    >
                      {ap.efeito}{ap.valorEstimadoCentavos ? ` (${formatarMoeda(ap.valorEstimadoCentavos)})` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#666', marginTop: '0.2rem' }}>
                    {tec?.descricao || 'Sem descrição cadastrada.'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tecnologias Candidatas Disponíveis (Seção 6.5) */}
      <div
        style={{
          background: '#fffdf7',
          padding: '0.6rem',
          borderRadius: '4px',
          border: '1px solid var(--pergaminho-escuro)',
        }}
        data-testid="secao-tecnologias-candidatas"
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--tinta)' }}>
          💡 Tecnologias Candidatas ({tecnologiasCandidatas.length})
        </span>
        <div style={{ fontSize: '0.72rem', color: 'var(--bronze)', marginBottom: '0.4rem' }}>
          Tecnologias dominadas disponíveis no Império prontas para aplicação:
        </div>

        {tecnologiasCandidatas.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--bronze)', margin: 0 }}>
            Nenhuma tecnologia dominada disponível no momento. Pesquise novas tecnologias na árvore.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {tecnologiasCandidatas.map((tc) => (
              <div
                key={tc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.3rem 0.5rem',
                  background: '#f8f5eb',
                  borderRadius: '3px',
                  fontSize: '0.76rem',
                }}
                data-testid={`candidata-${tc.id}`}
              >
                <span>
                  <strong>{tc.nome}</strong> (dominada)
                </span>
                <button
                  type="button"
                  className="botao-campanha"
                  style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                  onClick={() => {
                    setTecnologiaSelecionadaId(tc.id);
                    setModalAplicarTecnologia(true);
                  }}
                  data-testid={`botao-aplicar-candidata-${tc.id}`}
                >
                  Aplicar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Aplicar Tecnologia */}
      {modalAplicarTecnologia && (
        <div className="modal-overlay">
          <div className="modal-caixa" style={{ maxWidth: 420 }}>
            <div className="modal-cabecalho">
              <h3 className="modal-titulo">🔬 Aplicar Tecnologia ao Projeto</h3>
              <button
                type="button"
                className="botao-campanha"
                onClick={() => setModalAplicarTecnologia(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void salvarAplicacaoTecnologia(e)}>
              <div className="modal-corpo">
                <div className="campo-form">
                  <label className="rotulo-form">Selecione a Tecnologia:</label>
                  <select
                    className="select-form"
                    value={tecnologiaSelecionadaId}
                    onChange={(e) => setTecnologiaSelecionadaId(e.target.value)}
                    data-testid="select-tecnologia-aplicar"
                    required
                  >
                    {tecnologiasCandidatas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo-form">
                  <label className="rotulo-form">Efeito Esperado:</label>
                  <select
                    className="select-form"
                    value={efeitoSelecionado}
                    onChange={(e) => setEfeitoSelecionado(e.target.value as Aplicacao['efeito'])}
                    data-testid="select-efeito-tecnologia"
                  >
                    <option value="velocidade">Velocidade (+ produtividade)</option>
                    <option value="custo">Custo (- despesas)</option>
                    <option value="receita_nova">Receita Nova (+ novos produtos)</option>
                  </select>
                </div>

                <div className="campo-form">
                  <label className="rotulo-form">Valor Estimado do Impacto:</label>
                  <input
                    type="text"
                    className="input-texto"
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(e.target.value)}
                    data-testid="input-valor-estimado-tecnologia"
                    placeholder="Ex: -15% custo ou +R$ 5.000"
                    required
                  />
                </div>
              </div>
              <div className="modal-rodape">
                <button
                  type="button"
                  className="botao-campanha"
                  onClick={() => setModalAplicarTecnologia(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="botao-campanha botao-campanha-jade"
                  data-testid="botao-confirmar-aplicacao-tecnologia"
                >
                  Confirmar Aplicação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
