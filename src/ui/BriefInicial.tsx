import React, { useState } from 'react';
import type { Projeto, Setor } from '../domain';
import { useCampanhaStore } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import { formatarMoeda } from './formatadores';

export function BriefInicial(): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const dump = useCampanhaStore((s) => s.dump);
  const concluirBrief = useCampanhaStore((s) => s.concluirBrief);
  const atualizarConfig = useCampanhaStore((s) => s.atualizarConfig);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const resetarBanco = useCampanhaStore((s) => s.resetarBanco);
  const exportarJson = useCampanhaStore((s) => s.exportarJson);

  const [passo, setPasso] = useState<number>(1);

  // Estados locais dos passos do brief
  const [horasSemanais, setHorasSemanais] = useState<number>(
    dump.meta.config.horasSemanaisDisponiveis ?? 40
  );
  const [limiarMetropoleReais, setLimiarMetropoleReais] = useState<number>(
    dump.meta.config.maturidade.limiarReceitaMensalMetropoleCentavos / 100 || 50000
  );
  const [sementeMapa, setSementeMapa] = useState<string>(
    dump.meta.config.mapa.sementeTerreno || 'longa-marcha-2026'
  );

  // Primeiro projeto rápido
  const [novoProjetoNome, setNovoProjetoNome] = useState('');
  const [novoProjetoSetorId, setNovoProjetoSetorId] = useState(dump.setores[0]?.id ?? '');
  const [novoProjetoHoras, setNovoProjetoHoras] = useState(10);

  if (modalAberto !== 'brief') return null;

  const salvarETerminar = async () => {
    await atualizarConfig({
      horasSemanaisDisponiveis: horasSemanais,
      maturidade: {
        ...dump.meta.config.maturidade,
        limiarReceitaMensalMetropoleCentavos: Math.round(limiarMetropoleReais * 100),
      },
      mapa: {
        ...dump.meta.config.mapa,
        sementeTerreno: sementeMapa,
      },
    });

    if (novoProjetoNome.trim() && novoProjetoSetorId) {
      await criarEntidade<Projeto>('projetos', {
        nome: novoProjetoNome.trim(),
        descricao: '',
        setorId: novoProjetoSetorId,
        x: 0,
        z: 0,
        estagioId: dump.estagios[0]?.id ?? null,
        horasAlvoSemana: novoProjetoHoras,
        autonomia: 'direto',
        notas: '',
        notaLicoes: null,
      });
    }

    await concluirBrief();
  };

  const baixarJsonInicial = () => {
    const dados = exportarJson();
    const blob = new Blob([JSON.stringify(dados, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'a-longa-marcha-campanha-inicial.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" data-testid="modal-brief-inicial">
      <div className="modal-caixa modal-caixa-larga" style={{ minHeight: '520px' }}>
        <div className="modal-cabecalho">
          <div>
            <h3 className="modal-titulo">{textosPtBr.briefInicial.titulo}</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--bronze)' }}>
              Etapa {passo} de 8
            </span>
          </div>
          <button
            type="button"
            className="botao-campanha"
            onClick={() => void concluirBrief()}
            title="Pular brief e iniciar com padrões"
          >
            {textosPtBr.briefInicial.botoes.pular}
          </button>
        </div>

        <div className="modal-corpo" style={{ flex: 1 }}>
          {/* PASSO 1: Caminho */}
          {passo === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>{textosPtBr.briefInicial.passos.caminho}</h4>
              <p style={{ fontSize: '0.86rem' }}>
                {textosPtBr.briefInicial.caminho.descricao}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="botao-campanha botao-campanha-ouro"
                  style={{ justifyContent: 'flex-start', padding: '0.8rem' }}
                  onClick={() => setPasso(2)}
                >
                  ✨ <strong>{textosPtBr.briefInicial.caminho.opcaoPadrao}</strong>
                </button>
                <button
                  type="button"
                  className="botao-campanha"
                  style={{ justifyContent: 'flex-start', padding: '0.8rem' }}
                  onClick={() => {
                    void resetarBanco();
                    setPasso(2);
                  }}
                >
                  🌱 <strong>{textosPtBr.briefInicial.caminho.opcaoVazio}</strong>
                </button>
              </div>
            </div>
          )}

          {/* PASSO 2: Seu Tempo */}
          {passo === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>{textosPtBr.briefInicial.passos.tempo}</h4>
              <div className="campo-form">
                <label className="rotulo-form">
                  {textosPtBr.briefInicial.tempo.horasDisponiveis}:
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  className="input-texto"
                  value={horasSemanais}
                  onChange={(e) => setHorasSemanais(parseInt(e.target.value, 10) || 40)}
                />
              </div>
              <p style={{ fontSize: '0.82rem', color: '#666' }}>
                O tempo é o recurso mais valioso da sua campanha. O sistema avisará quando a soma das horas-alvo dos seus projetos ultrapassar esse orçamento.
              </p>
            </div>
          )}

          {/* PASSO 3: Setores & Biomas */}
          {passo === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <h4>{textosPtBr.briefInicial.passos.setores}</h4>
              <p style={{ fontSize: '0.82rem', color: '#666' }}>
                Os setores dividem seu império em províncias temáticas. Você pode renomear e recolorir livremente:
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.6rem',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {dump.setores.map((s: Setor) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: '#fffdf7',
                      border: '1px solid var(--pergaminho-escuro)',
                      borderRadius: '4px',
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: s.cor,
                      }}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{s.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PASSO 4: Vocabulário */}
          {passo === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <h4>{textosPtBr.briefInicial.passos.vocabulario}</h4>
              <p style={{ fontSize: '0.84rem' }}>
                O sistema adapta-se à sua linguagem. Você pode gerenciar os estágios declarados, categorias financeiras e prioridades no editor de registros a qualquer momento.
              </p>
              <div style={{ background: '#fffdf7', padding: '0.8rem', borderRadius: '4px', fontSize: '0.82rem' }}>
                <strong>Estágios disponíveis:</strong> {dump.estagios.map((e) => e.nome).join(', ')}
              </div>
            </div>
          )}

          {/* PASSO 5: Regras do Jogo */}
          {passo === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>{textosPtBr.briefInicial.passos.regras}</h4>
              <div className="campo-form">
                <label className="rotulo-form">
                  {textosPtBr.briefInicial.regras.limiarMetropole}:
                </label>
                <input
                  type="number"
                  step="1000"
                  className="input-texto"
                  value={limiarMetropoleReais}
                  onChange={(e) => setLimiarMetropoleReais(parseFloat(e.target.value) || 50000)}
                />
                <span style={{ fontSize: '0.78rem', color: '#666' }}>
                  {textosPtBr.briefInicial.regras.descricaoMetropole} (Atual: {formatarMoeda(limiarMetropoleReais * 100)})
                </span>
              </div>
            </div>
          )}

          {/* PASSO 6: Mapa */}
          {passo === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>{textosPtBr.briefInicial.passos.mapa}</h4>
              <div className="campo-form">
                <label className="rotulo-form">Semente do Terreno 3D:</label>
                <input
                  type="text"
                  className="input-texto"
                  value={sementeMapa}
                  onChange={(e) => setSementeMapa(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* PASSO 7: Primeiros Projetos */}
          {passo === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>{textosPtBr.briefInicial.passos.primeirosProjetos}</h4>
              <p style={{ fontSize: '0.84rem' }}>
                Deseja fundar um novo projeto agora para iniciar sua campanha? (Opcional)
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
                <div className="campo-form">
                  <label className="rotulo-form">Nome do Projeto:</label>
                  <input
                    type="text"
                    className="input-texto"
                    value={novoProjetoNome}
                    onChange={(e) => setNovoProjetoNome(e.target.value)}
                    placeholder="Ex: Sistema de Vendas"
                  />
                </div>
                <div className="campo-form">
                  <label className="rotulo-form">Setor Territorial:</label>
                  <select
                    className="select-form"
                    value={novoProjetoSetorId}
                    onChange={(e) => setNovoProjetoSetorId(e.target.value)}
                  >
                    {dump.setores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo-form">
                  <label className="rotulo-form">Horas Semanais:</label>
                  <input
                    type="number"
                    min="1"
                    className="input-texto"
                    value={novoProjetoHoras}
                    onChange={(e) => setNovoProjetoHoras(parseInt(e.target.value, 10) || 10)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASSO 8: Revisão */}
          {passo === 8 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4>{textosPtBr.briefInicial.passos.revisao}</h4>
              <div
                style={{
                  backgroundColor: '#fff3cd',
                  padding: '1rem',
                  borderRadius: '4px',
                  border: '1px solid #ffecb5',
                  fontSize: '0.84rem',
                  color: '#664d03',
                }}
              >
                ⚠️ {textosPtBr.briefInicial.revisao.avisoNavegador}
              </div>

              <div style={{ background: '#fffdf7', padding: '0.8rem', borderRadius: '4px', fontSize: '0.84rem' }}>
                <p>• Horas semanais: <strong>{horasSemanais}h</strong></p>
                <p>• Limiar Metrópole: <strong>{formatarMoeda(limiarMetropoleReais * 100)}</strong></p>
                <p>• Semente do Mapa: <strong>{sementeMapa}</strong></p>
                <p>• Total de setores ativos: <strong>{dump.setores.length}</strong></p>
                <p>• Total de projetos na campanha: <strong>{dump.projetos.length + (novoProjetoNome ? 1 : 0)}</strong></p>
              </div>

              <button
                type="button"
                className="botao-campanha"
                onClick={baixarJsonInicial}
                style={{ alignSelf: 'flex-start' }}
              >
                💾 {textosPtBr.briefInicial.revisao.botaoExportarInicial}
              </button>
            </div>
          )}
        </div>

        <div className="modal-rodape">
          {passo > 1 && (
            <button
              type="button"
              className="botao-campanha"
              onClick={() => setPasso((p) => p - 1)}
            >
              {textosPtBr.briefInicial.botoes.anterior}
            </button>
          )}

          {passo < 8 ? (
            <button
              type="button"
              className="botao-campanha botao-campanha-ouro"
              onClick={() => setPasso((p) => p + 1)}
            >
              {textosPtBr.briefInicial.botoes.proximo}
            </button>
          ) : (
            <button
              type="button"
              className="botao-campanha botao-campanha-jade"
              data-testid="botao-comecar-campanha"
              onClick={() => void salvarETerminar()}
            >
              🚩 {textosPtBr.briefInicial.revisao.botaoComecar}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
