import { describe, expect, it } from 'vitest';
import {
  configPadrao,
  EsquemaAplicacao,
  EsquemaArmazem,
  EsquemaBloqueioTarefa,
  EsquemaCategoriaLancamento,
  EsquemaCliente,
  EsquemaConfig,
  EsquemaEstagio,
  EsquemaEvento,
  EsquemaFornecedor,
  EsquemaFrente,
  EsquemaInstantaneo,
  EsquemaItem,
  EsquemaItemDeLista,
  EsquemaLancamento,
  EsquemaLigacao,
  EsquemaMeta,
  EsquemaMovimento,
  EsquemaPreRequisitoTecnologia,
  EsquemaProjeto,
  EsquemaRegistroDeHoras,
  EsquemaSaldo,
  EsquemaSetor,
  EsquemaTarefa,
  EsquemaTecnologia,
  EsquemaTipoLigacao,
  EsquemaVinculoCliente,
} from '../../src/domain';

const baseValida = {
  id: '00000000-0000-4000-8000-000000000001',
  criadoEm: '2026-10-31T12:00:00.000Z',
  atualizadoEm: '2026-10-31T12:00:00.000Z',
  arquivadoEm: null,
};

describe('Fase 1 — Domínio (Zod): fixtures válidas e inválidas de todas as entidades (Tabela 7.1)', () => {
  it('1. Setor: aceita válido e rejeita cor inválida ou polígono com menos de 3 pontos', () => {
    const valido = {
      ...baseValida,
      nome: 'Agricultura',
      cor: '#7FA35A',
      icone: 'espiga',
      bioma: 'planicie com terracos',
      regiao: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      ordem: 0,
    };
    expect(EsquemaSetor.safeParse(valido).success).toBe(true);
    expect(EsquemaSetor.safeParse({ ...valido, cor: 'verde' }).success).toBe(false);
    expect(
      EsquemaSetor.safeParse({
        ...valido,
        regiao: [
          [0, 0],
          [10, 10],
        ],
      }).success
    ).toBe(false);
  });

  it('2. Projeto: aceita válido e rejeita horasAlvoSemana negativas ou autonomia inválida', () => {
    const valido = {
      ...baseValida,
      nome: 'Cidade Piloto',
      descricao: 'Projeto inicial',
      setorId: 'setor-1',
      x: 12.5,
      z: -30.2,
      estagioId: null,
      horasAlvoSemana: 10,
      autonomia: 'direto' as const,
      notas: 'Notas iniciais',
      notaLicoes: null,
    };
    expect(EsquemaProjeto.safeParse(valido).success).toBe(true);
    expect(EsquemaProjeto.safeParse({ ...valido, horasAlvoSemana: -1 }).success).toBe(false);
    expect(EsquemaProjeto.safeParse({ ...valido, autonomia: 'invalido' }).success).toBe(false);
  });

  it('3. Frente: aceita válida e rejeita estado desconhecido', () => {
    const valida = {
      ...baseValida,
      nome: 'Frente de Infraestrutura',
      projetoId: 'proj-1',
      paiId: null,
      estado: 'ativa' as const,
    };
    expect(EsquemaFrente.safeParse(valida).success).toBe(true);
    expect(EsquemaFrente.safeParse({ ...valida, estado: 'arquivada' }).success).toBe(false);
  });

  it('4. Tarefa: aceita válida e rejeita prioridade fora de 1..4 ou data inválida', () => {
    const valida = {
      ...baseValida,
      titulo: 'Construir fundação',
      descricao: 'Etapa crítica',
      projetoId: 'proj-1',
      frenteId: null,
      status: 'pendente' as const,
      prioridade: 1 as const,
      prazo: '2026-11-15',
      estimativaHoras: 8,
      concluidaEm: null,
      recorrencia: { periodicidade: 'mensal' as const, intervalo: 1, diaRef: 31, ate: null },
      origemRecorrenciaId: null,
    };
    expect(EsquemaTarefa.safeParse(valida).success).toBe(true);
    expect(EsquemaTarefa.safeParse({ ...valida, prioridade: 5 }).success).toBe(false);
    expect(EsquemaTarefa.safeParse({ ...valida, prazo: '2026-02-30' }).success).toBe(false);
  });

  it('5. BloqueioTarefa: aceita distinto e rejeita auto-bloqueio', () => {
    expect(
      EsquemaBloqueioTarefa.safeParse({ tarefaId: 't-1', bloqueadaPorId: 't-2' }).success
    ).toBe(true);
    expect(
      EsquemaBloqueioTarefa.safeParse({ tarefaId: 't-1', bloqueadaPorId: 't-1' }).success
    ).toBe(false);
  });

  it('6. Cliente e VinculoCliente: aceita válidos e rejeita centavos em ponto flutuante', () => {
    const clienteValido = {
      ...baseValida,
      nome: 'Casa Mercantil',
      contato: 'contato@mercantil.br',
      statusRelacao: 'ativo' as const,
      ultimoContato: '2026-10-20',
      observacoes: '',
    };
    expect(EsquemaCliente.safeParse(clienteValido).success).toBe(true);
    expect(EsquemaCliente.safeParse({ ...clienteValido, nome: '' }).success).toBe(false);

    const vinculoValido = {
      ...baseValida,
      clienteId: 'cli-1',
      projetoId: 'proj-1',
      receitaRecorrenteCentavos: 250000,
      inicio: '2026-01-10',
      fim: null,
    };
    expect(EsquemaVinculoCliente.safeParse(vinculoValido).success).toBe(true);
    expect(
      EsquemaVinculoCliente.safeParse({ ...vinculoValido, receitaRecorrenteCentavos: 2500.5 })
        .success
    ).toBe(false);
  });

  it('7. Lancamento: aceita centavos inteiros e rejeita ponto flutuante ou negativo', () => {
    const valido = {
      ...baseValida,
      data: '2026-10-31',
      tipo: 'receita' as const,
      valorCentavos: 600000,
      categoriaId: 'cat-1',
      projetoId: 'proj-1',
      clienteId: 'cli-1',
      recorrencia: null,
      origemRecorrenciaId: null,
    };
    expect(EsquemaLancamento.safeParse(valido).success).toBe(true);
    expect(EsquemaLancamento.safeParse({ ...valido, valorCentavos: 199.99 }).success).toBe(false);
    expect(EsquemaLancamento.safeParse({ ...valido, valorCentavos: -100 }).success).toBe(false);
  });

  it('8. Fornecedor e Armazem: aceita válidos e rejeita prazo negativo ou nome vazio', () => {
    const fornValido = {
      ...baseValida,
      nome: 'Forja do Norte',
      contato: 'forja@norte.br',
      prazoEntregaDias: 10,
      observacoes: '',
    };
    expect(EsquemaFornecedor.safeParse(fornValido).success).toBe(true);
    expect(EsquemaFornecedor.safeParse({ ...fornValido, prazoEntregaDias: -2 }).success).toBe(
      false
    );

    const armValido = {
      ...baseValida,
      nome: 'Armazém Central',
      local: 'Galpão 1',
      observacoes: '',
    };
    expect(EsquemaArmazem.safeParse(armValido).success).toBe(true);
    expect(EsquemaArmazem.safeParse({ ...armValido, nome: '   ' }).success).toBe(false);
  });

  it('9. Item, Saldo, Movimento e ItemDeLista: aceita válidos e rejeita tipos/quantidades inválidos', () => {
    const itemValido = {
      ...baseValida,
      nome: 'Torno CNC',
      unidade: 'un',
      custoUnitarioCentavos: 1500000,
      estoqueMinimo: 1,
      fornecedorId: 'forn-1',
      tipo: 'equipamento' as const,
    };
    expect(EsquemaItem.safeParse(itemValido).success).toBe(true);
    expect(EsquemaItem.safeParse({ ...itemValido, custoUnitarioCentavos: 10.5 }).success).toBe(
      false
    );

    const saldoValido = { ...baseValida, itemId: 'it-1', armazemId: 'arm-1', quantidade: 6 };
    expect(EsquemaSaldo.safeParse(saldoValido).success).toBe(true);
    expect(EsquemaSaldo.safeParse({ ...saldoValido, quantidade: Number.NaN }).success).toBe(false);

    const movValido = {
      ...baseValida,
      itemId: 'it-1',
      armazemId: 'arm-1',
      tipo: 'entrada' as const,
      quantidade: 10,
      data: '2026-10-31',
      projetoId: 'proj-1',
    };
    expect(EsquemaMovimento.safeParse(movValido).success).toBe(true);
    expect(EsquemaMovimento.safeParse({ ...movValido, tipo: 'transferencia' }).success).toBe(false);

    const listaValida = {
      ...baseValida,
      projetoId: 'proj-1',
      itemId: 'it-1',
      quantidade: 10,
      status: 'falta' as const,
    };
    expect(EsquemaItemDeLista.safeParse(listaValida).success).toBe(true);
    expect(EsquemaItemDeLista.safeParse({ ...listaValida, quantidade: 0 }).success).toBe(false);
  });

  it('10. Tecnologia, PreRequisitoTecnologia e Aplicacao: aceita válidos e rejeita auto-dependência', () => {
    const tecValida = {
      ...baseValida,
      nome: 'Visão Computacional',
      descricao: 'Inspeção óptica',
      estado: 'pesquisando' as const,
      estimativaHoras: 40,
    };
    expect(EsquemaTecnologia.safeParse(tecValida).success).toBe(true);
    expect(EsquemaTecnologia.safeParse({ ...tecValida, estimativaHoras: -5 }).success).toBe(false);

    expect(
      EsquemaPreRequisitoTecnologia.safeParse({
        tecnologiaId: 'tec-2',
        preRequisitoId: 'tec-1',
      }).success
    ).toBe(true);
    expect(
      EsquemaPreRequisitoTecnologia.safeParse({
        tecnologiaId: 'tec-1',
        preRequisitoId: 'tec-1',
      }).success
    ).toBe(false);

    const appValida = {
      ...baseValida,
      tecnologiaId: 'tec-1',
      projetoId: 'proj-1',
      efeito: 'velocidade' as const,
      valorEstimadoCentavos: 100000,
    };
    expect(EsquemaAplicacao.safeParse(appValida).success).toBe(true);
    expect(EsquemaAplicacao.safeParse({ ...appValida, valorEstimadoCentavos: 12.34 }).success).toBe(
      false
    );
  });

  it('11. TipoLigacao e Ligacao: aceita válidos e rejeita ligação de um projeto consigo mesmo', () => {
    const tipoValido = {
      ...baseValida,
      nome: 'financia',
      cor: '#B8923A',
      direcional: true,
    };
    expect(EsquemaTipoLigacao.safeParse(tipoValido).success).toBe(true);
    expect(EsquemaTipoLigacao.safeParse({ ...tipoValido, cor: 'ouro' }).success).toBe(false);

    const ligValida = {
      ...baseValida,
      origemId: 'proj-1',
      destinoId: 'proj-2',
      tipoId: 'tipo-1',
      forca: 3 as const,
    };
    expect(EsquemaLigacao.safeParse(ligValida).success).toBe(true);
    expect(EsquemaLigacao.safeParse({ ...ligValida, destinoId: 'proj-1' }).success).toBe(false);
  });

  it('12. RegistroDeHoras, Evento, Instantaneo, Estagio, CategoriaLancamento, Config e Meta', () => {
    const regHoras = {
      ...baseValida,
      data: '2026-10-31',
      projetoId: 'proj-1',
      tarefaId: 'tar-1',
      horas: 4.5,
      tecnologiaId: null,
    };
    expect(EsquemaRegistroDeHoras.safeParse(regHoras).success).toBe(true);
    expect(EsquemaRegistroDeHoras.safeParse({ ...regHoras, horas: 0 }).success).toBe(false);

    const eventoValido = {
      ...baseValida,
      tipo: 'negativo' as const,
      tipoEvento: 'inanicao',
      titulo: 'Projeto sem atividade há 7 dias',
      projetoId: 'proj-1',
      data: '2026-10-31',
      origem: 'detector' as const,
      resposta: null,
      resultado: '',
      fechamentoId: 'fech-1',
    };
    expect(EsquemaEvento.safeParse(eventoValido).success).toBe(true);
    expect(EsquemaEvento.safeParse({ ...eventoValido, origem: 'sistema' }).success).toBe(false);

    const instValido = {
      ...baseValida,
      semana: '2026-10-26',
      receitaCentavos: 500000,
      custoCentavos: 200000,
      horas: 36,
      porProjeto: {
        'proj-1': { saude: 90, fase: 3, moral: 0.75 },
      },
      fechamentoId: 'fech-1',
    };
    expect(EsquemaInstantaneo.safeParse(instValido).success).toBe(true);
    expect(
      EsquemaInstantaneo.safeParse({
        ...instValido,
        porProjeto: { 'proj-1': { saude: 120, fase: 3, moral: 0.75 } },
      }).success
    ).toBe(false);

    const estagioValido = { ...baseValida, nome: 'Em validação', ordem: 1 };
    expect(EsquemaEstagio.safeParse(estagioValido).success).toBe(true);
    expect(EsquemaCategoriaLancamento.safeParse({ ...estagioValido, ordem: -1 }).success).toBe(
      false
    );

    expect(EsquemaConfig.safeParse(configPadrao).success).toBe(true);
    expect(
      EsquemaMeta.safeParse({
        versaoEsquema: 1,
        config: configPadrao,
        conquistas: { consistencia: { desbloqueadaEm: '2026-10-31', projetoId: null } },
      }).success
    ).toBe(true);
    expect(
      EsquemaMeta.safeParse({
        versaoEsquema: 0,
        config: configPadrao,
        conquistas: {},
      }).success
    ).toBe(false);
  });
});
