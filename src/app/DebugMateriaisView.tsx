import React, { useEffect, useRef, useState } from 'react';
import {
  VisualizadorDebugMateriais,
  type ResultadoLuminanciaModelo,
} from '../map/debugMateriais';

export function DebugMateriaisView(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const visualizadorRef = useRef<VisualizadorDebugMateriais | null>(null);
  const [resultados, setResultados] = useState<ResultadoLuminanciaModelo[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const params = new URLSearchParams(window.location.search);
    const ativarSombras = params.get('sombras') === '1';

    const viz = new VisualizadorDebugMateriais({
      container: el,
      ativarSombras,
    });
    visualizadorRef.current = viz;

    const timer = setTimeout(() => {
      const res = viz.auditarLuminanciaModelos();
      setResultados(res);
    }, 600);

    return () => {
      clearTimeout(timer);
      viz.destruir();
      visualizadorRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#262626',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 9999,
      }}
    >
      {/* Barra de Topo com Legenda das 4 Variantes */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          backgroundColor: '#1F1B16',
          borderBottom: '2px solid #B8923A',
          color: '#FAF3E0',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            🏛️ Auditoria de Materiais — Passo Zero (?debug=materials)
          </h2>
          <span style={{ fontSize: '12px', color: '#D6C29E' }}>
            Seção 2: Validação de ausência de preto em edifícios, muralhas, generais e árvores
          </span>
        </div>

        <div style={{ display: 'flex', gap: '24px', fontSize: '14px', fontWeight: 500 }}>
          <span style={{ color: '#E8DCC0' }}>1. Material Final PBR</span>
          <span style={{ color: '#E5AF28' }}>2. Albedo Puro</span>
          <span style={{ color: '#3E7C68' }}>3. MeshNormalMaterial</span>
          <span style={{ color: '#9DAAB0' }}>4. Só Contorno</span>
        </div>

        <div>
          <a
            href="/"
            style={{
              padding: '6px 14px',
              backgroundColor: '#8E1F1A',
              color: '#FFF',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Voltar ao Mapa
          </a>
        </div>
      </div>

      {/* Canvas 3D */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />

      {/* Painel Inferior com Métricas de Luminância */}
      {resultados.length > 0 && (
        <div
          data-testid="painel-auditoria-luminancia"
          style={{
            padding: '10px 24px',
            backgroundColor: '#181512',
            borderTop: '1px solid #38332B',
            color: '#E8DCC0',
            fontSize: '12px',
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
          }}
        >
          {resultados.map((r) => (
            <div
              key={r.id}
              data-testid={`resultado-modelo-${r.id}`}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                backgroundColor: r.aprovado ? 'rgba(62, 124, 104, 0.25)' : 'rgba(142, 31, 26, 0.4)',
                border: `1px solid ${r.aprovado ? '#3E7C68' : '#8E1F1A'}`,
                whiteSpace: 'nowrap',
              }}
            >
              <strong>{r.nome}:</strong> Lum: {r.luminanciaMedia} | &lt;0.05:{' '}
              {(r.pctPixelsAbaixo005 * 100).toFixed(1)}% [{r.aprovado ? '✓ OK' : '✗ FALHA'}]
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
