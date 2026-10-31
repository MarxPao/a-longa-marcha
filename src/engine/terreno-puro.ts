import type { AmostraRelevo, SementeTerreno } from '../domain';

/**
 * Converte uma string de semente em um inteiro de 32 bits sem sinal determinístico (FNV-1a).
 * Função 100% pura, sem dependências externas.
 */
export function gerarHashSemente(semente: SementeTerreno): number {
  let hash = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    hash ^= semente.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Ruído pseudoaleatório 2D determinístico baseado na semente numérica.
 */
function ruidoGradiente2D(x: number, z: number, sementeHash: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;

  const suavizar = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const u = suavizar(xf);
  const v = suavizar(zf);

  const hashPonto = (px: number, pz: number): number => {
    let h = (px * 374761393 + pz * 668265263 + sementeHash) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  const n00 = hashPonto(xi, zi);
  const n10 = hashPonto(xi + 1, zi);
  const n01 = hashPonto(xi, zi + 1);
  const n11 = hashPonto(xi + 1, zi + 1);

  const nx0 = n00 + u * (n10 - n00);
  const nx1 = n01 + u * (n11 - n01);
  return (nx0 + v * (nx1 - nx0)) * 2 - 1;
}

/**
 * Calcula a altura e o bioma visual de um ponto (x, z) no mapa de campanha estilo Three Kingdoms
 * (relevo de karst, vales de rios e planícies costeiras).
 */
export function amostrarTerrenoPorSemente(
  x: number,
  z: number,
  semente: SementeTerreno
): AmostraRelevo {
  const hash = gerarHashSemente(semente);
  const escalaBase = 0.018;

  // FBM de 4 oitavas
  let amplitude = 1.0;
  let frequencia = escalaBase;
  let soma = 0;
  let normalizador = 0;

  for (let oitava = 0; oitava < 4; oitava++) {
    soma += amplitude * ruidoGradiente2D(x * frequencia, z * frequencia, hash + oitava * 1013);
    normalizador += amplitude;
    amplitude *= 0.5;
    frequencia *= 2.05;
  }

  const fbm = soma / normalizador;

  // Cristas de Karst (relevo escarpado característico de Guilin / Three Kingdoms)
  const cristaBruta = 1 - Math.abs(ruidoGradiente2D(x * 0.024, z * 0.024, hash ^ 0x9e3779b9));
  const karst = Math.pow(Math.max(0, cristaBruta), 2.6) * 18;

  // Vale de rio serpenteante principal
  const deslocamentoRio = ruidoGradiente2D(z * 0.012, x * 0.008, hash ^ 0x517cc1b7) * 28;
  const distanciaRio = Math.abs(x * 0.65 - z * 0.35 + deslocamentoRio);
  const fatorValeRio = Math.min(1, distanciaRio / 16);

  const alturaBruta = (fbm * 9 + karst) * fatorValeRio - (1 - fatorValeRio) * 2.8;
  const altura = Math.round(alturaBruta * 1000) / 1000;

  let biomaVisual: AmostraRelevo['biomaVisual'] = 'planicie';
  if (altura < -0.6) {
    biomaVisual = 'agua';
  } else if (fatorValeRio < 0.38 || altura < 1.2) {
    biomaVisual = 'vale_rio';
  } else if (altura > 11.5) {
    biomaVisual = 'pico_rochoso';
  } else if (altura > 5.2) {
    biomaVisual = 'colina_karst';
  }

  return { x, z, altura, biomaVisual };
}
