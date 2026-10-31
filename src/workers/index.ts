import { gerarHashSemente } from '../engine';
import type { SementeTerreno } from '../domain';

export function calcularHashWorker(semente: SementeTerreno): number {
  return gerarHashSemente(semente);
}
