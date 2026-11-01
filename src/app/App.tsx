import React, { useEffect, useRef, useState } from 'react';
import type { Ligacao, Projeto } from '../domain';
import { MapView } from '../map';
import { useCampanhaStore, useTerrenoFase0Store } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import {
  BarraSuperior,
  BriefInicial,
  BuscaGlobal,
  CATALOGO_LENTES,
  CapturaRapida,
  EditorRegistros,
  FeedEventos,
  Minimapa,
  ModalCriarProjeto,
  ModalFecharTurno,
  PainelProjeto,
  TelaArvoreTecnologica,
  TelaEstoqueGlobal,
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

  // Store Campanha Fase 3, 4, 5 & 6
  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const vistaAtiva = useCampanhaStore((s) => s.vistaAtiva);
  const lenteAtiva = useCampanhaStore((s) => s.lenteAtiva);
  const definirLenteAtiva = useCampanhaStore((s) => s.definirLenteAtiva);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const projetoSelecionadoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const desfazer = useCampanhaStore((s) => s.desfazer);
  const notificacao = useCampanhaStore((s) => s.notificacao);
  const limparNotificacao = useCampanhaStore((s) => s.limparNotificacao);

  const [inputSemente, setInputSemente] = useState(semente);
  const [alvoCameraMinimapa, setAlvoCameraMinimapa] = useState<{ x: number; z: number }>({
    x: 0,
    z: 0,
  });

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

  // Sincroniza estado da campanha (projetos, setores, ligações, derivados, lente) no mapa 3D
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
        lenteAtiva,
        clientes: dump.clientes,
        vinculosCliente: dump.vinculosCliente,
        itensLista: dump.itensDeLista,
        aplicacoes: dump.aplicacoes,
        hoje: semanaAtual,
      });
    }
  }, [
    dump.projetos,
    dump.setores,
    dump.ligacoes,
    dump.tiposLigacao,
    dump.clientes,
    dump.vinculosCliente,
    dump.itensDeLista,
    dump.aplicacoes,
    derivadosPorProjeto,
    projetoSelecionadoId,
    semente,
    lenteAtiva,
    semanaAtual,
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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrirModal('buscaGlobal');
        return;
      }

      if (isInput) return;

      // Atalho / para Busca Global
      if (e.key === '/') {
        e.preventDefault();
        abrirModal('buscaGlobal');
        return;
      }

      // Teclas 1 a 8 para alternar as 8 Lentes do Mapa (Seção 4.6 e 6.7)
      if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        const lenteDef = CATALOGO_LENTES[idx];
        if (lenteDef) {
          definirLenteAtiva(lenteDef.id);
        }
        return;
      }

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
      } else if (key === 'G') {
        e.preventDefault();
        abrirModal('arvoreTecnologica');
      } else if (key === 'F') {
        e.preventDefault();
        const estado = useCampanhaStore.getState();
        const idSel = estado.projetoSelecionadoId;
        if (idSel) {
          const proj = estado.dump.projetos.find((p) => p.id === idSel);
          if (proj && mapViewRef.current) {
            mapViewRef.current.voarAte(proj.x, proj.z);
            setAlvoCameraMinimapa({ x: proj.x, z: proj.z });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abrirModal, fecharModal, selecionarProjeto, desfazer, definirLenteAtiva]);

  // Respeito à preferência do sistema por reduzir movimento (Seção 6.8)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aplicar = (reduzir: boolean) => {
      mapViewRef.current?.definirReduzirMovimento(reduzir);
      if (reduzir) {
        document.body.classList.add('reduzir-movimento');
      } else {
        document.body.classList.remove('reduzir-movimento');
      }
    };
    aplicar(mq.matches);
    const handler = (ev: MediaQueryListEvent) => aplicar(ev.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

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

        {/* Efeito leve de foco nas bordas (Tilt-Shift) para sensação de maquete (Seção 4.7) */}
        {vistaAtiva === 'mapa' && (
          <div
            data-testid="camada-tilt-shift"
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 2,
              background:
                'linear-gradient(to bottom, rgba(24,20,15,0.26) 0%, rgba(24,20,15,0) 14%, rgba(24,20,15,0) 84%, rgba(24,20,15,0.32) 100%), radial-gradient(circle at center, transparent 62%, rgba(24,20,15,0.2) 100%)',
            }}
          />
        )}

        {/* Vista Alternativa em Lista (Seção 6.8) */}
        {vistaAtiva === 'lista' && (
          <div style={{ position: 'relative', zIndex: 2, height: '100%', width: '100%' }}>
            <VistaLista />
          </div>
        )}

        {/* Painel Lateral do Projeto */}
        {projetoSelecionadoId && <PainelProjeto />}

        {/* Minimapa e Seletor de Lentes (Seção 4.5 e 4.6) */}
        {vistaAtiva === 'mapa' && (
          <Minimapa
            alvoCamera={alvoCameraMinimapa}
            aoNavegarCamera={(x, z) => {
              mapViewRef.current?.voarAte(x, z);
              setAlvoCameraMinimapa({ x, z });
            }}
          />
        )}

        {/* Feed de Eventos e Selo de Alerta Animado (Seção 4.5) */}
        <FeedEventos
          aoFocarProjeto={(_projetoId, x, z) => {
            mapViewRef.current?.voarAte(x, z);
            setAlvoCameraMinimapa({ x, z });
          }}
        />
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
      <TelaArvoreTecnologica />
      <TelaEstoqueGlobal />
      <BuscaGlobal
        aoVoarParaCoordenada={(x, z) => {
          mapViewRef.current?.voarAte(x, z);
          setAlvoCameraMinimapa({ x, z });
        }}
      />

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
