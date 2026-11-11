import {
  calcularNivelMetropole,
  LAYOUT_PADRAO,
  obterRaioCidadePorNivel,
  obterRaioMetropolePorNivel,
  type ConfigLayoutMapa,
} from '../../config/layout';
import type { Lancamento, Produto, Projeto, Setor, UUID } from '../../domain';
import { diferencaDias } from '../tempo';
import { gerarHashSemente } from '../terreno-puro';

export interface CunhaSetorLayout {
  setorId: UUID;
  nome: string;
  cor: string;
  icone: string;
  ordem: number;
  anguloInicioRad: number;
  anguloFimRad: number;
  anguloCentralRad: number;
  anguloGraus: number;
  projetosAtivosCount: number;
  vazia: boolean;
  poligono: [number, number][];
}

export interface CidadeLayout {
  projetoId: UUID;
  nome: string;
  setorId: UUID;
  x: number;
  z: number;
  raio: number;
  nivel: number;
  anguloRad: number;
  distanciaCentro: number;
  receitaMensalCentavos: number;
  fixadaPeloUsuario: boolean;
}

export interface PortaoMetropoleLayout {
  setorId: UUID;
  anguloRad: number;
  x: number;
  z: number;
  largura: number;
  altura: number;
}

export interface MetropoleCentralLayout {
  x: 0;
  z: 0;
  nivel: 0 | 1 | 2 | 3 | 4;
  raio: number;
  raioPracaCentral: number;
  aneisRuas: number[];
  portoesPorSetor: Map<UUID, PortaoMetropoleLayout>;
  portoes: PortaoMetropoleLayout[];
  fatorAlturaEdificios: number;
}

export interface EstadoEntradaTrade {
  setores: readonly Setor[];
  projetos: readonly Projeto[];
  produtos?: readonly Produto[];
  lancamentos?: readonly Lancamento[];
  derivadosPorProjeto?: ReadonlyMap<
    UUID,
    {
      fase?: { fase: number };
      fluxoMes?: { receitaCentavos?: number; custoCentavos?: number };
    }
  >;
  hoje?: string;
}

export interface ResultadoLayoutMundo {
  metropole: MetropoleCentralLayout;
  cunhas: CunhaSetorLayout[];
  cunhasPorSetorId: Map<UUID, CunhaSetorLayout>;
  cidades: CidadeLayout[];
  cidadesPorProjetoId: Map<UUID, CidadeLayout>;
  raioMapa: number;
}

/**
 * Calcula a receita mensal (média móvel de 3 meses em centavos) de cada projeto ativo.
 */
export function calcularReceitaMensalPorProjeto(
  projetos: readonly Projeto[],
  lancamentos: readonly Lancamento[] = [],
  hoje = '2026-11-01',
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): Map<UUID, number> {
  const somaPorProjeto = new Map<UUID, number>();
  for (const p of projetos) {
    somaPorProjeto.set(p.id, 0);
  }

  for (const l of lancamentos) {
    if (l.arquivadoEm !== null || l.tipo !== 'receita' || l.valorCentavos <= 0) continue;
    if (l.data > hoje) continue;
    const dias = diferencaDias(hoje, l.data);
    if (dias >= 0 && dias <= cfg.janelaMediaMovelReceitaDias) {
      somaPorProjeto.set(l.projetoId, (somaPorProjeto.get(l.projetoId) ?? 0) + l.valorCentavos);
    }
  }

  const mediaPorProjeto = new Map<UUID, number>();
  for (const [id, soma] of somaPorProjeto.entries()) {
    mediaPorProjeto.set(id, Math.round(soma / cfg.divisorMediaMovelMeses));
  }
  return mediaPorProjeto;
}

/**
 * Normaliza ângulos das cunhas radiais conforme Seção 4.2:
 * - Proporcional a sqrt(projetos ativos + 1)
 * - Mínimo de 20 graus (reduzido proporcionalmente se N * 20 > 360)
 * - Soma exata de 360 graus (2 * PI radianos)
 */
