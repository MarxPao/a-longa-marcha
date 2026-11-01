import React, { useMemo, useState } from 'react';
import { useCampanhaStore } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import { salvarBackupJsonEmPastaEscolhida } from './backupArquivoSistema';
import { formatarData, formatarHoras, formatarMoeda } from './formatadores';

export function ModalFecharTurno(): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const obterPreviaTurno = useCampanhaStore((s) => s.obterPreviaTurno);
  const fecharTurno = useCampanhaStore((s) => s.fecharTurno);
  const desfazerUltimoTurno = useCampanhaStore((s) => s.desfazerUltimoTurno);
  const exportarJson = useCampanhaStore((s) => s.exportarJson);
  const resumoRecente = useCampanhaStore((s) => s.resumoFechamentoRecente);

  const [executando, setExecutando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Calcula prévia analítica se modal estiver aberto
  const previa = useMemo(() => {
    if (modalAberto !== 'fecharTurno') return null;
    try {
      return obterPreviaTurno();
    } catch {
      return null;
    }
  }, [modalAberto, obterPreviaTurno]);

  if (modalAberto !== 'fecharTurno') return null;

  const confirmarFechamento = async () => {
    setExecutando(true);
    try {
      await fecharTurno();
      setSucesso(true);
    } finally {
      setExecutando(false);
    }
  };

  const reverterFechamento = async () => {
    await desfazerUltimoTurno();
    setSucesso(false);
  };

  const baixarJsonBackup = () => {
    const dump = exportarJson();
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `a-longa-marcha-backup-${semanaAtual}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" data-testid="modal-fechar-turno">
      <div className="modal-caixa modal-caixa-larga">
        <div className="modal-cabecalho">
          <h3 className="modal-titulo">
            📜 {sucesso ? textosPtBr.fechamentoTurno.tituloSucesso : `Prévia do Fechamento Semanal (${formatarData(semanaAtual)})`}
          </h3>
          <button type="button" className="botao-campanha" onClick={fecharModal}>
            ✕
          </button>
        </div>

        <div className="modal-corpo">
          {sucesso ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
              <div
                style={{
                  backgroundColor: '#d1e7dd',
                  color: '#0f5132',
                  padding: '1rem',
                  borderRadius: '4px',
                  border: '1px solid #badbcc',
                  fontWeight: 600,
                }}
              >
                ✅ {textosPtBr.fechamentoTurno.mensagemSucesso}
              </div>

              {/* Lembrete de Backup em Destaque (Seção 5.5 e 6.4) */}
              <div
                style={{
                  backgroundColor: '#fff3cd',
                  color: '#664d03',
                  padding: '1.2rem',
                  borderRadius: '6px',
                  border: '2px solid #ffecb5',
                }}
              >
                <h4 style={{ marginBottom: '0.4rem', color: '#664d03' }}>
                  🛡️ {textosPtBr.fechamentoTurno.lembreteExportar}
                </h4>
                <p style={{ fontSize: '0.86rem', marginBottom: '0.8rem' }}>
                  Para proteger seu progresso contra limpezas de cache do navegador, salve uma cópia do seu arquivo de campanha.
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="botao-campanha botao-campanha-ouro"
                    data-testid="botao-exportar-backup-turno"
                    onClick={baixarJsonBackup}
                    style={{ fontSize: '0.92rem', padding: '0.6rem 1.2rem' }}
                  >
                    💾 {textosPtBr.fechamentoTurno.botaoExportarBackup}
                  </button>
                  <button
                    type="button"
                    className="botao-campanha"
                    data-testid="botao-salvar-pasta-turno"
                    onClick={() => void salvarBackupJsonEmPastaEscolhida(exportarJson())}
                    style={{ fontSize: '0.92rem', padding: '0.6rem 1.2rem' }}
                  >
                    📁 Salvar em Pasta Escolhida
                  </button>
                </div>
              </div>

              {resumoRecente && (
                <div style={{ fontSize: '0.85rem', color: '#444' }}>
                  <span>Novos lançamentos criados: {resumoRecente.novosLancamentos.length}</span> ·{' '}
                  <span>Novas tarefas materializadas: {resumoRecente.novasTarefas.length}</span> ·{' '}
                  <span>Alertas emitidos: {resumoRecente.novosEventos.length}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', color: 'var(--bronze)' }}>
                {textosPtBr.fechamentoTurno.subtituloPrevia}
              </p>

              {previa && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Resumo Métricas da Semana */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.8rem',
                      background: '#fffdf7',
                      padding: '0.8rem',
                      borderRadius: '4px',
                      border: '1px solid var(--pergaminho-escuro)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--bronze)', fontWeight: 600 }}>
                        {textosPtBr.fechamentoTurno.horasRegistradasVsMeta}
                      </span>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {formatarHoras(previa.horasRegistradas)} / {formatarHoras(previa.horasPlanejadas)}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--bronze)', fontWeight: 600 }}>
                        {textosPtBr.fechamentoTurno.fluxoSemana}
                      </span>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: previa.receitaCentavos >= previa.custoCentavos ? '#245747' : 'var(--laca)',
                        }}
                      >
                        {formatarMoeda(previa.receitaCentavos - previa.custoCentavos)}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--bronze)', fontWeight: 600 }}>
                        {textosPtBr.fechamentoTurno.tarefasConcluidas}
                      </span>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {previa.tarefasConcluidas} concluídas
                      </div>
                    </div>
                  </div>

                  {/* Mudanças de Fase */}
                  {previa.mudancasFase.length > 0 && (
                    <div style={{ background: '#fffdf7', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--pergaminho-escuro)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7a5405' }}>
                        👑 {textosPtBr.fechamentoTurno.mudancasFase}
                      </span>
                      {previa.mudancasFase.map((m) => (
                        <div key={m.projetoId} style={{ fontSize: '0.84rem', marginTop: '0.3rem' }}>
                          <strong>{m.projetoNome}</strong>: Fase {m.de} ➔ Fase {m.para}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Alertas dos Detectores */}
                  {previa.alertas.length > 0 && (
                    <div style={{ background: 'rgba(142, 31, 26, 0.05)', padding: '0.8rem', borderRadius: '4px', border: '1px solid rgba(142, 31, 26, 0.2)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--laca)' }}>
                        ⚠️ {textosPtBr.fechamentoTurno.eventosDetectores} ({previa.alertas.length})
                      </span>
                      {previa.alertas.map((a, idx) => (
                        <div key={idx} style={{ fontSize: '0.82rem', marginTop: '0.3rem', color: 'var(--laca)' }}>
                          <strong>[{a.detector}]</strong> {a.motivo} (Ação: {a.acaoSugerida})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-rodape">
          {sucesso ? (
            <>
              <button
                type="button"
                className="botao-campanha botao-campanha-laca"
                data-testid="botao-desfazer-fechamento-turno"
                onClick={() => void reverterFechamento()}
              >
                ↩️ {textosPtBr.fechamentoTurno.botaoDesfazer}
              </button>
              <button
                type="button"
                className="botao-campanha botao-campanha-jade"
                data-testid="botao-concluir-fechamento-turno"
                onClick={fecharModal}
              >
                {textosPtBr.fechamentoTurno.botaoConcluir}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="botao-campanha" onClick={fecharModal}>
                {textosPtBr.fechamentoTurno.botaoCancelar}
              </button>
              <button
                type="button"
                className="botao-campanha botao-campanha-laca"
                data-testid="botao-confirmar-fechamento-turno"
                disabled={executando}
                onClick={() => void confirmarFechamento()}
              >
                {executando ? 'Executando 6 etapas...' : textosPtBr.fechamentoTurno.botaoConfirmar}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
