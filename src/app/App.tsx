import React, { useEffect, useRef, useState } from 'react';
import type { Ligacao, Projeto } from '../domain';
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

  // Store Campanha Fase 3 & 4
  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const vistaAtiva = useCampanhaStore((s) => s.vistaAtiva);
  const projetoSelecionadoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const desfazer = useCampanhaStore((s) => s.desfazer);
  const notificacao = useCampanhaStore((s) => s.notificacao);
  const limparNotificacao = useCampanhaStore((s) => s.limparNotificacao);

  const [inputSemente, setInputSemente] = useState(semente);

  // Inicializa mapa Three.js com suporte completo a cidades procedurais e interação
  useEffect(() => {
    const elemento = containerMapaRef.current;
    if (!elemento) return;

    const instancia = new MapView({
      container: elemento,
      sementeInicial: useTerrenoFase0Store.getState().semente,
      aoAtualizarTerreno: (metricas) => {
        atualizarMetricasMalha(metricas);
      },
      aoSelecionarProjeto: (projetoId) => {
        selecionarProjeto(projetoId);
      },
      aoMoverProjeto: (projetoId, novoX, novoZ) => {
        void useCampanhaStore.getState().atualizarEntidade<Projeto>('projetos', projetoId, {
          x: novoX,
          z: novoZ,
        });
      },
      aoLigarProjetos: (origemId, destinoId) => {
        const tipos = useCampanhaStore.getState().dump.tiposLigacao;
        const tipoId = tipos[0]?.id ?? 'tipo-lig-colabora';
        void useCampanhaStore.getState().criarEntidade<Ligacao>('ligacoes', {
          origemId,
          destinoId,
          tipoId,
          forca: 1,
        });
      },
      aoFundarProjeto: () => {
        abrirModal('criarProjeto');
      },
    });

    mapViewRef.current = instancia;

    // Expõe para depuração e testes E2E do Playwright
    if (typeof window !== 'undefined') {
      (window as unknown as { __MAP_VIEW__?: MapView }).__MAP_VIEW__ = instancia;
    }

    return () => {
      instancia.destruir();
      mapViewRef.current = null;
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __MAP_VIEW__?: MapView }).__MAP_VIEW__;
      }
    };
  }, [atualizarMetricasMalha, selecionarProjeto, abrirModal]);

  // Sincroniza estado da campanha (projetos, setores, ligações, derivados) no mapa 3D
  useEffect(() => {
    if (mapViewRef.current) {
      mapViewRef.current.sincronizarEstado({
        projetos: dump.projetos,
        setores: dump.setores,
        ligacoes: dump.ligacoes,
        tiposLigacao: dump.tiposLigacao,
        derivadosPorProjeto,
        projetoSelecionadoId,
        sementeTerreno: semente,
      });
    }
  }, [
    dump.projetos,
    dump.setores,
    dump.ligacoes,
    derivadosPorProjeto,
    projetoSelecionadoId,
    semente,
  ]);

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

      {/* Conteúdo Central: Mapa 3D Estratégico ou Vista em Lista */}
      <main className="conteudo-principal" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Container do Mapa 3D */}
        <div
          ref={containerMapaRef}
          data-testid="container-mapa-3d"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: vistaAtiva === 'mapa' ? 'block' : 'none',
          }}
        />

        {/* Vista Alternativa em Lista (Seção 6.8) */}
        {vistaAtiva === 'lista' && (
          <div style={{ position: 'relative', zIndex: 2, height: '100%', width: '100%' }}>
            <VistaLista />
          </div>
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
            onClick={sortearSemente}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
          >
            {textosPtBr.terreno.botaoSortear}
          </button>
        </form>
      </aside>

      {/* Brief Inicial de Campanha (Seção 6.1) */}
      {!dump.meta.config.brief.concluido && <BriefInicial />}

      {/* Modais Globais */}
      <CapturaRapida />
      <ModalFecharTurno />
      <ModalCriarProjeto />
      <EditorRegistros />

      {/* Notificação Toast */}
      {notificacao && (
        <div
          data-testid="toast-notificacao"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background:
              notificacao.tipo === 'erro'
                ? 'var(--laca)'
                : notificacao.tipo === 'sucesso'
                  ? 'var(--jade)'
                  : 'var(--tinta)',
            color: '#fff',
            padding: '0.6rem 1.2rem',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 100,
            fontSize: '0.9rem',
          }}
        >
          {notificacao.mensagem}
        </div>
      )}
    </div>
  );
}
