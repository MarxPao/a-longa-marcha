import React from 'react';
import { formatarMoeda } from '../formatadores';

export interface DadoMesFinanceiro {
  mesRotulo: string; // ex: '05/26'
  receitaCentavos: number;
  custoCentavos: number;
  projetado?: boolean;
}

interface Props {
  dados: DadoMesFinanceiro[];
}

export function GraficoFinancasSvg({ dados }: Props): React.JSX.Element {
  if (dados.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--bronze)', fontSize: '0.8rem' }}>
        Sem dados financeiros históricos ou projetados suficientes para o gráfico.
      </div>
    );
  }

  const alturaSvg = 130;
  const larguraSvg = 340;
  const paddingLateral = 24;
  const paddingVertical = 20;
  const alturaUtil = alturaSvg - paddingVertical * 2;
  const larguraUtil = larguraSvg - paddingLateral * 2;

  // Encontra o valor máximo para escalar as barras
  const maxCentavos = Math.max(
    100000, // mínimo R$ 1.000 de teto para não colapsar com valores zerados
    ...dados.map((d) => Math.max(d.receitaCentavos, d.custoCentavos))
  );

  const larguraSlot = larguraUtil / dados.length;
  const larguraBarra = Math.max(3, Math.min(10, larguraSlot * 0.35));

  return (
    <div
      style={{
        background: '#fffdf7',
        border: '1px solid var(--pergaminho-escuro)',
        borderRadius: '4px',
        padding: '0.5rem',
      }}
      data-testid="grafico-financas-svg-container"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--bronze)',
          marginBottom: '0.2rem',
        }}
      >
        <span>
          <span style={{ color: '#3E7C68', fontWeight: 700 }}>■</span> Receita ·{' '}
          <span style={{ color: '#8E1F1A', fontWeight: 700 }}>■</span> Custo
        </span>
        <span>Máx: {formatarMoeda(maxCentavos)}</span>
      </div>

      <svg
        viewBox={`0 0 ${larguraSvg} ${alturaSvg}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        data-testid="grafico-financas-svg"
      >
        {/* Linha de Base Zero */}
        <line
          x1={paddingLateral}
          y1={alturaSvg - paddingVertical}
          x2={larguraSvg - paddingLateral}
          y2={alturaSvg - paddingVertical}
          stroke="var(--pergaminho-escuro)"
          strokeWidth="1.5"
        />

        {/* Barras Mensais */}
        {dados.map((d, i) => {
          const xSlot = paddingLateral + i * larguraSlot + larguraSlot * 0.5;
          const altReceita = (d.receitaCentavos / maxCentavos) * alturaUtil;
          const altCusto = (d.custoCentavos / maxCentavos) * alturaUtil;

          const yReceita = alturaSvg - paddingVertical - altReceita;
          const yCusto = alturaSvg - paddingVertical - altCusto;

          const xReceita = xSlot - larguraBarra - 1;
          const xCusto = xSlot + 1;

          return (
            <g key={i}>
              {/* Barra de Receita */}
              <rect
                x={xReceita}
                y={yReceita}
                width={larguraBarra}
                height={Math.max(1, altReceita)}
                fill="#3E7C68"
                opacity={d.projetado ? 0.6 : 0.9}
                rx={1}
              >
                <title>
                  {d.mesRotulo} (Receita): {formatarMoeda(d.receitaCentavos)}
                  {d.projetado ? ' [Projetado]' : ''}
                </title>
              </rect>

              {/* Barra de Custo */}
              <rect
                x={xCusto}
                y={yCusto}
                width={larguraBarra}
                height={Math.max(1, altCusto)}
                fill="#8E1F1A"
                opacity={d.projetado ? 0.6 : 0.9}
                rx={1}
              >
                <title>
                  {d.mesRotulo} (Custo): {formatarMoeda(d.custoCentavos)}
                  {d.projetado ? ' [Projetado]' : ''}
                </title>
              </rect>

              {/* Linha divisória se for início da projeção */}
              {d.projetado && !dados[i - 1]?.projetado && (
                <line
                  x1={xSlot - larguraSlot * 0.5}
                  y1={paddingVertical * 0.5}
                  x2={xSlot - larguraSlot * 0.5}
                  y2={alturaSvg - paddingVertical}
                  stroke="#B8923A"
                  strokeDasharray="2,2"
                  strokeWidth="1"
                />
              )}

              {/* Rótulo do Mês (a cada 2 meses ou nos extremos) */}
              {(i % 2 === 0 || i === dados.length - 1) && (
                <text
                  x={xSlot}
                  y={alturaSvg - 6}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--tinta)"
                  opacity={0.7}
                >
                  {d.mesRotulo}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
