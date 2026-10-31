import React, { useState } from 'react';
import { useTerrenoFase0Store } from '../store';
import { textosPtBr } from '../textos/pt-BR';
import './tema.css';

export interface PropriedadesPainelTerrenoFase0 {
  children?: React.ReactNode;
}

export function PainelTerrenoFase0({ children }: PropriedadesPainelTerrenoFase0): React.JSX.Element {
  const sementeAtiva = useTerrenoFase0Store((s) => s.semente);
  const erroValidacao = useTerrenoFase0Store((s) => s.erroValidacao);
  const metricas = useTerrenoFase0Store((s) => s.metricas);
  const definirSemente = useTerrenoFase0Store((s) => s.definirSemente);
  const sortearSemente = useTerrenoFase0Store((s) => s.sortearSemente);

  const [rascunhoSemente, setRascunhoSemente] = useState<string>(sementeAtiva);

  const aoSubmeter = (ev: React.FormEvent<HTMLFormElement>): void => {
    ev.preventDefault();
    definirSemente(rascunhoSemente);
  };

  const aoSortear = (): void => {
    sortearSemente();
    setRascunhoSemente(useTerrenoFase0Store.getState().semente);
  };

  return (
    <div className="layout-campanha-fase0">
      <header className="barra-superior-pergaminho">
        <div>
          <h1 className="titulo-campanha" data-testid="titulo-app">
            {textosPtBr.app.titulo}
          </h1>
          <p className="subtitulo-campanha">{textosPtBr.app.subtitulo}</p>
        </div>

        <form className="controles-semente" onSubmit={aoSubmeter}>
          <label htmlFor="campo-semente" className="rotulo-semente">
            {textosPtBr.terreno.rotuloSemente}:
          </label>
          <input
            id="campo-semente"
            data-testid="input-semente"
            className="input-semente"
            type="text"
            value={rascunhoSemente}
            onChange={(e) => setRascunhoSemente(e.target.value)}
            placeholder={textosPtBr.terreno.placeholderSemente}
          />
          <button type="submit" data-testid="botao-gerar-terreno" className="botao-campanha">
            {textosPtBr.terreno.botaoGerar}
          </button>
          <button
            type="button"
            data-testid="botao-sortear-semente"
            className="botao-campanha secundario"
            onClick={aoSortear}
          >
            {textosPtBr.terreno.botaoSortear}
          </button>
        </form>
      </header>

      <main className="palco-mapa-3d">
        {children}

        <aside className="card-inspecao-terreno" aria-label="Diagnóstico do Terreno">
          <h2>{textosPtBr.terreno.rotaAdotadaTitulo}</h2>
          {erroValidacao ? (
            <p className="alerta-erro-semente" role="alert">
              {erroValidacao}
            </p>
          ) : null}
          <ul className="lista-metricas-terreno">
            <li>
              <span>{textosPtBr.terreno.rotuloSemente}:</span>
              <strong data-testid="semente-ativa-valor">{metricas.semente}</strong>
            </li>
            <li>
              <span>{textosPtBr.terreno.metricas.hash}:</span>
              <strong data-testid="hash-semente-valor">{metricas.hashNumerico}</strong>
            </li>
            <li>
              <span>{textosPtBr.terreno.metricas.vertices}:</span>
              <strong data-testid="vertices-terreno-valor">{metricas.vertices}</strong>
            </li>
            <li>
              <span>{textosPtBr.terreno.metricas.cotaMin}:</span>
              <strong data-testid="cota-min-valor">{metricas.cotaMinima} m</strong>
            </li>
            <li>
              <span>{textosPtBr.terreno.metricas.cotaMax}:</span>
              <strong data-testid="cota-max-valor">{metricas.cotaMaxima} m</strong>
            </li>
            <li>
              <span>{textosPtBr.terreno.metricas.rota}:</span>
              <strong data-testid="rota-terreno-valor">{metricas.rotaTerreno}</strong>
            </li>
          </ul>
          <p className="dica-camera">{textosPtBr.terreno.dicaCamera}</p>
        </aside>
      </main>
    </div>
  );
}
