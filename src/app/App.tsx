import React, { useEffect, useRef, useState } from 'react';
import type { Ligacao, Projeto, UUID } from '../domain';
import type { ResultadoLayoutMundo } from '../engine';
import { MapView, type InfoHoverElementoMapa, type InfoHudEscalaCamera } from '../map';
import { seedDemo } from '../seed';
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
  formatarMoeda,
} from '../ui';
import { DebugMateriaisView } from './DebugMateriaisView';
import { FatiaVerticalH2View } from './FatiaVerticalH2View';
import '../ui/tema.css';

export function App(): React.JSX.Element {
  const [modoVisual, setModoVisual] = useState<'mapa' | 'h2' | 'materials'>(() => {
    if (typeof window === 'undefined') return 'mapa';
    const params = new URLSearchParams(window.location.search);
    const dbg = params.get('debug');
    if (dbg === 'materials') return 'materials';
    if (dbg === 'h2' || dbg === 'fatia-vertical') return 'h2';
    return 'mapa';
  });

  if (modoVisual === 'materials') {
    return <DebugMateriaisView />;
  }

  if (modoVisual === 'h2') {
    return <FatiaVerticalH2View onVoltar={() => setModoVisual('mapa')} />;
  }

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
  const selecionarLojaNoMapa = useCampanhaStore((s) => s.selecionarLojaNoMapa);
  const filtroMapaSetorId = useCampanhaStore((s) => s.filtroMapaSetorId);
  const filtroMapaProdutoId = useCampanhaStore((s) => s.filtroMapaProdutoId);
  const definirFiltroMapaSetor = useCampanhaStore((s) => s.definirFiltroMapaSetor);
  const definirFiltroMapaProduto = useCampanhaStore((s) => s.definirFiltroMapaProduto);
  const produtosRecemCriadosIds = useCampanhaStore((s) => s.produtosRecemCriadosIds);
  const produtosRecemArquivadosIds = useCampanhaStore((s) => s.produtosRecemArquivadosIds);
  const importarJson = useCampanhaStore((s) => s.importarJson);
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
  const [hoverMapa, setHoverMapa] = useState<InfoHoverElementoMapa | null>(null);
  const [hudCamera, setHudCamera] = useState<InfoHudEscalaCamera | null>(null);
  const [layoutMundo, setLayoutMundo] = useState<ResultadoLayoutMundo | null>(null);

  // Inicializa mapa Three.js com suporte completo a cidades procedurais, Metrópole Central e fluxos
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
        if (projetoId && mapViewRef.current) {
          const layout = mapViewRef.current.obterLayoutMundo();
          const cid = layout?.cidades.find((c) => c.projetoId === projetoId);
          if (cid) {
            setAlvoCameraMinimapa({ x: cid.x, z: cid.z });
          }
        }
      },
      aoClicarLoja: (loja) => {
        selecionarLojaNoMapa(loja.projetoId, loja.produtoId);
      },
      aoHoverElementoMapa: (info) => {
        setHoverMapa(info);
      },
      aoAtualizarHudCamera: (hud) => {
        setHudCamera(hud);
      },
      aoAtualizarLayout: (layout) => {
        setLayoutMundo(layout);
      },
      aoMoverProjeto: (projetoId, novoX, novoZ) => {
        void useCampanhaStore.getState().atualizarEntidade<Projeto>('projetos', projetoId, {
          x: novoX,
          z: novoZ,
          posicao: { x: novoX, z: novoZ },
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
  }, [atualizarMetricasMalha, selecionarProjeto, selecionarLojaNoMapa, abrirModal]);

  // Sincroniza estado da campanha (projetos, setores, produtos, ligações, derivados, lente, filtros) no mapa 3D
  useEffect(() => {
    if (mapViewRef.current) {
      mapViewRef.current.sincronizarEstado({
        projetos: dump.projetos,
        setores: dump.setores,
        produtos: dump.produtos,
        lancamentos: dump.lancamentos,
        itens: dump.itens,
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
        filtroSetorId: filtroMapaSetorId,
        filtroProdutoId: filtroMapaProdutoId,
        produtosRecemCriadosIds: new Set(produtosRecemCriadosIds),
        produtosRecemArquivadosIds: new Set(produtosRecemArquivadosIds),
      });
    }
  }, [
    dump.projetos,
    dump.setores,
    dump.produtos,
    dump.lancamentos,
    dump.itens,
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
    filtroMapaSetorId,
    filtroMapaProdutoId,
    produtosRecemCriadosIds,
    produtosRecemArquivadosIds,
  ]);

  // Sincroniza input de semente quando ela muda na store
  useEffect(() => {
    setInputSemente(semente);
  }, [semente]);

  // Inicializa banco de dados local ou auto-carrega a demonstração de 40 cidades no primeiro acesso
  useEffect(() => {
    let montado = true;
    const inicializarCampanha = async () => {
      const repo = useCampanhaStore.getState().repositorio;
      try {
        const existente = await repo.exportar();
        if (!montado) return;
        if (existente && existente.projetos.length > 0) {
          await useCampanhaStore.getState().inicializar();
        } else {
          const demo = seedDemo('demo', 'imperio-de-projetos-demo-2026');
          demo.meta.config.brief.concluido = true;
          await useCampanhaStore.getState().importarJson(demo);
        }
      } catch {
        void useCampanhaStore.getState().inicializar();
      }
    };
    void inicializarCampanha();
    return () => {
      montado = false;
    };
  }, []);

  // Quando o layout do mundo estiver pronto no primeiro carregamento,
  // foca suavemente na Cidade Regional principal (Nível 5 / "Chen" do Total War)
  const cameraFocadaRef = useRef(false);
  useEffect(() => {
    if (!layoutMundo || cameraFocadaRef.current || !mapViewRef.current) return;
    if (layoutMundo.cidades.length > 0) {
      cameraFocadaRef.current = true;
      const cidadesOrdenadas = [...layoutMundo.cidades].sort(
        (a, b) => b.nivel - a.nivel || b.receitaMensalCentavos - a.receitaMensalCentavos
      );
      const principal = cidadesOrdenadas[0];
      if (principal) {
        mapViewRef.current.voarAte(principal.x, principal.z, 75, 800);
        selecionarProjeto(principal.projetoId);
        setAlvoCameraMinimapa({ x: principal.x, z: principal.z });
      }
    }
  }, [layoutMundo, selecionarProjeto]);

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

      // Atalho F para focar a Cidade Regional Principal estilo Total War
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (mapViewRef.current && layoutMundo && layoutMundo.cidades.length > 0) {
          e.preventDefault();
          const ordenadas = [...layoutMundo.cidades].sort(
            (a, b) => b.nivel - a.nivel || b.receitaMensalCentavos - a.receitaMensalCentavos
          );
          const principal = ordenadas[0];
          if (principal) {
            mapViewRef.current.voarAte(principal.x, principal.z, 140, 600);
            selecionarProjeto(principal.projetoId);
          }
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
      } else if (key === 'V') {
        // 'E' agora gira a câmera (Fase 2b, Seção 3.2); evento passa para 'V'
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

        {/* Barra de Filtros do Mercado & Metrópole Central (Seção 4.6) */}
        {vistaAtiva === 'mapa' && (
          <div
            data-testid="barra-filtros-mercado-mapa"
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              zIndex: 12,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(31, 27, 22, 0.9)',
              border: '1px solid var(--ouro)',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              color: '#E8DCC0',
              fontSize: '0.74rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            <button
              type="button"
              className="botao-campanha botao-campanha-ouro"
              data-testid="botao-focar-metropole-central"
              onClick={() => {
                mapViewRef.current?.voarAte(0, 0);
                setAlvoCameraMinimapa({ x: 0, z: 0 });
              }}
              style={{ padding: '0.18rem 0.45rem', fontSize: '0.72rem' }}
              title="Voar até a Metrópole Central (0, 0)"
            >
              🏛️ Ir à metrópole
            </button>

            <button
              type="button"
              className="botao-campanha"
              data-testid="botao-recarregar-dados-exemplo-topo"
              onClick={() => {
                const demo = seedDemo('demo', 'imperio-de-projetos-demo-2026');
                demo.meta.config.brief.concluido = true;
                void importarJson(demo);
              }}
              style={{ padding: '0.18rem 0.45rem', fontSize: '0.72rem' }}
              title="Carregar ou restaurar as 40 cidades, 70 lojas e NPCs da demonstração"
            >
              📦 Carregar Demo
            </button>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>Setor:</span>
              <select
                data-testid="select-filtro-mapa-setor"
                className="select-form"
                value={filtroMapaSetorId ?? ''}
                onChange={(e) => {
                  const val = (e.target.value as UUID) || null;
                  definirFiltroMapaSetor(val);
                  if (val) definirFiltroMapaProduto(null);
                }}
                style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', width: 135 }}
              >
                <option value="">Todos os setores</option>
                {dump.setores
                  .filter((s) => s.arquivadoEm === null)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>Produto:</span>
              <select
                data-testid="select-filtro-mapa-produto"
                className="select-form"
                value={filtroMapaProdutoId ?? ''}
                onChange={(e) => {
                  const val = (e.target.value as UUID) || null;
                  definirFiltroMapaProduto(val);
                }}
                style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', width: 155 }}
              >
                <option value="">Todos os produtos</option>
                {dump.produtos
                  .filter(
                    (p) =>
                      p.arquivadoEm === null &&
                      p.ativo &&
                      (!filtroMapaSetorId ||
                        dump.projetos.find((proj) => proj.id === p.projetoId)?.setorId ===
                          filtroMapaSetorId)
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
              </select>
            </label>

            {(filtroMapaSetorId || filtroMapaProdutoId) && (
              <button
                type="button"
                className="botao-campanha"
                data-testid="botao-limpar-filtros-mapa"
                onClick={() => {
                  definirFiltroMapaSetor(null);
                  definirFiltroMapaProduto(null);
                }}
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
              >
                ✕ Limpar
              </button>
            )}
          </div>
        )}

        {/* Atalhos Rápidos Total War e Fatia H2 */}
        {vistaAtiva === 'mapa' && (
          <div
            style={{
              position: 'absolute',
              top: 52,
              right: 12,
              zIndex: 14,
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              type="button"
              className="botao-campanha botao-campanha-ouro"
              data-testid="botao-focar-cidade-principal"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', cursor: 'pointer' }}
              onClick={() => {
                if (!mapViewRef.current || !layoutMundo || layoutMundo.cidades.length === 0) return;
                const ordenadas = [...layoutMundo.cidades].sort(
                  (a, b) => b.nivel - a.nivel || b.receitaMensalCentavos - a.receitaMensalCentavos
                );
                const principal = ordenadas[0];
                if (principal) {
                  mapViewRef.current.voarAte(principal.x, principal.z, 75, 600);
                  selecionarProjeto(principal.projetoId);
                }
              }}
              title="Focar na Cidade Regional Principal estilo Total War [Atalho: F]"
            >
              🏛️ Focar Cidade Total War [F]
            </button>
            <button
              type="button"
              className="botao-campanha botao-campanha-laca"
              data-testid="botao-abrir-fatia-h2"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', cursor: 'pointer' }}
              onClick={() => setModoVisual('h2')}
              title="Inspecionar os 38 modelos procedurais do kit Han em alta fidelidade"
            >
              🏮 Inspecionar Fatia H2 (38 Modelos)
            </button>
          </div>
        )}

        {/* Dica de onboarding quando a Metrópole Central está sem produtos (Seção 2, Princípio 1) */}
        {vistaAtiva === 'mapa' &&
          dump.produtos.filter((p) => p.arquivadoEm === null && p.ativo).length === 0 && (
            <div
              data-testid="dica-metropole-vazia"
              style={{
                position: 'absolute',
                top: 52,
                left: 12,
                zIndex: 11,
                background: 'rgba(31, 27, 22, 0.88)',
                border: '1px dashed var(--ouro)',
                borderRadius: 6,
                padding: '0.35rem 0.65rem',
                color: '#E8DCC0',
                fontSize: '0.73rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <span>
                🏛️ Metrópole vazia (praça e portões prontos) —{' '}
                <strong>adicione um produto</strong> na aba Finanças de um projeto ou:
              </span>
              <button
                type="button"
                className="botao-campanha botao-campanha-ouro"
                data-testid="botao-carregar-demo-metropole"
                style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', cursor: 'pointer' }}
                onClick={() => {
                  const demo = seedDemo('demo', 'imperio-de-projetos-demo-2026');
                  demo.meta.config.brief.concluido = true;
                  void importarJson(demo);
                }}
              >
                ✨ Carregar 40 Cidades (Demo)
              </button>
            </div>
          )}

        {/* HUD de escala: nível semântico, barra de escala e trilha (Fase 2b, Seção 3.2) */}
        {vistaAtiva === 'mapa' && hudCamera && (
          <div
            data-testid="hud-escala-camera"
            data-nivel={hudCamera.nivelSemantico}
            style={{
              position: 'absolute',
              bottom: 12,
              left: 240,
              zIndex: 12,
              background: 'rgba(31, 27, 22, 0.88)',
              border: '1px solid var(--ouro)',
              borderRadius: 6,
              padding: '0.3rem 0.6rem',
              color: '#E8DCC0',
              fontSize: '0.72rem',
              pointerEvents: 'none',
            }}
          >
            <div>
              <strong data-testid="hud-nivel-camera">{hudCamera.rotuloNivel}</strong>
              {' · '}
              <span data-testid="hud-trilha-camera">{hudCamera.trilhaBreadcrumb.join(' > ')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div
                style={{
                  width: hudCamera.larguraPxBarraEscala,
                  height: 5,
                  borderLeft: '1px solid #E8DCC0',
                  borderRight: '1px solid #E8DCC0',
                  borderBottom: '1px solid #E8DCC0',
                }}
              />
              <span data-testid="hud-barra-escala">{hudCamera.unidadesBarraEscala} u</span>
            </div>
          </div>
        )}

        {/* Tooltip de Hover de Lojas e Estradas no Mapa (Seções 4.3 e 4.6) */}
        {vistaAtiva === 'mapa' && hoverMapa && (
          <div
            data-testid="tooltip-hover-mapa"
            style={{
              position: 'absolute',
              top: 52,
              left: 12,
              zIndex: 15,
              background: 'rgba(31, 27, 22, 0.94)',
              border: '1px solid var(--ouro)',
              borderRadius: 6,
              padding: '0.45rem 0.7rem',
              color: '#E8DCC0',
              fontSize: '0.76rem',
              maxWidth: 340,
              pointerEvents: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
            }}
          >
            {hoverMapa.tipo === 'loja' && (
              <div data-testid="tooltip-hover-loja">
                <div style={{ fontWeight: 700, color: 'var(--ouro)' }}>
                  🏪 {hoverMapa.titulo} ({hoverMapa.loja?.tamanho ?? 'M'})
                </div>
                <div>{hoverMapa.subtitulo}</div>
                <div style={{ color: '#8FD6B8', fontWeight: 600 }}>
                  Receita mensal: {formatarMoeda(hoverMapa.receitaOuVolumeCentavos)}/mês
                </div>
              </div>
            )}
            {hoverMapa.tipo === 'estrada' && (
              <div data-testid="tooltip-hover-estrada">
                <div style={{ fontWeight: 700, color: 'var(--ouro)' }}>
                  🛤️ {hoverMapa.titulo}
                </div>
                <div>{hoverMapa.subtitulo}</div>
                <div style={{ color: '#8FD6B8', fontWeight: 600 }}>
                  Volume mensal: {formatarMoeda(hoverMapa.receitaOuVolumeCentavos)}/mês
                </div>
                {hoverMapa.nomesProdutos.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#D9C9A5' }}>
                    Produtos: {hoverMapa.nomesProdutos.join(', ')}
                  </div>
                )}
              </div>
            )}
            {hoverMapa.tipo === 'cidade' && (
              <div data-testid="tooltip-hover-cidade">
                <div style={{ fontWeight: 700, color: 'var(--ouro)' }}>
                  🏙️ {hoverMapa.titulo}
                </div>
                <div>{hoverMapa.subtitulo}</div>
              </div>
            )}
          </div>
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
            trapezioCamera={hudCamera?.trapezioMinimapa}
            raioMundo={layoutMundo?.raioMapa ?? mapViewRef.current?.obterLayoutMundo()?.raioMapa}
            cunhas={layoutMundo?.cunhas}
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
      <EditorRegistros
        aoCarregarDadosExemplo={() => {
          const exemplo = seedDemo('demo', 'imperio-de-projetos-demo-2026');
          exemplo.meta.config.brief.concluido = true;
          void importarJson(exemplo);
        }}
      />
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
