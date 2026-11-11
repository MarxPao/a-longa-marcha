/**
 * Configuração canônica de escala, proporção, paleta e parâmetros de layout do mapa plano
 * com Metrópole Central, mercado vivo e fluxo de NPCs (Seções 3, 4.1 a 4.6 e 6).
 *
 * Unidade de mundo = u.
 * Nenhum valor de medida espacial, escala de loja, estrada ou NPC deve ficar fixo fora deste módulo.
 */

const PALETA_PADRAO_MAPA = {
  pergaminho: '#E8DCC0',
  tinta: '#1F1B16',
  laca: '#8E1F1A',
  jade: '#3E7C68',
  ouro: '#B8923A',
  bronze: '#7A5A2B',
  nevoa: '#9DAAB0',
  luzSol: '#FFF3D6',
  terraClara: '#D9C9A5',
  // Bases arquiteturais canônicas da Fase 2c (madeira escura, reboco, telha, pedra)
  madeiraEscura: '#56402E',
  rebocoClaro: '#D8CEBC',
  telhaCinzaAzulada: '#2F353B',
  pedraBase: '#8A8275',
} as const;

export type ChavePaletaMapa = keyof typeof PALETA_PADRAO_MAPA;

/**
 * Retorna a cor da paleta com verificação estrita em desenvolvimento.
 * Lança erro explícito se a chave não existir em vez de retornar undefined ou zero (Seção 2).
 */
export function obterCorPaleta(chave: string): string {
  if (!chave || !(chave in PALETA_PADRAO_MAPA)) {
    throw new Error(
      `[PALETA_MAPA] Chave de paleta inválida ou ausente: "${chave}". Todas as chaves devem existir em src/config/layout.ts.`
    );
  }
  return PALETA_PADRAO_MAPA[chave as ChavePaletaMapa];
}

export const PALETA_MAPA: Record<ChavePaletaMapa, string> = new Proxy(
  PALETA_PADRAO_MAPA as unknown as Record<ChavePaletaMapa, string>,
  {
    get(target, prop: string | symbol) {
      if (typeof prop === 'string') {
        if (!(prop in target)) {
          throw new Error(
            `[PALETA_MAPA] Chave de paleta inexistente: "${prop}". Acesso inválido a cor da campanha.`
          );
        }
        return target[prop as ChavePaletaMapa];
      }
      return Reflect.get(target, prop);
    },
  }
);

export type NivelSemanticoCamera = 'imperio' | 'setor' | 'cidade' | 'rua';

export type PresetHoraDoDia = 'dia_mercado' | 'entardecer' | 'noite_lanternas';

export interface ConfigQualidadeDetalhada {
  maxNpcs: number;
  resolucaoSombra: number;
  cascatasSombra: 1 | 3;
  oclusaoAmbiente: 'desligada' | 'meia' | 'cheia';
  bloomETiltShift: boolean;
  dprMaximo: number;
  proporcaoArvores: number;
  maxDrawCallsOrcamento: number;
  maxTriangulosOrcamento: number;
}

export interface ConfigLayoutMapa {
  // 4.1 Escala e proporção (em unidades de mundo u)
  metropoleRaioBase: number; // 140 u (nível 0)
  metropoleRaioMaximo: number; // 200 u (nível 4)
  anelLivreMuralhaPrimeiraCidade: number; // 60 u
  cidadeRaioMinimo: number; // 14 u (nível 1)
  cidadeRaioMaximo: number; // 44 u (nível 7)
  cidadeRaioRuinas: number; // derivado por razão: 12 u (nível 0)
  fatorRaioMinimoMapaSobreMetropole: number; // 6x (pelo menos 840 u)
  raioMinimoMapaAbsoluto: number; // 840 u (6 * 140 u)
  folgaAlemCidadeMaisDistante: number; // 0.25 (25% de folga)
  edificioComumMin: number; // 4 u
  edificioComumMax: number; // 8 u
  lojaTamanhoP: number; // 6 u
  lojaTamanhoM: number; // 9 u
  lojaTamanhoG: number; // 13 u
  npcAlturaBase: number; // 1.6 u
  NPC_VISUAL_SCALE: number; // 2 (para leitura na câmera de jogo)
  portaAlturaPadrao: number; // 2.4 u (para auditoria de escala lado a lado com NPC e edifício)
  plataformaMetropoleAltura: number; // 1.0 u (Seção 5.3: plataforma elevada ~1 u)
  densidadeTexelPxPorUnidade: number; // 64 px por unidade de mundo (Seção 2, Princípio 3)
  carrocaComprimento: number; // 3 u
  estradaTroncoLargura: number; // 5 u (avenida do setor)
  estradaRamalLargura: number; // 3 u (ramal cidade -> avenida/portão)
  estradaTrilhaLargura: number; // 2 u (trilha cidade -> cidade)

