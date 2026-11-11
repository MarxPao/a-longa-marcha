import React, { useEffect, useRef, useState } from 'react';
import {
  VisualizadorFatiaVerticalH2,
  type ModoVisualizacaoH2,
} from '../map/fatiaVerticalH2';

export interface FatiaVerticalH2ViewProps {
  onVoltar?: () => void;
}

export function FatiaVerticalH2View({ onVoltar }: FatiaVerticalH2ViewProps = {}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const visualizadorRef = useRef<VisualizadorFatiaVerticalH2 | null>(null);
  const [modoAtivo, setModoAtivo] = useState<ModoVisualizacaoH2>('setor-agricultura');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const params = new URLSearchParams(window.location.search);
    const sombras = params.get('sombras') !== '0';

    const viz = new VisualizadorFatiaVerticalH2({
      container: el,
      ativarSombras: sombras,
    });
    visualizadorRef.current = viz;

    const modoUrl = params.get('modo') as ModoVisualizacaoH2 | null;
    if (modoUrl) {
      viz.definirVisualizacao(modoUrl);
      setModoAtivo(modoUrl);
    }

    return () => {
      viz.destruir();
      visualizadorRef.current = null;
    };
  }, []);

  const trocarModo = (modo: ModoVisualizacaoH2) => {
    setModoAtivo(modo);
    visualizadorRef.current?.definirVisualizacao(modo);
  };

  const botoes: Array<{ id: ModoVisualizacaoH2; rotulo: string; cor: string }> = [
    { id: 'setor-agricultura', rotulo: '🌾 Setor Agricultura', cor: '#3E7C68' },
    { id: 'cidade-agricultura', rotulo: '🏡 Cidade Agricultura', cor: '#3E7C68' },
    { id: 'rua-agricultura', rotulo: '🚶 Rua Agricultura', cor: '#3E7C68' },
    { id: 'setor-comercio', rotulo: '⚖️ Setor Comércio', cor: '#B8923A' },
    { id: 'cidade-comercio', rotulo: '🏛️ Cidade Comércio', cor: '#B8923A' },
    { id: 'rua-comercio', rotulo: '🚪 Rua Comércio', cor: '#B8923A' },
    { id: 'galeria-modelos', rotulo: '📦 Galeria (38 Modelos)', cor: '#8E1F1A' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#1E1B18',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 9999,
      }}
    >
      {/* Barra de Topo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          backgroundColor: '#161412',
          borderBottom: '2px solid #B8923A',
          color: '#FAF3E0',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
            🏮 Fatia Vertical (H2) — Kit de Arquitetura: Agricultura & Comércio
          </h2>
          <span style={{ fontSize: '12px', color: '#D6C29E' }}>
            36 modelos de edifícios (6 variantes x 6 tipos) + muralha modular e portão fortificado Han
          </span>
        </div>

        {/* Botoes de Navegação das Vistas de H2 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {botoes.map((b) => {
            const ativo = modoAtivo === b.id;
            return (
              <button
                key={b.id}
                data-testid={`botao-vista-${b.id}`}
                onClick={() => trocarModo(b.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: `1px solid ${b.cor}`,
                  backgroundColor: ativo ? b.cor : 'rgba(255,255,255,0.06)',
                  color: ativo ? '#FFF' : '#E8DCC0',
                  fontWeight: ativo ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {b.rotulo}
              </button>
            );
          })}
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              if (onVoltar) onVoltar();
              else window.location.href = '/';
            }}
            style={{
              padding: '6px 14px',
              backgroundColor: '#8E1F1A',
              color: '#FFF',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ← Voltar ao Mapa Total War
          </button>
        </div>
      </div>

      {/* Canvas 3D */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />
    </div>
  );
}
