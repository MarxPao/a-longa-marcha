import React, { useMemo, useState } from 'react';
import type { Aplicacao, Tecnologia, UUID } from '../domain';
import { useCampanhaStore } from '../store';

export function TelaArvoreTecnologica(): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const dump = useCampanhaStore((s) => s.dump);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const adicionarPreRequisitoTecnologia = useCampanhaStore(
    (s) => s.adicionarPreRequisitoTecnologia
  );
  const removerPreRequisitoTecnologia = useCampanhaStore(
    (s) => s.removerPreRequisitoTecnologia
  );
  const alterarEstadoTecnologia = useCampanhaStore((s) => s.alterarEstadoTecnologia);
  const obterRankingTecnologias = useCampanhaStore((s) => s.obterRankingTecnologias);

  // Estados de formulário: Nova Tecnologia
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaEstimativa, setNovaEstimativa] = useState('20');

  // Estados de formulário: Vincular Pré-requisito
  const [techDependenteId, setTechDependenteId] = useState<UUID>('');
  const [techPreRequisitoId, setTechPreRequisitoId] = useState<UUID>('');

  // Estados de formulário: Aplicar Tecnologia a Projeto
  const [techAplicarId, setTechAplicarId] = useState<UUID>('');
  const [projetoAplicarId, setProjetoAplicarId] = useState<UUID>('');
  const [efeitoAplicar, setEfeitoAplicar] = useState<
    'velocidade' | 'custo' | 'receita_nova'
  >('velocidade');

  // Mensagem de validação / bloqueio de ciclo ou pré-requisito
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const estaAberto = modalAberto === 'arvoreTecnologica';

  const tecnologiasAtivas = useMemo(
    () => dump.tecnologias.filter((t) => t.arquivadoEm === null),
    [dump.tecnologias]
  );

  const projetosAtivos = useMemo(
    () => dump.projetos.filter((p) => p.arquivadoEm === null),
    [dump.projetos]
  );

  // Horas acumuladas por tecnologia
  const horasPorTech = useMemo(() => {
    const mapa = new Map<UUID, number>();
    for (const r of dump.registrosDeHoras) {
      if (r.arquivadoEm === null && r.tecnologiaId) {
        mapa.set(r.tecnologiaId, (mapa.get(r.tecnologiaId) ?? 0) + r.horas);
      }
    }
    return mapa;
  }, [dump.registrosDeHoras]);

  // Ranking "O que pesquisar primeiro"
  const rankingPrioritario = useMemo(() => {
    if (!estaAberto) return [];
    return obterRankingTecnologias();
  }, [estaAberto, obterRankingTecnologias, dump.tecnologias, dump.preRequisitosTecnologia, dump.aplicacoes]);

  // Cálculo de colunas topológicas (níveis da árvore) e posições (x, y) para fios dourados SVG
  const layoutGrafo = useMemo(() => {
    const nivelPorId = new Map<UUID, number>();
    const preReqsPorTech = new Map<UUID, UUID[]>();

    for (const t of tecnologiasAtivas) {
      nivelPorId.set(t.id, 0);
      preReqsPorTech.set(t.id, []);
    }

    for (const pr of dump.preRequisitosTecnologia) {
      if (nivelPorId.has(pr.tecnologiaId) && nivelPorId.has(pr.preRequisitoId)) {
        preReqsPorTech.get(pr.tecnologiaId)?.push(pr.preRequisitoId);
      }
    }

    // Relaxamento iterativo para atribuir coluna (profundidade no DAG)
    for (let iter = 0; iter < tecnologiasAtivas.length + 1; iter++) {
      let mudou = false;
      for (const t of tecnologiasAtivas) {
        const pais = preReqsPorTech.get(t.id) ?? [];
        let maxPai = -1;
        for (const pId of pais) {
          const nv = nivelPorId.get(pId) ?? 0;
          if (nv > maxPai) maxPai = nv;
        }
        const novoNivel = maxPai + 1;
        if (novoNivel !== (nivelPorId.get(t.id) ?? 0) && novoNivel < 12) {
          nivelPorId.set(t.id, novoNivel);
          mudou = true;
        }
      }
      if (!mudou) break;
    }

    const porColuna = new Map<number, Tecnologia[]>();
    for (const t of tecnologiasAtivas) {
      const col = nivelPorId.get(t.id) ?? 0;
      const lista = porColuna.get(col) ?? [];
      lista.push(t);
      porColuna.set(col, lista);
    }

    const posicoes = new Map<UUID, { x: number; y: number; coluna: number }>();
    const LARGURA_NO = 220;
    const ALTURA_NO = 115;
    const ESPACO_X = 280;
    const ESPACO_Y = 140;

    let maxX = 640;
    let maxY = 360;

    for (const [col, lista] of porColuna.entries()) {
      lista.forEach((t, idx) => {
        const x = 30 + col * ESPACO_X;
        const y = 30 + idx * ESPACO_Y;
        posicoes.set(t.id, { x, y, coluna: col });
        if (x + LARGURA_NO + 40 > maxX) maxX = x + LARGURA_NO + 40;
        if (y + ALTURA_NO + 40 > maxY) maxY = y + ALTURA_NO + 40;
      });
    }

    return { posicoes, LARGURA_NO, ALTURA_NO, larguraCanvas: maxX, alturaCanvas: maxY };
  }, [tecnologiasAtivas, dump.preRequisitosTecnologia]);

  if (!estaAberto) return null;

  const handleCriarTecnologia = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    if (!novoNome.trim()) return;

    const criada = await criarEntidade<Tecnologia>('tecnologias', {
      nome: novoNome.trim(),
      descricao: novaDescricao.trim() || 'Pesquisa imperial',
      estado: 'ideia',
      estimativaHoras: Math.max(1, Number(novaEstimativa) || 20),
    });

    setNovoNome('');
    setNovaDescricao('');
    setMensagemSucesso(`Tecnologia "${criada.nome}" registrada na árvore.`);
  };

  const handleAdicionarPreRequisito = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    setMensagemSucesso(null);

    if (!techDependenteId || !techPreRequisitoId) {
      setMensagemErro('Selecione a tecnologia dependente e o seu pré-requisito.');
      return;
    }

    const res = await adicionarPreRequisitoTecnologia(
      techDependenteId,
      techPreRequisitoId
    );
    if (!res.ok) {
      setMensagemErro(res.erro ?? 'Não foi possível adicionar o pré-requisito.');
    } else {
      setMensagemSucesso('Fio dourado de pré-requisito conectado com sucesso.');
    }
  };

  const handleMudarEstado = async (
    techId: UUID,
    novoEstado: 'ideia' | 'pesquisando' | 'dominada'
  ) => {
    setMensagemErro(null);
    setMensagemSucesso(null);

    const res = await alterarEstadoTecnologia(techId, novoEstado);
    if (!res.ok) {
      setMensagemErro(res.erro ?? 'Transição bloqueada pelas regras da árvore.');
    } else {
      setMensagemSucesso(`Estado atualizado para "${novoEstado}".`);
    }
  };

  const handleAplicarTecnologia = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    setMensagemSucesso(null);

    if (!techAplicarId || !projetoAplicarId) {
      setMensagemErro('Selecione uma tecnologia dominada e um projeto destino.');
      return;
    }

    const tech = tecnologiasAtivas.find((t) => t.id === techAplicarId);
    if (!tech || tech.estado !== 'dominada') {
      setMensagemErro(
        'Apenas tecnologias no estado "Dominada" podem ser aplicadas a cidades.'
      );
      return;
    }

    await criarEntidade<Aplicacao>('aplicacoes', {
      tecnologiaId: techAplicarId,
      projetoId: projetoAplicarId,
      efeito: efeitoAplicar,
      valorEstimadoCentavos: 100000,
    });

    setMensagemSucesso(`Tecnologia "${tech.nome}" aplicada à cidade com sucesso.`);
  };

  const obterCorEstado = (estado: Tecnologia['estado']) => {
    if (estado === 'dominada') return '#2B6CB0'; // Azul celeste P&D
    if (estado === 'pesquisando') return '#B8923A'; // Ouro imperial
    return '#5A554E'; // Ideia
  };

  return (
    <div
      data-testid="modal-arvore-tecnologica"
      className="modal-overlay"
      onClick={fecharModal}
      style={{ zIndex: 85 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95vw',
          maxWidth: 1280,
          height: '88vh',
          background: '#1B1814',
          color: '#E8DCC0',
          border: '2px solid var(--ouro)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        }}
      >
        {/* Cabeçalho Imperial */}
        <header
          style={{
            padding: '0.85rem 1.25rem',
            background: '#26211B',
            borderBottom: '2px solid var(--ouro)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--fonte-titulo)',
                fontSize: '1.25rem',
                color: 'var(--ouro)',
                margin: 0,
              }}
            >
              🔬 Árvore Tecnológica e Sabedoria do Império (P&amp;D)
            </h2>
            <span style={{ fontSize: '0.78rem', color: '#C8BFA8' }}>
              Nós ligados por fios dourados · Validação acíclica (DAG) · Ranking de alavancagem
            </span>
          </div>

          <button
            type="button"
            data-testid="botao-fechar-arvore"
            className="botao-campanha"
            onClick={fecharModal}
          >
            ✕ Fechar [Esc]
          </button>
        </header>

        {/* Mensagens de Alerta / Bloqueio de Ciclo ou Pré-Requisito */}
        {mensagemErro && (
          <div
            data-testid="alerta-erro-arvore"
            style={{
              background: '#8E1F1A',
              color: '#FFF',
              padding: '0.6rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderBottom: '1px solid var(--ouro)',
            }}
          >
            ⚠️ Bloqueio da Árvore: {mensagemErro}
          </div>
        )}

        {mensagemSucesso && !mensagemErro && (
          <div
            data-testid="alerta-sucesso-arvore"
            style={{
              background: '#245747',
              color: '#FFF',
              padding: '0.5rem 1.25rem',
              fontSize: '0.82rem',
            }}
          >
            ✓ {mensagemSucesso}
          </div>
        )}

        {/* Corpo Principal: Grafo com Fios Dourados (Esquerda) + Painel de Ranking e Controles (Direita) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Tela do Grafo de Tecnologias com Fios Dourados */}
          <div
            data-testid="canvas-grafo-arvore"
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'auto',
              background:
                'radial-gradient(circle at center, #28221B 0%, #16130F 100%)',
              padding: '1rem',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: layoutGrafo.larguraCanvas,
                height: layoutGrafo.alturaCanvas,
              }}
            >
              {/* Camada SVG de Fios Dourados */}
              <svg
                data-testid="svg-fios-arvore"
                width={layoutGrafo.larguraCanvas}
                height={layoutGrafo.alturaCanvas}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                }}
              >
                <defs>
                  <marker
                    id="seta-fio-dourado"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill="#E5B842" />
                  </marker>
                </defs>

                {dump.preRequisitosTecnologia.map((pr) => {
                  const origem = layoutGrafo.posicoes.get(pr.preRequisitoId);
                  const destino = layoutGrafo.posicoes.get(pr.tecnologiaId);
                  if (!origem || !destino) return null;

                  const x1 = origem.x + layoutGrafo.LARGURA_NO;
                  const y1 = origem.y + layoutGrafo.ALTURA_NO / 2;
                  const x2 = destino.x;
                  const y2 = destino.y + layoutGrafo.ALTURA_NO / 2;
                  const cx1 = x1 + (x2 - x1) * 0.5;
                  const cx2 = x1 + (x2 - x1) * 0.5;

                  return (
                    <path
                      key={`${pr.preRequisitoId}->${pr.tecnologiaId}`}
                      data-testid={`fio-dourado-${pr.preRequisitoId}-${pr.tecnologiaId}`}
                      d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="#E5B842"
                      strokeWidth={2.5}
                      markerEnd="url(#seta-fio-dourado)"
                      opacity={0.9}
                    />
                  );
                })}
              </svg>

              {/* Nós das Tecnologias */}
              {tecnologiasAtivas.map((t) => {
                const pos = layoutGrafo.posicoes.get(t.id) ?? {
                  x: 20,
                  y: 20,
                  coluna: 0,
                };
                const horasGastas = horasPorTech.get(t.id) ?? 0;
                const corBorda = obterCorEstado(t.estado);
                const preReqs = dump.preRequisitosTecnologia.filter(
                  (p) => p.tecnologiaId === t.id
                );

                return (
                  <div
                    key={t.id}
                    data-testid={`no-tecnologia-${t.id}`}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      width: layoutGrafo.LARGURA_NO,
                      minHeight: layoutGrafo.ALTURA_NO,
                      background: '#26211B',
                      border: `2px solid ${corBorda}`,
                      borderRadius: 6,
                      padding: '0.55rem 0.65rem',
                      boxShadow:
                        t.estado === 'dominada'
                          ? '0 0 14px rgba(49, 130, 206, 0.45)'
                          : '0 4px 12px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <strong
                          data-testid={`titulo-tech-${t.id}`}
                          style={{ fontSize: '0.84rem', color: '#FFF' }}
                        >
                          {t.nome}
                        </strong>
                        <span
                          data-testid={`estado-tech-${t.id}`}
                          style={{
                            fontSize: '0.64rem',
                            padding: '0.1rem 0.35rem',
                            borderRadius: 3,
                            background: corBorda,
                            color: '#FFF',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {t.estado}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: '#C8BFA8',
                          marginTop: '0.2rem',
                        }}
                      >
                        Horas: {horasGastas}h / {t.estimativaHoras}h
                        {preReqs.length > 0 && ` · Req: ${preReqs.length}`}
                      </div>
                    </div>

                    {/* Botões rápidos de transição de estado */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.25rem',
                        marginTop: '0.45rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {t.estado !== 'pesquisando' && (
                        <button
                          type="button"
                          data-testid={`botao-pesquisar-${t.id}`}
                          onClick={() => void handleMudarEstado(t.id, 'pesquisando')}
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.35rem',
                            background: '#B8923A',
                            color: '#1F1B16',
                            border: 'none',
                            borderRadius: 3,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Pesquisar
                        </button>
                      )}
                      {t.estado !== 'dominada' && (
                        <button
                          type="button"
                          data-testid={`botao-dominar-${t.id}`}
                          onClick={() => void handleMudarEstado(t.id, 'dominada')}
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.35rem',
                            background: '#2B6CB0',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: 3,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Dominar
                        </button>
                      )}
                      {t.estado !== 'ideia' && (
                        <button
                          type="button"
                          data-testid={`botao-ideia-${t.id}`}
                          onClick={() => void handleMudarEstado(t.id, 'ideia')}
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.35rem',
                            background: '#5A554E',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: 3,
                            cursor: 'pointer',
                          }}
                        >
                          Ideia
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barra Lateral Direita: Ranking "O Que Pesquisar Primeiro" e Formulários */}
          <aside
            style={{
              width: 390,
              background: '#231E18',
              borderLeft: '2px solid var(--bronze)',
              padding: '0.9rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* 1. Ranking: O Que Pesquisar Primeiro (Seção 3.7) */}
            <section
              data-testid="secao-ranking-pesquisa"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--ouro)',
                borderRadius: 6,
                padding: '0.7rem',
              }}
            >
              <h3
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--ouro)',
                  marginBottom: '0.4rem',
                }}
              >
                🏆 O Que Pesquisar Primeiro (Alavancagem)
              </h3>
              {rankingPrioritario.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#9DAAB0' }}>
                  Todas as tecnologias já foram dominadas!
                </div>
              ) : (
                <div
                  data-testid="lista-ranking-pesquisa"
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
                >
                  {rankingPrioritario.slice(0, 6).map((item, idx) => (
                    <div
                      key={item.tecnologia.id}
                      data-testid={`item-ranking-tech-${idx}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.35rem 0.5rem',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#FFF' }}>
                          #{idx + 1} {item.tecnologia.nome}
                        </strong>
                        <div style={{ fontSize: '0.68rem', color: '#C8BFA8' }}>
                          Destrava {item.projetosDesbloqueados} cidade(s) e{' '}
                          {item.tecnologiasDesbloqueadas} tecnologia(s)
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 3,
                          background: item.podePesquisar ? '#3E7C68' : '#8E1F1A',
                          color: '#FFF',
                        }}
                      >
                        {item.podePesquisar ? 'Pronta' : 'Bloqueada'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Formulário: Criar Nova Tecnologia */}
            <form
              onSubmit={(e) => void handleCriarTecnologia(e)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--bronze)',
                borderRadius: 6,
                padding: '0.7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <strong style={{ fontSize: '0.82rem', color: '#E8DCC0' }}>
                ➕ Nova Tecnologia
              </strong>
              <input
                type="text"
                data-testid="input-nome-nova-tech"
                className="input-texto"
                placeholder="Nome da tecnologia (ex: Automação CNC)"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  data-testid="input-desc-nova-tech"
                  className="input-texto"
                  placeholder="Descrição"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  style={{ flex: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                />
                <input
                  type="number"
                  data-testid="input-horas-nova-tech"
                  className="input-texto"
                  placeholder="Horas"
                  value={novaEstimativa}
                  onChange={(e) => setNovaEstimativa(e.target.value)}
                  style={{ width: 75, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                />
              </div>
              <button
                type="submit"
                data-testid="botao-criar-tecnologia"
                className="botao-campanha botao-campanha-ouro"
                style={{ fontSize: '0.78rem' }}
              >
                Adicionar à Árvore
              </button>
            </form>

            {/* 3. Formulário: Vincular Pré-requisito (Com Defesa Anti-Ciclo) */}
            <form
              onSubmit={(e) => void handleAdicionarPreRequisito(e)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--bronze)',
                borderRadius: 6,
                padding: '0.7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <strong style={{ fontSize: '0.82rem', color: '#E8DCC0' }}>
                🔗 Conectar Pré-Requisito (Fio Dourado)
              </strong>
              <label style={{ fontSize: '0.72rem', color: '#C8BFA8' }}>
                Tecnologia que exige o pré-requisito:
                <select
                  data-testid="select-tech-dependente"
                  className="input-texto"
                  value={techDependenteId}
                  onChange={(e) => setTechDependenteId(e.target.value)}
                  style={{ width: '100%', marginTop: '0.2rem', fontSize: '0.78rem' }}
                >
                  <option value="">Selecione...</option>
                  {tecnologiasAtivas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: '0.72rem', color: '#C8BFA8' }}>
                Depende de (pré-requisito):
                <select
                  data-testid="select-tech-prerequisito"
                  className="input-texto"
                  value={techPreRequisitoId}
                  onChange={(e) => setTechPreRequisitoId(e.target.value)}
                  style={{ width: '100%', marginTop: '0.2rem', fontSize: '0.78rem' }}
                >
                  <option value="">Selecione...</option>
                  {tecnologiasAtivas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                data-testid="botao-vincular-prerequisito"
                className="botao-campanha"
                style={{ fontSize: '0.78rem' }}
              >
                Vincular Dependência
              </button>

              {dump.preRequisitosTecnologia.length > 0 && (
                <div style={{ marginTop: '0.3rem', fontSize: '0.7rem' }}>
                  {dump.preRequisitosTecnologia.map((pr) => {
                    const tDep = tecnologiasAtivas.find(
                      (t) => t.id === pr.tecnologiaId
                    );
                    const tPre = tecnologiasAtivas.find(
                      (t) => t.id === pr.preRequisitoId
                    );
                    if (!tDep || !tPre) return null;
                    return (
                      <div
                        key={`${pr.preRequisitoId}-${pr.tecnologiaId}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.15rem 0',
                        }}
                      >
                        <span>
                          {tPre.nome} ➔ {tDep.nome}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void removerPreRequisitoTecnologia(
                              pr.tecnologiaId,
                              pr.preRequisitoId
                            )
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#E57373',
                            cursor: 'pointer',
                            fontSize: '0.68rem',
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </form>

            {/* 4. Formulário: Aplicar Tecnologia a uma Cidade */}
            <form
              onSubmit={(e) => void handleAplicarTecnologia(e)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--bronze)',
                borderRadius: 6,
                padding: '0.7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <strong style={{ fontSize: '0.82rem', color: '#E8DCC0' }}>
                🏯 Aplicar Tecnologia a Cidade
              </strong>
              <select
                data-testid="select-aplicar-tech"
                className="input-texto"
                value={techAplicarId}
                onChange={(e) => setTechAplicarId(e.target.value)}
                style={{ fontSize: '0.78rem' }}
              >
                <option value="">Tecnologia dominada...</option>
                {tecnologiasAtivas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.estado})
                  </option>
                ))}
              </select>

              <select
                data-testid="select-aplicar-projeto"
                className="input-texto"
                value={projetoAplicarId}
                onChange={(e) => setProjetoAplicarId(e.target.value)}
                style={{ fontSize: '0.78rem' }}
              >
                <option value="">Cidade destino...</option>
                {projetosAtivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>

              <select
                data-testid="select-aplicar-efeito"
                className="input-texto"
                value={efeitoAplicar}
                onChange={(e) =>
                  setEfeitoAplicar(
                    e.target.value as 'velocidade' | 'custo' | 'receita_nova'
                  )
                }
                style={{ fontSize: '0.78rem' }}
              >
                <option value="velocidade">Efeito: Velocidade</option>
                <option value="custo">Efeito: Redução de Custo</option>
                <option value="receita_nova">Efeito: Receita Nova</option>
              </select>

              <button
                type="submit"
                data-testid="botao-aplicar-tech-arvore"
                className="botao-campanha botao-campanha-ouro"
                style={{ fontSize: '0.78rem' }}
              >
                Aplicar à Cidade
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
