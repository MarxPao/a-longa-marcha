import React, { useState } from 'react';
import type { Projeto } from '../../domain';
import { useCampanhaStore } from '../../store';

interface Props {
  projeto: Projeto;
  aoFechar: () => void;
}

export function ModalEditarProjeto({ projeto, aoFechar }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const atualizarEntidade = useCampanhaStore((s) => s.atualizarEntidade);

  const [nome, setNome] = useState(projeto.nome);
  const [setorId, setSetorId] = useState(projeto.setorId);
  const [horasAlvo, setHorasAlvo] = useState(String(projeto.horasAlvoSemana));
  const [autonomia, setAutonomia] = useState<Projeto['autonomia']>(projeto.autonomia);
  const [notas, setNotas] = useState(projeto.notas);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    await atualizarEntidade<Projeto>('projetos', projeto.id, {
      nome: nome.trim(),
      setorId,
      horasAlvoSemana: Math.max(0, parseFloat(horasAlvo || '0')),
      autonomia,
      notas,
    });
    aoFechar();
  };

  return (
    <div className="modal-overlay" data-testid="modal-editar-projeto">
      <div className="modal-caixa" style={{ maxWidth: 460 }}>
        <div className="modal-cabecalho">
          <h3 className="modal-titulo">✏️ Editar Projeto: {projeto.nome}</h3>
          <button type="button" className="botao-campanha" onClick={aoFechar}>
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
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                data-testid="input-editar-projeto-nome"
                required
              />
            </div>

            <div className="campo-form">
              <label className="rotulo-form">Setor / Território:</label>
              <select
                className="select-form"
                value={setorId}
                onChange={(e) => setSetorId(e.target.value)}
                data-testid="select-editar-projeto-setor"
              >
                {dump.setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-form">
              <label className="rotulo-form">Horas-Alvo por Semana:</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input-texto"
                value={horasAlvo}
                onChange={(e) => setHorasAlvo(e.target.value)}
                data-testid="input-editar-projeto-horas"
                required
              />
            </div>

            <div className="campo-form">
              <label className="rotulo-form">Modo de Autonomia:</label>
              <select
                className="select-form"
                value={autonomia}
                onChange={(e) => setAutonomia(e.target.value as Projeto['autonomia'])}
                data-testid="select-editar-projeto-autonomia"
              >
                <option value="direto">Direto (exige dedicação ativa)</option>
                <option value="esparso">Esparso (pouca atenção)</option>
                <option value="autonomo">Autônomo (roda sozinho, monitora receita)</option>
              </select>
            </div>

            <div className="campo-form">
              <label className="rotulo-form">Notas e Diretrizes:</label>
              <textarea
                className="textarea-form"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                data-testid="input-editar-projeto-notas"
                style={{ minHeight: 60 }}
              />
            </div>
          </div>
          <div className="modal-rodape">
            <button type="button" className="botao-campanha" onClick={aoFechar}>
              Cancelar
            </button>
            <button
              type="submit"
              className="botao-campanha botao-campanha-jade"
              data-testid="botao-salvar-edicao-projeto"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
