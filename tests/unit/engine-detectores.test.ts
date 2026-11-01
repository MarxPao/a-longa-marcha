import { describe, expect, it } from 'vitest';
import { configPadrao } from '../../src/domain';
import { executarDetectores } from '../../src/engine/detectores';
import {
  aplicacao,
  cliente,
  dumpVazio,
  fornecedor,
  horas,
  item,
  itemLista,
  lanc,
  ligacao,
  projeto,
  saldo,
  tarefa,
  tecnologia,
  vinculo,
} from './fabrica';

describe('Detectores de Inteligência (Seção 3.6 e Tabela 7.2)', () => {
  // --------------------------------------------------------------------------
  // Inanição
  // --------------------------------------------------------------------------
  describe('Inanição (Tabela 7.2: 6 / 7 / 30 dias sem atividade)', () => {
    it('6 dias sem atividade: não dispara alerta de inanição', () => {
      const dump = dumpVazio();
      const p = projeto({ id: 'p1', criadoEm: '2026-10-01T00:00:00.000Z' });
      dump.projetos.push(p);
      dump.registrosDeHoras.push(horas({ projetoId: 'p1', data: '2026-10-18' }));

      // Hoje = 2026-10-24 (diferença de exatamente 6 dias)
      const alertas = executarDetectores(dump, '2026-10-24', '2026-10-19', configPadrao);
      const inanicao = alertas.filter((a) => a.detector === 'inanicao');
      expect(inanicao).toHaveLength(0);
    });

    it('7 dias sem atividade: dispara alerta amarelo', () => {
      const dump = dumpVazio();
      const p = projeto({ id: 'p1', criadoEm: '2026-10-01T00:00:00.000Z' });
      dump.projetos.push(p);
      dump.registrosDeHoras.push(horas({ projetoId: 'p1', data: '2026-10-18' }));

      // Hoje = 2026-10-25 (diferença de 7 dias)
      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const inanicao = alertas.filter((a) => a.detector === 'inanicao');
      expect(inanicao).toHaveLength(1);
      expect(inanicao[0]?.nivel).toBe('amarelo');
      expect(inanicao[0]?.acaoSugerida).toBe('reativar, pausar ou arquivar');
    });

    it('30 dias sem atividade: dispara alerta vermelho (crítico)', () => {
      const dump = dumpVazio();
      const p = projeto({ id: 'p1', criadoEm: '2026-09-01T00:00:00.000Z' });
      dump.projetos.push(p);
      dump.registrosDeHoras.push(horas({ projetoId: 'p1', data: '2026-09-10' }));

      // Hoje = 2026-10-10 (diferença de 30 dias)
      const alertas = executarDetectores(dump, '2026-10-10', '2026-10-05', configPadrao);
      const inanicao = alertas.filter((a) => a.detector === 'inanicao');
      expect(inanicao).toHaveLength(1);
      expect(inanicao[0]?.nivel).toBe('vermelho');
      expect(inanicao[0]?.acaoSugerida).toBe('reativar, pausar ou arquivar');
    });
  });

  // --------------------------------------------------------------------------
  // Concentração de Cliente
  // --------------------------------------------------------------------------
  describe('Concentração de Cliente (Tabela 7.2: 41% / 40% / 3 projetos)', () => {
    it('cliente com 41% da receita: dispara alerta', () => {
      const dump = dumpVazio();
      const c1 = cliente({ id: 'c1', nome: 'MegaCorp' });
      const p1 = projeto({ id: 'p1' });
      dump.clientes.push(c1);
      dump.projetos.push(p1);

      // Receita total = R$ 100.000 (10.000.000 centavos)
      // MegaCorp = R$ 41.000 (4.100.000 centavos = 41%)
      // Outros = R$ 59.000
      dump.lancamentos.push(
        lanc({ projetoId: 'p1', clienteId: 'c1', tipo: 'receita', valorCentavos: 4_100_000 }),
        lanc({ projetoId: 'p1', clienteId: null, tipo: 'receita', valorCentavos: 5_900_000 })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const conc = alertas.filter((a) => a.detector === 'concentracao_cliente');
      expect(conc).toHaveLength(1);
      expect(conc[0]?.motivo).toContain('41.0%');
      expect(conc[0]?.acaoSugerida).toBe('plano de diversificação');
    });

    it('cliente com exatamente 40% da receita: NÃO dispara', () => {
      const dump = dumpVazio();
      const c1 = cliente({ id: 'c1', nome: 'QuarentaCorp' });
      const p1 = projeto({ id: 'p1' });
      dump.clientes.push(c1);
      dump.projetos.push(p1);

      // 40% exato: 40.000 / 100.000
      dump.lancamentos.push(
        lanc({ projetoId: 'p1', clienteId: 'c1', tipo: 'receita', valorCentavos: 4_000_000 }),
        lanc({ projetoId: 'p1', clienteId: null, tipo: 'receita', valorCentavos: 6_000_000 })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const conc = alertas.filter((a) => a.detector === 'concentracao_cliente');
      expect(conc).toHaveLength(0);
    });

    it('cliente presente em 3 projetos: dispara alerta de concentração', () => {
      const dump = dumpVazio();
      const c1 = cliente({ id: 'c1', nome: 'Omnipresente' });
      const p1 = projeto({ id: 'p1' });
      const p2 = projeto({ id: 'p2' });
      const p3 = projeto({ id: 'p3' });
      dump.clientes.push(c1);
      dump.projetos.push(p1, p2, p3);

      dump.vinculosCliente.push(
        vinculo({ clienteId: 'c1', projetoId: 'p1' }),
        vinculo({ clienteId: 'c1', projetoId: 'p2' }),
        vinculo({ clienteId: 'c1', projetoId: 'p3' })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const conc = alertas.filter((a) => a.detector === 'concentracao_cliente');
      expect(conc).toHaveLength(1);
      expect(conc[0]?.motivo).toContain('3 projetos simultâneos');
    });
  });

  // --------------------------------------------------------------------------
  // Ponto Único de Falha
  // --------------------------------------------------------------------------
  describe('Ponto Único de Falha (Tabela 7.2: fornecedor em 3 projetos / em 2)', () => {
    it('fornecedor em 3 projetos: dispara alerta', () => {
      const dump = dumpVazio();
      const forn = fornecedor({ id: 'f1', nome: 'Monopólio Peças' });
      const i1 = item({ id: 'i1', fornecedorId: 'f1' });
      dump.fornecedores.push(forn);
      dump.itens.push(i1);

      const p1 = projeto({ id: 'p1' });
      const p2 = projeto({ id: 'p2' });
      const p3 = projeto({ id: 'p3' });
      dump.projetos.push(p1, p2, p3);

      dump.itensDeLista.push(
        itemLista({ projetoId: 'p1', itemId: 'i1' }),
        itemLista({ projetoId: 'p2', itemId: 'i1' }),
        itemLista({ projetoId: 'p3', itemId: 'i1' })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const puf = alertas.filter((a) => a.detector === 'ponto_unico_falha');
      expect(puf).toHaveLength(1);
      expect(puf[0]?.motivo).toContain('compartilhado por 3 projetos distintos');
      expect(puf[0]?.acaoSugerida).toBe('segundo fornecedor');
    });

    it('fornecedor em 2 projetos: NÃO dispara', () => {
      const dump = dumpVazio();
      const forn = fornecedor({ id: 'f1', nome: 'Monopólio Peças' });
      const i1 = item({ id: 'i1', fornecedorId: 'f1' });
      dump.fornecedores.push(forn);
      dump.itens.push(i1);

      const p1 = projeto({ id: 'p1' });
      const p2 = projeto({ id: 'p2' });
      dump.projetos.push(p1, p2);

      dump.itensDeLista.push(
        itemLista({ projetoId: 'p1', itemId: 'i1' }),
        itemLista({ projetoId: 'p2', itemId: 'i1' })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const puf = alertas.filter((a) => a.detector === 'ponto_unico_falha');
      expect(puf).toHaveLength(0);
    });

    it('equipamento compartilhado por 3 projetos: dispara alerta', () => {
      const dump = dumpVazio();
      const equip = item({ id: 'eq1', nome: 'Impressora 3D Industrial', tipo: 'equipamento' });
      dump.itens.push(equip);

      const p1 = projeto({ id: 'p1' });
      const p2 = projeto({ id: 'p2' });
      const p3 = projeto({ id: 'p3' });
      dump.projetos.push(p1, p2, p3);

      dump.itensDeLista.push(
        itemLista({ projetoId: 'p1', itemId: 'eq1' }),
        itemLista({ projetoId: 'p2', itemId: 'eq1' }),
        itemLista({ projetoId: 'p3', itemId: 'eq1' })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const puf = alertas.filter((a) => a.detector === 'ponto_unico_falha');
      expect(puf).toHaveLength(1);
      expect(puf[0]?.motivo).toContain('Equipamento Impressora 3D Industrial');
    });
  });

  // --------------------------------------------------------------------------
  // Gargalo de Atenção e Troca de Contexto
  // --------------------------------------------------------------------------
  describe('Gargalo de Atenção (Tabela 7.2: 45h vs 40h, projeto direto 0.5h, 5 vs 4 setores)', () => {
    it('metas somam 45 h com 40 h disponíveis: dispara gargalo de horas', () => {
      const dump = dumpVazio();
      dump.projetos.push(
        projeto({ id: 'p1', horasAlvoSemana: 25 }),
        projeto({ id: 'p2', horasAlvoSemana: 20 })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const gargalo = alertas.filter((a) => a.tipoEvento === 'detector:gargalo_horas_totais');
      expect(gargalo).toHaveLength(1);
      expect(gargalo[0]?.motivo).toContain('somam 45 h por semana, acima das 40 h disponíveis');
      expect(gargalo[0]?.acaoSugerida).toBe('redistribuir horas');
    });

    it('projeto direto com 0,5 h na semana: dispara atenção insuficiente', () => {
      const dump = dumpVazio();
      const p1 = projeto({ id: 'p1', autonomia: 'direto', horasAlvoSemana: 10 });
      dump.projetos.push(p1);
      // Registra apenas 0.5h na semana de 2026-10-19 a 2026-10-25
      dump.registrosDeHoras.push(horas({ projetoId: 'p1', data: '2026-10-20', horas: 0.5 }));

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const direto = alertas.filter((a) => a.tipoEvento === 'detector:gargalo_projeto_direto');
      expect(direto).toHaveLength(1);
      expect(direto[0]?.motivo).toContain('registrou 0.5 h nesta semana (mínimo esperado: 1 h)');
    });

    it('5 setores com horas na semana: dispara aviso de troca de contexto', () => {
      const dump = dumpVazio();
      // Criar 5 projetos em 5 setores distintos
      for (let i = 1; i <= 5; i++) {
        dump.projetos.push(projeto({ id: `p${i}`, setorId: `setor-${i}` }));
        dump.registrosDeHoras.push(horas({ projetoId: `p${i}`, data: '2026-10-20', horas: 2 }));
      }

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const troca = alertas.filter((a) => a.tipoEvento === 'detector:troca_contexto');
      expect(troca).toHaveLength(1);
      expect(troca[0]?.motivo).toContain('5 setores nesta semana (limite recomendado: 4)');
      expect(troca[0]?.acaoSugerida).toBe('agrupar blocos por setor');
    });

    it('4 setores com horas na semana: NÃO dispara aviso de troca de contexto', () => {
      const dump = dumpVazio();
      for (let i = 1; i <= 4; i++) {
        dump.projetos.push(projeto({ id: `p${i}`, setorId: `setor-${i}` }));
        dump.registrosDeHoras.push(horas({ projetoId: `p${i}`, data: '2026-10-20', horas: 2 }));
      }

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const troca = alertas.filter((a) => a.tipoEvento === 'detector:troca_contexto');
      expect(troca).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Estoque
  // --------------------------------------------------------------------------
  describe('Estoque (Tabela 7.2: saldo 3 com mínimo 5 / compra sugerida)', () => {
    it('saldo 3 com mínimo 5: alerta de estoque com compra sugerida de 2', () => {
      const dump = dumpVazio();
      const i1 = item({ id: 'i1', nome: 'Resina Epóxi', unidade: 'kg', estoqueMinimo: 5 });
      dump.itens.push(i1);
      dump.saldos.push(saldo({ itemId: 'i1', quantidade: 3 }));

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const est = alertas.filter((a) => a.detector === 'estoque');
      expect(est).toHaveLength(1);
      expect(est[0]?.motivo).toContain('Saldo de 3 kg está abaixo do estoque mínimo de 5');
      expect(est[0]?.acaoSugerida).toBe('compra sugerida de 2');
    });

    it('lista pede 10, disponível 6, tarefa em 5 dias, fornecedor entrega em 10 dias: compra sugerida de 4', () => {
      const dump = dumpVazio();
      const forn = fornecedor({ id: 'f1', prazoEntregaDias: 10 });
      const i1 = item({ id: 'i1', nome: 'Placa PCB', unidade: 'un', estoqueMinimo: 0, fornecedorId: 'f1' });
      dump.fornecedores.push(forn);
      dump.itens.push(i1);
      dump.saldos.push(saldo({ itemId: 'i1', quantidade: 6 }));

      const p1 = projeto({ id: 'p1' });
      dump.projetos.push(p1);
      dump.itensDeLista.push(itemLista({ projetoId: 'p1', itemId: 'i1', quantidade: 10 }));

      // Tarefa vence em 5 dias: hoje = 2026-10-20, prazo = 2026-10-25
      dump.tarefas.push(tarefa({ projetoId: 'p1', prazo: '2026-10-25', status: 'pendente' }));

      const alertas = executarDetectores(dump, '2026-10-20', '2026-10-19', configPadrao);
      const est = alertas.filter((a) => a.tipoEvento === 'detector:estoque_prazo_insuficiente');
      expect(est).toHaveLength(1);
      expect(est[0]?.motivo).toContain('Lista pede 10, disponível 6');
      expect(est[0]?.motivo).toContain('Tarefa vence em 5 dias e entrega do fornecedor leva 10 dias');
      expect(est[0]?.acaoSugerida).toBe('compra sugerida de 4');
    });
  });

  // --------------------------------------------------------------------------
  // Tecnologia de Alto Retorno e Sinergia
  // --------------------------------------------------------------------------
  describe('Tecnologia e Sinergia', () => {
    it('tecnologia em pesquisa com aplicações em 3 projetos: dispara tecnologia de alto retorno', () => {
      const dump = dumpVazio();
      const tec = tecnologia({ id: 'tec1', nome: 'Motor Quântico', estado: 'pesquisando' });
      dump.tecnologias.push(tec);

      const p1 = projeto({ id: 'p1' });
      const p2 = projeto({ id: 'p2' });
      const p3 = projeto({ id: 'p3' });
      dump.projetos.push(p1, p2, p3);

      dump.aplicacoes.push(
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p1' }),
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p2' }),
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p3' })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const tar = alertas.filter((a) => a.detector === 'tecnologia_alto_retorno');
      expect(tar).toHaveLength(1);
      expect(tar[0]?.motivo).toContain('desbloqueará aplicações em 3 projetos');
      expect(tar[0]?.acaoSugerida).toBe('priorizar pesquisa');
    });

    it('dois projetos do mesmo setor usando a mesma tecnologia sem ligação: dispara sinergia', () => {
      const dump = dumpVazio();
      const tec = tecnologia({ id: 'tec1', nome: 'Visão Computacional', estado: 'dominada' });
      dump.tecnologias.push(tec);

      const p1 = projeto({ id: 'p1', setorId: 'setor-ia' });
      const p2 = projeto({ id: 'p2', setorId: 'setor-ia' });
      dump.projetos.push(p1, p2);

      dump.aplicacoes.push(
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p1' }),
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p2' })
      );

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const sin = alertas.filter((a) => a.detector === 'sinergia');
      expect(sin).toHaveLength(1);
      expect(sin[0]?.acaoSugerida).toBe('criar ligação');
    });

    it('dois projetos do mesmo setor com ligação existente: NÃO dispara sinergia', () => {
      const dump = dumpVazio();
      const tec = tecnologia({ id: 'tec1', nome: 'Visão Computacional', estado: 'dominada' });
      dump.tecnologias.push(tec);

      const p1 = projeto({ id: 'p1', setorId: 'setor-ia' });
      const p2 = projeto({ id: 'p2', setorId: 'setor-ia' });
      dump.projetos.push(p1, p2);

      dump.aplicacoes.push(
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p1' }),
        aplicacao({ tecnologiaId: 'tec1', projetoId: 'p2' })
      );
      dump.ligacoes.push(ligacao({ origemId: 'p1', destinoId: 'p2' }));

      const alertas = executarDetectores(dump, '2026-10-25', '2026-10-19', configPadrao);
      const sin = alertas.filter((a) => a.detector === 'sinergia');
      expect(sin).toHaveLength(0);
    });
  });
});
