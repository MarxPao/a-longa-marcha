import * as THREE from 'three';
import type { Projeto, UUID } from '../domain';
import type { DerivadosProjeto, ResultadoFase } from '../engine';
import {
  construirGeometriasCidades,
  type NivelMaturidadeVisual,
} from './cidadesGeometria';
import {
  calcularCorCidadePorLente,
  type DadosContextoLente,
} from './lentesCores';

export interface InfoInstanciaCidade {
  projetoId: UUID;
  nivel: NivelMaturidadeVisual;
  indiceInstancia: number;
  x: number;
  y: number;
  z: number;
}

export class GerenciadorCidadesInstanciadas {
  private readonly cena: THREE.Scene;
  private readonly geometrias: Record<NivelMaturidadeVisual, THREE.BufferGeometry>;
  private readonly materialCidades: THREE.MeshStandardMaterial;
  private malhasInstanciadas: Map<NivelMaturidadeVisual, THREE.InstancedMesh> = new Map();
  private capacidades: Map<NivelMaturidadeVisual, number> = new Map();

  // Mapeamento bidirecional para seleção e raycasting O(1)
  private instanciasPorProjetoId: Map<UUID, InfoInstanciaCidade> = new Map();
  private projetosPorChaveMalha: Map<string, UUID> = new Map();

  // Indicador visual de cidade selecionada (Anel luminoso de jade/ouro)
  private indicadorSelecao: THREE.Mesh | null = null;

  // Luz azul de P&D em InstancedMesh para cidades com tecnologias aplicadas (Fase 7)
  private malhaLuzesPd: THREE.InstancedMesh | null = null;
  private capacidadeLuzesPd = 64;