function calcularAngulosCunhasGraus(
  pesos: readonly number[],
  minimoGrausDesejado: number
): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  if (n === 1) return [360];

  const minimoEfetivo = Math.min(minimoGrausDesejado, 360 / n);
  const angulos = new Array<number>(n).fill(0);
  const fixados = new Array<boolean>(n).fill(false);

  for (let iter = 0; iter < n; iter++) {
    let grausFixados = 0;
    let somaPesosLivres = 0;
    for (let i = 0; i < n; i++) {
      if (fixados[i]) {
        grausFixados += angulos[i]!;
      } else {
        somaPesosLivres += pesos[i]!;
      }
    }

    const grausRestantes = Math.max(0, 360 - grausFixados);
    let algumFixadoNestaIteracao = false;

    for (let i = 0; i < n; i++) {
      if (fixados[i]) continue;
      const prop =
        somaPesosLivres > 0
          ? (pesos[i]! / somaPesosLivres) * grausRestantes
          : grausRestantes / n;
      if (prop < minimoEfetivo - 1e-6) {
        angulos[i] = minimoEfetivo;
        fixados[i] = true;
        algumFixadoNestaIteracao = true;
      } else {
        angulos[i] = prop;
      }
    }

    if (!algumFixadoNestaIteracao) break;
  }

  // Garante soma exata de 360 graus
  const soma = angulos.reduce((a, b) => a + b, 0);
  if (soma > 0 && Math.abs(soma - 360) > 1e-9) {
    const fator = 360 / soma;
    for (let i = 0; i < n; i++) {
      angulos[i] = angulos[i]! * fator;
    }
  }

  return angulos;
}

/**
 * Converte coordenadas cartesianas (x, z) para ângulo polar em [0, 2*PI).
 */
export function obterAnguloPolarPositivo(x: number, z: number): number {
  let ang = Math.atan2(z, x);
  if (ang < 0) ang += Math.PI * 2;
  return ang;
}

/**
 * Calcula layout determinístico do mundo plano (Seções 4.1, 4.2, 4.3 e 5):
 * - Metrópole Central em (0, 0)
 * - Cunhas radiais ordenadas por Setor.ordem
 * - Posições polares das cidades dentro da cunha (menor distância para quem vende mais)
 * - Relaxamento iterativo anti-colisão (separação mínima = r1 + r2 + 12 u)
 */
