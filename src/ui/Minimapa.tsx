import React, { useEffect, useMemo, useRef } from 'react';
import {
  calcularCorCidadePorLente,
  type DadosContextoLente,
  type InfoResumoDerivadoLente,
  type LenteMapa,
  type UUID,
} from '../domain';
import { useCampanhaStore } from '../store';

export interface DefinicaoLente {
  id: LenteMapa;
  tecla: string;
  rotulo: string;
  descricao: string;
}

export const CATALOGO_LENTES: DefinicaoLente[] = [
  {
    id: 'padrao',
    tecla: '1',
    rotulo: 'Padrão',
    descricao: 'Saúde (Jade ≥70, Âmbar ≥40, Laca <40)',
  },
  {
    id: 'financas',
    tecla: '2',
    rotulo: 'Finanças',
    descricao: 'Fluxo Mensal e Financiamento Cruzado',
  },
  {
    id: 'tempo',
    tecla: '3',
    rotulo: 'Tempo',
    descricao: 'Horas da Semana vs. Meta Semanal',
  },
  {
    id: 'rede',
    tecla: '4',
    rotulo: 'Rede',
    descricao: 'Hubs de Conexão (Ouro ≥2, Jade 1, Cinza 0)',
  },
  {
    id: 'risco',
    tecla: '5',
    rotulo: 'Risco',
    descricao: 'Concentração de Clientes e Gargalos',
  },
  {
    id: 'clientes',
    tecla: '6',
    rotulo: 'Clientes',
    descricao: 'Saúde Comercial e Último Contato (60d)',
  },
  {
    id: 'estoque',
    tecla: '7',
    rotulo: 'Estoque',
    descricao: 'Cobertura da Lista de Materiais (BOM)',
  },
  {
    id: 'pd',
    tecla: '8',
    rotulo: 'P&D',
    descricao: 'Tecnologias Dominadas e Aplicadas',
  },
];

interface PropriedadesMinimapa {
  aoNavegarCamera?: (x: number, z: number) => void;
  alvoCamera?: { x: number; z: number };
}