  constructor(cena: THREE.Scene) {
    this.cena = cena;
    this.geometrias = construirGeometriasCidades();

    this.materialCidades = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.15,
      vertexColors: true,
    });

    this.inicializarMalhas();
    this.criarIndicadorSelecao();
    this.criarMalhaLuzesPd(this.capacidadeLuzesPd);
  }

  private inicializarMalhas(): void {
    const niveis: NivelMaturidadeVisual[] = [1, 2, 3, 4, 5, 6, 7, 0];
    const capacidadePadrao = 64;

    for (const nivel of niveis) {
      const geo = this.geometrias[nivel];
      const instMesh = new THREE.InstancedMesh(geo, this.materialCidades, capacidadePadrao);
      instMesh.name = `cidades-instanciadas-nivel-${nivel}`;
      instMesh.count = 0;
      instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (instMesh.instanceColor) {
        instMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }

      this.cena.add(instMesh);
      this.malhasInstanciadas.set(nivel, instMesh);
      this.capacidades.set(nivel, capacidadePadrao);
    }
  }

  private criarIndicadorSelecao(): void {
    const geoAnel = new THREE.TorusGeometry(3.6, 0.28, 8, 32);
    geoAnel.rotateX(Math.PI / 2);

    const matAnel = new THREE.MeshBasicMaterial({
      color: '#B8923A',
      transparent: true,
      opacity: 0.9,
    });

    this.indicadorSelecao = new THREE.Mesh(geoAnel, matAnel);
    this.indicadorSelecao.name = 'indicador-selecao-cidade';
    this.indicadorSelecao.visible = false;
    this.cena.add(this.indicadorSelecao);
  }

  private criarMalhaLuzesPd(capacidade: number): void {
    if (this.malhaLuzesPd) {
      this.cena.remove(this.malhaLuzesPd);
      this.malhaLuzesPd.geometry.dispose();
      (this.malhaLuzesPd.material as THREE.Material).dispose();
    }

    const geoHalo = new THREE.TorusGeometry(2.6, 0.22, 8, 24);
    geoHalo.rotateX(Math.PI / 2);

    const matHalo = new THREE.MeshBasicMaterial({
      color: '#3182CE',
      transparent: true,
      opacity: 0.9,
    });

    this.malhaLuzesPd = new THREE.InstancedMesh(geoHalo, matHalo, capacidade);
    this.malhaLuzesPd.name = 'luzes-azuis-pd-cidades';
    this.malhaLuzesPd.count = 0;
    this.malhaLuzesPd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cena.add(this.malhaLuzesPd);
    this.capacidadeLuzesPd = capacidade;
  }

  private garantirCapacidade(nivel: NivelMaturidadeVisual, quantidadeNecessaria: number): void {
    const capAtual = this.capacidades.get(nivel) ?? 64;
    if (quantidadeNecessaria <= capAtual) return;

    let novaCap = capAtual;
    while (novaCap < quantidadeNecessaria) {
      novaCap *= 2;
    }

    const malhaAntiga = this.malhasInstanciadas.get(nivel);
    if (malhaAntiga) {
      this.cena.remove(malhaAntiga);
      malhaAntiga.dispose();
    }

    const geo = this.geometrias[nivel];
    const novaMalha = new THREE.InstancedMesh(geo, this.materialCidades, novaCap);
    novaMalha.name = `cidades-instanciadas-nivel-${nivel}`;
    novaMalha.count = 0;
    novaMalha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (novaMalha.instanceColor) {
      novaMalha.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }

    this.cena.add(novaMalha);
    this.malhasInstanciadas.set(nivel, novaMalha);
    this.capacidades.set(nivel, novaCap);
  }

  public mapearFaseParaNivel(
    fase: ResultadoFase | undefined,
    estaArquivado: boolean
  ): NivelMaturidadeVisual {
    if (estaArquivado) return 0;
    const num = fase?.fase;
    if (
      num === 1 ||
      num === 2 ||
      num === 3 ||
      num === 4 ||
      num === 5 ||
      num === 6 ||
      num === 7
    ) {
      return num;
    }
    return 1;
  }

  public atualizarCidades(
    projetos: Projeto[],
    derivados: Map<UUID, DerivadosProjeto>,
    obterAlturaTerreno: (x: number, z: number) => number,
    projetoSelecionadoId: UUID | null,
    contextoLente?: DadosContextoLente
  ): void {
    this.instanciasPorProjetoId.clear();
    this.projetosPorChaveMalha.clear();

    // Agrupa projetos ativos pelo nível visual
    const grupos = new Map<NivelMaturidadeVisual, Projeto[]>();
    const niveis: NivelMaturidadeVisual[] = [1, 2, 3, 4, 5, 6, 7, 0];
    for (const n of niveis) grupos.set(n, []);

    for (const proj of projetos) {
      const infoDerivado = derivados.get(proj.id);
      const nivel = this.mapearFaseParaNivel(infoDerivado?.fase, proj.arquivadoEm !== null);
      grupos.get(nivel)?.push(proj);
    }

    const matrixTemp = new THREE.Matrix4();
    const posTemp = new THREE.Vector3();
    const rotTemp = new THREE.Euler();
    const quatTemp = new THREE.Quaternion();
    const scaleTemp = new THREE.Vector3(1, 1, 1);
    const corTemp = new THREE.Color();

    let posSelecionado: { x: number; y: number; z: number } | null = null;

    for (const nivel of niveis) {
      const listaProjetos = grupos.get(nivel) || [];
      this.garantirCapacidade(nivel, listaProjetos.length);
      const malha = this.malhasInstanciadas.get(nivel);
      if (!malha) continue;

      malha.count = listaProjetos.length;

      for (let i = 0; i < listaProjetos.length; i++) {
        const p = listaProjetos[i]!;
        const y = obterAlturaTerreno(p.x, p.z);

        // Variação determinística leve de rotação pelo hash do ID
        let hash = 0;
        for (let c = 0; c < p.id.length; c++) {
          hash = (hash * 31 + p.id.charCodeAt(c)) & 0xffff;
        }
        const anguloRotacao = (hash / 0xffff) * Math.PI * 0.5 - Math.PI * 0.25;

        posTemp.set(p.x, y, p.z);
        rotTemp.set(0, anguloRotacao, 0);
        quatTemp.setFromEuler(rotTemp);

        // Escala proporcional ao nível de maturidade
        const fatorEscala = nivel === 0 ? 0.9 : 0.85 + nivel * 0.08;
        scaleTemp.set(fatorEscala, fatorEscala, fatorEscala);

        matrixTemp.compose(posTemp, quatTemp, scaleTemp);
        malha.setMatrixAt(i, matrixTemp);

        // Determinação da cor pela lente ativa (Seção 4.6)
        if (contextoLente) {
          const corHex = calcularCorCidadePorLente(p, contextoLente);
          corTemp.set(corHex);
        } else {
          const saude = derivados.get(p.id)?.saude.pontuacao ?? 100;
          if (nivel === 0) {
            corTemp.set('#5A554E'); // Ruínas
          } else if (saude >= 70) {
            corTemp.set('#3E7C68'); // Saudável: Jade
          } else if (saude >= 40) {
            corTemp.set('#D09B2C'); // Atenção: Âmbar
          } else {
            corTemp.set('#8E1F1A'); // Crítico: Laca
          }
        }
        malha.setColorAt(i, corTemp);

        // Registro de consulta
        const info: InfoInstanciaCidade = {
          projetoId: p.id,
          nivel,
          indiceInstancia: i,
          x: p.x,
          y,
          z: p.z,
        };
        this.instanciasPorProjetoId.set(p.id, info);
        this.projetosPorChaveMalha.set(`${nivel}:${i}`, p.id);

        if (p.id === projetoSelecionadoId) {
          posSelecionado = { x: p.x, y, z: p.z };
        }
      }

      malha.instanceMatrix.needsUpdate = true;
      if (malha.instanceColor) {
        malha.instanceColor.needsUpdate = true;
      }
    }

    // Atualiza anel indicador de seleção
    if (this.indicadorSelecao) {
      if (posSelecionado) {
        this.indicadorSelecao.position.set(
          posSelecionado.x,
          posSelecionado.y + 0.15,
          posSelecionado.z
        );
        this.indicadorSelecao.visible = true;
      } else {
        this.indicadorSelecao.visible = false;
      }
    }

    // Atualiza luz azul de P&D nas cidades com tecnologias aplicadas (Fase 7)
    const idsComPd = new Set<UUID>();
    for (const ap of contextoLente?.aplicacoes ?? []) {
      if (ap.arquivadoEm === null) {
        idsComPd.add(ap.projetoId);
      }
    }

    const projetosComPd = projetos.filter(
      (p) => p.arquivadoEm === null && idsComPd.has(p.id)
    );
    if (projetosComPd.length > this.capacidadeLuzesPd) {
      let novaCap = this.capacidadeLuzesPd;
      while (novaCap < projetosComPd.length) novaCap *= 2;
      this.criarMalhaLuzesPd(novaCap);
    }

    if (this.malhaLuzesPd) {
      this.malhaLuzesPd.count = projetosComPd.length;
      const matLuz = new THREE.Matrix4();
      for (let i = 0; i < projetosComPd.length; i++) {
        const p = projetosComPd[i]!;
        const y = obterAlturaTerreno(p.x, p.z);
        matLuz.makeTranslation(p.x, y + 3.2, p.z);
        this.malhaLuzesPd.setMatrixAt(i, matLuz);
      }
      this.malhaLuzesPd.instanceMatrix.needsUpdate = true;
    }
  }

  public obterTotalLuzesPdAtivas(): number {
    return this.malhaLuzesPd?.count ?? 0;
  }

  public obterProjetoPorInstancia(
    nivel: NivelMaturidadeVisual,
    indiceInstancia: number
  ): UUID | undefined {
    return this.projetosPorChaveMalha.get(`${nivel}:${indiceInstancia}`);
  }

  public obterInfoInstancia(projetoId: UUID): InfoInstanciaCidade | undefined {
    return this.instanciasPorProjetoId.get(projetoId);
  }

  public destruir(): void {
    for (const malha of this.malhasInstanciadas.values()) {
      this.cena.remove(malha);
      malha.dispose();
    }
    this.malhasInstanciadas.clear();

    if (this.indicadorSelecao) {
      this.cena.remove(this.indicadorSelecao);
      this.indicadorSelecao.geometry.dispose();
      (this.indicadorSelecao.material as THREE.Material).dispose();
      this.indicadorSelecao = null;
    }

    if (this.malhaLuzesPd) {
      this.cena.remove(this.malhaLuzesPd);
      this.malhaLuzesPd.geometry.dispose();
      (this.malhaLuzesPd.material as THREE.Material).dispose();
      this.malhaLuzesPd = null;
    }

    for (const geo of Object.values(this.geometrias)) {
      geo.dispose();
    }
    this.materialCidades.dispose();
  }
}
