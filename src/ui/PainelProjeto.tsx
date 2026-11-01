import React, { useState } from 'react';
import type { Tarefa } from '../domain';
import { useCampanhaStore } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import {
  formatarData,
  formatarHoras,
  formatarMoeda,
  formatarPercentual,
  obterInfoFase,
  obterInfoSaude,
} from './formatadores';

type AbaPainel = 'visaoGeral' | 'tarefas' | 'clientes' | 'financas' | 'estoque' | 'pd';

export function PainelProjeto(): React.JSX.Element | null {
  const projetoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);
  const arquivarEntidade = useCampanhaStore((s) => s.arquivarEntidade);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);

  const [abaAtiva, setAbaAtiva] = useState<AbaPainel>('visaoGeral');
  const [modalRuinasAberto, setModalRuinasAberto] = useState(false);
  const [licoesAprendidas, setLicoesAprendidas] = useState('');
  const [erroRuinas, setErroRuinas] = useState<string | null>(null);

  if (!projetoId) return null;

  const projeto = dump.projetos.find((p) => p.id === projetoId);
  if (!projeto) return null;

  const setor = dump.setores.find((s) => s.id === projeto.setorId);
  const derivado = derivadosPorProjeto.get(projetoId);

  const saude = derivado?.saude.pontuacao ?? 100;
  const descontos = derivado?.saude.descontos ?? [];
  const infoSaude = obterInfoSaude(saude);

  const fase = derivado?.fase.fase ?? 1;
  const infoFase = obterInfoFase(fase);

  const moral = derivado?.moral.moral ?? 0.5;

  // Coleções filtradas por este projeto
  const tarefas = dump.tarefas.filter(
    (t) => t.projetoId === projetoId && t.arquivadoEm === null
  );
  const lancamentos = dump.lancamentos.filter(
    (l) => l.projetoId === projetoId && l.arquivadoEm === null
  );
  const vinculos = dump.vinculosCliente.filter(
    (v) =>
      v.projetoId === projetoId &&
      v.arquivadoEm === null &&
      (!v.fim || v.fim >= semanaAtual)
  );
  const itensDeLista = dump.itensDeLista.filter((i) => i.projetoId === projetoId);
  const aplicacoes = dump.aplicacoes.filter((a) => a.projetoId === projetoId);

  // Horas registradas na semana neste projeto
  const horasNaSemana = dump.registrosDeHoras
    .filter(
      (r) =>
        r.projetoId === projetoId &&
        r.arquivadoEm === null &&
        r.data >= semanaAtual
    )
    .reduce((acc, r) => acc + r.horas, 0);

  const alternarConclusaoTarefa = async (tarefa: Tarefa) => {
    const novoStatus = tarefa.status === 'feita' ? 'pendente' : 'feita';
    const concluidaEm = novoStatus === 'feita' ? semanaAtual : null;
    await atualizarEntidade<Tarefa>('tarefas', tarefa.id, {
      status: novoStatus,
      concluidaEm,
    });
  };

  const confirmarArquivamentoRuinas = async () => {
    if (!licoesAprendidas.trim()) {
      setErroRuinas(textosPtBr.painelProjeto.ruinasAviso);
      return;
    }
    try {
      await arquivarEntidade('projetos', projeto.id, licoesAprendidas);
      setModalRuinasAberto(false);
      selecionarProjeto(null);
    } catch (err) {
      setErroRuinas(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside
      className="painel-lateral-direito"
      data-testid="painel-lateral-projeto"
    >
      {/* Cabeçalho do Painel */}
      <div className="painel-lateral-cabecalho">
        <div>
          <h2 className="painel-lateral-titulo" data-testid="painel-projeto-nome">
            {projeto.nome}
          </h2>
          <div className="painel-lateral-subtitulo">
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: setor?.cor ?? '#888',
              }}
            />
            <span>{setor?.nome ?? 'Sem Setor'}</span>
            <span>·</span>
            <span>{projeto.autonomia}</span>
          </div>
        </div>

        <button
          type="button"
          className="botao-campanha"
          data-testid="botao-fechar-painel-projeto"
          onClick={() => selecionarProjeto(null)}
          title="Fechar painel (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Badges de Status (Fase, Saúde, Moral) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#fffdf7',
          borderBottom: '1px solid var(--pergaminho-escuro)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--bronze)', fontWeight: 600 }}>
            {textosPtBr.painelProjeto.fase}
          </span>
          <span
            style={{ fontWeight: 700, fontSize: '0.85rem' }}
            data-testid="badge-fase-valor"
          >
            {infoFase.icone} {infoFase.nome} ({infoFase.nivel})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--bronze)', fontWeight: 600 }}>
            {textosPtBr.painelProjeto.saude}
          </span>
          <span
            className={`badge ${
              saude >= 70
                ? 'badge-saude-saudavel'
                : saude >= 40
                ? 'badge-saude-atencao'
                : 'badge-saude-critico'
            }`}
            data-testid="badge-saude-valor"
            title={`${infoSaude.forma} (${infoSaude.texto})`}
          >
            {infoSaude.icone} {saude} ({infoSaude.texto})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--bronze)', fontWeight: 600 }}>
            {textosPtBr.painelProjeto.moral}
          </span>
          <span
            style={{ fontWeight: 700, fontSize: '0.85rem' }}
            data-testid="badge-moral-valor"
          >
            ⚡ {formatarPercentual(moral)}
          </span>
        </div>
      </div>

      {/* Abas */}
      <nav className="painel-lateral-abas">
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'visaoGeral' ? 'ativa' : ''}`}
          data-testid="aba-visao-geral"
          onClick={() => setAbaAtiva('visaoGeral')}
        >
          {textosPtBr.painelProjeto.abas.visaoGeral}
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'tarefas' ? 'ativa' : ''}`}
          data-testid="aba-tarefas"
          onClick={() => setAbaAtiva('tarefas')}
        >
          {textosPtBr.painelProjeto.abas.tarefas} ({tarefas.length})
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'clientes' ? 'ativa' : ''}`}
          data-testid="aba-clientes"
          onClick={() => setAbaAtiva('clientes')}
        >
          {textosPtBr.painelProjeto.abas.clientes} ({vinculos.length})
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'financas' ? 'ativa' : ''}`}
          data-testid="aba-financas"
          onClick={() => setAbaAtiva('financas')}
        >
          {textosPtBr.painelProjeto.abas.financas}
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'estoque' ? 'ativa' : ''}`}
          data-testid="aba-estoque"
          onClick={() => setAbaAtiva('estoque')}
        >
          {textosPtBr.painelProjeto.abas.estoque} ({itensDeLista.length})
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'pd' ? 'ativa' : ''}`}
          data-testid="aba-pd"
          onClick={() => setAbaAtiva('pd')}
        >
          {textosPtBr.painelProjeto.abas.pd} ({aplicacoes.length})
        </button>
      </nav>

      {/* Conteúdo da Aba */}
      <div className="painel-lateral-corpo">
        {abaAtiva === 'visaoGeral' && (
          <>
            {/* Princípio 2: Lista dos descontos que compõem a saúde */}
            <div className="descontos-saude-container">
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--laca)',
                  display: 'block',
                  marginBottom: '0.4rem',
                }}
              >
                {textosPtBr.painelProjeto.descontosSaudeTitulo}
              </span>

              {descontos.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: '#0f5132' }}>
                  {textosPtBr.painelProjeto.semDescontos}
                </p>
              ) : (
                descontos.map((d, idx) => (
                  <div key={idx} className="desconto-item">
                    <span>⚠️ -{d.pontos} pts:</span>
                    <span>{d.detalhe}</span>
                  </div>
                ))
              )}
            </div>

            {/* Metas e Horas */}
            <div
              style={{
                background: '#fffdf7',
                padding: '0.8rem',
                borderRadius: '4px',
                border: '1px solid var(--pergaminho-escuro)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.4rem',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {textosPtBr.painelProjeto.horasSemana}:
                </span>
                <span>
                  {formatarHoras(horasNaSemana)} / {formatarHoras(projeto.horasAlvoSemana)}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#eee',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      projeto.horasAlvoSemana > 0
                        ? (horasNaSemana / projeto.horasAlvoSemana) * 100
                        : 100
                    )}%`,
                    height: '100%',
                    backgroundColor:
                      horasNaSemana >= projeto.horasAlvoSemana ? '#3E7C68' : '#B8923A',
                  }}
                />
              </div>
            </div>

            {/* Notas do Projeto */}
            {projeto.notas && (
              <div style={{ fontSize: '0.82rem', color: 'var(--tinta)' }}>
                <strong>Notas:</strong>
                <p style={{ marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
                  {projeto.notas}
                </p>
              </div>
            )}

            {/* Ações Rápidas */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <button
                type="button"
                className="botao-campanha botao-campanha-ouro"
                style={{ flex: 1 }}
                onClick={() => abrirModal('capturaRapida', 'horas')}
              >
                ⏱️ Registrar Horas
              </button>
              <button
                type="button"
                className="botao-campanha botao-campanha-laca"
                data-testid="botao-arquivar-projeto"
                onClick={() => setModalRuinasAberto(true)}
              >
                🏚️ {textosPtBr.painelProjeto.botoes.arquivarRuinas}
              </button>
            </div>
          </>
        )}

        {abaAtiva === 'tarefas' && (
          <div style={{ display: 'flex', flexFlow: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                Tarefas ({tarefas.length})
              </span>
              <button
                type="button"
                className="botao-campanha botao-campanha-ouro"
                data-testid="botao-nova-tarefa"
                onClick={() => abrirModal('capturaRapida', 'tarefa')}
              >
                + Nova Tarefa
              </button>
            </div>

            {tarefas.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--bronze)' }}>
                Nenhuma tarefa ativa. Clique acima para criar a primeira tarefa!
              </p>
            ) : (
              tarefas.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    backgroundColor: t.status === 'feita' ? '#f0f0f0' : '#fffdf7',
                    border: '1px solid var(--pergaminho-escuro)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={t.status === 'feita'}
                    onChange={() => void alternarConclusaoTarefa(t)}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <div style={{ flex: 1 }}>
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--bronze)' }}>
                      Prazo: {formatarData(t.prazo ?? '')} · Estimativa: {t.estimativaHoras}h
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
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
                </div>
              ))
            )}
          </div>
        )}

        {abaAtiva === 'clientes' && (
          <div style={{ display: 'flex', flexFlow: 'column', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Vínculos de Clientes ({vinculos.length})
            </span>
            {vinculos.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--bronze)' }}>
                Nenhum cliente ativo vinculado a este projeto.
              </p>
            ) : (
              vinculos.map((v) => {
                const cliente = dump.clientes.find((c) => c.id === v.clienteId);
                return (
                  <div
                    key={v.id}
                    style={{
                      padding: '0.6rem',
                      backgroundColor: '#fffdf7',
                      border: '1px solid var(--pergaminho-escuro)',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {cliente?.nome ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#245747' }}>
                      Receita mensal: {formatarMoeda(v.receitaRecorrenteCentavos)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {abaAtiva === 'financas' && (
          <div style={{ display: 'flex', flexFlow: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                Lançamentos Financeiros ({lancamentos.length})
              </span>
              <button
                type="button"
                className="botao-campanha botao-campanha-ouro"
                data-testid="botao-novo-lancamento"
                onClick={() => abrirModal('capturaRapida', 'lancamento')}
              >
                + Lançar
              </button>
            </div>

            {lancamentos.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--bronze)' }}>
                Nenhum lançamento registrado neste projeto.
              </p>
            ) : (
              lancamentos.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    backgroundColor: '#fffdf7',
                    border: '1px solid var(--pergaminho-escuro)',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>
                      {dump.categoriasLancamento.find((c) => c.id === l.categoriaId)?.nome ?? 'Geral'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#666', marginLeft: '0.4rem' }}>
                      {formatarData(l.data)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: l.tipo === 'receita' ? '#245747' : 'var(--laca)',
                    }}
                  >
                    {l.tipo === 'receita' ? '+' : '-'} {formatarMoeda(l.valorCentavos)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {abaAtiva === 'estoque' && (
          <div style={{ display: 'flex', flexFlow: 'column', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Lista de Materiais (BOM) ({itensDeLista.length})
            </span>
            {itensDeLista.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--bronze)' }}>
                Nenhum insumo ou equipamento cadastrado na BOM.
              </p>
            ) : (
              itensDeLista.map((item) => {
                const itemRef = dump.itens.find((i) => i.id === item.itemId);
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: '#fffdf7',
                      border: '1px solid var(--pergaminho-escuro)',
                      borderRadius: '4px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{itemRef?.nome ?? 'Item'}</span>
                    <div style={{ fontSize: '0.74rem', color: '#666' }}>
                      Necessário: {item.quantidade} {itemRef?.unidade ?? 'un'} ·
                      Status: {item.status}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {abaAtiva === 'pd' && (
          <div style={{ display: 'flex', flexFlow: 'column', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Tecnologias Aplicadas ({aplicacoes.length})
            </span>
            {aplicacoes.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--bronze)' }}>
                Nenhuma tecnologia aplicada neste projeto ainda.
              </p>
            ) : (
              aplicacoes.map((ap) => {
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
                  >
                    <span style={{ fontWeight: 600 }}>🔬 {tec?.nome ?? 'Tecnologia'}</span>
                    <div style={{ fontSize: '0.74rem', color: '#666' }}>
                      Efeito: {ap.efeito}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação de arquivamento como Ruínas */}
      {modalRuinasAberto && (
        <div className="modal-overlay">
          <div className="modal-caixa" style={{ maxWidth: 480 }}>
            <div className="modal-cabecalho">
              <h3 className="modal-titulo">🏚️ Arquivar como Ruínas</h3>
              <button
                type="button"
                className="botao-campanha"
                onClick={() => setModalRuinasAberto(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-corpo">
              <p style={{ fontSize: '0.84rem' }}>
                {textosPtBr.painelProjeto.ruinasAviso}
              </p>
              <div className="campo-form">
                <label className="rotulo-form">Lições Aprendidas (Obrigatório):</label>
                <textarea
                  className="textarea-form"
                  data-testid="input-licoes-aprendidas-ruinas"
                  placeholder={textosPtBr.painelProjeto.licoesAprendidasPlaceholder}
                  value={licoesAprendidas}
                  onChange={(e) => setLicoesAprendidas(e.target.value)}
                />
              </div>
              {erroRuinas && (
                <span style={{ color: 'var(--laca)', fontSize: '0.8rem', fontWeight: 600 }}>
                  {erroRuinas}
                </span>
              )}
            </div>
            <div className="modal-rodape">
              <button
                type="button"
                className="botao-campanha"
                onClick={() => setModalRuinasAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="botao-campanha botao-campanha-laca"
                data-testid="botao-confirmar-ruinas"
                onClick={() => void confirmarArquivamentoRuinas()}
              >
                Confirmar Arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
