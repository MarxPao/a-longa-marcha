import React, { useState } from 'react';
import type { Setor } from '../domain';
import { useCampanhaStore, useTerrenoFase0Store } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import { salvarBackupJsonEmPastaEscolhida } from './backupArquivoSistema';

type AbaEditor = 'setores' | 'estagios' | 'config' | 'dados' | 'terreno';

export interface PropriedadesEditorRegistros {
  aoCarregarDadosExemplo?: () => void;
}

export function EditorRegistros({
  aoCarregarDadosExemplo,
}: PropriedadesEditorRegistros = {}): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const dump = useCampanhaStore((s) => s.dump);
  const exportarJson = useCampanhaStore((s) => s.exportarJson);
  const importarJson = useCampanhaStore((s) => s.importarJson);
  const resetarBanco = useCampanhaStore((s) => s.resetarBanco);
  const atualizarConfig = useCampanhaStore((s) => s.atualizarConfig);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);

  // Store Terreno Fase 0 para sincronização
  const semente = useTerrenoFase0Store((s) => s.semente);
  const definirSemente = useTerrenoFase0Store((s) => s.definirSemente);
  const sortearSemente = useTerrenoFase0Store((s) => s.sortearSemente);
  const metricasTerreno = useTerrenoFase0Store((s) => s.metricas);

  const [abaAtiva, setAbaAtiva] = useState<AbaEditor>('setores');
  const [novoSetorNome, setNovoSetorNome] = useState('');
  const [novoSetorCor, setNovoSetorCor] = useState('#7FA35A');
  const [novoSetorBioma, setNovoSetorBioma] = useState('planicie');

  // Input de semente do terreno
  const [inputSemente, setInputSemente] = useState(semente);

  // Confirmação de limpeza
  const [confirmacaoLimpeza, setConfirmacaoLimpeza] = useState('');
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);
  const [statusBackupPasta, setStatusBackupPasta] = useState<string | null>(null);

  if (modalAberto !== 'editorRegistros') return null;

  const salvarNovoSetor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoSetorNome.trim()) return;

    await criarEntidade<Setor>('setores', {
      nome: novoSetorNome.trim(),
      cor: novoSetorCor,
      icone: 'cidade',
      bioma: novoSetorBioma,
      ordem: dump.setores.length + 1,
      regiao: [
        [-50, -50],
        [50, -50],
        [50, 50],
        [-50, 50],
      ],
    });

    setNovoSetorNome('');
  };

  const baixarJson = () => {
    const dados = exportarJson();
    const blob = new Blob([JSON.stringify(dados, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `a-longa-marcha-export-${dump.meta.versaoEsquema}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const carregarArquivoJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErroImportacao(null);

    const leitor = new FileReader();
    leitor.onload = async (evento) => {
      try {
        const conteudo = evento.target?.result;
        if (typeof conteudo !== 'string') return;
        const objeto = JSON.parse(conteudo);
        await importarJson(objeto);
      } catch (err) {
        setErroImportacao(err instanceof Error ? err.message : String(err));
      }
    };
    leitor.readAsText(arquivo);
  };

  const aplicarNovaSemente = () => {
    definirSemente(inputSemente);
    void atualizarConfig({
      mapa: {
        ...dump.meta.config.mapa,
        sementeTerreno: inputSemente,
      },
    });
  };

  return (
    <div className="modal-overlay" data-testid="modal-editor-registros">
      <div className="modal-caixa modal-caixa-larga" style={{ minHeight: '520px' }}>
        <div className="modal-cabecalho">
          <h3 className="modal-titulo">⚙️ {textosPtBr.editorRegistros.titulo}</h3>
          <button
            type="button"
            className="botao-campanha"
            data-testid="botao-fechar-editor-registros"
            onClick={fecharModal}
          >
            ✕
          </button>
        </div>

        {/* Abas do Editor */}
        <div className="painel-lateral-abas">
          <button
            type="button"
            className={`aba-item ${abaAtiva === 'setores' ? 'ativa' : ''}`}
            onClick={() => setAbaAtiva('setores')}
          >
            {textosPtBr.editorRegistros.abas.setores} ({dump.setores.length})
          </button>
          <button
            type="button"
            className={`aba-item ${abaAtiva === 'estagios' ? 'ativa' : ''}`}
            onClick={() => setAbaAtiva('estagios')}
          >
            {textosPtBr.editorRegistros.abas.estagios} ({dump.estagios.length})
          </button>
          <button
            type="button"
            className={`aba-item ${abaAtiva === 'config' ? 'ativa' : ''}`}
            onClick={() => setAbaAtiva('config')}
          >
            {textosPtBr.editorRegistros.abas.config}
          </button>
          <button
            type="button"
            className={`aba-item ${abaAtiva === 'dados' ? 'ativa' : ''}`}
            data-testid="aba-editor-dados"
            onClick={() => setAbaAtiva('dados')}
          >
            {textosPtBr.editorRegistros.abas.dados}
          </button>
          <button
            type="button"
            className={`aba-item ${abaAtiva === 'terreno' ? 'ativa' : ''}`}
            onClick={() => setAbaAtiva('terreno')}
          >
            {textosPtBr.editorRegistros.abas.terreno}
          </button>
        </div>

        <div className="modal-corpo">
          {/* ABA SETORES */}
          {abaAtiva === 'setores' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form
                onSubmit={(e) => void salvarNovoSetor(e)}
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-end',
                  background: '#fffdf7',
                  padding: '0.8rem',
                  borderRadius: '4px',
                  border: '1px solid var(--pergaminho-escuro)',
                }}
              >
                <div className="campo-form" style={{ flex: 2 }}>
                  <label className="rotulo-form">Novo Setor:</label>
                  <input
                    type="text"
                    className="input-texto"
                    data-testid="input-novo-setor-nome"
                    value={novoSetorNome}
                    onChange={(e) => setNovoSetorNome(e.target.value)}
                    placeholder="Nome do setor..."
                    required
                  />
                </div>
                <div className="campo-form" style={{ width: 80 }}>
                  <label className="rotulo-form">Cor:</label>
                  <input
                    type="color"
                    className="input-texto"
                    value={novoSetorCor}
                    onChange={(e) => setNovoSetorCor(e.target.value)}
                    style={{ height: 38, padding: 2 }}
                  />
                </div>
                <div className="campo-form" style={{ flex: 1 }}>
                  <label className="rotulo-form">Bioma:</label>
                  <select
                    className="select-form"
                    value={novoSetorBioma}
                    onChange={(e) => setNovoSetorBioma(e.target.value)}
                  >
                    <option value="planicie">Planície</option>
                    <option value="vale">Vale</option>
                    <option value="colinas">Colinas</option>
                    <option value="rochoso">Rochoso</option>
                    <option value="montanhas">Montanhas</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="botao-campanha botao-campanha-ouro"
                  data-testid="botao-criar-setor"
                >
                  + Adicionar Setor
                </button>
              </form>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                {dump.setores.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem',
                      background: '#fffdf7',
                      border: '1px solid var(--pergaminho-escuro)',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          backgroundColor: s.cor,
                        }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.nome}</span>
                      <span style={{ fontSize: '0.74rem', color: '#888' }}>({s.bioma})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA ESTÁGIOS */}
          {abaAtiva === 'estagios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p style={{ fontSize: '0.84rem' }}>
                Estágios de maturidade declarados pelo usuário (livremente editáveis):
              </p>
              {dump.estagios.map((est) => (
                <div
                  key={est.id}
                  style={{
                    padding: '0.6rem',
                    background: '#fffdf7',
                    border: '1px solid var(--pergaminho-escuro)',
                    borderRadius: '4px',
                    fontSize: '0.84rem',
                  }}
                >
                  <strong>{est.nome}</strong> (Ordem: {est.ordem})
                </div>
              ))}
            </div>
          )}

          {/* ABA CONFIG */}
          {abaAtiva === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>Pesos e Limites das Engines (Config)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="campo-form">
                  <label className="rotulo-form">Horas Disponíveis / Semana:</label>
                  <input
                    type="number"
                    className="input-texto"
                    value={dump.meta.config.horasSemanaisDisponiveis}
                    onChange={(e) =>
                      void atualizarConfig({
                        horasSemanaisDisponiveis: parseInt(e.target.value, 10) || 40,
                      })
                    }
                  />
                </div>
                <div className="campo-form">
                  <label className="rotulo-form">Limiar Receita Metrópole:</label>
                  <input
                    type="number"
                    className="input-texto"
                    value={dump.meta.config.maturidade.limiarReceitaMensalMetropoleCentavos / 100}
                    onChange={(e) =>
                      void atualizarConfig({
                        maturidade: {
                          ...dump.meta.config.maturidade,
                          limiarReceitaMensalMetropoleCentavos: Math.round(
                            parseFloat(e.target.value) * 100
                          ),
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* ABA DADOS */}
          {abaAtiva === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ background: '#fffdf7', padding: '1rem', borderRadius: '4px', border: '1px solid var(--pergaminho-escuro)' }}>
                <h4 style={{ marginBottom: '0.4rem' }}>Exportar e Importar JSON</h4>
                <p style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}>
                  Versão do esquema: <strong>v{dump.meta.versaoEsquema}</strong> · Total de entidades:{' '}
                  {dump.projetos.length} projetos, {dump.tarefas.length} tarefas.
                </p>

                {/* Aviso obrigatório da Seção 5.5 sobre persistência local no navegador */}
                <div
                  data-testid="aviso-persistencia-navegador"
                  style={{
                    background: '#fff3cd',
                    color: '#664d03',
                    border: '1px solid #ffecb5',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    marginBottom: '0.8rem',
                  }}
                >
                  ⚠️ <strong>Aviso Importante (Seção 5.5):</strong> Seus dados ficam gravados localmente no
                  IndexedDB deste navegador. Limpar os dados do site apaga tudo — exporte uma cópia JSON a cada
                  fechamento de turno ou salve numa pasta local.
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="botao-campanha botao-campanha-ouro"
                    data-testid="botao-exportar-dados-json"
                    onClick={baixarJson}
                  >
                    💾 Exportar Império (.JSON)
                  </button>

                  <button
                    type="button"
                    className="botao-campanha"
                    data-testid="botao-salvar-pasta-sistema"
                    onClick={() => {
                      void salvarBackupJsonEmPastaEscolhida(exportarJson()).then((res) => {
                        setStatusBackupPasta(
                          `Backup "${res.nomeArquivo}" salvo (${res.metodo === 'file_system_access_api' ? 'Pasta escolhida' : 'Download'}).`
                        );
                      });
                    }}
                  >
                    📁 Salvar em Pasta Escolhida
                  </button>

                  <label className="botao-campanha" style={{ cursor: 'pointer' }}>
                    📂 Importar JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={carregarArquivoJson}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {aoCarregarDadosExemplo && (
                    <button
                      type="button"
                      className="botao-campanha"
                      data-testid="botao-carregar-dados-exemplo"
                      onClick={() => {
                        aoCarregarDadosExemplo();
                        setStatusBackupPasta(
                          'Dados de exemplo (seed/demo.json) carregados pelo repositório.'
                        );
                      }}
                    >
                      🌱 Carregar dados de exemplo (seed/demo.json)
                    </button>
                  )}
                </div>
                {statusBackupPasta && (
                  <span
                    data-testid="status-backup-pasta"
                    style={{ color: '#3E7C68', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem', fontWeight: 600 }}
                  >
                    ✓ {statusBackupPasta}
                  </span>
                )}
                {erroImportacao && (
                  <span style={{ color: 'var(--laca)', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem' }}>
                    {erroImportacao}
                  </span>
                )}
              </div>

              {/* Limpeza com Dupla Confirmação */}
              <div style={{ background: 'rgba(142, 31, 26, 0.06)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--laca)' }}>
                <h4 style={{ color: 'var(--laca)', marginBottom: '0.4rem' }}>
                  ⚠️ Zona de Perigo: Limpar Banco
                </h4>
                <p style={{ fontSize: '0.82rem', marginBottom: '0.6rem' }}>
                  {textosPtBr.editorRegistros.confirmarLimpezaMensagem}
                </p>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <input
                    type="text"
                    className="input-texto"
                    placeholder="Digite LIMPAR"
                    value={confirmacaoLimpeza}
                    onChange={(e) => setConfirmacaoLimpeza(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                  <button
                    type="button"
                    className="botao-campanha botao-campanha-laca"
                    disabled={confirmacaoLimpeza.trim() !== 'LIMPAR'}
                    onClick={() => {
                      void resetarBanco();
                      setConfirmacaoLimpeza('');
                    }}
                  >
                    🗑️ Limpar Tudo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA TERRENO (Preserva compatibilidade com Fase 0 E2E) */}
          {abaAtiva === 'terreno' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>Configuração do Terreno 3D</h4>
              <div className="controles-semente">
                <label className="rotulo-semente" htmlFor="input-semente-editor">
                  {textosPtBr.terreno.rotuloSemente}:
                </label>
                <input
                  id="input-semente-editor"
                  type="text"
                  className="input-semente"
                  data-testid="input-semente"
                  value={inputSemente}
                  onChange={(e) => setInputSemente(e.target.value)}
                />
                <button
                  type="button"
                  className="botao-campanha botao-campanha-ouro"
                  data-testid="botao-gerar-terreno"
                  onClick={aplicarNovaSemente}
                >
                  {textosPtBr.terreno.botaoGerar}
                </button>
                <button
                  type="button"
                  className="botao-campanha"
                  data-testid="botao-sortear-semente"
                  onClick={() => {
                    sortearSemente();
                    setInputSemente(useTerrenoFase0Store.getState().semente);
                  }}
                >
                  {textosPtBr.terreno.botaoSortear}
                </button>
              </div>

              <div style={{ background: '#fffdf7', padding: '0.8rem', borderRadius: '4px', fontSize: '0.82rem' }}>
                <p>
                  Semente ativa: <strong data-testid="semente-ativa-valor">{semente}</strong>
                </p>
                <p>
                  Hash determinístico: <strong data-testid="hash-semente-valor">{metricasTerreno.hashNumerico}</strong>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-rodape">
          <button type="button" className="botao-campanha" onClick={fecharModal}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
