import * as THREE from 'three';
import { LAYOUT_PADRAO, PALETA_MAPA } from '../config/layout';

export type PresetHoraDia = 'dia_mercado' | 'entardecer' | 'noite_lanternas';

export interface ParametrosPresetHora {
  solCor: string;
  solIntensidade: number;
  solElevacaoGraus: number;
  solAzimuteGraus: number;
  luzCeuCor: string;
  luzChaoCor: string;
  luzHemisfericaIntensidade: number;
  nevoaCor: string;
  nevoaDensidade: number;
  ceugradienteCeu: string;
  ceugradienteHorizonte: string;
  intensidadeLanternas: number;
  emissaoJanelas: number;
}

export const PRESETS_HORA_DO_DIA: Record<PresetHoraDia, ParametrosPresetHora> = {
  dia_mercado: {
    solCor: '#FFF3D6',
    solIntensidade: 1.45,
    solElevacaoGraus: 32,
    solAzimuteGraus: 40,
    luzCeuCor: '#E8DCC0',
    luzChaoCor: '#7A5A2B',
    luzHemisfericaIntensidade: 1.10,
    nevoaCor: '#E8DCC0',
    nevoaDensidade: 0.00042,
    ceugradienteCeu: '#D2C4A3',
    ceugradienteHorizonte: '#E8DCC0',
    intensidadeLanternas: 0.2,
    emissaoJanelas: 0.1,
  },
  entardecer: {
    solCor: '#FFA450',
    solIntensidade: 1.6,
    solElevacaoGraus: 18,
    solAzimuteGraus: 65,
    luzCeuCor: '#D49272',
    luzChaoCor: '#5A3825',
    luzHemisfericaIntensidade: 0.85,
    nevoaCor: '#C79075',
    nevoaDensidade: 0.00055,
    ceugradienteCeu: '#70425E',
    ceugradienteHorizonte: '#E59263',
    intensidadeLanternas: 0.85,
    emissaoJanelas: 0.7,
  },
  noite_lanternas: {
    solCor: '#3B4E7A',
    solIntensidade: 0.45,
    solElevacaoGraus: 25,
    solAzimuteGraus: 200,
    luzCeuCor: '#1B243B',
    luzChaoCor: '#141724',
    luzHemisfericaIntensidade: 0.55,
    nevoaCor: '#161B2B',
    nevoaDensidade: 0.00075,
    ceugradienteCeu: '#0D111A',
    ceugradienteHorizonte: '#1C2436',
    intensidadeLanternas: 1.8,
    emissaoJanelas: 1.0,
  },
};

/**
 * Gerencia iluminação direcional rasante (25°–35°), skydome procedural com gradiente,
 * névoa volumétrica e ciclo com os 3 presets (Seção 5.1).
 */
export class GerenciadorLuzAtmosfera {
  private cena: THREE.Scene;
  private luzHemisferica: THREE.HemisphereLight;
  private luzSol: THREE.DirectionalLight;
  private skydome: THREE.Mesh;
  private presetAtual: PresetHoraDia = 'dia_mercado';
  private luzesLanternas: THREE.PointLight[] = [];

