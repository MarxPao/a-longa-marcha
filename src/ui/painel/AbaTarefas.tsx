import React, { useState } from 'react';
import type { Tarefa } from '../../domain';
import { useCampanhaStore } from '../../store';
import { formatarData } from '../formatadores';

interface Props {
  projetoId: string;
}

type ModoVisualizacao = 'lista' | 'quadro';
type FiltroStatus = 'todas' | 'pendentes' | 'feitas' | 'bloqueadas';

export function AbaTarefas({ projetoId }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);

  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('lista');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [filtroPrazo, setFiltroPrazo] = useState<string>('todos');

  // Tarefas ativas deste projeto
  const tarefas = dump.tarefas.filter(
    (t) => t.projetoId === projetoId && t.arquivadoEm === null
  );

  // Frentes do projeto
  const frentes = dump.frentes.filter(
    (f) => f.projetoId === projetoId && f.arquivadoEm === null
  );

  // Bloqueios
  const bloqueios = dump.bloqueiosTarefa;

  const alternarConclusaoTarefa = async (tarefa: Tarefa) => {
    const novoStatus = tarefa.status === 'feita' ? 'pendente' : 'feita';
    const concluidaEm = novoStatus === 'feita' ? semanaAtual : null;
    await atualizarEntidade<Tarefa>('tarefas', tarefa.id, {
      status: novoStatus,
      concluidaEm,
    });
  };

  // Filtragem
  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtroStatus === 'pendentes' && t.status === 'feita') return false;
    if (filtroStatus === 'feitas' && t.status !== 'feita') return false;
    if (filtroStatus === 'bloqueadas' && t.status !== 'bloqueada') return false;

    if (filtroPrazo === 'vencidas') {
      if (!t.prazo || t.prazo >= semanaAtual || t.status === 'feita') return false;
    } else if (filtroPrazo === 'estaSemana') {
      if (!t.prazo || t.prazo < semanaAtual) return false;
    }
    return true;
  });

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
      data-testid="aba-tarefas-conteudo"
    >
      {/* Barra de Controles: Modo de Exibição e Nova Tarefa */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button
            type="button"
            className={`botao-campanha ${modoVisualizacao === 'lista' ? 'botao-campanha-ouro' : ''}`}
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.74rem' }}
            onClick={() => setModoVisualizacao('lista')}
            data-testid="botao-modo-lista-tarefas"
          >
            📋 Lista
          </button>
          <button
            type="button"
            className={`botao-campanha ${modoVisualizacao === 'quadro' ? 'botao-campanha-ouro' : ''}`}
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.74rem' }}
            onClick={() => setModoVisualizacao('quadro')}
            data-testid="botao-modo-quadro-tarefas"
          >
            📊 Quadro
          </button>
        </div>

        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          data-testid="botao-nova-tarefa"
          onClick={() => abrirModal('capturaRapida', 'tarefa')}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
        >
          + Nova Tarefa
        </button>
      </div>

      {/* Barra de Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          fontSize: '0.75rem',
          background: '#fffdf7',
          padding: '0.4rem 0.6rem',
          borderRadius: '4px',
          border: '1px solid var(--pergaminho-escuro)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
        data-testid="filtros-tarefas-barra"
      >
        <span style={{ fontWeight: 600, color: 'var(--bronze)' }}>Filtros:</span>
        <select
          className="select-form"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
          style={{ padding: '0.1rem 0.4rem', fontSize: '0.74rem' }}
          data-testid="select-filtro-status-tarefas"
        >
          <option value="todas">Todos os status</option>
          <option value="pendentes">Apenas Pendentes</option>
          <option value="bloqueadas">Apenas Bloqueadas</option>
          <option value="feitas">Apenas Feitas</option>
        </select>

        <select
          className="select-form"
          value={filtroPrazo}
          onChange={(e) => setFiltroPrazo(e.target.value)}
          style={{ padding: '0.1rem 0.4rem', fontSize: '0.74rem' }}
          data-testid="select-filtro-prazo-tarefas"
        >
          <option value="todos">Todos os prazos</option>
          <option value="vencidas">⚠️ Vencidas</option>
          <option value="estaSemana">📅 Esta semana / futuras</option>
        </select>

        <span style={{ marginLeft: 'auto', color: 'var(--bronze)' }}>
          {tarefasFiltradas.length} de {tarefas.length}
        </span>
      </div>

      {/* Conteúdo das Tarefas */}
      {tarefasFiltradas.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--bronze)', padding: '1rem', textAlign: 'center' }}>
          Nenhuma tarefa encontrada com os filtros selecionados.
        </p>
      ) : modoVisualizacao === 'lista' ? (
        /* VISTA EM LISTA AGRUPADA POR FRENTE */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }} data-testid="vista-lista-tarefas">
          {/* Tarefas Sem Frente */}
          {(() => {
            const tarefasGerais = tarefasFiltradas.filter((t) => !t.frenteId);
            if (tarefasGerais.length === 0) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--bronze)' }}>
                  Geral ({tarefasGerais.length})
                </span>
                {tarefasGerais.map((t) => renderCardTarefa(t))}
              </div>
            );
          })()}

          {/* Tarefas por Frente */}
          {frentes.map((f) => {
            const tarefasDaFrente = tarefasFiltradas.filter((t) => t.frenteId === f.id);
            if (tarefasDaFrente.length === 0) return null;
            return (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--tinta)' }}>
                  📁 {f.nome} ({tarefasDaFrente.length})
                </span>
                {tarefasDaFrente.map((t) => renderCardTarefa(t))}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA EM QUADRO KANBAN (4 COLUNAS) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.4rem',
            overflowX: 'auto',
          }}
          data-testid="quadro-kanban-tarefas"
        >
          {(['pendente', 'em_andamento', 'bloqueada', 'feita'] as Tarefa['status'][]).map((st) => {
            const tarefasStatus = tarefasFiltradas.filter((t) => t.status === st);
            const titulosStatus: Record<Tarefa['status'], string> = {
              pendente: '⏳ Pendente',
              em_andamento: '⚡ Em Curso',
              bloqueada: '🛑 Bloqueada',
              feita: '✅ Feita',
            };
            return (
              <div
                key={st}
                style={{
                  background: '#f8f5eb',
                  border: '1px solid var(--pergaminho-escuro)',
                  borderRadius: '4px',
                  padding: '0.4rem',
                  minWidth: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
                data-testid={`coluna-kanban-${st}`}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tinta)', borderBottom: '1px solid #ddd', paddingBottom: '0.2rem' }}>
                  {titulosStatus[st]} ({tarefasStatus.length})
                </div>
                {tarefasStatus.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: '#fff',
                      padding: '0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.74rem',
                      border: '1px solid #e0d8c3',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                    data-testid={`card-kanban-tarefa-${t.id}`}
                  >
                    <span style={{ fontWeight: 600 }}>{t.titulo}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--bronze)' }}>
                      <span>P{t.prioridade}</span>
                      <span>{t.estimativaHoras ?? 0}h</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  function renderCardTarefa(t: Tarefa) {
    const estaVencida = t.prazo && t.prazo < semanaAtual && t.status !== 'feita';
    const bloqueadores = bloqueios.filter((b) => b.tarefaId === t.id);

    return (
      <div
        key={t.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          padding: '0.5rem',
          borderRadius: '4px',
          backgroundColor: t.status === 'feita' ? '#f5f5f5' : '#fffdf7',
          border: `1px solid ${estaVencida ? 'var(--laca)' : 'var(--pergaminho-escuro)'}`,
        }}
        data-testid={`item-tarefa-${t.id}`}
      >
        <input
          type="checkbox"
          checked={t.status === 'feita'}
          onChange={() => void alternarConclusaoTarefa(t)}
          style={{ cursor: 'pointer', width: 16, height: 16, marginTop: 2 }}
          data-testid={`checkbox-tarefa-${t.id}`}
        />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                fontSize: '0.84rem',
                fontWeight: 600,
                textDecoration: t.status === 'feita' ? 'line-through' : 'none',
                color: t.status === 'feita' ? '#777' : 'var(--tinta)',
              }}
            >
              {t.titulo}
            </span>
            {estaVencida && (
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--laca)',
                  fontWeight: 700,
                  background: 'rgba(142,31,26,0.1)',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '2px',
                }}
                data-testid={`badge-vencida-${t.id}`}
              >
                VENCIDA
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--bronze)', marginTop: '0.2rem' }}>
            Prazo: {formatarData(t.prazo ?? '')} · Estimativa: {t.estimativaHoras ?? 0}h
          </div>

          {/* Bloqueios Visíveis (Seção 6.5) */}
          {bloqueadores.length > 0 && (
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--laca)',
                marginTop: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
              data-testid={`bloqueios-tarefa-${t.id}`}
            >
              🛑 Bloqueada por {bloqueadores.length} tarefa(s) pendente(s)
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
          <span
            className="badge"
            style={{
              fontSize: '0.68rem',
              backgroundColor:
                t.prioridade === 4
                  ? '#f8d7da'
                  : t.prioridade === 3
                  ? '#fff3cd'
                  : '#e2e3e5',
            }}
          >
            P{t.prioridade}
          </span>
          <button
            type="button"
            className="botao-campanha"
            style={{ fontSize: '0.68rem', padding: '0.1rem 0.3rem' }}
            onClick={() => abrirModal('capturaRapida', 'horas')}
            title="Registrar horas nesta tarefa"
            data-testid={`botao-horas-tarefa-${t.id}`}
          >
            ⏱️ Horas
          </button>
        </div>
      </div>
    );
  }
}
