import React, { useState } from 'react';
import { useCampanhaStore } from '../../src/store';
import { textosPtBr } from '../../src/textos/pt-BR';
import {
  formatarPercentual,
  obterInfoFase,
  obterInfoSaude,
} from './formatadores';
import { IconeFormaSaudeSvg, IconeSetorSvg } from './IconesSetoresSvg';
import { AbaClientes } from './painel/AbaClientes';
import { AbaEstoque } from './painel/AbaEstoque';
import { AbaFinancas } from './painel/AbaFinancas';
import { AbaPd } from './painel/AbaPd';
import { AbaTarefas } from './painel/AbaTarefas';
import { AbaVisaoGeral } from './painel/AbaVisaoGeral';
import { ModalEditarProjeto } from './painel/ModalEditarProjeto';

export function PainelProjeto(): React.JSX.Element | null {
  const projetoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const abaAtiva = useCampanhaStore((s) => s.abaAtivaPainel);
  const setAbaAtiva = useCampanhaStore((s) => s.definirAbaAtivaPainel);
  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const arquivarEntidade = useCampanhaStore((s) => s.arquivarEntidade);

  const [modalEditarAberto, setModalEditarAberto] = useState(false);
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

  // Horas registradas na semana corrente neste projeto
  const horasNaSemana = dump.registrosDeHoras
    .filter(
      (r) =>
        r.projetoId === projetoId &&
        r.arquivadoEm === null &&
        r.data >= semanaAtual
    )
    .reduce((acc, r) => acc + r.horas, 0);

  // Contagens para os rótulos das abas
  const totalTarefas = dump.tarefas.filter(
    (t) => t.projetoId === projetoId && t.arquivadoEm === null
  ).length;
  const totalClientes = dump.vinculosCliente.filter(
    (v) =>
      v.projetoId === projetoId &&
      v.arquivadoEm === null &&
      (!v.fim || v.fim >= semanaAtual)
  ).length;
  const totalEstoque = dump.itensDeLista.filter((i) => i.projetoId === projetoId).length;
  const totalAplicacoes = dump.aplicacoes.filter((a) => a.projetoId === projetoId).length;

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
    <aside className="painel-lateral-direito" data-testid="painel-lateral-projeto">
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
            <IconeSetorSvg
              iconeOuNome={setor?.icone || setor?.nome || 'comercio'}
              cor={setor?.cor ?? '#7A5A2B'}
              tamanho={14}
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
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }} data-testid="badge-fase-valor">
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <IconeFormaSaudeSvg pontuacao={saude} tamanho={14} />
            {infoSaude.icone} {saude} ({infoSaude.texto})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--bronze)', fontWeight: 600 }}>
            {textosPtBr.painelProjeto.moral}
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }} data-testid="badge-moral-valor">
            ⚡ {formatarPercentual(moral)}
          </span>
        </div>
      </div>

      {/* Navegação por Abas (Seção 6.5) */}
      <nav className="painel-lateral-abas" data-testid="nav-abas-painel-projeto">
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
          {textosPtBr.painelProjeto.abas.tarefas} ({totalTarefas})
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'clientes' ? 'ativa' : ''}`}
          data-testid="aba-clientes"
          onClick={() => setAbaAtiva('clientes')}
        >
          {textosPtBr.painelProjeto.abas.clientes} ({totalClientes})
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
          {textosPtBr.painelProjeto.abas.estoque} ({totalEstoque})
        </button>
        <button
          type="button"
          className={`aba-item ${abaAtiva === 'pd' ? 'ativa' : ''}`}
          data-testid="aba-pd"
          onClick={() => setAbaAtiva('pd')}
        >
          {textosPtBr.painelProjeto.abas.pd} ({totalAplicacoes})
        </button>
      </nav>

      {/* Conteúdo Dinâmico da Aba Selecionada */}
      <div className="painel-lateral-corpo">
        {abaAtiva === 'visaoGeral' && (
          <AbaVisaoGeral
            projeto={projeto}
            descontos={descontos}
            horasNaSemana={horasNaSemana}
            abrirModalRuinas={() => setModalRuinasAberto(true)}
            abrirModalEditar={() => setModalEditarAberto(true)}
          />
        )}

        {abaAtiva === 'tarefas' && <AbaTarefas projetoId={projeto.id} />}

        {abaAtiva === 'clientes' && <AbaClientes projetoId={projeto.id} />}

        {abaAtiva === 'financas' && <AbaFinancas projeto={projeto} />}

        {abaAtiva === 'estoque' && <AbaEstoque projetoId={projeto.id} />}

        {abaAtiva === 'pd' && <AbaPd projetoId={projeto.id} />}
      </div>

      {/* Modal Editar Projeto */}
      {modalEditarAberto && (
        <ModalEditarProjeto
          projeto={projeto}
          aoFechar={() => setModalEditarAberto(false)}
        />
      )}

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
              <p style={{ fontSize: '0.84rem' }}>{textosPtBr.painelProjeto.ruinasAviso}</p>
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