  constructor(cena: THREE.Scene) {
    this.cena = cena;

    this.luzHemisferica = new THREE.HemisphereLight(
      PALETA_MAPA.pergaminho,
      PALETA_MAPA.bronze,
      0.95
    );
    this.cena.add(this.luzHemisferica);

    this.luzSol = new THREE.DirectionalLight(PALETA_MAPA.luzSol, 1.45);
    this.luzSol.castShadow = true;
    this.luzSol.shadow.mapSize.width = 2048;
    this.luzSol.shadow.mapSize.height = 2048;
    this.luzSol.shadow.camera.near = 10;
    this.luzSol.shadow.camera.far = 2800;
    this.luzSol.shadow.bias = -0.0002;
    this.luzSol.shadow.normalBias = 0.04;
    this.cena.add(this.luzSol);
    this.cena.add(this.luzSol.target);

    // Skydome procedural com gradiente e nuvens de tinta
    const geoCeu = new THREE.SphereGeometry(3800, 32, 24);
    const matCeu = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        corCeu: { value: new THREE.Color('#D2C4A3') },
        corHorizonte: { value: new THREE.Color('#E8DCC0') },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 corCeu;
        uniform vec3 corHorizonte;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = clamp(h * 3.5, 0.0, 1.0);
          vec3 finalCor = mix(corHorizonte, corCeu, t);
          gl_FragColor = vec4(finalCor, 1.0);
        }
      `,
    });
    this.skydome = new THREE.Mesh(geoCeu, matCeu);
    this.cena.add(this.skydome);

    // Pool de até 8 luzes pontuais para lanternas mais próximas (Seção 5.5)
    for (let i = 0; i < LAYOUT_PADRAO.maxLuzesLanternaReais; i++) {
      const pl = new THREE.PointLight('#FFB85A', 0, 45, 1.8);
      pl.visible = false;
      this.cena.add(pl);
      this.luzesLanternas.push(pl);
    }

    this.aplicarPreset('dia_mercado');
  }

  public aplicarPreset(presetNome: PresetHoraDia): void {
    this.presetAtual = presetNome;
    const p = PRESETS_HORA_DO_DIA[presetNome];

    this.luzHemisferica.color.set(p.luzCeuCor);
    this.luzHemisferica.groundColor.set(p.luzChaoCor);
    this.luzHemisferica.intensity = p.luzHemisfericaIntensidade;

    this.luzSol.color.set(p.solCor);
    this.luzSol.intensity = p.solIntensidade;

    // Converte elevação (25° a 35°) e azimute da luz solar
    const elevRad = (p.solElevacaoGraus * Math.PI) / 180;
    const azRad = (p.solAzimuteGraus * Math.PI) / 180;
    const distSol = 1200;
    const sx = distSol * Math.cos(elevRad) * Math.sin(azRad);
    const sy = distSol * Math.sin(elevRad);
    const sz = distSol * Math.cos(elevRad) * Math.cos(azRad);
    this.luzSol.position.set(sx, sy, sz);

    // Atualiza skydome e névoa
    this.cena.background = new THREE.Color(p.nevoaCor);
    this.cena.fog = new THREE.FogExp2(p.nevoaCor, p.nevoaDensidade);

    const mat = this.skydome.material as THREE.ShaderMaterial;
    if (mat.uniforms?.corCeu && mat.uniforms?.corHorizonte) {
      mat.uniforms.corCeu.value.set(p.ceugradienteCeu);
      mat.uniforms.corHorizonte.value.set(p.ceugradienteHorizonte);
    }
  }

  /**
   * Ajusta o frustum ortográfico da sombra direcional e faz texel snapping
   * contra o ponto focal e distância da câmera para eliminar completamente o shadow swimming.
   */
  public ajustarSombraTexelSnapping(
    cameraAlvo: THREE.Vector3,
    cameraDistancia: number,
    qualidade: 'baixa' | 'media' | 'alta'
  ): void {
    const resolucao = LAYOUT_PADRAO.perfisQualidade[qualidade].resolucaoSombra;
    this.luzSol.shadow.mapSize.width = resolucao;
    this.luzSol.shadow.mapSize.height = resolucao;

    const span = Math.max(160, Math.min(1800, cameraDistancia * 1.6));
    const camSombra = this.luzSol.shadow.camera;
    camSombra.left = -span;
    camSombra.right = span;
    camSombra.top = span;
    camSombra.bottom = -span;

    // Texel snapping em espaço de sombra
    const texelTamanho = (span * 2) / resolucao;
    const alvoSnapX = Math.floor(cameraAlvo.x / texelTamanho) * texelTamanho;
    const alvoSnapZ = Math.floor(cameraAlvo.z / texelTamanho) * texelTamanho;

    this.luzSol.target.position.set(alvoSnapX, 0, alvoSnapZ);
    this.luzSol.target.updateMatrixWorld();

    const p = PRESETS_HORA_DO_DIA[this.presetAtual];
    const elevRad = (p.solElevacaoGraus * Math.PI) / 180;
    const azRad = (p.solAzimuteGraus * Math.PI) / 180;
    const distSol = 1100;
    this.luzSol.position.set(
      alvoSnapX + distSol * Math.cos(elevRad) * Math.sin(azRad),
      sySol(elevRad, distSol),
      alvoSnapZ + distSol * Math.cos(elevRad) * Math.cos(azRad)
    );
    camSombra.updateProjectionMatrix();
  }

  public obterPresetAtual(): PresetHoraDia {
    return this.presetAtual;
  }

  public destruir(): void {
    this.cena.remove(this.luzHemisferica);
    this.cena.remove(this.luzSol);
    this.cena.remove(this.luzSol.target);
    this.cena.remove(this.skydome);
    this.skydome.geometry.dispose();
    (this.skydome.material as THREE.Material).dispose();
    for (const pl of this.luzesLanternas) {
      this.cena.remove(pl);
      pl.dispose();
    }
  }
}

function sySol(elevRad: number, dist: number): number {
  return Math.max(220, dist * Math.sin(elevRad));
}
