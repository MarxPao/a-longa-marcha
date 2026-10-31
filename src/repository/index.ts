import type { SementeTerreno } from '../domain';

/**
 * Fase 0 — Contrato mínimo de persistência da semente.
 * A interface completa Repository e as 17 entidades entram na Fase 1.
 */
export interface LeitorSementeInicial {
  obterSementePadrao(): SementeTerreno;
}
