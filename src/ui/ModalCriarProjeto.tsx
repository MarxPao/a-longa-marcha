import React, { useState } from 'react';
import type { Projeto, UUID } from '../domain';
import { useCampanhaStore } from '../store';

export function ModalCriarProjeto(): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const dump = useCampanhaStore((s) => s.dump);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);

  const [nome, setNome] = useState('');
  const [setorId, setSetorId] = useState<UUID | ''>('');
  const [horasAlvoSemana, setHorasAlvoSemana] = useState(10);
  const [autonomia, setAutonomia] = useState<'direto' | 'esparso' | 'autonomo'>('direto');
  const [erro, setErro] = useState<string | null>(null);

  if (modalAberto !== 'criarProjeto') return null;

  const setorEfetivo = setorId || (dump.setores[0]?.id ?? ('' as UUID));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Nome do projeto é obrigatório');
      return;
    }
    if (!setorEfetivo) {
      setErro('Selecione um setor');
      return;
    }

    try {
      const projetoCriado = await criarEntidade<Projeto>('projetos', {
        nome: nome.trim(),
        descricao: '',
        setorId: setorEfetivo,
        x: 0,
        z: 0,
        estagioId: dump.estagios[0]?.id ?? null,
        horasAlvoSemana,
        autonomia,
        notas: '',
        notaLicoes: null,
      });

      selecionarProjeto(projetoCriado.id);
      setNome('');
      fecharModal();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-overlay" data-testid="modal-criar-projeto">
      <div className="modal-caixa" style={{ maxWidth: 480 }}>
        <div className="modal-cabecalho">
          <h3 className="modal-titulo">🚩 Fundar Novo Projeto</h3>
          <button type="button" className="botao-campanha" onClick={fecharModal}>
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void salvar(e)}>
          <div className="modal-corpo">
            <div className="campo-form">
              <label className="rotulo-form">Nome do Projeto:</label>
              <input
                type="text"
                className="input-texto"
                data-testid="input-criar-projeto-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Plataforma E-commerce"
                required
                autoFocus
              />
            </div>

            <div className="campo-form">
              <label className="rotulo-form">Setor Territorial:</label>
              <select
                className="select-form"
                data-testid="select-criar-projeto-setor"
                value={setorEfetivo}
                onChange={(e) => setSetorId(e.target.value as UUID)}
                required
              >
                {dump.setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="campo-form">
                <label className="rotulo-form">Horas Alvo / Semana:</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input-texto"
                  data-testid="input-criar-projeto-horas"
                  value={horasAlvoSemana}
                  onChange={(e) => setHorasAlvoSemana(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>

              <div className="campo-form">
                <label className="rotulo-form">Autonomia:</label>
                <select
                  className="select-form"
                  data-testid="select-criar-projeto-autonomia"
                  value={autonomia}
                  onChange={(e) =>
                    setAutonomia(e.target.value as 'direto' | 'esparso' | 'autonomo')
                  }
                >
                  <option value="direto">Direto</option>
                  <option value="esparso">Esparso</option>
                  <option value="autonomo">Autônomo</option>
                </select>
              </div>
            </div>

            {erro && (
              <span style={{ color: 'var(--laca)', fontSize: '0.82rem', fontWeight: 600 }}>
                {erro}
              </span>
            )}
          </div>

          <div className="modal-rodape">
            <button type="button" className="botao-campanha" onClick={fecharModal}>
              Cancelar
            </button>
            <button
              type="submit"
              className="botao-campanha botao-campanha-ouro"
              data-testid="botao-salvar-novo-projeto"
            >
              Fundar Cidade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
