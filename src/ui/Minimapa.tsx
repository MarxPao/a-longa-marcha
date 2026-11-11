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

export interface CunhaSetorMinimapa {
  setorId: string;
  nome?: string;
  cor: string;
  anguloInicioRad: number;
  anguloFimRad: number;
  poligono?: [number, number][];
}

interface PropriedadesMinimapa {
  aoNavegarCamera?: (x: number, z: number) => void;
  alvoCamera?: { x: number; z: number };
  trapezioCamera?: ReadonlyArray<readonly [number, number]>;
  raioMundo?: number;
  cunhas?: readonly CunhaSetorMinimapa[];
}

export function Minimapa({
  aoNavegarCamera,
  alvoCamera,
  trapezioCamera,
  raioMundo = 840,
  cunhas,
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
  const MUNDO_RAIO = Math.max(160, raioMundo);

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
    ctx.strokeStyle = 'rgba(122, 90, 43, 0.15)';
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

    const centroCanvas = mundoParaCanvas(0, 0);
    const raioCunhaMundo = MUNDO_RAIO * 1.15;

    // 2. Territórios dos Setores (Cunhas Radiais do Mapa de Campanha)
    const setoresAtivos = dump.setores.filter((s) => s.arquivadoEm === null);
    const cunhasEfetivas: CunhaSetorMinimapa[] =
      cunhas && cunhas.length > 0
        ? [...cunhas]
        : setoresAtivos.map((s, idx) => {
            const passo = (Math.PI * 2) / Math.max(1, setoresAtivos.length);
            return {
              setorId: s.id,
              nome: s.nome,
              cor: s.cor,
              anguloInicioRad: idx * passo,
              anguloFimRad: (idx + 1) * passo,
            };
          });

    for (const cunha of cunhasEfetivas) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centroCanvas.cx, centroCanvas.cy);

      if (cunha.poligono && cunha.poligono.length >= 3) {
        cunha.poligono.forEach((pt, idx) => {
          const { cx, cy } = mundoParaCanvas(pt[0], pt[1]);
          if (idx === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
      } else {
        const passos = 16;
        for (let i = 0; i <= passos; i++) {
          const t = i / passos;
          const ang =
            cunha.anguloInicioRad + (cunha.anguloFimRad - cunha.anguloInicioRad) * t;
          const px = Math.cos(ang) * raioCunhaMundo;
          const pz = Math.sin(ang) * raioCunhaMundo;
          const pt = mundoParaCanvas(px, pz);
          ctx.lineTo(pt.cx, pt.cy);
        }
      }

      ctx.closePath();
      ctx.fillStyle = `${cunha.cor}24`; // preenchimento com 14% de opacidade
      ctx.fill();
      ctx.strokeStyle = `${cunha.cor}55`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Fronteira de tinta na borda do setor
      const pBordaX = Math.cos(cunha.anguloInicioRad) * raioCunhaMundo;
      const pBordaZ = Math.sin(cunha.anguloInicioRad) * raioCunhaMundo;
      const ptBorda = mundoParaCanvas(pBordaX, pBordaZ);
      ctx.beginPath();
      ctx.moveTo(centroCanvas.cx, centroCanvas.cy);
      ctx.lineTo(ptBorda.cx, ptBorda.cy);
      ctx.strokeStyle = 'rgba(31, 27, 22, 0.35)'; // tinta aguada #1F1B16
      ctx.lineWidth = 1.1;
      ctx.stroke();

      ctx.restore();
    }

    // 3. Metrópole Central (Mercado Vivo) em (0, 0)
    ctx.save();
    const rxMetro = (140 / (MUNDO_RAIO * 2)) * LARGURA;
    const ryMetro = (140 / (MUNDO_RAIO * 2)) * ALTURA;
    ctx.beginPath();
    ctx.ellipse(centroCanvas.cx, centroCanvas.cy, rxMetro, ryMetro, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(184, 146, 58, 0.25)'; // ouro imperial
    ctx.fill();
    ctx.strokeStyle = '#B8923A';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centroCanvas.cx, centroCanvas.cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#B8923A';
    ctx.fill();
    ctx.restore();

    // 4. Rotas de ligação comercial entre projetos
    const projetosMap = new Map(dump.projetos.map((p) => [p.id, p]));
    for (const lig of dump.ligacoes) {
      if (lig.arquivadoEm !== null) continue;
      const p1 = projetosMap.get(lig.origemId);
      const p2 = projetosMap.get(lig.destinoId);
      if (!p1 || !p2) continue;

      const p1x = p1.posicao?.x ?? p1.x;
      const p1z = p1.posicao?.z ?? p1.z;
      const p2x = p2.posicao?.x ?? p2.x;
      const p2z = p2.posicao?.z ?? p2.z;

      const c1 = mundoParaCanvas(p1x, p1z);
      const c2 = mundoParaCanvas(p2x, p2z);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c1.cx, c1.cy);
      ctx.lineTo(c2.cx, c2.cy);
      ctx.strokeStyle =
        lenteAtiva === 'rede' || lenteAtiva === 'financas'
          ? 'rgba(184, 146, 58, 0.85)'
          : 'rgba(122, 90, 43, 0.45)';
      ctx.lineWidth = lenteAtiva === 'rede' ? 1.6 : 1;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Cidades com Zonas de Influência Circular (Halos)
    for (const proj of dump.projetos) {
      if (proj.arquivadoEm !== null) continue;
      const px = proj.posicao?.x ?? proj.x;
      const pz = proj.posicao?.z ?? proj.z;
      const { cx, cy } = mundoParaCanvas(px, pz);
      const corCidade = calcularCorCidadePorLente(proj, contextoLente);
      const selecionado = proj.id === projetoSelecionadoId;

      ctx.save();

      // ZONA DE INFLUÊNCIA TERRITORIAL DA CIDADE (Proporcional ao nível 1..7)
      const deriv = derivadosPorProjeto.get(proj.id);
      const nivel = deriv?.fase?.fase ? Math.max(1, Math.min(7, deriv.fase.fase)) : 1;
      const raioInfluenciaMundo = 20 + nivel * 6; // 26 u a 62 u
      const raioInfluenciaCanvas = Math.max(6, (raioInfluenciaMundo / (MUNDO_RAIO * 2)) * LARGURA);

      const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, raioInfluenciaCanvas);
      grad.addColorStop(0, `${corCidade}45`);
      grad.addColorStop(0.65, `${corCidade}18`);
      grad.addColorStop(1, `${corCidade}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, raioInfluenciaCanvas, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, raioInfluenciaCanvas, 0, Math.PI * 2);
      ctx.strokeStyle = `${corCidade}45`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Marcador central da cidade
      if (selecionado) {
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#B8923A';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, selecionado ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = corCidade;
      ctx.fill();
      ctx.strokeStyle = '#1F1B16';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.restore();
    }

    // 6. Trapézio visível da câmera (frustum projetado no chão)
    ctx.save();
    ctx.strokeStyle = '#8E1F1A';
    ctx.fillStyle = 'rgba(142, 31, 26, 0.16)';
    ctx.lineWidth = 1.4;
    if (trapezioCamera && trapezioCamera.length >= 4) {
      ctx.beginPath();
      trapezioCamera.forEach((pt, idx) => {
        const { cx, cy } = mundoParaCanvas(pt[0], pt[1]);
        const cxClamp = Math.max(1, Math.min(LARGURA - 1, cx));
        const cyClamp = Math.max(1, Math.min(ALTURA - 1, cy));
        if (idx === 0) ctx.moveTo(cxClamp, cyClamp);
        else ctx.lineTo(cxClamp, cyClamp);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const camX = alvoCamera?.x ?? 0;
      const camZ = alvoCamera?.z ?? 0;
      const posCam = mundoParaCanvas(camX, camZ);
      ctx.strokeRect(posCam.cx - 18, posCam.cy - 12, 36, 24);
    }
    ctx.restore();
  }, [
    dump.setores,
    dump.projetos,
    dump.ligacoes,
    cunhas,
    contextoLente,
    projetoSelecionadoId,
    lenteAtiva,
    alvoCamera,
    trapezioCamera,
    MUNDO_RAIO,
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
