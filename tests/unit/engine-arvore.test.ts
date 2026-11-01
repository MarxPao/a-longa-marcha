import { describe, expect, it } from 'vitest';
import type { PreRequisitoTecnologia } from '../../src/domain';
import {
  calcularProgressoTecnologia,
  criariaCicloPreRequisito,
  rankingOQuePesquisarPrimeiro,
  validarTransicaoEstadoTecnologia,
} from '../../src/engine/arvoreTecnologica';
import { aplicacao, horas, projeto, tecnologia } from './fabrica';

describe('Árvore Tecnológica (Seção 3.7 e Tabela 7.2)', () => {
  describe('Grafo dirigido acíclico e detecção de ciclos', () => {
    it('rejeita auto-dependência A -> A', () => {
      const ciclo = criariaCicloPreRequisito([], 'tec-a', 'tec-a');
      expect(ciclo).toBe(true);
    });

    it('rejeita ciclo direto A -> B -> A', () => {
      // Já existe: B depende de A (B -> A)
      const preReqs: PreRequisitoTecnologia[] = [
        { tecnologiaId: 'tec-b', preRequisitoId: 'tec-a' },
      ];
      // Tenta adicionar: A depende de B (A -> B)
      const ciclo = criariaCicloPreRequisito(preReqs, 'tec-a', 'tec-b');
      expect(ciclo).toBe(true);
    });

    it('rejeita ciclo indireto A -> B -> C -> A', () => {
      // Já existe: B depende de A, C depende de B
      const preReqs: PreRequisitoTecnologia[] = [
        { tecnologiaId: 'tec-b', preRequisitoId: 'tec-a' },
        { tecnologiaId: 'tec-c', preRequisitoId: 'tec-b' },
      ];
      // Tenta adicionar: A depende de C (A -> C)
      const ciclo = criariaCicloPreRequisito(preReqs, 'tec-a', 'tec-c');
      expect(ciclo).toBe(true);
    });

    it('permite árvore válida sem ciclo (diamante: D depende de B e C; B e C dependem de A)', () => {
      const preReqs: PreRequisitoTecnologia[] = [
        { tecnologiaId: 'tec-b', preRequisitoId: 'tec-a' },
        { tecnologiaId: 'tec-c', preRequisitoId: 'tec-a' },
      ];
      // Adicionar D -> B
      expect(criariaCicloPreRequisito(preReqs, 'tec-d', 'tec-b')).toBe(false);
      // Adicionar D -> C
      preReqs.push({ tecnologiaId: 'tec-d', preRequisitoId: 'tec-b' });
      expect(criariaCicloPreRequisito(preReqs, 'tec-d', 'tec-c')).toBe(false);
    });
  });

  describe('Validação de transição de estado', () => {
    it('rejeita marcar como pesquisando se pré-requisito não for dominado (Tabela 7.2)', () => {
      const tecA = tecnologia({ id: 'tec-a', nome: 'Mecânica Básica', estado: 'ideia' });
      const tecB = tecnologia({ id: 'tec-b', nome: 'Motores a Vapor', estado: 'ideia' });
      const preReqs: PreRequisitoTecnologia[] = [
        { tecnologiaId: 'tec-b', preRequisitoId: 'tec-a' },
      ];

      const val = validarTransicaoEstadoTecnologia(
        'tec-b',
        'pesquisando',
        [tecA, tecB],
        preReqs
      );
      expect(val.permitido).toBe(false);
      expect(val.motivo).toContain('Mecânica Básica');
    });

    it('permite marcar como pesquisando quando todos os pré-requisitos estão dominados', () => {
      const tecA = tecnologia({ id: 'tec-a', nome: 'Mecânica Básica', estado: 'dominada' });
      const tecB = tecnologia({ id: 'tec-b', nome: 'Motores a Vapor', estado: 'ideia' });
      const preReqs: PreRequisitoTecnologia[] = [
        { tecnologiaId: 'tec-b', preRequisitoId: 'tec-a' },
      ];

      const val = validarTransicaoEstadoTecnologia(
        'tec-b',
        'pesquisando',
        [tecA, tecB],
        preReqs
      );
      expect(val.permitido).toBe(true);
    });

    it('permite tecnologia sem pré-requisitos ir para pesquisando', () => {
      const tecA = tecnologia({ id: 'tec-a', nome: 'Matemática', estado: 'ideia' });
      const val = validarTransicaoEstadoTecnologia('tec-a', 'pesquisando', [tecA], []);
      expect(val.permitido).toBe(true);
    });
  });

  describe('Cálculo de progresso da pesquisa', () => {
    it('calcula horas investidas e fração de progresso corretamente', () => {
      const tec = tecnologia({ id: 'tec-1', estimativaHoras: 40 });
      const reg = [
        horas({ tecnologiaId: 'tec-1', horas: 10 }),
        horas({ tecnologiaId: 'tec-1', horas: 15 }),
        horas({ tecnologiaId: 'outro', horas: 8 }),
      ];

      const p = calcularProgressoTecnologia(tec, reg);
      expect(p.horasInvestidas).toBe(25);
      expect(p.estimativaHoras).toBe(40);
      expect(p.progresso).toBe(25 / 40);
      expect(p.concluida).toBe(false);
    });

    it('sinaliza concluída quando horas atingem a estimativa', () => {
      const tec = tecnologia({ id: 'tec-1', estimativaHoras: 20 });
      const reg = [horas({ tecnologiaId: 'tec-1', horas: 25 })];

      const p = calcularProgressoTecnologia(tec, reg);
      expect(p.progresso).toBe(1);
      expect(p.concluida).toBe(true);
    });
  });

  describe('Ranking "o que pesquisar primeiro" (Seção 3.7)', () => {
    it('ordena tecnologias pendentes por projetos e tecnologias desbloqueadas', () => {
      const tecA = tecnologia({ id: 'tec-a', nome: 'Fundição Avançada', estado: 'ideia' });
      const tecB = tecnologia({ id: 'tec-b', nome: 'Tratamento Térmico', estado: 'ideia' });
      const tecC = tecnologia({ id: 'tec-c', nome: 'Armadura Pesada', estado: 'ideia' });

      // tecA desbloqueia 2 projetos e tecB como tecnologia filha
      // tecB desbloqueia 1 projeto e tecC como filha
      // tecC desbloqueia 3 projetos
      const aplicacoes = [
        aplicacao({ tecnologiaId: 'tec-a', projetoId: 'p1' }),
        aplicacao({ tecnologiaId: 'tec-a', projetoId: 'p2' }),
        aplicacao({ tecnologiaId: 'tec-b', projetoId: 'p3' }),
        aplicacao({ tecnologiaId: 'tec-c', projetoId: 'p4' }),
        aplicacao({ tecnologiaId: 'tec-c', projetoId: 'p5' }),
        aplicacao({ tecnologiaId: 'tec-c', projetoId: 'p6' }),
      ];

      const preReqs: PreRequisitoTecnologia[] = [
        { tecnologiaId: 'tec-b', preRequisitoId: 'tec-a' },
        { tecnologiaId: 'tec-c', preRequisitoId: 'tec-b' },
      ];

      const projetos = [
        projeto({ id: 'p1' }),
        projeto({ id: 'p2' }),
        projeto({ id: 'p3' }),
        projeto({ id: 'p4' }),
        projeto({ id: 'p5' }),
        projeto({ id: 'p6' }),
      ];

      const ranking = rankingOQuePesquisarPrimeiro(
        [tecA, tecB, tecC],
        preReqs,
        aplicacoes,
        projetos
      );

      // tecC tem 3 projetos e 0 filhas = 3*10 + 0 = 30
      // tecA tem 2 projetos e 2 filhas (B e C) = 2*10 + 2*5 = 30
      // tecB tem 1 projeto e 1 filha (C) = 1*10 + 1*5 = 15
      expect(ranking).toHaveLength(3);
      expect(ranking[0]?.tecnologia.id).toBe('tec-a'); // tecA pode pesquisar (sem pré-reqs pendentes)
      expect(ranking.map((r) => r.tecnologia.id)).toContain('tec-c');
    });
  });
});
