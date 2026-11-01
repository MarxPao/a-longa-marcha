import React from 'react';
import type { Projeto } from '../domain';
import { useCampanhaStore } from '../store';
import { obterInfoFase, obterInfoSaude } from './formatadores';

interface Props {
  children?: React.ReactNode;
}

export function PlaceholderMapa2D({ children }: Props): React.JSX.Element {
  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const projetoSelecionadoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const selecionarProjeto = useCampanhaStore((s) => s.selecionarProjeto);
  const abrirModal = useCampanhaStore((s) => s.abrirModal);

  const projetosAtivos = dump.projetos.filter((p) => p.arquivadoEm === null);

  return (
    <div
      className="area-mapa-central"
      data-testid="area-mapa-central"
      onDoubleClick={() => abrirModal('criarProjeto')}
    >
      {/* Canvas 3D de Fundo */}
      <div className="canvas-3d-fundo">{children}</div>

      {/* Overlay 2D Estratégico (Marcadores das Cidades) */}
      <div className="overlay-2d-estrategico">
        <svg
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          viewBox="-100 -100 200 200"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Cidades e Marcadores Estratégicos */}
          {projetosAtivos.map((p: Projeto, idx) => {
            const deriv = derivadosPorProjeto.get(p.id);
            const saude = deriv?.saude.pontuacao ?? 100;
            const fase = deriv?.fase.fase ?? 1;
            const infoSaude = obterInfoSaude(saude);
            const infoFase = obterInfoFase(fase);
            const selecionado = projetoSelecionadoId === p.id;

            // Posição no plano X/Z ou layout em grade/espalhado se zerado
            const posX = p.x !== 0 ? p.x : ((idx % 6) - 2.5) * 28;
            const posZ = p.z !== 0 ? p.z : (Math.floor(idx / 6) - 2) * 28;

            return (
              <g
                key={p.id}
                transform={`translate(${posX}, ${posZ})`}
                onClick={(e) => {
                  e.stopPropagation();
                  selecionarProjeto(p.id);
                }}
                style={{ cursor: 'pointer' }}
                data-testid={`marcador-cidade-${p.id}`}
              >
                {/* Halo de Seleção */}
                {selecionado && (
                  <circle
                    r="12"
                    fill="none"
                    stroke="#8E1F1A"
                    strokeWidth="2.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Marcador da Cidade (Cor por Saúde, Tamanho por Fase) */}
                <circle
                  r={5 + fase * 0.8}
                  fill={infoSaude.cor}
                  stroke="#1F1B16"
                  strokeWidth="1.5"
                />

                {/* Ícone e Nome */}
                <text
                  y="-8"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="4.5"
                  fontWeight="bold"
                  stroke="#1F1B16"
                  strokeWidth="0.8"
                  paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  {infoFase.icone} {p.nome}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dica de uso */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            background: 'rgba(31, 27, 22, 0.75)',
            color: '#E8DCC0',
            padding: '0.4rem 0.8rem',
            borderRadius: '4px',
            fontSize: '0.78rem',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none',
          }}
        >
          💡 Dica: Clique em uma cidade para inspecionar · Duplo clique para fundar nova cidade
        </div>
      </div>
    </div>
  );
}
