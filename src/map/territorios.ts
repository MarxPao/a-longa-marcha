import * as THREE from 'three';
import type { Setor } from '../domain';

export function pontoEstaDentroDoPoligono(
  x: number,
  z: number,
  poligono: [number, number][]
): boolean {
  if (poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i]![0];
    const zi = poligono[i]![1];
    const xj = poligono[j]![0];
    const zj = poligono[j]![1];

    const intersecta =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 0.000001) + xi;
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}

export class GerenciadorTerritorios {
  private readonly cena: THREE.Scene;
  private linhasTerritorios: THREE.LineLoop[] = [];
  private grupoTerritorios: THREE.Group;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.grupoTerritorios = new THREE.Group();
    this.grupoTerritorios.name = 'grupo-territorios-setores';
    this.cena.add(this.grupoTerritorios);
  }

  public atualizarTerritorios(
    setores: Setor[],
    obterAlturaTerreno: (x: number, z: number) => number
  ): void {
    this.limpar();

    for (const setor of setores) {
      if (setor.arquivadoEm !== null || setor.regiao.length < 3) continue;

      const pontosSubdivididos: THREE.Vector3[] = [];
      const tam = setor.regiao.length;

      for (let i = 0; i < tam; i++) {
        const p1 = setor.regiao[i]!;
        const p2 = setor.regiao[(i + 1) % tam]!;

        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const distancia = Math.sqrt(dx * dx + dz * dz);
        const passos = Math.max(1, Math.ceil(distancia / 4));

        for (let s = 0; s < passos; s++) {
          const t = s / passos;
          const x = p1[0] + dx * t;
          const z = p1[1] + dz * t;
          const y = obterAlturaTerreno(x, z) + 0.25;
          pontosSubdivididos.push(new THREE.Vector3(x, y, z));
        }
      }

      if (pontosSubdivididos.length < 3) continue;

      const geometria = new THREE.BufferGeometry().setFromPoints(pontosSubdivididos);
      const material = new THREE.LineBasicMaterial({
        color: setor.cor || '#7FA35A',
        linewidth: 2,
        transparent: true,
        opacity: 0.75,
      });

      const linhaLoop = new THREE.LineLoop(geometria, material);
      linhaLoop.name = `territorio-setor-${setor.id}`;
      this.linhasTerritorios.push(linhaLoop);
      this.grupoTerritorios.add(linhaLoop);
    }
  }

  public encontrarSetorPorCoordenadas(
    x: number,
    z: number,
    setores: Setor[]
  ): Setor | null {
    for (const setor of setores) {
      if (setor.arquivadoEm === null && pontoEstaDentroDoPoligono(x, z, setor.regiao)) {
        return setor;
      }
    }
    return null;
  }

  public limpar(): void {
    for (const linha of this.linhasTerritorios) {
      this.grupoTerritorios.remove(linha);
      linha.geometry.dispose();
      (linha.material as THREE.Material).dispose();
    }
    this.linhasTerritorios = [];
  }

  public destruir(): void {
    this.limpar();
    this.cena.remove(this.grupoTerritorios);
  }
}
