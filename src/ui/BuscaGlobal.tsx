import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  construirIndiceBusca,
  executarBuscaGlobal,
  type ResultadoBuscaGlobal,
  type TipoResultadoBusca,
} from '../domain';
import { useCampanhaStore } from '../store';

interface PropriedadesBuscaGlobal {
  aoVoarParaCoordenada?: (x: number, z: number) => void;
}

export function BuscaGlobal({
  aoVoarParaCoordenada,
}: PropriedadesBuscaGlobal): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const dump = useCampanhaStore((s) => s.dump);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const alternarVista = useCampanhaStore((s) => s.alternarVista);

  const [termo, setTermo] = useState('');
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const [ultimoTempoMs, setUltimoTempoMs] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const estaAberto = modalAberto === 'buscaGlobal';

  // Índice pré-construído quando o dump muda
  const indiceBusca = useMemo(() => construirIndiceBusca(dump), [dump]);

  // Executa a busca e mede o tempo por tecla
  const resultados = useMemo(() => {
    if (!estaAberto) return [];
    const t0 = performance.now();
    const res = executarBuscaGlobal(indiceBusca, termo, 18);
    const t1 = performance.now();
    setUltimoTempoMs(Math.round((t1 - t0) * 100) / 100);
    return res;
  }, [indiceBusca, termo, estaAberto]);

  useEffect(() => {
    if (estaAberto) {
      setTermo('');
      setIndiceSelecionado(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    }
  }, [estaAberto]);

  useEffect(() => {
    setIndiceSelecionado(0);
  }, [termo]);

  if (!estaAberto) return null;

  const obterIconeTipo = (tipo: TipoResultadoBusca) => {
    switch (tipo) {
      case 'projeto':
        return '🏯';
      case 'tarefa':
        return '📋';
      case 'cliente':
        return '🤝';
      case 'item':
        return '📦';
      case 'tecnologia':
        return '🔬';
    }
  };

  const handleConfirmarResultado = (item: ResultadoBuscaGlobal) => {
    fecharModal();
    alternarVista('mapa');
    if (item.projetoAlvoId) {
      selecionarProjeto(item.projetoAlvoId);
    }
    if (item.coordenadas && aoVoarParaCoordenada) {
      aoVoarParaCoordenada(item.coordenadas.x, item.coordenadas.z);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceSelecionado((atual) =>
        resultados.length > 0 ? (atual + 1) % resultados.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceSelecionado((atual) =>
        resultados.length > 0
          ? (atual - 1 + resultados.length) % resultados.length
          : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const escolhido = resultados[indiceSelecionado];
      if (escolhido) {
        handleConfirmarResultado(escolhido);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fecharModal();
    }
  };

  return (
    <div
      data-testid="modal-busca-global"
      className="modal-overlay"
      onClick={fecharModal}
      style={{
        alignItems: 'flex-start',
        paddingTop: '10vh',
        zIndex: 90,
      }}
    >
      <div
        className="pergaminho-painel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 8,
          border: '2px solid var(--ouro)',
          padding: '1rem',
          boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.6rem',
          }}
        >
          <strong style={{ fontSize: '0.95rem', color: 'var(--tinta)' }}>
            🔍 Busca Imperial Rápida
          </strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              data-testid="tempo-busca-ms"
              style={{ fontSize: '0.72rem', color: '#5A554E' }}
            >
              {ultimoTempoMs} ms
            </span>
            <button
              type="button"
              data-testid="botao-fechar-busca-global"
              onClick={fecharModal}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: 'var(--tinta)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="text"
          data-testid="input-busca-global"
          className="input-texto"
          placeholder="Buscar cidade, tarefa, cliente, insumo ou tecnologia... (Enter para voar)"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '0.6rem 0.8rem',
            fontSize: '0.95rem',
            marginBottom: '0.75rem',
          }}
        />

        <div
          data-testid="lista-resultados-busca"
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
          }}
        >
          {resultados.length === 0 ? (
            <div
              data-testid="busca-sem-resultados"
              style={{
                padding: '1rem',
                textAlign: 'center',
                color: '#686256',
                fontStyle: 'italic',
                fontSize: '0.85rem',
              }}
            >
              Nenhum registro encontrado para &ldquo;{termo}&rdquo;.
            </div>
          ) : (
            resultados.map((item, idx) => {
              const ativo = idx === indiceSelecionado;
              return (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  data-testid={`resultado-busca-${idx}`}
                  onClick={() => handleConfirmarResultado(item)}
                  onMouseEnter={() => setIndiceSelecionado(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 5,
                    border: ativo
                      ? '1px solid var(--ouro)'
                      : '1px solid rgba(122, 90, 43, 0.2)',
                    background: ativo
                      ? 'rgba(184, 146, 58, 0.22)'
                      : 'rgba(255, 255, 255, 0.45)',
                    cursor: 'pointer',
                    color: 'var(--tinta)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>
                      {obterIconeTipo(item.tipo)}
                    </span>
                    <div>
                      <div
                        data-testid={`resultado-busca-titulo-${idx}`}
                        style={{ fontWeight: 700, fontSize: '0.86rem' }}
                      >
                        {item.titulo}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#5A554E' }}>
                        {item.subtitulo}
                      </div>
                    </div>
                  </div>

                  {item.coordenadas && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--laca)',
                        fontWeight: 600,
                      }}
                    >
                      Voar ➔
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
