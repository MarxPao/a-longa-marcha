import { z } from 'zod';

/**
 * Fase 0 — Contrato mínimo de semente do terreno (sem entidades de negócio, que pertencem à Fase 1).
 */
export const EsquemaSementeTerreno = z
  .string()
  .trim()
  .min(1, 'A semente não pode ser vazia')
  .max(64, 'A semente deve ter no máximo 64 caracteres');

export type SementeTerreno = z.infer<typeof EsquemaSementeTerreno>;

export interface AmostraRelevo {
  readonly x: number;
  readonly z: number;
  readonly altura: number;
  readonly biomaVisual: 'agua' | 'vale_rio' | 'planicie' | 'colina_karst' | 'pico_rochoso';
}

export interface MetricasTerrenoGerado {
  readonly semente: SementeTerreno;
  readonly hashNumerico: number;
  readonly vertices: number;
  readonly cotaMinima: number;
  readonly cotaMaxima: number;
  readonly rotaTerreno: 'rota-a-pacote' | 'rota-b-glb-heightmap';
}