export function Minimapa({
  aoNavegarCamera,
  alvoCamera,
}: PropriedadesMinimapa): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dump = useCampanhaStore((s) => s.dump);
  const derivadosPorProjeto = useCampanhaStore((s) => s.derivadosPorProjeto);
  const projetoSelecionadoId = useCampanhaStore((s) => s.projetoSelecionadoId);
  const lenteAtiva = useCampanhaStore((s) => s.lenteAtiva);
  const definirLenteAtiva = useCampanhaStore((s) => s.definirLenteAtiva);
  const semanaAtual = useCampanhaStore((s) => s.semanaAtual);

  const LARGURA = 200;
  const ALTURA = 140;
  const MUNDO_RAIO = 160; // mundo vai de -160 a +160

  const mundoParaCanvas = (x: number, z: number) => {
    const cx = ((x + MUNDO_RAIO) / (MUNDO_RAIO * 2)) * LARGURA;
    const cy = ((z + MUNDO_RAIO) / (MUNDO_RAIO * 2)) * ALTURA;
    return { cx, cy };
  };

  const canvasParaMundo = (cx: number, cy: number) => {
    const x = (cx / LARGURA) * (MUNDO_RAIO * 2) - MUNDO_RAIO;
    const z = (cy / ALTURA) * (MUNDO_RAIO * 2) - MUNDO_RAIO;
    return { x: Math.round(x), z: Math.round(z) };
  };

  const contextoLente: DadosContextoLente = useMemo(() => {
    const resumo = new Map<UUID, InfoResumoDerivadoLente>();
    for (const [id, d] of derivadosPorProjeto.entries()) {
      resumo.set(id, {
        pontuacaoSaude: d.saude.pontuacao,
        liquidoMesCentavos: d.fluxoMes?.liquidoCentavos ?? 0,
        horasRegistradasSemana: d.horasJanela / 2,
        concentracaoRisco:
          d.bloqueios.total > 0 ? 0.6 : d.tarefasVencidas > 2 ? 0.4 : 0.1,
      });
    }
    return {
      lente: lenteAtiva,
      derivadosPorProjeto: resumo,
      ligacoes: dump.ligacoes,
      clientes: dump.clientes,
      vinculosCliente: dump.vinculosCliente,
      itensLista: dump.itensDeLista,
      aplicacoes: dump.aplicacoes,
      hoje: semanaAtual,
    };
  }, [
    lenteAtiva,
    derivadosPorProjeto,
    dump.ligacoes,
    dump.clientes,
    dump.vinculosCliente,
    dump.itensDeLista,
    dump.aplicacoes,
    semanaAtual,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Fundo de pergaminho estratégico
    ctx.fillStyle = '#DCD1B8';
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    // Grade sutil de coordenadas
    ctx.strokeStyle = 'rgba(122, 90, 43, 0.18)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < LARGURA; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, ALTURA);
      ctx.stroke();
    }
    for (let gy = 35; gy < ALTURA; gy += 35) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(LARGURA, gy);
      ctx.stroke();
    }

    // 2. Desenha polígonos dos territórios (setores)
    for (const setor of dump.setores) {
      if (setor.arquivadoEm !== null || setor.regiao.length < 3) continue;
      ctx.save();
      ctx.beginPath();
      setor.regiao.forEach((pt, idx) => {
        const { cx, cy } = mundoParaCanvas(pt[0], pt[1]);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.fillStyle = `${setor.cor}28`;
      ctx.fill();
      ctx.strokeStyle = setor.cor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Desenha rotas de ligação entre projetos
    const projetosMap = new Map(dump.projetos.map((p) => [p.id, p]));
    for (const lig of dump.ligacoes) {
      if (lig.arquivadoEm !== null) continue;
      const p1 = projetosMap.get(lig.origemId);
      const p2 = projetosMap.get(lig.destinoId);
      if (!p1 || !p2) continue;

      const c1 = mundoParaCanvas(p1.x, p1.z);
      const c2 = mundoParaCanvas(p2.x, p2.z);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c1.cx, c1.cy);
      ctx.lineTo(c2.cx, c2.cy);
      ctx.strokeStyle =
        lenteAtiva === 'rede' || lenteAtiva === 'financas'
          ? 'rgba(184, 146, 58, 0.85)'
          : 'rgba(122, 90, 43, 0.4)';
      ctx.lineWidth = lenteAtiva === 'rede' ? 1.5 : 1;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Desenha cidades coloridas pela lente ativa
    for (const proj of dump.projetos) {
      const { cx, cy } = mundoParaCanvas(proj.x, proj.z);
      const corCidade = calcularCorCidadePorLente(proj, contextoLente);
      const selecionado = proj.id === projetoSelecionadoId;

      ctx.save();
      if (selecionado) {
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#B8923A';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, selecionado ? 4 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = corCidade;
      ctx.fill();
      ctx.strokeStyle = '#1F1B16';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Retângulo de câmera (frustum / alvo)
    const camX = alvoCamera?.x ?? 0;
    const camZ = alvoCamera?.z ?? 0;
    const posCam = mundoParaCanvas(camX, camZ);
    ctx.save();
    ctx.strokeStyle = '#8E1F1A';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(posCam.cx - 18, posCam.cy - 12, 36, 24);
    ctx.restore();
  }, [
    dump.setores,
    dump.projetos,
    dump.ligacoes,
    contextoLente,
    projetoSelecionadoId,
    lenteAtiva,
    alvoCamera,
  ]);

  const handleCliqueCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const { x, z } = canvasParaMundo(clickX, clickY);
    aoNavegarCamera?.(x, z);
  };

  const infoLenteAtual =
    CATALOGO_LENTES.find((l) => l.id === lenteAtiva) ?? CATALOGO_LENTES[0]!;

  return (
    <aside
      data-testid="painel-minimapa-lentes"
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 12,
        width: 216,
        background: 'rgba(31, 27, 22, 0.92)',
        border: '1px solid var(--ouro)',
        borderRadius: 6,
        padding: '0.5rem',
        color: '#E8DCC0',
        boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Cabeçalho da Lente Ativa */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.35rem',
          fontSize: '0.75rem',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--ouro)' }}>
          Lente [{infoLenteAtual.tecla}]:{' '}
          <strong data-testid="nome-lente-ativa" style={{ color: '#FFF' }}>
            {infoLenteAtual.rotulo}
          </strong>
        </span>
        <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>Teclas 1–8</span>
      </div>

      {/* Seletor das 8 Lentes */}
      <div
        data-testid="seletor-lentes"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.25rem',
          marginBottom: '0.45rem',
        }}
      >
        {CATALOGO_LENTES.map((lente) => {
          const ativa = lente.id === lenteAtiva;
          return (
            <button
              key={lente.id}
              type="button"
              data-testid={`botao-lente-${lente.id}`}
              onClick={() => definirLenteAtiva(lente.id)}
              title={`${lente.rotulo} (Tecla ${lente.tecla}): ${lente.descricao}`}
              style={{
                background: ativa ? 'var(--laca)' : 'rgba(232, 220, 192, 0.1)',
                color: ativa ? '#FFF' : '#E8DCC0',
                border: ativa
                  ? '1px solid var(--ouro)'
                  : '1px solid rgba(184, 146, 58, 0.35)',
                borderRadius: 3,
                padding: '0.2rem 0.15rem',
                fontSize: '0.68rem',
                fontWeight: ativa ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {lente.tecla}.{lente.rotulo}
            </button>
          );
        })}
      </div>

      {/* Canvas Aéreo do Minimapa */}
      <div
        style={{
          border: '1px solid var(--bronze)',
          borderRadius: 4,
          overflow: 'hidden',
          lineHeight: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          width={LARGURA}
          height={ALTURA}
          data-testid="canvas-minimapa"
          onClick={handleCliqueCanvas}
          title="Clique no minimapa para mover a câmera até o território"
          style={{
            width: '100%',
            height: ALTURA,
            cursor: 'crosshair',
            display: 'block',
          }}
        />
      </div>

      {/* Legenda rápida da lente */}
      <div
        data-testid="legenda-lente-ativa"
        style={{
          marginTop: '0.35rem',
          fontSize: '0.68rem',
          color: '#C8BFA8',
          lineHeight: 1.25,
        }}
      >
        {infoLenteAtual.descricao}
      </div>
    </aside>
  );
}
