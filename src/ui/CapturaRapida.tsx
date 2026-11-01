import React, { useEffect, useState } from 'react';
import type { Evento, Lancamento, RegistroDeHoras, Tarefa, UUID } from '../domain';
import { useCampanhaStore, type TipoCapturaRapida } from '../store';
import { textosPtBr } from '../textos/pt-BR';

export function CapturaRapida(): React.JSX.Element | null {
  const modalAberto = useCampanhaStore((s) => s.modalAberto);
  const tipoCaptura = useCampanhaStore((s) => s.tipoCapturaRapida);
  const fecharModal = useCampanhaStore((s) => s.fecharModal);
  const dump = useCampanhaStore((s) => s.dump);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const ultimoProjetoIdUsado = useCampanhaStore((s) => s.ultimoProjetoIdUsado);
  const criarEntidade = useCampanhaStore((s) => s.criarEntidade);

  const [tipoAtivo, setTipoAtivo] = useState<TipoCapturaRapida>(tipoCaptura ?? 'horas');
  const [projetoId, setProjetoId] = useState<UUID | ''>('');

  useEffect(() => {
    if (tipoCaptura) {
      setTipoAtivo(tipoCaptura);
    }
  }, [tipoCaptura, modalAberto]);

  const projetoEfetivo =
    (projetoId as UUID) || ultimoProjetoIdUsado || (dump.projetos[0]?.id ?? ('' as UUID));

  // Campos de Horas
  const [horas, setHoras] = useState('2');
  const [dataHoras, setDataHoras] = useState(semanaAtual);
  const [tarefaId, setTarefaId] = useState<UUID | ''>('');

  // Campos de Tarefa
  const [tituloTarefa, setTituloTarefa] = useState('');
  const [prazoTarefa, setPrazoTarefa] = useState(semanaAtual);
  const [estimativaTarefa, setEstimativaTarefa] = useState('4');
  const [prioridadeTarefa, setPrioridadeTarefa] = useState<1 | 2 | 3 | 4>(2);

  // Campos de Lançamento
  const [tipoLancamento, setTipoLancamento] = useState<'receita' | 'custo'>('receita');
  const [valorReais, setValorReais] = useState('1500.00');
  const [categoriaLancamento, setCategoriaLancamento] = useState('Serviços');
  const [dataLancamento, setDataLancamento] = useState(semanaAtual);

  // Campos de Evento
  const [tituloEvento, setTituloEvento] = useState('');
  const [tipoEvento, setTipoEvento] = useState<'positivo' | 'negativo' | 'ambiguo'>('positivo');

  const [erro, setErro] = useState<string | null>(null);

  if (modalAberto !== 'capturaRapida') return null;

  const tarefasDoProjeto = dump.tarefas.filter(
    (t) => t.projetoId === projetoId && t.arquivadoEm === null && t.status !== 'feita'
  );

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    try {
      if (!projetoEfetivo) throw new Error('Selecione um projeto');

      if (tipoAtivo === 'horas') {
        const numHoras = parseFloat(horas);
        if (isNaN(numHoras) || numHoras <= 0) throw new Error('Horas devem ser maiores que zero');
        await criarEntidade<RegistroDeHoras>('registrosDeHoras', {
          projetoId: projetoEfetivo,
          data: dataHoras,
          horas: numHoras,
          tarefaId: tarefaId ? (tarefaId as UUID) : null,
          tecnologiaId: null,
        });
      } else if (tipoAtivo === 'tarefa') {
        if (!tituloTarefa.trim()) throw new Error('Título da tarefa é obrigatório');
        await criarEntidade<Tarefa>('tarefas', {
          projetoId: projetoEfetivo,
          titulo: tituloTarefa.trim(),
          descricao: '',
          frenteId: null,
          status: 'pendente',
          prioridade: prioridadeTarefa,
          prazo: prazoTarefa,
          estimativaHoras: parseFloat(estimativaTarefa) || 1,
          concluidaEm: null,
          recorrencia: null,
          origemRecorrenciaId: null,
        });
      } else if (tipoAtivo === 'lancamento') {
        const reais = parseFloat(valorReais);
        if (isNaN(reais) || reais <= 0) throw new Error('Valor monetário inválido');
        const valorCentavos = Math.round(reais * 100);
        const catId =
          dump.categoriasLancamento.find(
            (c) => c.nome.toLowerCase() === categoriaLancamento.trim().toLowerCase()
          )?.id ??
          dump.categoriasLancamento[0]?.id ??
          (crypto.randomUUID() as UUID);

        await criarEntidade<Lancamento>('lancamentos', {
          projetoId: projetoEfetivo,
          tipo: tipoLancamento,
          valorCentavos,
          categoriaId: catId,
          data: dataLancamento,
          clienteId: null,
          recorrencia: null,
          origemRecorrenciaId: null,
        });
      } else if (tipoAtivo === 'evento') {
        if (!tituloEvento.trim()) throw new Error('Título do evento é obrigatório');
        await criarEntidade<Evento>('eventos', {
          tipo: tipoEvento,
          tipoEvento: 'evento_manual',
          titulo: tituloEvento.trim(),
          projetoId: projetoEfetivo || null,
          data: semanaAtual,
          origem: 'manual',
          resposta: null,
          resultado: '',
          fechamentoId: null,
        });
      }

      fecharModal();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-overlay" data-testid="modal-captura-rapida">
      <div className="modal-caixa" style={{ maxWidth: 520 }}>
        <div className="modal-cabecalho">
          <h3 className="modal-titulo">⚡ {textosPtBr.hud.capturaRapida}</h3>
          <button type="button" className="botao-campanha" onClick={fecharModal}>
            ✕
          </button>
        </div>

        {/* Seletor de Tipo */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--bronze)', background: 'var(--pergaminho-escuro)' }}>
          <button
            type="button"
            className={`aba-item ${tipoAtivo === 'horas' ? 'ativa' : ''}`}
            onClick={() => setTipoAtivo('horas')}
          >
            [H] Horas
          </button>
          <button
            type="button"
            className={`aba-item ${tipoAtivo === 'tarefa' ? 'ativa' : ''}`}
            onClick={() => setTipoAtivo('tarefa')}
          >
            [T] Tarefa
          </button>
          <button
            type="button"
            className={`aba-item ${tipoAtivo === 'lancamento' ? 'ativa' : ''}`}
            onClick={() => setTipoAtivo('lancamento')}
          >
            [L] Lançamento
          </button>
          <button
            type="button"
            className={`aba-item ${tipoAtivo === 'evento' ? 'ativa' : ''}`}
            onClick={() => setTipoAtivo('evento')}
          >
            [E] Evento
          </button>
        </div>

        <form onSubmit={(e) => void submeter(e)}>
          <div className="modal-corpo">
            {/* Campo Projeto (Comum a quase todos) */}
            <div className="campo-form">
              <label className="rotulo-form">{textosPtBr.capturaRapida.projeto}:</label>
              <select
                className="select-form"
                data-testid="input-captura-projeto"
                value={projetoEfetivo}
                onChange={(e) => setProjetoId(e.target.value as UUID)}
                required
              >
                {dump.projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* MODO HORAS */}
            {tipoAtivo === 'horas' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.horas}:</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="input-texto"
                      data-testid="input-captura-horas"
                      value={horas}
                      onChange={(e) => setHoras(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.data}:</label>
                    <input
                      type="date"
                      className="input-texto"
                      data-testid="input-captura-data"
                      value={dataHoras}
                      onChange={(e) => setDataHoras(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="campo-form">
                  <label className="rotulo-form">{textosPtBr.capturaRapida.tarefaOpcional}:</label>
                  <select
                    className="select-form"
                    data-testid="input-captura-tarefa"
                    value={tarefaId}
                    onChange={(e) => setTarefaId((e.target.value as UUID) || '')}
                  >
                    <option value="">{textosPtBr.capturaRapida.nenhumaTarefa}</option>
                    {tarefasDoProjeto.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* MODO TAREFA */}
            {tipoAtivo === 'tarefa' && (
              <>
                <div className="campo-form">
                  <label className="rotulo-form">{textosPtBr.capturaRapida.tituloTarefaCampo}:</label>
                  <input
                    type="text"
                    className="input-texto"
                    data-testid="input-captura-tarefa-titulo"
                    value={tituloTarefa}
                    onChange={(e) => setTituloTarefa(e.target.value)}
                    placeholder="Ex: Entregar protótipo"
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.prazo}:</label>
                    <input
                      type="date"
                      className="input-texto"
                      data-testid="input-captura-tarefa-prazo"
                      value={prazoTarefa}
                      onChange={(e) => setPrazoTarefa(e.target.value)}
                      required
                    />
                  </div>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.estimativaHoras}:</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="input-texto"
                      data-testid="input-captura-tarefa-estimativa"
                      value={estimativaTarefa}
                      onChange={(e) => setEstimativaTarefa(e.target.value)}
                      required
                    />
                  </div>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.prioridade}:</label>
                    <select
                      className="select-form"
                      value={prioridadeTarefa}
                      onChange={(e) =>
                        setPrioridadeTarefa((parseInt(e.target.value, 10) as 1 | 2 | 3 | 4) || 2)
                      }
                    >
                      <option value="1">Baixa (1)</option>
                      <option value="2">Média (2)</option>
                      <option value="3">Alta (3)</option>
                      <option value="4">Crítica (4)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* MODO LANÇAMENTO */}
            {tipoAtivo === 'lancamento' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.tipoLancamento}:</label>
                    <select
                      className="select-form"
                      data-testid="select-captura-lancamento-tipo"
                      value={tipoLancamento}
                      onChange={(e) => setTipoLancamento(e.target.value as 'receita' | 'custo')}
                    >
                      <option value="receita">{textosPtBr.capturaRapida.receita}</option>
                      <option value="custo">{textosPtBr.capturaRapida.custo}</option>
                    </select>
                  </div>

                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.valorReais}:</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input-texto"
                      data-testid="input-captura-lancamento-valor"
                      value={valorReais}
                      onChange={(e) => setValorReais(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.categoria}:</label>
                    <input
                      type="text"
                      className="input-texto"
                      data-testid="input-captura-lancamento-categoria"
                      value={categoriaLancamento}
                      onChange={(e) => setCategoriaLancamento(e.target.value)}
                      placeholder="Ex: Consultoria, Servidores"
                      required
                    />
                  </div>

                  <div className="campo-form">
                    <label className="rotulo-form">{textosPtBr.capturaRapida.data}:</label>
                    <input
                      type="date"
                      className="input-texto"
                      value={dataLancamento}
                      onChange={(e) => setDataLancamento(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* MODO EVENTO */}
            {tipoAtivo === 'evento' && (
              <>
                <div className="campo-form">
                  <label className="rotulo-form">{textosPtBr.capturaRapida.tituloEventoCampo}:</label>
                  <input
                    type="text"
                    className="input-texto"
                    data-testid="input-captura-evento-titulo"
                    value={tituloEvento}
                    onChange={(e) => setTituloEvento(e.target.value)}
                    placeholder="Ex: Contratação de novo parceiro"
                    required
                    autoFocus
                  />
                </div>

                <div className="campo-form">
                  <label className="rotulo-form">{textosPtBr.capturaRapida.tipoEvento}:</label>
                  <select
                    className="select-form"
                    value={tipoEvento}
                    onChange={(e) =>
                      setTipoEvento(e.target.value as 'positivo' | 'negativo' | 'ambiguo')
                    }
                  >
                    <option value="positivo">{textosPtBr.capturaRapida.positivo}</option>
                    <option value="negativo">{textosPtBr.capturaRapida.negativo}</option>
                    <option value="ambiguo">{textosPtBr.capturaRapida.ambiguo}</option>
                  </select>
                </div>
              </>
            )}

            {erro && (
              <span style={{ color: 'var(--laca)', fontSize: '0.82rem', fontWeight: 600 }}>
                {erro}
              </span>
            )}
          </div>

          <div className="modal-rodape">
            <button type="button" className="botao-campanha" onClick={fecharModal}>
              {textosPtBr.capturaRapida.cancelar}
            </button>
            <button
              type="submit"
              className="botao-campanha botao-campanha-ouro"
              data-testid="botao-salvar-captura-rapida"
            >
              {textosPtBr.capturaRapida.salvar}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
