import { LAYOUT_PADRAO, type ConfigLayoutMapa } from '../../config/layout';
import type { Fluxo, Loja, UUID } from '../../domain';
import type { CidadeLayout, PortaoMetropoleLayout, ResultadoLayoutMundo } from './layoutWorld';

export interface Ponto2D {
  x: number;
  z: number;
}

export interface EstradaRoteada {
  id: string;
  tipo: 'tronco' | 'ramal' | 'trilha';
  setorId: UUID | null;
  origemId: UUID;
  destinoId: UUID;
  pontos: Ponto2D[];
  larguraBase: number;
  larguraEfetiva: number;
  brilho: number;
  volumeMensal: number;
  produtoIds: string[];
  ativa: boolean;
}

export interface ResultadoEstradasMundo {
  estradas: EstradaRoteada[];
  estradasPorId: Map<string, EstradaRoteada>;
  ramalPorCidadeId: Map<UUID, EstradaRoteada>;
  trilhaPorLigacaoKey: Map<string, EstradaRoteada>;
  fluxosRoteados: Fluxo[];
}

/**
 * Interpola uma spline Catmull-Rom 2D uniforme através dos pontos de controle.
 */
export function interpolarCatmullRom2D(
  controles: readonly Ponto2D[],
  segmentosPorTrecho = 10
): Ponto2D[] {
  if (controles.length === 0) return [];
  if (controles.length === 1) return [{ x: controles[0]!.x, z: controles[0]!.z }];
  if (controles.length === 2) {
    const p0 = controles[0]!;
    const p1 = controles[1]!;
    const saida: Ponto2D[] = [];
    for (let i = 0; i <= segmentosPorTrecho; i++) {
      const t = i / segmentosPorTrecho;
      saida.push({
        x: Math.round((p0.x + (p1.x - p0.x) * t) * 100) / 100,
        z: Math.round((p0.z + (p1.z - p0.z) * t) * 100) / 100,
      });
    }
    return saida;
  }

  const pontos: Ponto2D[] = [];
  const n = controles.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = controles[Math.max(0, i - 1)]!;
    const p1 = controles[i]!;
    const p2 = controles[i + 1]!;
    const p3 = controles[Math.min(n - 1, i + 2)]!;

    const limite = i === n - 2 ? segmentosPorTrecho : segmentosPorTrecho - 1;
    for (let s = 0; s <= limite; s++) {
      const t = s / segmentosPorTrecho;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * t +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);

      pontos.push({
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
      });
    }
  }

  return pontos;
}

/**
 * Desvia um ponto de controle intermediário caso o segmento (inicio -> fim) atravesse o disco de outra cidade.
 */
function desviarDeCidadesObstaculo(
  pInicio: Ponto2D,
  pControle: Ponto2D,
  pFim: Ponto2D,
  cidades: readonly CidadeLayout[],
  ignorarIds: ReadonlySet<UUID>
): Ponto2D {
  let ctrlX = pControle.x;
  let ctrlZ = pControle.z;

  for (let passo = 0; passo < 3; passo++) {
    let ajustou = false;
    for (const cid of cidades) {
      if (ignorarIds.has(cid.projetoId)) continue;
      const raioSeguranca = cid.raio + 7;

      // Verifica distância do ponto de controle e do ponto médio dos sub-segmentos ao centro da cidade
      const candidatos: Ponto2D[] = [
        { x: ctrlX, z: ctrlZ },
        { x: (pInicio.x + ctrlX) * 0.5, z: (pInicio.z + ctrlZ) * 0.5 },
        { x: (ctrlX + pFim.x) * 0.5, z: (ctrlZ + pFim.z) * 0.5 },
      ];

      for (const pt of candidatos) {
        const dx = pt.x - cid.x;
        const dz = pt.z - cid.z;
        const dist = Math.hypot(dx, dz);
        if (dist < raioSeguranca) {
          ajustou = true;
          const empurrao = raioSeguranca - dist + 6;
          if (dist > 0.01) {
            ctrlX += (dx / dist) * empurrao;
            ctrlZ += (dz / dist) * empurrao;
          } else {
            // Desvio perpendicular à direção inicio -> fim
            const vx = pFim.x - pInicio.x;
            const vz = pFim.z - pInicio.z;
            const vLen = Math.max(1, Math.hypot(vx, vz));
            ctrlX += (-vz / vLen) * empurrao;
            ctrlZ += (vx / vLen) * empurrao;
          }
          break;
        }
      }
    }
    if (!ajustou) break;
  }

  return { x: ctrlX, z: ctrlZ };
}

