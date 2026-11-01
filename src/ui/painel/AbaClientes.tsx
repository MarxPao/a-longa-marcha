import React, { useState } from 'react';
import type { Cliente, VinculoCliente } from '../../domain';
import { useCampanhaStore } from '../../store';
import { formatarData, formatarMoeda, formatarPercentual } from '../formatadores';

interface Props {
  projetoId: string;
}

export function AbaClientes({ projetoId }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);

  const [modalNovoVinculo, setModalNovoVinculo] = useState(false);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('');
  const [valorMensalReais, setValorMensalReais] = useState('1500.00');

  // Vínculos deste projeto
  const vinculos = dump.vinculosCliente.filter(
    (v) =>
      v.projetoId === projetoId &&
      v.arquivadoEm === null &&
      (!v.fim || v.fim >= semanaAtual)
  );

  const receitaRecorrenteTotalProjeto = vinculos.reduce(
    (acc, v) => acc + v.receitaRecorrenteCentavos,
    0
  );

  const limiteDiasContato = dump.meta.config.detectores.diasUltimoContatoCliente || 60;

  const registrarContatoHoje = async (cliente: Cliente) => {
    await atualizarEntidade<Cliente>('clientes', cliente.id, {
      ultimoContato: semanaAtual,
    });
  };

  const salvarNovoVinculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSelecionadoId) return;

    const centavos = Math.round(parseFloat(valorMensalReais || '0') * 100);
    await criarEntidade<VinculoCliente>('vinculosCliente', {
      projetoId,
      clienteId: clienteSelecionadoId,
      receitaRecorrenteCentavos: centavos,
      inicio: semanaAtual,
      fim: null,
    });

    setModalNovoVinculo(false);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      data-testid="aba-clientes-conteudo"
    >
      {/* Resumo e Botão de Vincular */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
            Vínculos Ativos ({vinculos.length})
          </span>
          <div style={{ fontSize: '0.74rem', color: '#3E7C68', fontWeight: 600 }}>
            Receita Recorrente Total: {formatarMoeda(receitaRecorrenteTotalProjeto)}/mês
          </div>
        </div>

        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          data-testid="botao-novo-vinculo-cliente"
          onClick={() => {
            setClienteSelecionadoId(dump.clientes[0]?.id ?? '');
            setModalNovoVinculo(true);
          }}
          style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
        >
          + Vincular Cliente
        </button>
      </div>

      {/* Lista de Vínculos de Clientes */}
      {vinculos.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--bronze)', padding: '1rem', textAlign: 'center' }}>
          Nenhum cliente com contrato ou receita recorrente vinculado a este projeto.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {vinculos.map((v) => {
            const cliente = dump.clientes.find((c) => c.id === v.clienteId);
            if (!cliente) return null;

            // Cálculo de dias desde último contato
            let diasSemContato = 0;
            if (cliente.ultimoContato) {
              const diffMs = new Date(semanaAtual).getTime() - new Date(cliente.ultimoContato).getTime();
              diasSemContato = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            } else {
              diasSemContato = 999;
            }

            const alertaDesatualizado = diasSemContato > limiteDiasContato;
            const proporcaoReceita =
              receitaRecorrenteTotalProjeto > 0
                ? v.receitaRecorrenteCentavos / receitaRecorrenteTotalProjeto
                : 0;

            return (
              <div
                key={v.id}
                style={{
                  padding: '0.6rem',
                  backgroundColor: '#fffdf7',
                  border: `1px solid ${alertaDesatualizado ? 'var(--laca)' : 'var(--pergaminho-escuro)'}`,
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
                data-testid={`card-cliente-${cliente.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    👤 {cliente.nome}
                  </span>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.68rem',
                      background:
                        cliente.statusRelacao === 'ativo'
                          ? '#d1e7dd'
                          : cliente.statusRelacao === 'em_risco'
                            ? '#f8d7da'
                            : '#fff3cd',
                    }}
                  >
                    {cliente.statusRelacao}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ color: '#245747', fontWeight: 600 }}>
                    {formatarMoeda(v.receitaRecorrenteCentavos)} / mês
                  </span>
                  <span style={{ color: 'var(--bronze)' }}>
                    Concentração: {formatarPercentual(proporcaoReceita)}
                  </span>
                </div>

                {/* Último Contato e Alerta de 60 Dias (Seção 6.5) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.72rem',
                    borderTop: '1px solid #eee',
                    paddingTop: '0.3rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <span
                    style={{
                      color: alertaDesatualizado ? 'var(--laca)' : 'var(--bronze)',
                      fontWeight: alertaDesatualizado ? 700 : 400,
                    }}
                    data-testid={`alerta-contato-${cliente.id}`}
                  >
                    {alertaDesatualizado
                      ? `⚠️ Sem contato há ${diasSemContato} dias (> ${limiteDiasContato}d)!`
                      : `Último contato: ${formatarData(cliente.ultimoContato ?? '')}`}
                  </span>

                  <button
                    type="button"
                    className="botao-campanha"
                    style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                    onClick={() => void registrarContatoHoje(cliente)}
                    data-testid={`botao-contato-hoje-${cliente.id}`}
                  >
                    🤝 Contato Hoje
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Novo Vínculo de Cliente */}
      {modalNovoVinculo && (
        <div className="modal-overlay">
          <div className="modal-caixa" style={{ maxWidth: 420 }}>
            <div className="modal-cabecalho">
              <h3 className="modal-titulo">🤝 Vincular Cliente ao Projeto</h3>
              <button
                type="button"
                className="botao-campanha"
                onClick={() => setModalNovoVinculo(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void salvarNovoVinculo(e)}>
              <div className="modal-corpo">
                <div className="campo-form">
                  <label className="rotulo-form">Selecione o Cliente:</label>
                  <select
                    className="select-form"
                    value={clienteSelecionadoId}
                    onChange={(e) => setClienteSelecionadoId(e.target.value)}
                    data-testid="select-cliente-vinculo"
                    required
                  >
                    {dump.clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.statusRelacao})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo-form">
                  <label className="rotulo-form">Receita Recorrente Mensal (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-texto"
                    value={valorMensalReais}
                    onChange={(e) => setValorMensalReais(e.target.value)}
                    data-testid="input-valor-recorrente-cliente"
                    required
                  />
                </div>
              </div>
              <div className="modal-rodape">
                <button
                  type="button"
                  className="botao-campanha"
                  onClick={() => setModalNovoVinculo(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="botao-campanha botao-campanha-jade"
                  data-testid="botao-confirmar-vinculo-cliente"
                >
                  Confirmar Vínculo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
