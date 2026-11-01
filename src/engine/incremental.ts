import type { UUID } from '../domain';
import type { IndiceEstado } from './indice';

export interface MudancaDados {
  tabela: string;
  antes?: object | null;
  depois?: object | null;
}

const campo = (reg: object | null | undefined, nome: string): string | null => {
  if (!reg) return null;
  const v = (reg as Record<string, unknown>)[nome];
  return typeof v === 'string' ? v : null;
};

/**
 * Quais projetos uma mudança invalida (recálculo incremental). Conservador: nunca deixa de fora um projeto
 * afetado, mas só inclui o que de fato depende do registro alterado. 'todos' para mudanças de Config.
 */
export function projetosInvalidados(indice: IndiceEstado, m: MudancaDados): Set<UUID> | 'todos' {
  if (m.tabela === 'config') return 'todos';
  const regs = [m.antes, m.depois].filter((r): r is object => !!r);
  const out = new Set<UUID>();
  const add = (id: string | null | undefined): void => {
    if (id) out.add(id);
  };
  const projetosDoItem = (itemId: string | null): void => {
    if (itemId) for (const l of indice.listaPorItem.get(itemId) ?? []) add(l.projetoId);
  };
  const addAutonomos = (): void => {
    for (const id of indice.autonomos) add(id);
  };

  for (const r of regs) {
    switch (m.tabela) {
      case 'setores':
        for (const id of indice.projetosPorSetor.get(campo(r, 'id') ?? '') ?? []) add(id);
        break;
      case 'projetos': {
        add(campo(r, 'id'));
        break;
      }
      case 'frentes':
      case 'eventos':
      case 'vinculosCliente':
        add(campo(r, 'projetoId'));
        break;
      case 'tarefas':
        add(campo(r, 'projetoId'));
        for (const dependente of indice.bloqueadasPor.get(campo(r, 'id') ?? '') ?? []) {
          add(indice.tarefaPorId.get(dependente)?.projetoId);
        }
        break;
      case 'bloqueiosTarefa':
        add(indice.tarefaPorId.get(campo(r, 'tarefaId') ?? '')?.projetoId);
        add(indice.tarefaPorId.get(campo(r, 'bloqueadaPorId') ?? '')?.projetoId);
        break;
      case 'clientes':
        for (const v of indice.vinculosPorCliente.get(campo(r, 'id') ?? '') ?? []) add(v.projetoId);
        break;
      case 'lancamentos': {
        const pid = campo(r, 'projetoId');
        add(pid);
        for (const l of indice.ligacoesPorProjeto.get(pid ?? '') ?? []) {
          add(l.origemId);
          add(l.destinoId);
        }
        break;
      }
      case 'fornecedores':
        for (const it of indice.itensPorFornecedor.get(campo(r, 'id') ?? '') ?? []) projetosDoItem(it.id);
        break;
      case 'itens':
        projetosDoItem(campo(r, 'id'));
        break;
      case 'saldos':
      case 'movimentos':
        projetosDoItem(campo(r, 'itemId'));
        break;
      case 'itensDeLista':
        add(campo(r, 'projetoId'));
        projetosDoItem(campo(r, 'itemId'));
        break;
      case 'registrosDeHoras': {
        const pid = campo(r, 'projetoId');
        add(pid);
        if (indice.projetos.get(pid ?? '')?.autonomia === 'direto') addAutonomos();
        break;
      }
      case 'ligacoes':
        add(campo(r, 'origemId'));
        add(campo(r, 'destinoId'));
        break;
      case 'instantaneos': {
        const por = (r as { porProjeto?: Record<string, unknown> }).porProjeto;
        if (por) for (const id of Object.keys(por)) add(id);
        break;
      }
      default:
        break; // estagios, categorias, tecnologias, aplicacoes, tipos de ligação, armazéns: sem efeito nos derivados da 2A
    }
  }

  if (m.tabela === 'projetos') {
    const a = m.antes as Record<string, unknown> | null | undefined;
    const d = m.depois as Record<string, unknown> | null | undefined;
    const mudouMedia =
      !a || !d || a['horasAlvoSemana'] !== d['horasAlvoSemana'] || a['autonomia'] !== d['autonomia'] || a['arquivadoEm'] !== d['arquivadoEm'];
    if (mudouMedia) addAutonomos();
  }
  return out;
}