/**
 * Constrói a polilinha Catmull-Rom do ramal de uma cidade até o portão do seu setor,
 * juntando-se à avenida do setor e desviando de outras cidades.
 */
export function construirPolilinhaRamalCidade(
  cidade: CidadeLayout,
  portao: PortaoMetropoleLayout,
  anguloAvenidaRad: number,
  todasCidades: readonly CidadeLayout[],
  raioMetropole: number
): Ponto2D[] {
  const cosAv = Math.cos(anguloAvenidaRad);
  const sinAv = Math.sin(anguloAvenidaRad);

  const rJuncao = Math.max(
    raioMetropole + 24,
    Math.min(cidade.distanciaCentro * 0.72, cidade.distanciaCentro - 20)
  );
  const pJuncao: Ponto2D = {
    x: cosAv * rJuncao,
    z: sinAv * rJuncao,
  };

  const pMeioInicial: Ponto2D = {
    x: (cidade.x + pJuncao.x) * 0.5,
    z: (cidade.z + pJuncao.z) * 0.5,
  };

  const ignorar = new Set<UUID>([cidade.projetoId]);
  const pMeioDesviado = desviarDeCidadesObstaculo(
    { x: cidade.x, z: cidade.z },
    pMeioInicial,
    pJuncao,
    todasCidades,
    ignorar
  );

  return interpolarCatmullRom2D(
    [{ x: cidade.x, z: cidade.z }, pMeioDesviado, pJuncao, { x: portao.x, z: portao.z }],
    8
  );
}

/**
 * Constrói a polilinha Catmull-Rom de uma trilha direta entre duas cidades,
 * contornando a Metrópole Central (se necessário) e desviando de cidades intermediárias.
 */
export function construirPolilinhaTrilhaCidades(
  origem: CidadeLayout,
  destino: CidadeLayout,
  todasCidades: readonly CidadeLayout[],
  raioMetropole: number
): Ponto2D[] {
  let meioX = (origem.x + destino.x) * 0.5;
  let meioZ = (origem.z + destino.z) * 0.5;

  // Se o ponto médio atravessar o interior da Metrópole Central, desvia para fora da muralha
  const distMeioCentro = Math.hypot(meioX, meioZ);
  const rSegurancaMetropole = raioMetropole + 22;
  if (distMeioCentro < rSegurancaMetropole) {
    const angOrigem = Math.atan2(origem.z, origem.x);
    const angDestino = Math.atan2(destino.z, destino.x);
    let angMeio = (angOrigem + angDestino) * 0.5;
    if (Math.abs(angDestino - angOrigem) > Math.PI) {
      angMeio += Math.PI;
    }
    meioX = Math.cos(angMeio) * rSegurancaMetropole;
    meioZ = Math.sin(angMeio) * rSegurancaMetropole;
  } else {
    // Leve curvatura estética proporcional à distância
    const dx = destino.x - origem.x;
    const dz = destino.z - origem.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1) {
      const offsetCurva = Math.min(24, dist * 0.08);
      meioX += (-dz / dist) * offsetCurva;
      meioZ += (dx / dist) * offsetCurva;
    }
  }

  const ignorar = new Set<UUID>([origem.projetoId, destino.projetoId]);
  const pMeioDesviado = desviarDeCidadesObstaculo(
    { x: origem.x, z: origem.z },
    { x: meioX, z: meioZ },
    { x: destino.x, z: destino.z },
    todasCidades,
    ignorar
  );

  return interpolarCatmullRom2D(
    [{ x: origem.x, z: origem.z }, pMeioDesviado, { x: destino.x, z: destino.z }],
    10
  );
}

function calcularEspessuraEBrilhoLog(
  larguraBase: number,
  volumeMensal: number,
  cfg: ConfigLayoutMapa
): { larguraEfetiva: number; brilho: number; ativa: boolean } {
  if (volumeMensal <= 0) {
    return {
      larguraEfetiva: Math.round(larguraBase * 0.7 * 100) / 100,
      brilho: 0.16,
      ativa: false,
    };
  }
  const fatorLog = Math.min(
    1,
    Math.log2(1 + volumeMensal / Math.max(1, cfg.fluxoVolumeBaseCentavos)) / 7
  );
  return {
    larguraEfetiva: Math.round(larguraBase * (0.9 + 0.65 * fatorLog) * 100) / 100,
    brilho: Math.round((0.45 + 0.55 * fatorLog) * 100) / 100,
    ativa: true,
  };
}

