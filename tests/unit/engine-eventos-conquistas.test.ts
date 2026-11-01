import { describe, expect, it } from 'vitest';
import { avaliarConquistas } from '../../src/engine/conquistas';
import {
  buscarHistoricoRespostasPorTipo,
  criarEvento,
  responderEvento,
} from '../../src/engine/eventos';
import {
  aplicacao,
  cliente,
  dumpVazio,
  lanc,
  projeto,
  vinculo,
} from './fabrica';

describe('Eventos e Conquistas (Seções 3.8, 3.9 e Tabela 7.2)', () => {
  describe('Eventos (Seção 3.8)', () => {
    it('cria evento puro com campos obrigatórios preenchidos', () => {
      const ev = criarEvento({
        id: 'ev-1',
        tipo: 'negativo',
        tipoEvento: 'detector:inanicao_vermelho',
        titulo: 'Inanição Crítica',
        projetoId: 'p1',
        data: '2026-10-25',
        origem: 'detector',
        agora: '2026-10-25T18:00:00.000Z',
        resultado: 'Aguardando decisão.',
      });

      expect(ev.id).toBe('ev-1');
      expect(ev.tipo).toBe('negativo');
      expect(ev.resposta).toBeNull();
      expect(ev.resultado).toBe('Aguardando decisão.');
    });

    it('responde a evento e preserva imutabilidade do original', () => {
      const evOriginal = criarEvento({
        id: 'ev-1',
        tipo: 'negativo',
        tipoEvento: 'detector:inanicao_vermelho',
        titulo: 'Inanição Crítica',
        projetoId: 'p1',
        data: '2026-10-25',
        origem: 'detector',
        agora: '2026-10-25T18:00:00.000Z',
      });

      const respondido = responderEvento(
        evOriginal,
        'mitigar',
        'Planejadas 10 horas para a próxima semana',
        '2026-10-26T09:00:00.000Z'
      );

      expect(evOriginal.resposta).toBeNull();
      expect(respondido.resposta).toBe('mitigar');
      expect(respondido.resultado).toBe('Planejadas 10 horas para a próxima semana');
      expect(respondido.atualizadoEm).toBe('2026-10-26T09:00:00.000Z');
    });

    it('busca histórico de respostas por tipo de evento em ordem cronológica reversa', () => {
      const ev1 = responderEvento(
        criarEvento({
          id: 'ev-1',
          tipo: 'negativo',
          tipoEvento: 'detector:cliente_risco',
          titulo: 'Alerta 1',
          projetoId: 'p1',
          data: '2026-09-10',
          origem: 'detector',
          agora: '2026-09-10T10:00:00.000Z',
        }),
        'ignorar',
        'Cliente regularizado',
        '2026-09-10T12:00:00.000Z'
      );

      const ev2 = responderEvento(
        criarEvento({
          id: 'ev-2',
          tipo: 'negativo',
          tipoEvento: 'detector:cliente_risco',
          titulo: 'Alerta 2',
          projetoId: 'p2',
          data: '2026-10-15',
          origem: 'detector',
          agora: '2026-10-15T10:00:00.000Z',
        }),
        'mitigar',
        'Ligação realizada e contrato renovado',
        '2026-10-15T12:00:00.000Z'
      );

      const historico = buscarHistoricoRespostasPorTipo('detector:cliente_risco', [ev1, ev2]);
      expect(historico).toHaveLength(2);
      expect(historico[0]?.data).toBe('2026-10-15');
      expect(historico[0]?.resposta).toBe('mitigar');
      expect(historico[1]?.data).toBe('2026-09-10');
      expect(historico[1]?.resposta).toBe('ignorar');
    });
  });

  describe('Conquistas baseadas em dados reais (Seção 3.9)', () => {
    it('diplomacia: desbloqueia com 10 clientes ativos simultâneos', () => {
      const dump = dumpVazio();
      for (let i = 1; i <= 10; i++) {
        dump.clientes.push(cliente({ id: `c${i}`, statusRelacao: 'ativo' }));
      }

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const diplo = conquistas.find((c) => c.id === 'diplomacia');
      expect(diplo).toBeDefined();
      expect(diplo?.titulo).toBe('Rede Diplomática');
    });

    it('diplomacia: não desbloqueia com 9 clientes ativos', () => {
      const dump = dumpVazio();
      for (let i = 1; i <= 9; i++) {
        dump.clientes.push(cliente({ id: `c${i}`, statusRelacao: 'ativo' }));
      }

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const diplo = conquistas.find((c) => c.id === 'diplomacia');
      expect(diplo).toBeUndefined();
    });

    it('sinergia: desbloqueia quando tecnologia é aplicada em 3 ou mais projetos', () => {
      const dump = dumpVazio();
      dump.projetos.push(projeto({ id: 'p1' }), projeto({ id: 'p2' }), projeto({ id: 'p3' }));
      dump.aplicacoes.push(
        aplicacao({ tecnologiaId: 'tec-1', projetoId: 'p1' }),
        aplicacao({ tecnologiaId: 'tec-1', projetoId: 'p2' }),
        aplicacao({ tecnologiaId: 'tec-1', projetoId: 'p3' })
      );

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const sin = conquistas.find((c) => c.id === 'sinergia');
      expect(sin).toBeDefined();
      expect(sin?.titulo).toBe('Mestria Sinergética');
    });

    it('expansão: desbloqueia com projetos em 2 ou mais setores diferentes', () => {
      const dump = dumpVazio();
      dump.projetos.push(
        projeto({ id: 'p1', setorId: 'setor-agri' }),
        projeto({ id: 'p2', setorId: 'setor-tech' })
      );

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const exp = conquistas.find((c) => c.id === 'expansao');
      expect(exp).toBeDefined();
    });

    it('escala: desbloqueia quando projeto atinge Metrópole (fase >= 6)', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);

      // Metrópole: 10 ou mais clientes ativos e margem positiva por 6 meses
      for (let i = 1; i <= 10; i++) {
        dump.clientes.push(cliente({ id: `c${i}`, statusRelacao: 'ativo' }));
        dump.vinculosCliente.push(
          vinculo({ clienteId: `c${i}`, projetoId: 'p1', receitaRecorrenteCentavos: 500_000 })
        );
      }

      // 6 meses completos civis terminando em 2026-09 (pois 2026-10 ainda não completou em 2026-10-25) com receita > custo
      const meses = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
      for (const m of meses) {
        dump.lancamentos.push(
          lanc({ projetoId: 'p1', data: `${m}-10`, tipo: 'receita', valorCentavos: 5_000_000 }),
          lanc({ projetoId: 'p1', data: `${m}-12`, tipo: 'custo', valorCentavos: 1_000_000 })
        );
      }

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const escala = conquistas.find((c) => c.id === 'escala');
      expect(escala).toBeDefined();
      expect(escala?.titulo).toBe('Grande Metrópole');
    });

    it('consistencia: desbloqueia após 7 semanas sem tarefa crítica vencida', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);

      // 7 instantâneos consecutivos
      for (let w = 1; w <= 7; w++) {
        dump.instantaneos.push({
          ...dumpVazio().instantaneos[0]!,
          id: `inst-${w}`,
          criadoEm: '2026-10-31T00:00:00.000Z',
          atualizadoEm: '2026-10-31T00:00:00.000Z',
          arquivadoEm: null,
          semana: `2026-09-0${w}`,
          receitaCentavos: 0,
          custoCentavos: 0,
          horas: 10,
          porProjeto: { p1: { saude: 100, fase: 2, moral: 1 } },
          fechamentoId: `f-${w}`,
        });
      }

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const cons = conquistas.find((c) => c.id === 'consistencia');
      expect(cons).toBeDefined();
      expect(cons?.titulo).toBe('Consistência de Ferro');
    });

    it('resiliencia: desbloqueia quando projeto crítico recupera saúde para saudável sem perder clientes', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);

      // Instantâneo passado onde p1 esteve crítico (< 40)
      dump.instantaneos.push({
        ...dumpVazio().instantaneos[0]!,
        id: 'inst-passado',
        criadoEm: '2026-09-01T00:00:00.000Z',
        atualizadoEm: '2026-09-01T00:00:00.000Z',
        arquivadoEm: null,
        semana: '2026-09-01',
        receitaCentavos: 0,
        custoCentavos: 0,
        horas: 0,
        porProjeto: { p1: { saude: 35, fase: 3, moral: 0.2 } },
        fechamentoId: 'f-ant',
      });

      // Hoje o projeto está 100% saudável (sem tarefas vencidas nem bloqueios)
      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const res = conquistas.find((c) => c.id === 'resiliencia');
      expect(res).toBeDefined();
      expect(res?.titulo).toBe('Resiliência Comprovada');
    });

    it('não desbloqueia novamente conquista já registrada em meta.conquistas', () => {
      const dump = dumpVazio();
      dump.meta.conquistas['diplomacia'] = {
        desbloqueadaEm: '2026-09-01',
        projetoId: null,
      };

      for (let i = 1; i <= 10; i++) {
        dump.clientes.push(cliente({ id: `c${i}`, statusRelacao: 'ativo' }));
      }

      const conquistas = avaliarConquistas(dump, '2026-10-25');
      const diplo = conquistas.find((c) => c.id === 'diplomacia');
      expect(diplo).toBeUndefined(); // Já estava desbloqueada
    });
  });
});
