import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  criarDumpVazio,
  ErroValidacaoImportacao,
  type Lancamento,
  type Projeto,
  type Setor,
} from '../../src/domain';
import {
  criarRepositorioDexie,
  criarRepositorioMemoria,
  solicitarArmazenamentoPersistente,
  type Repository,
} from '../../src/repository';

function criarFixturesIniciais(): { setor: Setor; projeto: Projeto; lancamento: Lancamento } {
  const instante = '2026-10-31T15:00:00.000Z';
  const setor: Setor = {
    id: 'setor-agro-1',
    criadoEm: instante,
    atualizadoEm: instante,
    arquivadoEm: null,
    nome: 'Agricultura',
    cor: '#7FA35A',
    icone: 'espiga',
    bioma: 'planicie com terracos e arrozais',
    regiao: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    ordem: 0,
  };

  const projeto: Projeto = {
    id: 'proj-irrigacao-1',
    criadoEm: instante,
    atualizadoEm: instante,
    arquivadoEm: null,
    nome: 'Irrigação Inteligente',
    descricao: 'Controle automatizado de canais',
    setorId: setor.id,
    x: 40,
    z: 50,
    estagioId: null,
    horasAlvoSemana: 12,
    autonomia: 'direto',
    notas: 'Prioridade de primavera',
    notaLicoes: null,
  };

  const lancamento: Lancamento = {
    id: 'lanc-1',
    criadoEm: instante,
    atualizadoEm: instante,
    arquivadoEm: null,
    data: '2026-10-31',
    tipo: 'receita',
    valorCentavos: 600000,
    categoriaId: 'cat-venda',
    projetoId: projeto.id,
    clienteId: null,
    recorrencia: null,
    origemRecorrenciaId: null,
  };

  return { setor, projeto, lancamento };
}