export function layoutWorld(
  state: EstadoEntradaTrade,
  config?: Partial<ConfigLayoutMapa>
): ResultadoLayoutMundo {
  const cfg: ConfigLayoutMapa = { ...LAYOUT_PADRAO, ...config };
  const hoje = state.hoje ?? '2026-11-01';

  // 1. Ordena setores ativos pela ordem do setor (para o mapa não girar a cada edição)
  const setoresAtivos = state.setores
    .filter((s) => s.arquivadoEm === null)
    .slice()
    .sort((a, b) => (a.ordem !== b.ordem ? a.ordem - b.ordem : a.id.localeCompare(b.id)));

  const projetosAtivos = state.projetos
    .filter((p) => p.arquivadoEm === null)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  // 2. Receita mensal por projeto e nível da Metrópole Central
  const receitaPorProjeto = calcularReceitaMensalPorProjeto(
    projetosAtivos,
    state.lancamentos ?? [],
    hoje,
    cfg
  );

  let receitaTotalMensalCentavos = 0;
  for (const valor of receitaPorProjeto.values()) {
    receitaTotalMensalCentavos += valor;
  }

  const produtosAtivosCount = (state.produtos ?? []).filter(
    (pr) => pr.arquivadoEm === null && pr.ativo
  ).length;
  const lojasEstimadas = Math.max(
    produtosAtivosCount,
    Array.from(receitaPorProjeto.values()).filter((v) => v > 0).length
  );

  const nivelMetropole = calcularNivelMetropole(
    receitaTotalMensalCentavos,
    lojasEstimadas,
    cfg
  );
  const raioMetropole = obterRaioMetropolePorNivel(nivelMetropole, cfg);
  const raioPracaCentral = Math.round(raioMetropole * cfg.pracaCentralRaioRazao * 100) / 100;
  const infoNivel =
    cfg.limiaresNivelMetropole.find((l) => l.nivel === nivelMetropole) ??
    cfg.limiaresNivelMetropole[0]!;

  const aneisRuas: number[] = [];
  const totalAneis = infoNivel.aneisRuas;
  const rInicioAnel = raioPracaCentral + 16;
  const rFimAnel = raioMetropole - cfg.muralhaEspessura - 10;
  for (let a = 0; a < totalAneis; a++) {
    const t = totalAneis === 1 ? 0.5 : a / (totalAneis - 1);
    aneisRuas.push(Math.round((rInicioAnel + t * (rFimAnel - rInicioAnel)) * 100) / 100);
  }

  // 3. Cunhas radiais dos setores
  const contagemPorSetor = new Map<UUID, number>();
  for (const s of setoresAtivos) contagemPorSetor.set(s.id, 0);
  for (const p of projetosAtivos) {
    contagemPorSetor.set(p.setorId, (contagemPorSetor.get(p.setorId) ?? 0) + 1);
  }

  const pesos = setoresAtivos.map((s) => {
    const qtd = contagemPorSetor.get(s.id) ?? 0;
    return Math.sqrt(qtd + 1);
  });

  const angulosGraus = calcularAngulosCunhasGraus(pesos, cfg.anguloMinimoCunhaGraus);
  const cunhas: CunhaSetorLayout[] = [];
  const cunhasPorSetorId = new Map<UUID, CunhaSetorLayout>();
  const portoesPorSetor = new Map<UUID, PortaoMetropoleLayout>();
  const portoes: PortaoMetropoleLayout[] = [];

  let anguloAcumuladoRad = 0;
  for (let i = 0; i < setoresAtivos.length; i++) {
    const setor = setoresAtivos[i]!;
    const graus = angulosGraus[i] ?? 360 / setoresAtivos.length;
    const deltaRad = (graus * Math.PI) / 180;
    const inicioRad = anguloAcumuladoRad;
    const fimRad = inicioRad + deltaRad;
    const centralRad = (inicioRad + fimRad) * 0.5;
    anguloAcumuladoRad = fimRad;

    const qtdProjetos = contagemPorSetor.get(setor.id) ?? 0;
    const cunha: CunhaSetorLayout = {
      setorId: setor.id,
      nome: setor.nome,
      cor: setor.cor,
      icone: setor.icone,
      ordem: setor.ordem,
      anguloInicioRad: inicioRad,
      anguloFimRad: fimRad,
      anguloCentralRad: centralRad,
      anguloGraus: Math.round(graus * 100) / 100,
      projetosAtivosCount: qtdProjetos,
      vazia: qtdProjetos === 0,
      poligono: [], // preenchido após determinar raioMapa final
    };
    cunhas.push(cunha);
    cunhasPorSetorId.set(setor.id, cunha);

    const portao: PortaoMetropoleLayout = {
      setorId: setor.id,
      anguloRad: centralRad,
      x: Math.round(Math.cos(centralRad) * raioMetropole * 100) / 100,
      z: Math.round(Math.sin(centralRad) * raioMetropole * 100) / 100,
      largura: cfg.portaoLargura,
      altura: Math.round(cfg.portaoAlturaBase * infoNivel.fatorAlturaEdificios * 100) / 100,
    };
    portoesPorSetor.set(setor.id, portao);
    portoes.push(portao);
  }

  // Caso não haja setores cadastrados mas haja projetos, cria cunha padrão de 360 graus
  const cunhaFallback: CunhaSetorLayout = {
    setorId: 'setor-padrao',
    nome: 'Território Imperial',
    cor: '#7A5A2B',
    icone: 'bandeira',
    ordem: 0,
    anguloInicioRad: 0,
    anguloFimRad: Math.PI * 2,
    anguloCentralRad: Math.PI,
    anguloGraus: 360,
    projetosAtivosCount: projetosAtivos.length,
    vazia: projetosAtivos.length === 0,
    poligono: [],
  };

  // 4. Posicionamento inicial das cidades por cunha (proximidade comercial)
  const projetosPorSetor = new Map<UUID, Projeto[]>();
  for (const p of projetosAtivos) {
    const chave = cunhasPorSetorId.has(p.setorId) ? p.setorId : cunhaFallback.setorId;
    const lista = projetosPorSetor.get(chave);
    if (lista) lista.push(p);
    else projetosPorSetor.set(chave, [p]);
  }

  const cidades: CidadeLayout[] = [];
  const rMinPrimeiraCidade = raioMetropole + cfg.anelLivreMuralhaPrimeiraCidade;

  for (const [setorId, lista] of projetosPorSetor.entries()) {
    const cunha = cunhasPorSetorId.get(setorId) ?? cunhaFallback;
    // Ordena por maior receita mensal primeiro (mais próximo da Metrópole Central), desempate por id
    const ordenados = lista.slice().sort((a, b) => {
      const recA = receitaPorProjeto.get(a.id) ?? 0;
      const recB = receitaPorProjeto.get(b.id) ?? 0;
      if (recB !== recA) return recB - recA;
      return a.id.localeCompare(b.id);
    });

    const nSetor = ordenados.length;
    const larguraAngular = cunha.anguloFimRad - cunha.anguloInicioRad;
    const margemAng = Math.min(cfg.margemAngularInternaCunhaRad, larguraAngular * 0.18);
    const angMin = cunha.anguloInicioRad + margemAng;
    const angMax = cunha.anguloFimRad - margemAng;
    const spanAng = Math.max(0.02, angMax - angMin);

    // Organiza em faixas radiais para acomodar desde 1 até 500 cidades sem superlotar o arco interno
    for (let idx = 0; idx < nSetor; idx++) {
      const proj = ordenados[idx]!;
      const infoDeriv = state.derivadosPorProjeto?.get(proj.id);
      const nivel = infoDeriv?.fase?.fase ?? 1;
      const raioCidade = obterRaioCidadePorNivel(nivel, cfg);
      const receita = receitaPorProjeto.get(proj.id) ?? 0;

      const temPosicaoUsuario =
        proj.posicao !== undefined &&
        proj.posicao !== null &&
        Number.isFinite(proj.posicao.x) &&
        Number.isFinite(proj.posicao.z);

      if (temPosicaoUsuario && proj.posicao) {
        const px = proj.posicao.x;
        const pz = proj.posicao.z;
        cidades.push({
          projetoId: proj.id,
          nome: proj.nome,
          setorId: proj.setorId,
          x: px,
          z: pz,
          raio: raioCidade,
          nivel,
          anguloRad: obterAnguloPolarPositivo(px, pz),
          distanciaCentro: Math.hypot(px, pz),
          receitaMensalCentavos: receita,
          fixadaPeloUsuario: true,
        });
        continue;
      }

      // Distribuição polar determinística: quem vende mais (idx menor) fica mais perto do centro
      const rMin = rMinPrimeiraCidade + raioCidade;
      const passoRadial = cfg.cidadeRaioMinimo * 2.2 + cfg.separacaoMinimaExtraCidades;
      // Capacidade estimada por arco cresce com o raio
      const linhaRadial = Math.floor(Math.sqrt(idx));
      const posNaLinha = idx - linhaRadial * linhaRadial;
      const totalNaLinha = 2 * linhaRadial + 1;

      const hash = gerarHashSemente(proj.id);
      const jitterRadial = ((hash & 0xff) / 255 - 0.5) * 10;
      const rAlvo = Math.max(rMin, rMin + linhaRadial * passoRadial * 1.15 + jitterRadial);

      const fracaoAng =
        totalNaLinha <= 1
          ? 0.5 + (((hash >> 8) & 0xff) / 255 - 0.5) * 0.28
          : (posNaLinha + 0.5) / totalNaLinha;
      const angAlvo = angMin + Math.max(0.05, Math.min(0.95, fracaoAng)) * spanAng;

      const x = Math.cos(angAlvo) * rAlvo;
      const z = Math.sin(angAlvo) * rAlvo;

      cidades.push({
        projetoId: proj.id,
        nome: proj.nome,
        setorId: proj.setorId,
        x,
        z,
        raio: raioCidade,
        nivel,
        anguloRad: angAlvo,
        distanciaCentro: rAlvo,
        receitaMensalCentavos: receita,
        fixadaPeloUsuario: false,
      });
    }
  }

  // Ordena cidades por projetoId antes do relaxamento para determinismo absoluto
  cidades.sort((a, b) => a.projetoId.localeCompare(b.projetoId));

  // 5. Anti-colisão por relaxamento iterativo (separação mínima = r1 + r2 + 12 u)
  const numCidades = cidades.length;
  for (let iter = 0; iter < cfg.iteracoesRelaxamentoColisao; iter++) {
    let houveColisao = false;

    for (let i = 0; i < numCidades; i++) {
      const cA = cidades[i]!;
      for (let j = i + 1; j < numCidades; j++) {
        const cB = cidades[j]!;
        const sepMin = cA.raio + cB.raio + cfg.separacaoMinimaExtraCidades;
        const dx = cB.x - cA.x;
        const dz = cB.z - cA.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < sepMin * sepMin) {
          houveColisao = true;
          const dist = Math.sqrt(distSq);
          let ux = 1;
          let uz = 0;
          if (dist > 1e-4) {
            ux = dx / dist;
            uz = dz / dist;
          } else {
            const angDesempate = ((i * 73 + j * 151) % 360) * (Math.PI / 180);
            ux = Math.cos(angDesempate);
            uz = Math.sin(angDesempate);
          }

          const sobreposicao = sepMin - dist + 0.05;
          if (!cA.fixadaPeloUsuario && !cB.fixadaPeloUsuario) {
            cA.x -= ux * sobreposicao * 0.5;
            cA.z -= uz * sobreposicao * 0.5;
            cB.x += ux * sobreposicao * 0.5;
            cB.z += uz * sobreposicao * 0.5;
          } else if (!cA.fixadaPeloUsuario && cB.fixadaPeloUsuario) {
            cA.x -= ux * sobreposicao;
            cA.z -= uz * sobreposicao;
          } else if (cA.fixadaPeloUsuario && !cB.fixadaPeloUsuario) {
            cB.x += ux * sobreposicao;
            cB.z += uz * sobreposicao;
          }
        }
      }
    }

    // Mantém cidades não fixadas fora do anel livre da metrópole e dentro da sua cunha
    const restringirCunha = iter < cfg.iteracoesRelaxamentoColisao - 12;
    for (let i = 0; i < numCidades; i++) {
      const c = cidades[i]!;
      if (c.fixadaPeloUsuario) continue;

      let r = Math.hypot(c.x, c.z);
      let ang = obterAnguloPolarPositivo(c.x, c.z);
      const rMin = rMinPrimeiraCidade + c.raio;
      if (r < rMin) {
        r = rMin;
      }

      if (restringirCunha) {
        const cunha = cunhasPorSetorId.get(c.setorId);
        if (cunha && cunhas.length > 1) {
          const folgaAng = Math.min(
            (cunha.anguloFimRad - cunha.anguloInicioRad) * 0.2,
            Math.atan2(c.raio + 4, r)
          );
          const minA = cunha.anguloInicioRad + folgaAng;
          const maxA = cunha.anguloFimRad - folgaAng;
          if (minA < maxA) {
            ang = Math.max(minA, Math.min(maxA, ang));
          } else {
            ang = cunha.anguloCentralRad;
          }
        }
      }

      c.x = Math.cos(ang) * r;
      c.z = Math.sin(ang) * r;
      c.anguloRad = ang;
      c.distanciaCentro = r;
    }

    if (!houveColisao && iter > 6) break;
  }

  // Arredondamento determinístico de 2 casas decimais e cálculo da distância máxima
  let maxAlcanceCidade = 0;
  const cidadesPorProjetoId = new Map<UUID, CidadeLayout>();
  for (const c of cidades) {
    c.x = Math.round(c.x * 100) / 100;
    c.z = Math.round(c.z * 100) / 100;
    c.distanciaCentro = Math.round(Math.hypot(c.x, c.z) * 100) / 100;
    c.anguloRad = Math.round(obterAnguloPolarPositivo(c.x, c.z) * 10000) / 10000;
    cidadesPorProjetoId.set(c.projetoId, c);

    const alcance = c.distanciaCentro + c.raio;
    if (alcance > maxAlcanceCidade) {
      maxAlcanceCidade = alcance;
    }
  }

  // 6. Raio do mapa: pelo menos 6x o da metrópole (840 u), com 25% de folga além da cidade mais distante
  const raioMapa = Math.max(
    cfg.raioMinimoMapaAbsoluto,
    Math.ceil(raioMetropole * cfg.fatorRaioMinimoMapaSobreMetropole),
    Math.ceil(maxAlcanceCidade * (1 + cfg.folgaAlemCidadeMaisDistante))
  );

  // Preenche polígono de cada cunha do raio da metrópole até o raioMapa
  for (const cunha of cunhas) {
    const pts: [number, number][] = [[0, 0]];
    const passosArco = Math.max(8, Math.ceil((cunha.anguloGraus / 360) * 48));
    for (let s = 0; s <= passosArco; s++) {
      const t = s / passosArco;
      const a = cunha.anguloInicioRad + t * (cunha.anguloFimRad - cunha.anguloInicioRad);
      pts.push([
        Math.round(Math.cos(a) * raioMapa * 100) / 100,
        Math.round(Math.sin(a) * raioMapa * 100) / 100,
      ]);
    }
    cunha.poligono = pts;
  }

  return {
    metropole: {
      x: 0,
      z: 0,
      nivel: nivelMetropole,
      raio: raioMetropole,
      raioPracaCentral,
      aneisRuas,
      portoesPorSetor,
      portoes,
      fatorAlturaEdificios: infoNivel.fatorAlturaEdificios,
    },
    cunhas,
    cunhasPorSetorId,
    cidades,
    cidadesPorProjetoId,
    raioMapa,
  };
}