  // 4.2 Layout de cunhas e anti-colisão
  anguloMinimoCunhaGraus: number; // 20 graus
  anguloCunhaVaziaGraus: number; // 20 graus (cunha estreita em névoa)
  separacaoMinimaExtraCidades: number; // 12 u (soma dos raios + 12 u)
  iteracoesRelaxamentoColisao: number; // 80 iterações determinísticas
  opacidadeChaoCunhaSetor: number; // 0.12 (12% de opacidade)
  margemAngularInternaCunhaRad: number; // folga angular para a cidade não tocar a linha de tinta

  // 4.3 Metrópole Central e Lojas
  pracaCentralRaioRazao: number; // 0.24 do raio da metrópole
  monumentoCentralRaioBase: number; // 10 u
  muralhaEspessura: number; // 3.5 u
  muralhaAlturaBase: number; // 6.5 u
  portaoLargura: number; // 14 u
  portaoAlturaBase: number; // 11 u
  espacamentoMinimoLojas: number; // 4 u entre lojas no arco
  percentilLojaP: number; // 0.50 (até 50%)
  percentilLojaM: number; // 0.85 (até 85%; G acima de 85%)
  tempoConstrucaoLojaSegundos: number; // 2 s (andaime -> construção)
  diasSemReceitaParaFecharLoja: number; // 60 dias
  diasSemReceitaParaSumirLoja: number; // 180 dias
  janelaMediaMovelReceitaDias: number; // 90 dias (3 meses)
  divisorMediaMovelMeses: number; // 3 meses
  limiaresNivelMetropole: ReadonlyArray<{
    nivel: 0 | 1 | 2 | 3 | 4;
    receitaTotalMensalCentavos: number;
    minimoLojasAtivas: number;
    aneisRuas: number;
    fatorAlturaEdificios: number;
  }>;

  // 4.5 NPCs e fluxo
  fluxoK: number; // k = 2
  fluxoVolumeBaseCentavos: number; // R$ 500 = 50.000 centavos
  fluxoNMaxPorRota: number; // nMax = 12
  tetoGlobalNpcs: number; // 1.500 NPCs
  velocidadeNpcUnidadesPorSegundo: number; // 6 u/s
  espacamentoMinimoNpcUnidades: number; // 4.5 u
  distanciaCameraParticulasNpc: number; // acima desta distância, NPCs viram partículas fluindo
  frequenciaSimulacaoNpcHz: number; // 30 Hz (Seção 4.2)

  // Fase 2b — Seção 3: Câmera e Zoom Contínuo
  cameraFovGraus: number; // 32 graus (FOV constante entre 30° e 35°, lente longa)
  cameraElevacaoMinGraus: number; // 30 graus
  cameraElevacaoMaxGraus: number; // 70 graus (Império ~70°, Rua ~32°)
  cameraElevacaoRuaGraus: number; // 32 graus
  cameraElevacaoCidadeMinGraus: number; // 38 graus
  cameraElevacaoCidadeMaxGraus: number; // 55 graus
  cameraElevacaoSetorMaxGraus: number; // 70 graus
  cameraElevacaoImperioGraus: number; // 70 graus
  cameraDistanciaMin: number; // 24 u (Seção 3.2: distância mínima cerca de 24 u)
  cameraDistanciaRuaRef: number; // 70 u (d_rua na fórmula de voarAte e limite Rua)
  cameraFatorMaxDistFit: number; // 1.2 * distFit (Seção 3.2)
  cameraDistanciaMaxFatorRaioMapa: number; // 1.85x raio do mapa (compatibilidade)
  limiaresRazaoDistFit: {
    imperioMin: number; // 0.45 (d / distFit >= 0.45)
    setorMin: number; // 0.15 (0.15 a 0.45)
    cidadeMin: number; // 0.04 (0.04 a 0.15; Rua < 0.04)
  };
  zoomFatorPassoRoda: number; // 1.15 (entre 1.12 e 1.18)
  zoomConstanteTempoSuavizacaoMs: number; // 120 ms
  zoomToleranciaCursorPx: number; // 2 px
  panAmortecimentoInercia: number; // decaimento exponencial da inércia curta do pan
  vooDuracaoMinSegundos: number; // 0.6 s
  vooDuracaoMaxSegundos: number; // 2.2 s
  vooFatorLog: number; // 0.35
  vooArcoMaxFator: number; // 0.40 (afasta até 40% no meio do voo em saltos longos)
  duracaoTransicaoArrastoEstradaMs: number; // 400 ms