/**
 * Gera todas as estradas do mundo plano (avenidas tronco, ramais de cidades e trilhas entre cidades)
 * e preenche/sincroniza as polilinhas dos fluxos (Seções 4.4 e 5).
 */
export function routeRoads(
  layout: ResultadoLayoutMundo,
  flows: readonly Fluxo[],
  config?: Partial<ConfigLayoutMapa>,
  lojas?: readonly Loja[]
): ResultadoEstradasMundo {
  const cfg: ConfigLayoutMapa = { ...LAYOUT_PADRAO, ...config };

  // Mapeia lojas por produtoId para conectar a ponta final do fluxo de produção até a porta da loja
  const lojaPorProdutoId = new Map<string, Loja>();
  if (lojas) {
    for (const l of lojas) {
      lojaPorProdutoId.set(l.produtoId, l);
    }
  }

  // Soma volumes e produtos por cidade (para ramais) e por setor (para avenidas tronco)
  const volumeRamalPorCidade = new Map<UUID, number>();
  const produtosRamalPorCidade = new Map<UUID, Set<string>>();
  const volumeAvenidaPorSetor = new Map<UUID, number>();
  const produtosAvenidaPorSetor = new Map<UUID, Set<string>>();

  for (const f of flows) {
    if (f.tipo === 'producao') {
      const cid = layout.cidadesPorProjetoId.get(f.origemId);
      if (cid) {
        volumeRamalPorCidade.set(
          cid.projetoId,
          (volumeRamalPorCidade.get(cid.projetoId) ?? 0) + f.volumeMensal
        );
        let conjCid = produtosRamalPorCidade.get(cid.projetoId);
        if (!conjCid) {
          conjCid = new Set();
          produtosRamalPorCidade.set(cid.projetoId, conjCid);
        }
        for (const pid of f.produtoIds) conjCid.add(pid);

        volumeAvenidaPorSetor.set(
          cid.setorId,
          (volumeAvenidaPorSetor.get(cid.setorId) ?? 0) + f.volumeMensal
        );
        let conjSetor = produtosAvenidaPorSetor.get(cid.setorId);
        if (!conjSetor) {
          conjSetor = new Set();
          produtosAvenidaPorSetor.set(cid.setorId, conjSetor);
        }
        for (const pid of f.produtoIds) conjSetor.add(pid);
      }
    } else if (f.tipo === 'insumo') {
      const cid = layout.cidadesPorProjetoId.get(f.destinoId);
      if (cid) {
        volumeRamalPorCidade.set(
          cid.projetoId,
          (volumeRamalPorCidade.get(cid.projetoId) ?? 0) + f.volumeMensal
        );
        volumeAvenidaPorSetor.set(
          cid.setorId,
          (volumeAvenidaPorSetor.get(cid.setorId) ?? 0) + f.volumeMensal
        );
      }
    }
  }

  const estradas: EstradaRoteada[] = [];
  const estradasPorId = new Map<string, EstradaRoteada>();
  const ramalPorCidadeId = new Map<UUID, EstradaRoteada>();
  const trilhaPorLigacaoKey = new Map<string, EstradaRoteada>();

  // 1. Avenidas Tronco por Setor (5 u)
  for (const cunha of layout.cunhas) {
    const portao = layout.metropole.portoesPorSetor.get(cunha.setorId);
    if (!portao) continue;

    // Alcance radial da avenida até a cidade mais distante do setor (ou mínimo fora do portão)
    let rMaxSetor = layout.metropole.raio + 55;
    for (const c of layout.cidades) {
      if (c.setorId === cunha.setorId && c.distanciaCentro > rMaxSetor) {
        rMaxSetor = c.distanciaCentro * 0.82;
      }
    }

    const cosA = Math.cos(cunha.anguloCentralRad);
    const sinA = Math.sin(cunha.anguloCentralRad);
    const rInicio = layout.metropole.raioPracaCentral;
    const pontosTronco = interpolarCatmullRom2D(
      [
        { x: cosA * rInicio, z: sinA * rInicio },
        { x: portao.x, z: portao.z },
        { x: cosA * rMaxSetor, z: sinA * rMaxSetor },
      ],
      8
    );

    const volSetor = volumeAvenidaPorSetor.get(cunha.setorId) ?? 0;
    const { larguraEfetiva, brilho, ativa } = calcularEspessuraEBrilhoLog(
      cfg.estradaTroncoLargura,
      volSetor,
      cfg
    );

    const estradaTronco: EstradaRoteada = {
      id: `estrada-tronco-${cunha.setorId}`,
      tipo: 'tronco',
      setorId: cunha.setorId,
      origemId: 'metropole-central',
      destinoId: cunha.setorId,
      pontos: pontosTronco,
      larguraBase: cfg.estradaTroncoLargura,
      larguraEfetiva,
      brilho,
      volumeMensal: volSetor,
      produtoIds: Array.from(produtosAvenidaPorSetor.get(cunha.setorId) ?? []),
      ativa,
    };
    estradas.push(estradaTronco);
    estradasPorId.set(estradaTronco.id, estradaTronco);
  }

  // Portão fallback caso uma cidade pertença a setor sem portão explícito
  const portaoPadrao: PortaoMetropoleLayout = layout.metropole.portoes[0] ?? {
    setorId: 'setor-padrao',
    anguloRad: 0,
    x: layout.metropole.raio,
    z: 0,
    largura: cfg.portaoLargura,
    altura: cfg.portaoAlturaBase,
  };

  // 2. Ramais por Cidade (3 u)
  for (const cidade of layout.cidades) {
    const portao = layout.metropole.portoesPorSetor.get(cidade.setorId) ?? portaoPadrao;
    const cunha = layout.cunhasPorSetorId.get(cidade.setorId);
    const angAvenida = cunha ? cunha.anguloCentralRad : portao.anguloRad;

    const pontosRamal = construirPolilinhaRamalCidade(
      cidade,
      portao,
      angAvenida,
      layout.cidades,
      layout.metropole.raio
    );

    const volCidade = volumeRamalPorCidade.get(cidade.projetoId) ?? 0;
    const { larguraEfetiva, brilho, ativa } = calcularEspessuraEBrilhoLog(
      cfg.estradaRamalLargura,
      volCidade,
      cfg
    );

    const estradaRamal: EstradaRoteada = {
      id: `estrada-ramal-${cidade.projetoId}`,
      tipo: 'ramal',
      setorId: cidade.setorId,
      origemId: cidade.projetoId,
      destinoId: `portao-${cidade.setorId}`,
      pontos: pontosRamal,
      larguraBase: cfg.estradaRamalLargura,
      larguraEfetiva,
      brilho,
      volumeMensal: volCidade,
      produtoIds: Array.from(produtosRamalPorCidade.get(cidade.projetoId) ?? []),
      ativa,
    };
    estradas.push(estradaRamal);
    estradasPorId.set(estradaRamal.id, estradaRamal);
    ramalPorCidadeId.set(cidade.projetoId, estradaRamal);
  }

  // 3. Trilhas Cidade a Cidade (2 u) e Roteamento Final de cada Fluxo
  const fluxosRoteados: Fluxo[] = [];

  for (const f of flows) {
    if (f.tipo === 'producao') {
      const ramal = ramalPorCidadeId.get(f.origemId);
      const loja = lojaPorProdutoId.get(f.destinoId);
      let rota = ramal ? ramal.pontos.slice() : f.rota.slice();
      if (loja && typeof loja.x === 'number' && typeof loja.z === 'number' && rota.length > 0) {
        rota = [...rota, { x: loja.x, z: loja.z }];
      }
      fluxosRoteados.push({
        ...f,
        rota,
      });
    } else if (f.tipo === 'insumo') {
      const ramal = ramalPorCidadeId.get(f.destinoId);
      const rota = ramal ? ramal.pontos.slice().reverse() : f.rota.slice();
      fluxosRoteados.push({
        ...f,
        rota,
      });
    } else if (f.tipo === 'ligacao') {
      const cOrigem = layout.cidadesPorProjetoId.get(f.origemId);
      const cDestino = layout.cidadesPorProjetoId.get(f.destinoId);
      if (!cOrigem || !cDestino) {
        fluxosRoteados.push(f);
        continue;
      }

      const chavePar = `${f.origemId}->${f.destinoId}`;
      let estradaTrilha = trilhaPorLigacaoKey.get(chavePar);
      if (!estradaTrilha) {
        const pontosTrilha = construirPolilinhaTrilhaCidades(
          cOrigem,
          cDestino,
          layout.cidades,
          layout.metropole.raio
        );
        const { larguraEfetiva, brilho, ativa } = calcularEspessuraEBrilhoLog(
          cfg.estradaTrilhaLargura,
          f.volumeMensal,
          cfg
        );
        estradaTrilha = {
          id: `estrada-trilha-${f.origemId}-${f.destinoId}`,
          tipo: 'trilha',
          setorId: cOrigem.setorId,
          origemId: f.origemId,
          destinoId: f.destinoId,
          pontos: pontosTrilha,
          larguraBase: cfg.estradaTrilhaLargura,
          larguraEfetiva,
          brilho,
          volumeMensal: f.volumeMensal,
          produtoIds: f.produtoIds.slice(),
          ativa,
        };
        estradas.push(estradaTrilha);
        estradasPorId.set(estradaTrilha.id, estradaTrilha);
        trilhaPorLigacaoKey.set(chavePar, estradaTrilha);
      }

      fluxosRoteados.push({
        ...f,
        rota: estradaTrilha.pontos.slice(),
      });
    }
  }

  return {
    estradas,
    estradasPorId,
    ramalPorCidadeId,
    trilhaPorLigacaoKey,
    fluxosRoteados,
  };
}

