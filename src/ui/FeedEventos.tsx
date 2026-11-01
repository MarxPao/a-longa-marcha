import React, { useMemo, useState } from 'react';
import type { Evento, UUID } from '../domain';
import { useCampanhaStore } from '../store';
import { formatarData } from './formatadores';

interface PropriedadesFeedEventos {
  aoFocarProjeto?: (projetoId: UUID, x: number, z: number) => void;
}

export function FeedEventos({
  aoFocarProjeto,
}: PropriedadesFeedEventos): React.JSX.Element {
  const [aberto, setAberto] = useState(false);

  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);

  const projetosPorId = useMemo(
    () => new Map(dump.projetos.map((p) => [p.id, p])),
    [dump.projetos]
  );

  // Eventos persistidos em ordem cronológica reversa
  const eventosOrdenados = useMemo(() => {
    return [...dump.eventos]
      .filter((e) => e.arquivadoEm === null)
      .sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : 0));
  }, [dump.eventos]);

  // Alertas vivos de projetos críticos para complementar o mensageiro
  const alertasVivos = useMemo(() => {
    const lista: Array<{
      id: string;
      projetoId: UUID;
      nomeProjeto: string;
      motivo: string;
      gravidade: 'critico' | 'atencao';
    }> = [];

    for (const p of dump.projetos) {
      if (p.arquivadoEm !== null) continue;
      const d = derivadosPorProjeto.get(p.id);
      if (!d) continue;

      if (d.saude.pontuacao < 40) {
        lista.push({
          id: `alerta-saude-${p.id}`,
          projetoId: p.id,
          nomeProjeto: p.nome,
          motivo: `Cidade em estado crítico (${d.saude.pontuacao} pts). Requer intervenção imediata.`,
          gravidade: 'critico',
        });
      } else if (d.tarefasVencidas > 0) {
        lista.push({
          id: `alerta-vencida-${p.id}`,
          projetoId: p.id,
          nomeProjeto: p.nome,
          motivo: `${d.tarefasVencidas} tarefa(s) vencida(s) aguardando despacho.`,
          gravidade: 'atencao',
        });
      }
    }
    return lista;
  }, [dump.projetos, derivadosPorProjeto]);

  const totalPendentes =
    eventosOrdenados.filter((e) => e.resposta === null).length + alertasVivos.length;

  const obterEstiloTipo = (tipo: Evento['tipo']) => {
    if (tipo === 'positivo') {
      return {
        cor: '#3E7C68',
        icone: '✨',
        rotulo: 'Bons Ventos',
      };
    }
    if (tipo === 'negativo') {
      return {
        cor: '#8E1F1A',
        icone: '🔥',
        rotulo: 'Presságio Crítico',
      };
    }
    return {
      cor: '#D09B2C',
      icone: '📜',
      rotulo: 'Mensageiro',
    };
  };

  const handleIrParaProjeto = (projetoId: UUID) => {
    const proj = projetosPorId.get(projetoId);
    selecionarProjeto(projetoId);
    if (proj && aoFocarProjeto) {
      aoFocarProjeto(proj.id, proj.x, proj.z);
    }
  };

  const handleResponderEvento = async (
    eventoId: UUID,
    resposta: 'ignorar' | 'mitigar' | 'aproveitar'
  ) => {
    await atualizarEntidade<Evento>('eventos', eventoId, { resposta });
  };

  return (
    <div
      data-testid="container-feed-eventos"
      style={{
        position: 'absolute',
        bottom: 52,
        right: 12,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* Gaveta de Cartas e Eventos (Quando aberta) */}
      {aberto && (
        <div
          data-testid="painel-feed-eventos"
          className="pergaminho-painel"
          style={{
            width: 340,
            maxHeight: 380,
            overflowY: 'auto',
            marginBottom: '0.5rem',
            padding: '0.75rem',
            borderRadius: 6,
            border: '2px solid var(--ouro)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--bronze)',
              paddingBottom: '0.4rem',
              marginBottom: '0.6rem',
            }}
          >
            <strong style={{ fontSize: '0.9rem', color: 'var(--tinta)' }}>
              📜 Crônicas e Cartas do Império
            </strong>
            <button
              type="button"
              data-testid="botao-fechar-feed"
              onClick={() => setAberto(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: 'var(--tinta)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Alertas Vivos */}
          {alertasVivos.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--laca)',
                  marginBottom: '0.35rem',
                }}
              >
                Alertas da Campanha ({alertasVivos.length})
              </div>
              {alertasVivos.map((alerta) => (
                <div
                  key={alerta.id}
                  data-testid="item-alerta-feed"
                  style={{
                    background: 'rgba(142, 31, 26, 0.08)',
                    borderLeft: `4px solid ${
                      alerta.gravidade === 'critico' ? '#8E1F1A' : '#D09B2C'
                    }`,
                    padding: '0.45rem 0.6rem',
                    borderRadius: 4,
                    marginBottom: '0.4rem',
                    fontSize: '0.78rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                    }}
                  >
                    <span>
                      {alerta.gravidade === 'critico' ? '🔥' : '⚠️'} {alerta.nomeProjeto}
                    </span>
                    <button
                      type="button"
                      className="botao-campanha"
                      onClick={() => handleIrParaProjeto(alerta.projetoId)}
                      style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem' }}
                    >
                      Inspecionar
                    </button>
                  </div>
                  <div style={{ color: '#4A4236', marginTop: '0.2rem' }}>
                    {alerta.motivo}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de Eventos Registrados */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#5A554E',
                marginBottom: '0.35rem',
              }}
            >
              Eventos Históricos ({eventosOrdenados.length})
            </div>

            {eventosOrdenados.length === 0 ? (
              <div
                data-testid="feed-eventos-vazio"
                style={{
                  fontSize: '0.8rem',
                  color: '#686256',
                  fontStyle: 'italic',
                  padding: '0.6rem 0',
                }}
              >
                Nenhuma carta de mensageiro registrada até o momento.
              </div>
            ) : (
              eventosOrdenados.slice(0, 20).map((ev) => {
                const estilo = obterEstiloTipo(ev.tipo);
                const proj = ev.projetoId ? projetosPorId.get(ev.projetoId) : undefined;
                return (
                  <div
                    key={ev.id}
                    data-testid="item-evento-feed"
                    style={{
                      background: 'rgba(255,255,255,0.45)',
                      borderLeft: `4px solid ${estilo.cor}`,
                      padding: '0.5rem 0.6rem',
                      borderRadius: 4,
                      marginBottom: '0.45rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong style={{ color: estilo.cor }}>
                        {estilo.icone} {ev.titulo}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: '#686256' }}>
                        {formatarData(ev.data)}
                      </span>
                    </div>

                    {ev.resultado && (
                      <div style={{ marginTop: '0.2rem', color: '#2C261E' }}>
                        {ev.resultado}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '0.35rem',
                        gap: '0.3rem',
                      }}
                    >
                      {proj ? (
                        <button
                          type="button"
                          onClick={() => handleIrParaProjeto(proj.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--bronze)',
                            textDecoration: 'underline',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          📍 {proj.nome}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: '#7B7468' }}>
                          Império Global
                        </span>
                      )}

                      {ev.resposta === null ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="botao-campanha"
                            onClick={() =>
                              void handleResponderEvento(
                                ev.id,
                                ev.tipo === 'positivo' ? 'aproveitar' : 'mitigar'
                              )
                            }
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}
                          >
                            {ev.tipo === 'positivo' ? 'Aproveitar' : 'Mitigar'}
                          </button>
                          <button
                            type="button"
                            className="botao-campanha"
                            onClick={() => void handleResponderEvento(ev.id, 'ignorar')}
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}
                          >
                            Arquivar Selo
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.3rem',
                            background: 'rgba(62, 124, 104, 0.15)',
                            borderRadius: 3,
                            color: '#3E7C68',
                          }}
                        >
                          ✓ {ev.resposta}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Botão do Selo de Alerta Animado (Carta de Mensageiro) */}
      <button
        type="button"
        data-testid="selo-alerta-mensageiro"
        onClick={() => setAberto((v) => !v)}
        className={totalPendentes > 0 ? 'selo-mensageiro-animado' : ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: totalPendentes > 0 ? '#8E1F1A' : 'rgba(31, 27, 22, 0.9)',
          color: '#E8DCC0',
          border: '2px solid var(--ouro)',
          borderRadius: '20px',
          padding: '0.4rem 0.85rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          fontSize: '0.8rem',
          fontWeight: 700,
        }}
      >
        <span>✉️ Mensageiro</span>
        <span
          data-testid="contador-alertas-feed"
          style={{
            background: '#B8923A',
            color: '#1F1B16',
            borderRadius: '999px',
            padding: '0.05rem 0.45rem',
            fontSize: '0.72rem',
            fontWeight: 800,
          }}
        >
          {eventosOrdenados.length + alertasVivos.length}
        </span>
      </button>
    </div>
  );
}
