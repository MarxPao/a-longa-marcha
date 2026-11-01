import React from 'react';
import { useCampanhaStore } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import { formatarData, formatarHoras, formatarMoeda } from './formatadores';

export function BarraSuperior(): React.JSX.Element {
  const derivadosGlobais = useCampanhaStore((s) => s.derivadosGlobais);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);
  const dump = useCampanhaStore((s) => s.dump);
  const vistaAtiva = useCampanhaStore((s) => s.vistaAtiva);
  const alternarVista = useCampanhaStore((s) => s.alternarVista);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);
  const desfazer = useCampanhaStore((s) => s.desfazer);
  const podeDesfazer = useCampanhaStore((s) => s.podeDesfazer());
  const historicoComandos = useCampanhaStore((s) => s.historicoComandos);

  // Calcula horas registradas na semana corrente
  const horasNaSemana = dump.registrosDeHoras
    .filter((r) => r.arquivadoEm === null && r.data >= semanaAtual)
    .reduce((acc, r) => acc + r.horas, 0);

  const horasDisponiveis = dump.meta.config.horasSemanaisDisponiveis;
  const horasLivres = Math.max(0, horasDisponiveis - horasNaSemana);

  // Formatação de runway
  const runwayTexto =
    derivadosGlobais.runway.tipo === 'sustentavel'
      ? textosPtBr.hud.runwaySustentavel
      : `${derivadosGlobais.runway.meses.toFixed(1)} ${textosPtBr.hud.meses}`;

  return (
    <header className="hud-barra-superior" data-testid="hud-barra-superior">
      <div className="hud-marca">
        <h1 className="titulo-campanha" data-testid="titulo-app">
          {textosPtBr.app.titulo}
        </h1>
        <span className="subtitulo-campanha">{textosPtBr.app.subtitulo}</span>
      </div>

      <div className="hud-metricas">
        <div className="hud-item-metrica">
          <span className="hud-rotulo">{textosPtBr.hud.caixaTotal}</span>
          <span
            className="hud-valor hud-valor-ouro"
            data-testid="caixa-total-valor"
          >
            {formatarMoeda(derivadosGlobais.caixaCentavos)}
          </span>
        </div>

        <div className="hud-item-metrica">
          <span className="hud-rotulo">{textosPtBr.hud.runway}</span>
          <span
            className={`hud-valor ${
              derivadosGlobais.runway.tipo === 'sustentavel'
                ? 'hud-valor-jade'
                : 'hud-valor-laca'
            }`}
            data-testid="runway-valor"
          >
            {runwayTexto}
          </span>
        </div>

        <div className="hud-item-metrica">
          <span className="hud-rotulo">{textosPtBr.hud.horasSemana}</span>
          <span className="hud-valor" data-testid="horas-livres-valor">
            {formatarHoras(horasLivres)} {textosPtBr.hud.horasLivres}
          </span>
        </div>

        <div className="hud-item-metrica">
          <span className="hud-rotulo">{textosPtBr.hud.semanaAtual}</span>
          <span className="hud-valor" data-testid="semana-atual-valor">
            {formatarData(semanaAtual)}
          </span>
        </div>
      </div>

      <div className="hud-acoes">
        <button
          type="button"
          className="botao-campanha"
          data-testid="botao-abrir-busca"
          onClick={() => abrirModal('buscaGlobal')}
          title="Busca Global [Atalho: /]"
        >
          🔍 Buscar [/]
        </button>

        <button
          type="button"
          className="botao-campanha botao-campanha-ouro"
          data-testid="botao-captura-rapida"
          onClick={() => abrirModal('capturaRapida', 'horas')}
          title="Atalho: H, T, L ou E"
        >
          ⚡ {textosPtBr.hud.capturaRapida}
        </button>

        <button
          type="button"
          className="botao-campanha botao-campanha-laca"
          data-testid="botao-fechar-turno"
          onClick={() => abrirModal('fecharTurno')}
        >
          📜 {textosPtBr.hud.fecharTurno}
        </button>

        <button
          type="button"
          className="botao-campanha"
          data-testid="botao-alternar-vista"
          onClick={() => alternarVista(vistaAtiva === 'mapa' ? 'lista' : 'mapa')}
        >
          {vistaAtiva === 'mapa' ? '📋 ' + textosPtBr.hud.vistaLista : '🗺️ ' + textosPtBr.hud.vistaMapa}
        </button>

        <button
          type="button"
          className="botao-campanha"
          data-testid="botao-configuracoes"
          onClick={() => abrirModal('editorRegistros')}
          title="Configurações e Registros da Campanha"
        >
          ⚙️
        </button>

        <button
          type="button"
          className="botao-campanha"
          data-testid="botao-desfazer"
          disabled={!podeDesfazer}
          onClick={() => void desfazer()}
          title={`Desfazer comando (${historicoComandos.length} no histórico) [Ctrl+Z]`}
        >
          ↩️ ({historicoComandos.length})
        </button>
      </div>
    </header>
  );
}