/**
 * Recalcula incrementalmente apenas as estradas e fluxos afetados pelo arrasto de uma única cidade,
 * sem mover nenhuma outra cidade nem recalcular estradas de outras cidades (Seção 4.6 e Critério 4).
 */
export function recalcularEstradasDaCidade(
  layoutAtual: ResultadoLayoutMundo,
  estradasAtuais: ResultadoEstradasMundo,
  flowsAtuais: readonly Fluxo[],
  projetoIdMovido: UUID,
  novoX: number,
  novoZ: number,
  config?: Partial<ConfigLayoutMapa>,
  lojas?: readonly Loja[]
): {
  layout: ResultadoLayoutMundo;
  estradas: ResultadoEstradasMundo;
  idsEstradasRecalculadas: string[];
} {
  const cfg: ConfigLayoutMapa = { ...LAYOUT_PADRAO, ...config };
  const cidadeAntiga = layoutAtual.cidadesPorProjetoId.get(projetoIdMovido);
  if (!cidadeAntiga) {
    return {
      layout: layoutAtual,
      estradas: estradasAtuais,
      idsEstradasRecalculadas: [],
    };
  }

  const cidadeNova: CidadeLayout = {
    ...cidadeAntiga,
    x: Math.round(novoX * 100) / 100,
    z: Math.round(novoZ * 100) / 100,
    distanciaCentro: Math.round(Math.hypot(novoX, novoZ) * 100) / 100,
    anguloRad:
      Math.round(
        ((Math.atan2(novoZ, novoX) + Math.PI * 2) % (Math.PI * 2)) * 10000
      ) / 10000,
    fixadaPeloUsuario: true,
  };

  // Clona apenas o mapa e array de cidades substituindo somente a cidade movida
  const novasCidades = layoutAtual.cidades.map((c) =>
    c.projetoId === projetoIdMovido ? cidadeNova : c
  );
  const novasCidadesPorId = new Map(layoutAtual.cidadesPorProjetoId);
  novasCidadesPorId.set(projetoIdMovido, cidadeNova);

  const novoLayout: ResultadoLayoutMundo = {
    ...layoutAtual,
    cidades: novasCidades,
    cidadesPorProjetoId: novasCidadesPorId,
  };

  const idsEstradasRecalculadas: string[] = [];
  const novasEstradasPorId = new Map(estradasAtuais.estradasPorId);
  const novoRamalPorCidadeId = new Map(estradasAtuais.ramalPorCidadeId);
  const novaTrilhaPorLigacaoKey = new Map(estradasAtuais.trilhaPorLigacaoKey);

  const portaoPadrao: PortaoMetropoleLayout = novoLayout.metropole.portoes[0] ?? {
    setorId: 'setor-padrao',
    anguloRad: 0,
    x: novoLayout.metropole.raio,
    z: 0,
    largura: cfg.portaoLargura,
    altura: cfg.portaoAlturaBase,
  };

  // 1. Recalcula apenas o ramal da cidade movida
  const ramalAntigo = novoRamalPorCidadeId.get(projetoIdMovido);
  if (ramalAntigo) {
    const portao =
      novoLayout.metropole.portoesPorSetor.get(cidadeNova.setorId) ?? portaoPadrao;
    const cunha = novoLayout.cunhasPorSetorId.get(cidadeNova.setorId);
    const angAv = cunha ? cunha.anguloCentralRad : portao.anguloRad;
    const novosPontosRamal = construirPolilinhaRamalCidade(
      cidadeNova,
      portao,
      angAv,
      novasCidades,
      novoLayout.metropole.raio
    );
    const novoRamal: EstradaRoteada = {
      ...ramalAntigo,
      pontos: novosPontosRamal,
    };
    novoRamalPorCidadeId.set(projetoIdMovido, novoRamal);
    novasEstradasPorId.set(novoRamal.id, novoRamal);
    idsEstradasRecalculadas.push(novoRamal.id);
  }

  // 2. Recalcula apenas as trilhas cidade a cidade em que origemId ou destinoId === projetoIdMovido
  for (const [chavePar, trilhaAntiga] of novaTrilhaPorLigacaoKey.entries()) {
    if (
      trilhaAntiga.origemId === projetoIdMovido ||
      trilhaAntiga.destinoId === projetoIdMovido
    ) {
      const cOrigem = novasCidadesPorId.get(trilhaAntiga.origemId);
      const cDestino = novasCidadesPorId.get(trilhaAntiga.destinoId);
      if (cOrigem && cDestino) {
        const novosPontosTrilha = construirPolilinhaTrilhaCidades(
          cOrigem,
          cDestino,
          novasCidades,
          novoLayout.metropole.raio
        );
        const novaTrilha: EstradaRoteada = {
          ...trilhaAntiga,
          pontos: novosPontosTrilha,
        };
        novaTrilhaPorLigacaoKey.set(chavePar, novaTrilha);
        novasEstradasPorId.set(novaTrilha.id, novaTrilha);
        idsEstradasRecalculadas.push(novaTrilha.id);
      }
    }
  }

  const lojaPorProdutoId = new Map<string, Loja>();
  if (lojas) {
    for (const l of lojas) lojaPorProdutoId.set(l.produtoId, l);
  }

  // 3. Atualiza apenas os fluxos que tocam a cidade movida
  const novosFluxosRoteados = flowsAtuais.map((f) => {
    if (f.tipo === 'producao' && f.origemId === projetoIdMovido) {
      const ramal = novoRamalPorCidadeId.get(projetoIdMovido);
      const loja = lojaPorProdutoId.get(f.destinoId);
      let rota = ramal ? ramal.pontos.slice() : f.rota.slice();
      if (loja && typeof loja.x === 'number' && typeof loja.z === 'number' && rota.length > 0) {
        rota = [...rota, { x: loja.x, z: loja.z }];
      }
      return { ...f, rota };
    }
    if (f.tipo === 'insumo' && f.destinoId === projetoIdMovido) {
      const ramal = novoRamalPorCidadeId.get(projetoIdMovido);
      return {
        ...f,
        rota: ramal ? ramal.pontos.slice().reverse() : f.rota.slice(),
      };
    }
    if (
      f.tipo === 'ligacao' &&
      (f.origemId === projetoIdMovido || f.destinoId === projetoIdMovido)
    ) {
      const trilha = novaTrilhaPorLigacaoKey.get(`${f.origemId}->${f.destinoId}`);
      return {
        ...f,
        rota: trilha ? trilha.pontos.slice() : f.rota.slice(),
      };
    }
    return f;
  });

  const novasEstradas = estradasAtuais.estradas.map(
    (e) => novasEstradasPorId.get(e.id) ?? e
  );

  return {
    layout: novoLayout,
    estradas: {
      estradas: novasEstradas,
      estradasPorId: novasEstradasPorId,
      ramalPorCidadeId: novoRamalPorCidadeId,
      trilhaPorLigacaoKey: novaTrilhaPorLigacaoKey,
      fluxosRoteados: novosFluxosRoteados,
    },
    idsEstradasRecalculadas,
  };
}