function executarSuiteContratoRepositorio(
  nomeImplementacao: string,
  fabrica: () => Promise<Repository>
): void {
  describe(`Fase 1 — Contrato Repository (${nomeImplementacao})`, () => {
    let repo: Repository;

    beforeEach(async () => {
      repo = await fabrica();
    });

    it('retorna versaoEsquema = 1 por padrão', async () => {
      expect(await repo.versaoEsquema()).toBe(1);
    });

    it('Caso 7.2 — exportar, importar, exportar: os dois JSON são idênticos (round-trip)', async () => {
      const { setor, projeto, lancamento } = criarFixturesIniciais();
      await repo.salvar('setores', setor);
      await repo.salvar('projetos', projeto);
      await repo.salvar('lancamentos', lancamento);

      const dump1 = await repo.exportar();
      const outroRepo = await fabrica();
      await outroRepo.importar(dump1);
      const dump2 = await outroRepo.exportar();

      expect(dump2).toEqual(dump1);
      expect(JSON.stringify(dump2)).toBe(JSON.stringify(dump1));
    });

    it('Caso 7.2 — arquivar um registro: continua no banco; consultas padrão o ocultam', async () => {
      const { setor, projeto } = criarFixturesIniciais();
      await repo.salvar('setores', setor);
      await repo.salvar('projetos', projeto);

      await repo.arquivar('projetos', projeto.id);

      // Continua no banco ao buscar por id
      const obtidoNoBanco = await repo.obter<Projeto>('projetos', projeto.id);
      expect(obtidoNoBanco).not.toBeNull();
      expect(obtidoNoBanco?.arquivadoEm).not.toBeNull();

      // Consultas padrão o ocultam
      const listagemPadrao = await repo.listar<Projeto>('projetos');
      expect(listagemPadrao).toHaveLength(0);

      // Consulta explícita incluindo arquivados encontra o registro
      const listagemComArquivados = await repo.listar<Projeto>('projetos', {
        incluirArquivados: true,
      });
      expect(listagemComArquivados).toHaveLength(1);
      expect(listagemComArquivados[0]?.id).toBe(projeto.id);
    });

    it('Caso 7.2 — importar JSON com um campo inválido: nada é gravado e erros são listados pelo caminho do campo', async () => {
      const { setor, projeto } = criarFixturesIniciais();
      await repo.salvar('setores', setor);
      await repo.salvar('projetos', projeto);

      const dumpAntes = await repo.exportar();

      const dumpInvalido = criarDumpVazio();
      dumpInvalido.lancamentos.push({
        id: 'lanc-invalido',
        criadoEm: '2026-10-31T15:00:00.000Z',
        atualizadoEm: '2026-10-31T15:00:00.000Z',
        arquivadoEm: null,
        data: '2026-10-31',
        tipo: 'receita',
        valorCentavos: 150.75, // Inválido: ponto flutuante em centavos!
        categoriaId: 'cat-1',
        projetoId: 'proj-1',
        clienteId: null,
        recorrencia: null,
        origemRecorrenciaId: null,
      });

      let erroCapturado: ErroValidacaoImportacao | null = null;
      try {
        await repo.importar(dumpInvalido);
      } catch (err) {
        if (err instanceof ErroValidacaoImportacao) {
          erroCapturado = err;
        } else {
          throw err;
        }
      }

      expect(erroCapturado).not.toBeNull();
      expect(
        erroCapturado?.errosPorCampo.some((e) => e.caminho === 'lancamentos.0.valorCentavos')
      ).toBe(true);

      // Atomicidade: nada foi gravado, os dados anteriores permanecem idênticos
      const dumpDepois = await repo.exportar();
      expect(dumpDepois).toEqual(dumpAntes);
    });

    it('Caso 7.2 — abrir/importar banco de uma versão antiga (fixture v0): migração preserva todos os dados', async () => {
      const { setor } = criarFixturesIniciais();
      // Fixture v0: sem notaLicoes no projeto, sem campo tipo no item e versaoEsquema = 0
      const fixtureV0 = {
        versaoEsquema: 0,
        meta: {
          versaoEsquema: 0,
          config: { horasSemanaisDisponiveis: 35 },
          conquistas: {
            expansao: { desbloqueadaEm: '2026-09-01', projetoId: 'proj-legado-v0' },
          },
        },
        setores: [setor],
        projetos: [
          {
            id: 'proj-legado-v0',
            criadoEm: '2026-09-01T10:00:00.000Z',
            atualizadoEm: '2026-09-01T10:00:00.000Z',
            arquivadoEm: null,
            nome: 'Projeto Legado V0',
            descricao: 'Criado na versão 0 do esquema',
            setorId: setor.id,
            x: 10,
            z: 20,
            estagioId: null,
            horasAlvoSemana: 8,
            autonomia: 'esparso',
            notas: 'Preservado na migração',
            // notaLicoes ausente na v0
          },
        ],
        itens: [
          {
            id: 'item-legado-v0',
            criadoEm: '2026-09-01T10:00:00.000Z',
            atualizadoEm: '2026-09-01T10:00:00.000Z',
            arquivadoEm: null,
            nome: 'Sensor de Umidade',
            unidade: 'un',
            custoUnitarioCentavos: 4500,
            estoqueMinimo: 5,
            fornecedorId: null,
            // tipo ausente na v0
          },
        ],
      };

      await repo.importar(fixtureV0);

      expect(await repo.versaoEsquema()).toBe(1);
      const projetoMigrado = await repo.obter<Projeto>('projetos', 'proj-legado-v0');
      expect(projetoMigrado).not.toBeNull();
      expect(projetoMigrado?.nome).toBe('Projeto Legado V0');
      expect(projetoMigrado?.notaLicoes).toBeNull();

      const setoresMigrados = await repo.listar<Setor>('setores');
      expect(setoresMigrados).toHaveLength(1);
    });
  });
}

executarSuiteContratoRepositorio('Memória', async () => criarRepositorioMemoria());
executarSuiteContratoRepositorio('Dexie (IndexedDB)', async () =>
  criarRepositorioDexie(`db-teste-${Math.random().toString(36).slice(2)}`)
);

describe('Fase 1 — Armazenamento persistente (Seção 5.5)', () => {
  it('retorna booleano de forma segura mesmo quando navigator.storage.persist não existe', async () => {
    const resultado = await solicitarArmazenamentoPersistente();
    expect(typeof resultado).toBe('boolean');
  });
});
