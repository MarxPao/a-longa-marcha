import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  construirGeometriasCidades,
  GerenciadorCidadesInstanciadas,
  GradeEspacial,
  pontoEstaDentroDoPoligono,
  type NivelMaturidadeVisual,
} from '../../src/map';
import type { Setor } from '../../src/domain';

describe('Fase 4 — Submódulos do Mapa 3D (Grade Espacial e Geometrias)', () => {
  describe('GradeEspacial<T>', () => {
    it('insere itens e localiza o mais próximo dentro do raio de tolerância', () => {
      const grade = new GradeEspacial<{ nome: string }>(20);

      grade.inserir('cidade-1', 10, 10, { nome: 'Luoyang' });
      grade.inserir('cidade-2', 50, 50, { nome: 'Chang\'an' });
      grade.inserir('cidade-3', 12, 11, { nome: 'Vila Próxima' });

      expect(grade.totalItens()).toBe(3);

      // Consulta próximo a (10, 10)
      const resultado = grade.buscarMaisProximo(11, 10, 5);
      expect(resultado).not.toBeNull();
      expect(resultado?.item.id).toBe('cidade-1');

      // Consulta no raio
      const itensNoRaio = grade.buscarNoRaio(10, 10, 5);
      expect(itensNoRaio.length).toBe(2); // cidade-1 e cidade-3

      // Consulta fora do raio
      const longe = grade.buscarMaisProximo(100, 100, 10);
      expect(longe).toBeNull();
    });

    it('remove e atualiza itens na grade espacial corretamente', () => {
      const grade = new GradeEspacial<{ valor: number }>(15);
      grade.inserir('proj-1', 0, 0, { valor: 42 });

      expect(grade.obterPorId('proj-1')?.dados.valor).toBe(42);

      // Mover item (reinserção com novas coordenadas)
      grade.inserir('proj-1', 40, 40, { valor: 99 });
      expect(grade.buscarMaisProximo(0, 0, 5)).toBeNull();
      expect(grade.buscarMaisProximo(40, 40, 5)?.item.dados.valor).toBe(99);

      // Remover item
      const removido = grade.remover('proj-1');
      expect(removido).toBe(true);
      expect(grade.totalItens()).toBe(0);
      expect(grade.buscarMaisProximo(40, 40, 5)).toBeNull();
    });
  });

  describe('Geometrias Procedurais das Cidades (Seção 4.3)', () => {
    it('gera malhas válidas com normais e posições para os 7 níveis e Ruínas', () => {
      const geometrias = construirGeometriasCidades();
      const niveis: NivelMaturidadeVisual[] = [1, 2, 3, 4, 5, 6, 7, 0];

      for (const nivel of niveis) {
        const geo = geometrias[nivel];
        expect(geo).toBeInstanceOf(THREE.BufferGeometry);

        const posicoes = geo.getAttribute('position');
        expect(posicoes).toBeDefined();
        expect(posicoes.count).toBeGreaterThan(12);

        const normais = geo.getAttribute('normal');
        expect(normais).toBeDefined();
        expect(normais.count).toBe(posicoes.count);

        // A base do modelo deve repousar no plano y >= 0
        let minY = Infinity;
        for (let i = 0; i < posicoes.count; i++) {
          const y = posicoes.getY(i);
          if (y < minY) minY = y;
        }
        expect(minY).toBeGreaterThanOrEqual(-0.05); // tolerância mínima de ponto flutuante
      }
    });
  });

  describe('Territórios e Ponto em Polígono (Seção 4.2)', () => {
    const poligonoQuadrado: [number, number][] = [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ];

    it('identifica corretamente coordenadas internas e externas ao polígono', () => {
      expect(pontoEstaDentroDoPoligono(0, 0, poligonoQuadrado)).toBe(true);
      expect(pontoEstaDentroDoPoligono(40, -40, poligonoQuadrado)).toBe(true);
      expect(pontoEstaDentroDoPoligono(100, 0, poligonoQuadrado)).toBe(false);
      expect(pontoEstaDentroDoPoligono(-60, 20, poligonoQuadrado)).toBe(false);
    });

    it('ignora setores arquivados na consulta espacial de território', () => {
      const cena = new THREE.Scene();
      const gerenciador = new (class extends THREE.Object3D {
        encontrarSetor(x: number, z: number, setores: Setor[]): Setor | null {
          for (const s of setores) {
            if (s.arquivadoEm === null && pontoEstaDentroDoPoligono(x, z, s.regiao)) {
              return s;
            }
          }
          return null;
        }
      })();

      const instante = '2026-10-31T20:00:00.000Z';
      const setorAtivo: Setor = {
        id: 'setor-1',
        nome: 'Agricultura',
        cor: '#7FA35A',
        icone: 'espiga',
        bioma: 'planicie',
        regiao: poligonoQuadrado,
        ordem: 0,
        criadoEm: instante,
        atualizadoEm: instante,
        arquivadoEm: null,
      };

      const setorArquivado: Setor = {
        ...setorAtivo,
        id: 'setor-2',
        arquivadoEm: instante,
      };

      expect(gerenciador.encontrarSetor(0, 0, [setorAtivo])?.id).toBe('setor-1');
      expect(gerenciador.encontrarSetor(0, 0, [setorArquivado])).toBeNull();
      cena.clear();
    });
  });

  describe('GerenciadorCidadesInstanciadas — Mapeamento de Fase', () => {
    it('mapeia fases de maturidade 1 a 7 e converte projetos arquivados em Ruínas (nível 0)', () => {
      const cena = new THREE.Scene();
      const gerenciador = new GerenciadorCidadesInstanciadas(cena);

      const criarFaseMock = (fase: 1 | 2 | 3 | 4 | 5 | 6 | 7) => ({
        fase,
        faseBrutaHoje: fase,
        desceu: false,
        evento: null,
        mesesAbaixo: 0,
      });

      expect(gerenciador.mapearFaseParaNivel(criarFaseMock(1), false)).toBe(1);
      expect(gerenciador.mapearFaseParaNivel(criarFaseMock(4), false)).toBe(4);
      expect(gerenciador.mapearFaseParaNivel(criarFaseMock(7), false)).toBe(7);

      // Projeto arquivado sempre vira Ruínas (nível 0)
      expect(gerenciador.mapearFaseParaNivel(criarFaseMock(6), true)).toBe(0);

      gerenciador.destruir();
    });
  });
});
