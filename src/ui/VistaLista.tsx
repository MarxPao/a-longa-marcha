import React, { useMemo } from 'react';
import type { UUID } from '../domain';
import { useCampanhaStore } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import {
  formatarHoras,
  formatarMoeda,
  formatarPercentual,
  obterInfoFase,
  obterInfoSaude,
} from './formatadores';

export function VistaLista(): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const filtroLista = useCampanhaStore((s) => s.filtroLista);
  const definirFiltroLista = useCampanhaStore((s) => s.definirFiltroLista);
  const projetoSelecionadoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);

  const projetosFiltrados = useMemo(() => {
    return dump.projetos
      .filter((p) => p.arquivadoEm === null)
      .filter((p) => {
        if (filtroLista.setorId && p.setorId !== filtroLista.setorId) return false;
        if (filtroLista.busca.trim()) {
          const termo = filtroLista.busca.toLowerCase();
          return (
            p.nome.toLowerCase().includes(termo) ||
            p.notas?.toLowerCase().includes(termo)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const derivA = derivadosPorProjeto.get(a.id);
        const derivB = derivadosPorProjeto.get(b.id);
        let diff = 0;

        switch (filtroLista.ordenacao) {
          case 'nome':
            diff = a.nome.localeCompare(b.nome);
            break;
          case 'saude': {
            const sA = derivA?.saude.pontuacao ?? 100;
            const sB = derivB?.saude.pontuacao ?? 100;
            diff = sA - sB;
            break;
          }
          case 'fase': {
            const fA = derivA?.fase.fase ?? 1;
            const fB = derivB?.fase.fase ?? 1;
            diff = fA - fB;
            break;
          }
          case 'moral': {
            const mA = derivA?.moral.moral ?? 0.5;
            const mB = derivB?.moral.moral ?? 0.5;
            diff = mA - mB;
            break;
          }
          case 'horas':
            diff = a.horasAlvoSemana - b.horasAlvoSemana;
            break;
        }

        return filtroLista.direcao === 'asc' ? diff : -diff;
      });
  }, [dump.projetos, filtroLista, derivadosPorProjeto]);

  const alternarOrdenacao = (coluna: typeof filtroLista.ordenacao) => {
    if (filtroLista.ordenacao === coluna) {
      definirFiltroLista({
        direcao: filtroLista.direcao === 'asc' ? 'desc' : 'asc',
      });
    } else {
      definirFiltroLista({ ordenacao: coluna, direcao: 'asc' });
    }
  };

  return (
    <div className="vista-lista-container" data-testid="vista-lista-projetos">
      <div className="barra-filtros-lista">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.2rem' }}>
            {textosPtBr.listaProjetos.titulo}
          </h2>

          <input
            type="text"
            className="input-texto"
            data-testid="input-busca-projetos"
            placeholder={textosPtBr.hud.buscaProjetosPlaceholder}
            value={filtroLista.busca}
            onChange={(e) => definirFiltroLista({ busca: e.target.value })}
            style={{ minWidth: 260 }}
          />

          <select
            className="select-form"
            data-testid="select-filtro-setor"
            value={filtroLista.setorId ?? ''}
            onChange={(e) =>
              definirFiltroLista({
                setorId: e.target.value ? (e.target.value as UUID) : null,
              })
            }
          >
            <option value="">{textosPtBr.hud.filtroSetor}</option>
            {dump.setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          data-testid="botao-novo-projeto"
          onClick={() => abrirModal('criarProjeto')}
        >
          + Fundar Novo Projeto
        </button>
      </div>

      <div className="tabela-container">
        <table className="tabela-campanha" data-testid="tabela-projetos-lista">
          <thead>
            <tr>
              <th onClick={() => alternarOrdenacao('nome')}>
                {textosPtBr.listaProjetos.colunaNome}{' '}
                {filtroLista.ordenacao === 'nome'
                  ? filtroLista.direcao === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </th>
              <th>{textosPtBr.listaProjetos.colunaSetor}</th>
              <th onClick={() => alternarOrdenacao('fase')}>
                {textosPtBr.listaProjetos.colunaFase}{' '}
                {filtroLista.ordenacao === 'fase'
                  ? filtroLista.direcao === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </th>
              <th onClick={() => alternarOrdenacao('saude')}>
                {textosPtBr.listaProjetos.colunaSaude}{' '}
                {filtroLista.ordenacao === 'saude'
                  ? filtroLista.direcao === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </th>
              <th onClick={() => alternarOrdenacao('moral')}>
                {textosPtBr.listaProjetos.colunaMoral}{' '}
                {filtroLista.ordenacao === 'moral'
                  ? filtroLista.direcao === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </th>
              <th onClick={() => alternarOrdenacao('horas')}>
                {textosPtBr.listaProjetos.colunaHoras}{' '}
                {filtroLista.ordenacao === 'horas'
                  ? filtroLista.direcao === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </th>
              <th>{textosPtBr.listaProjetos.colunaRoi}</th>
            </tr>
          </thead>
          <tbody>
            {projetosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  {textosPtBr.listaProjetos.vazio}
                </td>
              </tr>
            ) : (
              projetosFiltrados.map((p) => {
                const setor = dump.setores.find((s) => s.id === p.setorId);
                const deriv = derivadosPorProjeto.get(p.id);
                const saude = deriv?.saude.pontuacao ?? 100;
                const infoSaude = obterInfoSaude(saude);
                const fase = deriv?.fase.fase ?? 1;
                const infoFase = obterInfoFase(fase);
                const moral = deriv?.moral.moral ?? 0.5;

                const horasNaSemana = dump.registrosDeHoras
                  .filter(
                    (r) =>
                      r.projetoId === p.id &&
                      r.arquivadoEm === null &&
                      r.data >= semanaAtual
                  )
                  .reduce((acc, r) => acc + r.horas, 0);

                const roi = deriv?.roi.centavosPorHora;

                return (
                  <tr
                    key={p.id}
                    className={projetoSelecionadoId === p.id ? 'selecionada' : ''}
                    onClick={() => selecionarProjeto(p.id)}
                    data-testid={`linha-projeto-${p.id}`}
                  >
                    <td style={{ fontWeight: 600 }}>{p.nome}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: setor?.cor ?? '#888',
                          }}
                        />
                        {setor?.nome ?? 'Sem Setor'}
                      </span>
                    </td>
                    <td>
                      {infoFase.icone} {infoFase.nome} ({infoFase.nivel})
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          saude >= 70
                            ? 'badge-saude-saudavel'
                            : saude >= 40
                            ? 'badge-saude-atencao'
                            : 'badge-saude-critico'
                        }`}
                        title={`${infoSaude.forma} (${infoSaude.texto})`}
                      >
                        {infoSaude.icone} {saude}
                      </span>
                    </td>
                    <td>⚡ {formatarPercentual(moral)}</td>
                    <td>
                      {formatarHoras(horasNaSemana)} / {formatarHoras(p.horasAlvoSemana)}
                    </td>
                    <td>{roi !== null && roi !== undefined ? `${formatarMoeda(roi)}/h` : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