  // Fase 2b — Seção 4: Arquitetura do Motor Gráfico (Blocos 128 u, LOD, DPR, Rótulos, Qualidade)
  tamanhoBlocoEspacialUnidades: number; // 128 u (Seção 4.1 e 4.2)
  lodHistereseFator: number; // 0.10 (10% de histerese para evitar troca repetida)
  lodDuracaoDitheringMs: number; // 250 ms (transição alpha-hash sem popping)
  dprMinimoDinamico: number; // 0.75 (Seção 4.2)
  maxRotulosHtmlSimultaneos: number; // 80 rótulos (Seção 4.1 Camada 5)
  maxLuzesLanternaReais: number; // 8 luzes pontuais realocadas para as mais próximas da câmera (Seção 5.5)
  tetoTexturasVramMb: number; // 512 MB (Seção 4.2)
  limiteNpcsPorQualidade: {
    baixa: number; // 400
    media: number; // 900
    alta: number; // 1500
  };
  perfisQualidade: Record<'baixa' | 'media' | 'alta', ConfigQualidadeDetalhada>;
}

export const LAYOUT_PADRAO: ConfigLayoutMapa = {
  metropoleRaioBase: 140,
  metropoleRaioMaximo: 200,
  anelLivreMuralhaPrimeiraCidade: 60,
  cidadeRaioMinimo: 14,
  cidadeRaioMaximo: 44,
  cidadeRaioRuinas: 12,
  fatorRaioMinimoMapaSobreMetropole: 6,
  raioMinimoMapaAbsoluto: 840,
  folgaAlemCidadeMaisDistante: 0.25,
  edificioComumMin: 4,
  edificioComumMax: 8,
  lojaTamanhoP: 6,
  lojaTamanhoM: 9,
  lojaTamanhoG: 13,
  npcAlturaBase: 1.6,
  NPC_VISUAL_SCALE: 2,
  portaAlturaPadrao: 2.4,
  plataformaMetropoleAltura: 1.0,
  densidadeTexelPxPorUnidade: 64,
  carrocaComprimento: 3,
  estradaTroncoLargura: 5,
  estradaRamalLargura: 3,
  estradaTrilhaLargura: 2,

  anguloMinimoCunhaGraus: 20,
  anguloCunhaVaziaGraus: 20,
  separacaoMinimaExtraCidades: 12,
  iteracoesRelaxamentoColisao: 80,
  opacidadeChaoCunhaSetor: 0.12,
  margemAngularInternaCunhaRad: 0.06,

  pracaCentralRaioRazao: 0.24,
  monumentoCentralRaioBase: 10,
  muralhaEspessura: 3.5,
  muralhaAlturaBase: 6.5,
  portaoLargura: 14,
  portaoAlturaBase: 11,
  espacamentoMinimoLojas: 4,
  percentilLojaP: 0.5,
  percentilLojaM: 0.85,
  tempoConstrucaoLojaSegundos: 2,
  diasSemReceitaParaFecharLoja: 60,
  diasSemReceitaParaSumirLoja: 180,
  janelaMediaMovelReceitaDias: 90,
  divisorMediaMovelMeses: 3,
  limiaresNivelMetropole: [
    {
      nivel: 0,
      receitaTotalMensalCentavos: 0,
      minimoLojasAtivas: 0,
      aneisRuas: 1,
      fatorAlturaEdificios: 1.0,
    },
    {
      nivel: 1,
      receitaTotalMensalCentavos: 500_000, // R$ 5.000/mês
      minimoLojasAtivas: 3,
      aneisRuas: 2,
      fatorAlturaEdificios: 1.2,
    },
    {
      nivel: 2,
      receitaTotalMensalCentavos: 2_500_000, // R$ 25.000/mês
      minimoLojasAtivas: 10,
      aneisRuas: 3,
      fatorAlturaEdificios: 1.45,
    },
    {
      nivel: 3,
      receitaTotalMensalCentavos: 8_000_000, // R$ 80.000/mês
      minimoLojasAtivas: 25,
      aneisRuas: 4,
      fatorAlturaEdificios: 1.75,
    },
    {
      nivel: 4,
      receitaTotalMensalCentavos: 20_000_000, // R$ 200.000/mês
      minimoLojasAtivas: 50,
      aneisRuas: 5,
      fatorAlturaEdificios: 2.1,
    },
  ],

  fluxoK: 2,
  fluxoVolumeBaseCentavos: 50_000, // R$ 500,00
  fluxoNMaxPorRota: 12,
  tetoGlobalNpcs: 1500,
  velocidadeNpcUnidadesPorSegundo: 6,
  espacamentoMinimoNpcUnidades: 4.5,
  distanciaCameraParticulasNpc: 520,
  frequenciaSimulacaoNpcHz: 30,

  cameraFovGraus: 32,
  cameraElevacaoMinGraus: 30,
  cameraElevacaoMaxGraus: 70,
  cameraElevacaoRuaGraus: 32,
  cameraElevacaoCidadeMinGraus: 38,
  cameraElevacaoCidadeMaxGraus: 55,
  cameraElevacaoSetorMaxGraus: 70,
  cameraElevacaoImperioGraus: 70,
  cameraDistanciaMin: 24,
  cameraDistanciaRuaRef: 70,
  cameraFatorMaxDistFit: 1.2,
  cameraDistanciaMaxFatorRaioMapa: 1.85,
  limiaresRazaoDistFit: {
    imperioMin: 0.45,
    setorMin: 0.15,
    cidadeMin: 0.04,
  },
  zoomFatorPassoRoda: 1.15,
  zoomConstanteTempoSuavizacaoMs: 120,
  zoomToleranciaCursorPx: 2,
  panAmortecimentoInercia: 8.5,
  vooDuracaoMinSegundos: 0.6,
  vooDuracaoMaxSegundos: 2.2,
  vooFatorLog: 0.35,
  vooArcoMaxFator: 0.4,
  duracaoTransicaoArrastoEstradaMs: 400,

  tamanhoBlocoEspacialUnidades: 128,
  lodHistereseFator: 0.1,
  lodDuracaoDitheringMs: 250,
  dprMinimoDinamico: 0.75,
  maxRotulosHtmlSimultaneos: 80,
  maxLuzesLanternaReais: 8,
  tetoTexturasVramMb: 512,
  limiteNpcsPorQualidade: {
    baixa: 400,
    media: 900,
    alta: 1500,
  },
  perfisQualidade: {
    baixa: {
      maxNpcs: 400,
      resolucaoSombra: 1024,
      cascatasSombra: 1,
      oclusaoAmbiente: 'desligada',
      bloomETiltShift: false,
      dprMaximo: 1.0,
      proporcaoArvores: 0.3,
      maxDrawCallsOrcamento: 220,
      maxTriangulosOrcamento: 750_000,
    },
    media: {
      maxNpcs: 900,
      resolucaoSombra: 2048,
      cascatasSombra: 1,
      oclusaoAmbiente: 'meia',
      bloomETiltShift: true,
      dprMaximo: 1.25,
      proporcaoArvores: 0.6,
      maxDrawCallsOrcamento: 320,
      maxTriangulosOrcamento: 1_400_000,
    },
    alta: {
      maxNpcs: 1500,
      resolucaoSombra: 4096,
      cascatasSombra: 3,
      oclusaoAmbiente: 'cheia',
      bloomETiltShift: true,
      dprMaximo: 1.5,
      proporcaoArvores: 1.0,
      maxDrawCallsOrcamento: 400,
      maxTriangulosOrcamento: 2_000_000,
    },
  },
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Calcula dinamicamente `distFit` a partir do raio do mundo e da proporção da tela (Seção 3.1).
 * Nunca retorna um valor fixo: varia tanto com os limites do mundo quanto com o aspect ratio.
 */
export function calcularDistFitMapa(
  raioMapa: number,
  proporcaoTela: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  const r = Math.max(cfg.raioMinimoMapaAbsoluto, raioMapa);
  const aspect = Math.max(0.35, Math.min(4.0, proporcaoTela || 1.6));
  const fovVRad = (cfg.cameraFovGraus * Math.PI) / 180;
  const tanHalfV = Math.tan(fovVRad * 0.5);
  const tanHalfH = tanHalfV * aspect;
  const tanHalfEfetivo = Math.min(tanHalfV, tanHalfH);
  // Distância necessária para que o diâmetro do mundo caiba na menor dimensão angular da tela
  const dist = (r * 0.96) / Math.max(0.15, tanHalfEfetivo);
  return Math.round(dist * 100) / 100;
}

/**
 * Classifica o nível semântico da câmera (`imperio`, `setor`, `cidade`, `rua`)
 * pela razão `d / distFit` (Seção 3.1).
 */
export function obterNivelSemanticoCamera(
  distancia: number,
  distFit: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): NivelSemanticoCamera {
  const razao = distancia / Math.max(1, distFit);
  if (razao >= cfg.limiaresRazaoDistFit.imperioMin) return 'imperio';
  if (razao >= cfg.limiaresRazaoDistFit.setorMin) return 'setor';
  if (razao >= cfg.limiaresRazaoDistFit.cidadeMin) return 'cidade';
  return 'rua';
}

export function obterRotuloNivelSemantico(nivel: NivelSemanticoCamera): string {
  switch (nivel) {
    case 'imperio':
      return 'Império';
    case 'setor':
      return 'Setor';
    case 'cidade':
      return 'Cidade e bairro';
    case 'rua':
      return 'Rua';
  }
}

/**
 * Calcula a inclinação da câmera em graus seguindo uma curva suave (`smoothstep` sobre
 * o logaritmo de `d / distFit`) conforme Seção 3.1:
 * - Rua (`r <= 0.04`): ~32°
 * - Cidade e bairro (`0.04..0.15`): 38° a 55°
 * - Setor (`0.15..0.45`): 55° a 70°
 * - Império (`r >= 0.45`): ~70°
 */
export function calcularInclinacaoSuaveCameraGraus(
  distancia: number,
  distFit: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  const razao = Math.max(0.008, Math.min(1.5, distancia / Math.max(1, distFit)));
  const logR = Math.log(razao);
  const logRua = Math.log(0.025);
  const logCidadeMin = Math.log(cfg.limiaresRazaoDistFit.cidadeMin);
  const logSetorMin = Math.log(cfg.limiaresRazaoDistFit.setorMin);
  const logImperioMin = Math.log(cfg.limiaresRazaoDistFit.imperioMin);

  if (logR <= logCidadeMin) {
    const t = smoothstep(logRua, logCidadeMin, logR);
    return cfg.cameraElevacaoRuaGraus + t * (cfg.cameraElevacaoCidadeMinGraus - cfg.cameraElevacaoRuaGraus);
  }
  if (logR <= logSetorMin) {
    const t = smoothstep(logCidadeMin, logSetorMin, logR);
    return cfg.cameraElevacaoCidadeMinGraus + t * (cfg.cameraElevacaoCidadeMaxGraus - cfg.cameraElevacaoCidadeMinGraus);
  }
  if (logR <= logImperioMin) {
    const t = smoothstep(logSetorMin, logImperioMin, logR);
    return cfg.cameraElevacaoCidadeMaxGraus + t * (cfg.cameraElevacaoSetorMaxGraus - cfg.cameraElevacaoCidadeMaxGraus);
  }
  return cfg.cameraElevacaoImperioGraus;
}

/**
 * Fórmula da Seção 3.2 para duração de voo da câmera (`voarAte`):
 * Duração = clamp(0.6 + 0.35 * log2(1 + dist / d_rua), 0.6, 2.2) s
 */
export function calcularDuracaoVooSegundos(
  distanciaDeslocamento: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  const dRua = Math.max(1, cfg.cameraDistanciaRuaRef);
  const bruto =
    cfg.vooDuracaoMinSegundos +
    cfg.vooFatorLog * Math.log2(1 + Math.max(0, distanciaDeslocamento) / dRua);
  return Math.max(
    cfg.vooDuracaoMinSegundos,
    Math.min(cfg.vooDuracaoMaxSegundos, Math.round(bruto * 1000) / 1000)
  );
}

/**
 * Calcula o raio da cidade (14 u no nível 1 até 44 u no nível 7) com crescimento suave.
 */
export function obterRaioCidadePorNivel(
  nivel: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  if (nivel <= 0) return cfg.cidadeRaioRuinas;
  const nClamp = Math.max(1, Math.min(7, nivel));
  const t = (nClamp - 1) / 6;
  return Math.round((cfg.cidadeRaioMinimo + t * (cfg.cidadeRaioMaximo - cfg.cidadeRaioMinimo)) * 100) / 100;
}

/**
 * Determina o nível da Metrópole Central (0 a 4) com base na receita mensal total (em centavos)
 * e no número de lojas abertas/ativas.
 */
export function calcularNivelMetropole(
  receitaTotalMensalCentavos: number,
  lojasAtivas: number,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): 0 | 1 | 2 | 3 | 4 {
  let nivelAlcancado: 0 | 1 | 2 | 3 | 4 = 0;
  for (const limiar of cfg.limiaresNivelMetropole) {
    if (
      receitaTotalMensalCentavos >= limiar.receitaTotalMensalCentavos &&
      lojasAtivas >= limiar.minimoLojasAtivas
    ) {
      nivelAlcancado = limiar.nivel;
    }
  }
  return nivelAlcancado;
}

/**
 * Calcula o raio da Metrópole Central (140 u no nível 0 até 200 u no nível 4).
 */
export function obterRaioMetropolePorNivel(
  nivel: 0 | 1 | 2 | 3 | 4,
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  const t = nivel / 4;
  return Math.round((cfg.metropoleRaioBase + t * (cfg.metropoleRaioMaximo - cfg.metropoleRaioBase)) * 100) / 100;
}

/**
 * Retorna a medida em unidades de mundo (u) para o tamanho da loja ('P' | 'M' | 'G').
 */
export function obterMedidaLojaPorTamanho(
  tamanho: 'P' | 'M' | 'G',
  cfg: ConfigLayoutMapa = LAYOUT_PADRAO
): number {
  if (tamanho === 'G') return cfg.lojaTamanhoG;
  if (tamanho === 'M') return cfg.lojaTamanhoM;
  return cfg.lojaTamanhoP;
}

export const OPCOES_TIPO_LOJA: ReadonlyArray<{
  chave: string;
  titulo: string;
  iconePadrao: string;
}> = [
  { chave: 'padaria', titulo: 'Padaria (Produção alimentícia)', iconePadrao: 'pao' },
  { chave: 'acougue', titulo: 'Açougue (Carnes & Derivados)', iconePadrao: 'carne' },
  { chave: 'taverna', titulo: 'Taverna (Bebidas)', iconePadrao: 'barril' },
  { chave: 'armazem_graos', titulo: 'Armazém de Grãos (Agricultura)', iconePadrao: 'saco_graos' },
  { chave: 'ferraria', titulo: 'Ferraria (Automação & Robótica)', iconePadrao: 'engrenagem' },
  { chave: 'laboratorio_alquimista', titulo: 'Laboratório do Alquimista (Química)', iconePadrao: 'frasco' },
  { chave: 'casa_escribas', titulo: 'Casa dos Escribas (Software)', iconePadrao: 'pergaminho' },
  { chave: 'balanca_cambio', titulo: 'Balança de Câmbio (Comércio)', iconePadrao: 'balanca' },
  { chave: 'banca_generica', titulo: 'Banca Genérica', iconePadrao: 'caixa' },
];

export const OPCOES_ICONE_PRODUTO: ReadonlyArray<{
  chave: string;
  rotulo: string;
  simbolo: string;
}> = [
  { chave: 'pao', rotulo: 'Pão & Massas', simbolo: '🥖' },
  { chave: 'carne', rotulo: 'Carnes & Embutidos', simbolo: '🥩' },
  { chave: 'barril', rotulo: 'Barril / Bebidas', simbolo: '🛢️' },
  { chave: 'saco_graos', rotulo: 'Saco de Grãos', simbolo: '🌾' },
  { chave: 'engrenagem', rotulo: 'Engrenagem / Automação', simbolo: '⚙️' },
  { chave: 'frasco', rotulo: 'Frasco / Química', simbolo: '⚗️' },
  { chave: 'pergaminho', rotulo: 'Pergaminho / Software', simbolo: '📜' },
  { chave: 'balanca', rotulo: 'Balança / Comércio', simbolo: '⚖️' },
  { chave: 'caixa', rotulo: 'Caixa / Mercadoria Geral', simbolo: '📦' },
];

