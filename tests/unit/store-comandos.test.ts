import { describe, expect, it } from 'vitest';
import type { Projeto, Tarefa } from '../../src/domain';
import { RepositorioMemoria } from '../../src/repository';
import { seedDemo } from '../../src/seed';
import { useCampanhaStore } from '../../src/store';

describe('Fase 3 — Store Zustand e Barramento de Comandos', () => {
  it('inicializa a store e calcula derivados de projetos e globais', async () => {
    const demo = seedDemo('pequeno', 'semente-teste-store');
    const repo = new RepositorioMemoria(demo);
    await useCampanhaStore.getState().inicializar(repo, demo);

    const estado = useCampanhaStore.getState();
    expect(estado.dump.projetos.length).toBeGreaterThan(0);
    expect(estado.derivadosPorProjeto.size).toBe(estado.dump.projetos.length);
    expect(estado.derivadosGlobais.caixaCentavos).toBeTypeOf('number');
  });

  it('cria entidade via comando validado por Zod e permite desfazer (Ctrl+Z)', async () => {
    const demo = seedDemo('pequeno', 'semente-teste-criar');
    const repo = new RepositorioMemoria(demo);
    await useCampanhaStore.getState().inicializar(repo, demo);

    const totalProjetosAntes = useCampanhaStore.getState().dump.projetos.length;
    const setorId = useCampanhaStore.getState().dump.setores[0]!.id;

    // Criar projeto válido
    const novoProjeto = await useCampanhaStore.getState().criarEntidade<Projeto>('projetos', {
      nome: 'Projeto Comandos Teste',
      descricao: 'Descrição de teste',
      setorId,
      x: 10,
      z: 20,
      estagioId: null,
      horasAlvoSemana: 12,
      autonomia: 'direto',
      notas: '',
      notaLicoes: null,
    });

    expect(novoProjeto.id).toBeTruthy();
    expect(useCampanhaStore.getState().dump.projetos.length).toBe(totalProjetosAntes + 1);
    expect(useCampanhaStore.getState().podeDesfazer()).toBe(true);

    // Desfazer comando
    const desfez = await useCampanhaStore.getState().desfazer();
    expect(desfez).toBe(true);
    expect(useCampanhaStore.getState().dump.projetos.length).toBe(totalProjetosAntes);
  });

  it('rejeita entidade inválida pelo schema Zod sem alterar o estado', async () => {
    const demo = seedDemo('pequeno', 'semente-teste-invalida');
    const repo = new RepositorioMemoria(demo);
    await useCampanhaStore.getState().inicializar(repo, demo);

    const totalTarefasAntes = useCampanhaStore.getState().dump.tarefas.length;

    // Tentar criar tarefa com prioridade fora de 1..4
    await expect(
      useCampanhaStore.getState().criarEntidade<Tarefa>('tarefas', {
        projetoId: useCampanhaStore.getState().dump.projetos[0]!.id,
        titulo: 'Tarefa Inválida',
        descricao: '',
        frenteId: null,
        status: 'pendente',
        prioridade: 99 as never, // Inválido
        prazo: '2026-10-30',
        estimativaHoras: 2,
        concluidaEm: null,
        recorrencia: null,
        origemRecorrenciaId: null,
      })
    ).rejects.toThrow();

    expect(useCampanhaStore.getState().dump.tarefas.length).toBe(totalTarefasAntes);
  });

  it('exige nota de lições aprendidas para arquivar projeto como Ruínas (Caso 7.2)', async () => {
    const demo = seedDemo('pequeno', 'semente-teste-ruinas');
    const repo = new RepositorioMemoria(demo);
    await useCampanhaStore.getState().inicializar(repo, demo);

    const projeto = useCampanhaStore.getState().dump.projetos[0]!;

    // Limpa notas antes
    await useCampanhaStore.getState().atualizarEntidade<Projeto>('projetos', projeto.id, {
      notas: '',
    });

    // Rejeita arquivamento sem lições
    await expect(
      useCampanhaStore.getState().arquivarEntidade('projetos', projeto.id, '')
    ).rejects.toThrow(/lições aprendidas/i);

    // Aceita arquivamento quando lições aprendidas são fornecidas
    await useCampanhaStore
      .getState()
      .arquivarEntidade('projetos', projeto.id, 'Pivô de mercado mal planejado');

    const projetoArquivado = useCampanhaStore
      .getState()
      .dump.projetos.find((p) => p.id === projeto.id);
    expect(projetoArquivado?.arquivadoEm).not.toBeNull();
    expect(projetoArquivado?.notas).toContain('Pivô de mercado');
  });

  it('fecha turno semanal, avança a semana e permite desfazer o turno', async () => {
    const demo = seedDemo('pequeno', 'semente-teste-turno-store');
    const repo = new RepositorioMemoria(demo);
    await useCampanhaStore.getState().inicializar(repo, demo);

    const semanaAntes = useCampanhaStore.getState().semanaAtual;
    const resultado = await useCampanhaStore.getState().fecharTurno();

    expect(resultado.fechamentoId).toBeTruthy();
    expect(useCampanhaStore.getState().semanaAtual).not.toBe(semanaAntes);

    // Desfaz último fechamento
    const desfez = await useCampanhaStore.getState().desfazerUltimoTurno();
    expect(desfez).toBe(true);
    expect(useCampanhaStore.getState().semanaAtual).toBe(semanaAntes);
  });

  it('importa JSON de forma atômica e rejeita JSON corrompido sem tocar o estado', async () => {
    const demo = seedDemo('pequeno', 'semente-teste-import-store');
    const repo = new RepositorioMemoria(demo);
    await useCampanhaStore.getState().inicializar(repo, demo);

    const totalProjetosAntes = useCampanhaStore.getState().dump.projetos.length;

    // Exporta e reimporta
    const dumpExportado = useCampanhaStore.getState().exportarJson();
    await useCampanhaStore.getState().importarJson(dumpExportado);
    expect(useCampanhaStore.getState().dump.projetos.length).toBe(totalProjetosAntes);

    // Tentar importar payload corrompido
    await expect(
      useCampanhaStore.getState().importarJson({ versaoEsquema: 1, projetos: 'invalido' })
    ).rejects.toThrow();

    expect(useCampanhaStore.getState().dump.projetos.length).toBe(totalProjetosAntes);
  });
});
