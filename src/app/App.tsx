import React, { useEffect, useRef, useState } from 'react';
import { MapView } from '../map';
import { useCampanhaStore, useTerrenoFase0Store } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import {
  BarraSuperior,
  BriefInicial,
  CapturaRapida,
  EditorRegistros,
  ModalCriarProjeto,
  ModalFecharTurno,
  PainelProjeto,
  PlaceholderMapa2D,
  VistaLista,
} from '../ui';
import '../ui/tema.css';

export function App(): React.JSX.Element {
  const containerMapaRef = useRef<HTMLDivElement | null>(null);
  const mapViewRef = useRef<MapView | null>(null);

  // Store Terreno Fase 0
  const semente = useTerrenoFase0Store((s) => s.semente);
  const definirSemente = useTerrenoFase0Store((s) => s.definirSemente);
  const sortearSemente = useTerrenoFase0Store((s) => s.sortearSemente);
  const metricasTerreno = useTerrenoFase0Store((s) => s.metricas);
  const atualizarMetricasMalha = useTerrenoFase0Store((s) => s.atualizarMetricasMalha);

  // Store Campanha Fase 3
  const vistaAtiva = useCampanhaStore((s) => s.vistaAtiva);
  const projetoSelecionadoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const desfazer = useCampanhaStore((s) => s.desfazer);
  const notificacao = useCampanhaStore((s) => s.notificacao);
  const limparNotificacao = useCampanhaStore((s) => s.limparNotificacao);

  const [inputSemente, setInputSemente] = useState(semente);

  // Inicializa mapa Three.js em segundo plano
  useEffect(() => {
    const elemento = containerMapaRef.current;
    if (!elemento) return;

    const instancia = new MapView({
      container: elemento,
      sementeInicial: useTerrenoFase0Store.getState().semente,
      aoAtualizarTerreno: (metricas) => {
        atualizarMetricasMalha(metricas);
      },
    });
    mapViewRef.current = instancia;

    return () => {
      instancia.destruir();
      mapViewRef.current = null;
    };
  }, [atualizarMetricasMalha]);

  useEffect(() => {
    if (mapViewRef.current) {
      void mapViewRef.current.aplicarSemente(semente);
    }
  }, [semente]);

  // Sincroniza input de semente quando ela muda na store
  useEffect(() => {
    setInputSemente(semente);
  }, [semente]);

  // Listener global de atalhos (Seção 6.3 e 6.7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        fecharModal();
        selecionarProjeto(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void desfazer();
        return;
      }

      if (isInput) return;

      const key = e.key.toUpperCase();
      if (key === 'H') {
        e.preventDefault();
        abrirModal('capturaRapida', 'horas');
      } else if (key === 'T') {
        e.preventDefault();
        abrirModal('capturaRapida', 'tarefa');
      } else if (key === 'L') {
        e.preventDefault();
        abrirModal('capturaRapida', 'lancamento');
      } else if (key === 'E') {
        e.preventDefault();
        abrirModal('capturaRapida', 'evento');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abrirModal, fecharModal, selecionarProjeto, desfazer]);

  // Auto-limpar notificação após 4s
  useEffect(() => {
    if (!notificacao) return;
    const timer = setTimeout(() => {
      limparNotificacao();
    }, 4000);
    return () => clearTimeout(timer);
  }, [notificacao, limparNotificacao]);

  return (
    <div className="layout-principal">
      {/* Barra Superior do HUD */}
      <BarraSuperior />

      {/* Conteúdo Central: Mapa 2D ou Vista em Lista */}
      <main className="conteudo-principal">
        {vistaAtiva === 'mapa' ? (
          <PlaceholderMapa2D>
            <div
              ref={containerMapaRef}
              data-testid="container-mapa-3d"
              style={{ width: '100%', height: '100%' }}
            />
          </PlaceholderMapa2D>
        ) : (
          <VistaLista />
        )}

        {/* Painel Lateral do Projeto */}
        {projetoSelecionadoId && <PainelProjeto />}
      </main>

      {/* Barra de Terreno Flutuante (Preserva Compatibilidade com Teste E2E Fase 0) */}
      <aside
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 10,
          background: 'rgba(31, 27, 22, 0.85)',
          padding: '0.4rem 0.8rem',
          borderRadius: '4px',
          border: '1px solid var(--bronze)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          color: '#E8DCC0',
          fontSize: '0.8rem',
          backdropFilter: 'blur(3px)',
        }}
      >
        <span style={{ fontWeight: 600 }}>Semente:</span>
        <strong data-testid="semente-ativa-valor" style={{ color: '#B8923A' }}>
          {semente}
        </strong>
        <span>(Hash: <strong data-testid="hash-semente-valor">{metricasTerreno.hashNumerico}</strong>)</span>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            definirSemente(inputSemente);
          }}
          style={{ display: 'inline-flex', gap: '0.4rem', marginLeft: '0.4rem' }}
        >
          <input
            type="text"
            data-testid="input-semente"
            className="input-texto"
            value={inputSemente}
            onChange={(e) => setInputSemente(e.target.value)}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', width: 140 }}
          />
          <button
            type="submit"
            data-testid="botao-gerar-terreno"
            className="botao-campanha botao-campanha-ouro"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
          >
            {textosPtBr.terreno.botaoGerar}
          </button>
          <button
            type="button"
            data-testid="botao-sortear-semente"
            className="botao-campanha"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => {
              sortearSemente();
              setInputSemente(useTerrenoFase0Store.getState().semente);
            }}
          >
            🎲
          </button>
        </form>
      </aside>

      {/* Modais Globais da Aplicação */}
      <BriefInicial />
      <CapturaRapida />
      <ModalFecharTurno />
      <EditorRegistros />
      <ModalCriarProjeto />

      {/* Notificação Toast */}
      {notificacao && (
        <div
          className={`notificacao-toast notificacao-${notificacao.tipo}`}
          data-testid="notificacao-toast"
        >
          <span>{notificacao.mensagem}</span>
          <button
            type="button"
            onClick={limparNotificacao}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
