import { create } from 'zustand';
import {
  EsquemaSementeTerreno,
  type MetricasTerrenoGerado,
  type SementeTerreno,
} from '../domain';
import { amostrarTerrenoPorSemente, gerarHashSemente } from '../engine';

export interface EstadoTerrenoFase0 {
  semente: SementeTerreno;
  erroValidacao: string | null;
  metricas: MetricasTerrenoGerado;
  definirSemente: (novaSemente: string) => boolean;
  sortearSemente: () => void;
  atualizarMetricasMalha: (
    metricasParciais: Partial<
      Pick<MetricasTerrenoGerado, 'vertices' | 'cotaMinima' | 'cotaMaxima' | 'rotaTerreno'>
    >
  ) => void;
}

const SEMENTE_PADRAO: SementeTerreno = 'longa-marcha-2026';

function calcularMetricasIniciais(semente: SementeTerreno): MetricasTerrenoGerado {
  const hashNumerico = gerarHashSemente(semente);
  let cotaMinima = Infinity;
  let cotaMaxima = -Infinity;

  for (let gx = -60; gx <= 60; gx += 15) {
    for (let gz = -60; gz <= 60; gz += 15) {
      const amostra = amostrarTerrenoPorSemente(gx, gz, semente);
      if (amostra.altura < cotaMinima) cotaMinima = amostra.altura;
      if (amostra.altura > cotaMaxima) cotaMaxima = amostra.altura;
    }
  }

  return {
    semente,
    hashNumerico,
    vertices: 16641,
    cotaMinima: Math.round(cotaMinima * 100) / 100,
    cotaMaxima: Math.round(cotaMaxima * 100) / 100,
    rotaTerreno: 'rota-b-glb-heightmap',
  };
}

const SEMENTES_CATALOGO: readonly SementeTerreno[] = [
  'longa-marcha-2026',
  'rio-amarelo-karst',
  'tres-reinos-jade',
  'passo-de-hulao',
  'vales-de-shu-han',
  'planicie-central-wei',
  ' foz-do-yangtze-wu',
];

export const useTerrenoFase0Store = create<EstadoTerrenoFase0>((set, get) => ({
  semente: SEMENTE_PADRAO,
  erroValidacao: null,
  metricas: calcularMetricasIniciais(SEMENTE_PADRAO),

  definirSemente: (novaSemente: string): boolean => {
    const validacao = EsquemaSementeTerreno.safeParse(novaSemente);
    if (!validacao.success) {
      const mensagem = validacao.error.issues[0]?.message ?? 'Semente inválida';
      set({ erroValidacao: mensagem });
      return false;
    }
    const sementeValida = validacao.data;
    set({
      semente: sementeValida,
      erroValidacao: null,
      metricas: calcularMetricasIniciais(sementeValida),
    });
    return true;
  },

  sortearSemente: (): void => {
    const atual = get().semente;
    const candidatas = SEMENTES_CATALOGO.filter((s) => s.trim() !== atual);
    const indice = gerarHashSemente(`${atual}-${Date.now()}`) % candidatas.length;
    const escolhida = (candidatas[indice] ?? 'longa-marcha-2026').trim();
    get().definirSemente(escolhida);
  },

  atualizarMetricasMalha: (metricasParciais): void => {
    set((estado) => ({
      metricas: {
        ...estado.metricas,
        ...metricasParciais,
      },
    }));
  },
}));
