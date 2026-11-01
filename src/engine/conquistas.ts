import type {
  Data,
  DumpBanco,
  UUID,
} from '../domain';
import { calcularDerivadosProjeto } from './derivados';
import { construirIndice, type IndiceEstado } from './indice';
import { somarDias } from './tempo';

export interface DefinicaoConquista {
  id: string;
  titulo: string;
  descricao: string;
}

export interface ConquistaDesbloqueada {
  id: string;
  titulo: string;
  descricao: string;
  projetoId: UUID | null;
  desbloqueadaEm: Data;
}

export const CATALOGO_CONQUISTAS: Record<string, DefinicaoConquista> = {
  consistencia: {
    id: 'consistencia',
    titulo: 'Consistência de Ferro',
    descricao: '7 semanas consecutivas sem nenhuma tarefa crítica vencida.',
  },
  expansao: {
    id: 'expansao',
    titulo: 'Expansão Territorial',
    descricao: 'Fundou o primeiro projeto em um setor anteriormente inexplorado.',
  },
  sinergia: {
    id: 'sinergia',
    titulo: 'Mestria Sinergética',
    descricao: 'Uma tecnologia dominada foi aplicada com sucesso em 3 ou mais projetos.',
  },
  resiliencia: {
    id: 'resiliencia',
    titulo: 'Resiliência Comprovada',
    descricao: 'Superou uma crise severa recuperando a saúde do projeto sem perder nenhum cliente.',
  },
  escala: {
    id: 'escala',
    titulo: 'Grande Metrópole',
    descricao: 'Primeiro projeto a atingir a fase de Metrópole (nível 6).',
  },
  diplomacia: {
    id: 'diplomacia',
    titulo: 'Rede Diplomática',
    descricao: 'Manteve 10 ou mais clientes ativos simultaneamente.',
  },
};

export interface DadosTurnoConquistas {
  porProjeto?: Record<UUID, { saude: number; fase: number; moral: number }>;
  indice?: IndiceEstado;
}

/**
 * Avalia regras sobre os dados reais do banco e retorna as conquistas
 * que foram alcançadas nesta semana e ainda não constam como desbloqueadas em meta.conquistas.
 */
export function avaliarConquistas(
  dump: DumpBanco,
  semanaAtual: Data,
  fasesAnteriores?: Record<UUID, number>,
  dadosTurno?: DadosTurnoConquistas
): ConquistaDesbloqueada[] {
  const desbloqueadas: ConquistaDesbloqueada[] = [];
  const jaDesbloqueadas = dump.meta.conquistas;

  const projetosAtivos = dump.projetos.filter((p) => p.arquivadoEm === null);
  let indiceCache: IndiceEstado | null = dadosTurno?.indice ?? null;

  function obterFaseESaude(projId: UUID): { fase: number; saude: number } {
    if (dadosTurno?.porProjeto && dadosTurno.porProjeto[projId]) {
      const info = dadosTurno.porProjeto[projId]!;
      return { fase: info.fase, saude: info.saude };
    }
    if (!indiceCache) {
      indiceCache = construirIndice(dump);
    }
    const der = calcularDerivadosProjeto(indiceCache, projId, semanaAtual, dump.meta.config);
    return { fase: der.fase.fase, saude: der.saude.pontuacao };
  }

  // 1. Escala: primeiro projeto em Metrópole (fase >= 6)
  if (!jaDesbloqueadas['escala']) {
    for (const proj of projetosAtivos) {
      const { fase } = obterFaseESaude(proj.id);
      if (fase >= 6) {
        desbloqueadas.push({
          id: 'escala',
          titulo: CATALOGO_CONQUISTAS.escala!.titulo,
          descricao: CATALOGO_CONQUISTAS.escala!.descricao,
          projetoId: proj.id,
          desbloqueadaEm: semanaAtual,
        });
        break;
      }
    }
  }

  // 2. Diplomacia: 10 ou mais clientes ativos simultaneamente
  if (!jaDesbloqueadas['diplomacia']) {
    const clientesAtivos = dump.clientes.filter(
      (c) => c.arquivadoEm === null && c.statusRelacao === 'ativo'
    );
    if (clientesAtivos.length >= 10) {
      desbloqueadas.push({
        id: 'diplomacia',
        titulo: CATALOGO_CONQUISTAS.diplomacia!.titulo,
        descricao: CATALOGO_CONQUISTAS.diplomacia!.descricao,
        projetoId: null,
        desbloqueadaEm: semanaAtual,
      });
    }
  }

  // 3. Sinergia: uma tecnologia aplicada em 3 ou mais projetos
  if (!jaDesbloqueadas['sinergia']) {
    const projetosPorTec = new Map<UUID, Set<UUID>>();
    for (const ap of dump.aplicacoes) {
      if (ap.arquivadoEm === null) {
        let set = projetosPorTec.get(ap.tecnologiaId);
        if (!set) {
          set = new Set();
          projetosPorTec.set(ap.tecnologiaId, set);
        }
        set.add(ap.projetoId);
      }
    }

    for (const [, projs] of projetosPorTec.entries()) {
      if (projs.size >= 3) {
        desbloqueadas.push({
          id: 'sinergia',
          titulo: CATALOGO_CONQUISTAS.sinergia!.titulo,
          descricao: CATALOGO_CONQUISTAS.sinergia!.descricao,
          projetoId: Array.from(projs)[0]!,
          desbloqueadaEm: semanaAtual,
        });
        break;
      }
    }
  }

  // 4. Expansão: projetos em setores diferentes
  if (!jaDesbloqueadas['expansao']) {
    const setoresComProjetos = new Set(projetosAtivos.map((p) => p.setorId));
    // Se há pelo menos 2 setores ocupados
    if (setoresComProjetos.size >= 2) {
      desbloqueadas.push({
        id: 'expansao',
        titulo: CATALOGO_CONQUISTAS.expansao!.titulo,
        descricao: CATALOGO_CONQUISTAS.expansao!.descricao,
        projetoId: projetosAtivos[0]?.id ?? null,
        desbloqueadaEm: semanaAtual,
      });
    }
  }

  // 5. Consistência: 7 semanas seguidas sem tarefa crítica (prioridade 1) vencida
  if (!jaDesbloqueadas['consistencia']) {
    const tarefasCriticas = dump.tarefas.filter(
      (t) => t.arquivadoEm === null && t.prioridade === 1
    );

    let houveTarefaCriticaVencida = false;
    const inicioJanela = somarDias(semanaAtual, -49); // 7 semanas

    for (const t of tarefasCriticas) {
      if (t.prazo && t.prazo >= inicioJanela && t.prazo <= semanaAtual) {
        if (t.status !== 'feita' && t.prazo < semanaAtual) {
          houveTarefaCriticaVencida = true;
          break;
        }
        if (t.concluidaEm && t.concluidaEm > t.prazo) {
          houveTarefaCriticaVencida = true;
          break;
        }
      }
    }

    const instantaneosPassados = dump.instantaneos.filter((inst) => inst.semana <= semanaAtual);
    if (!houveTarefaCriticaVencida && instantaneosPassados.length >= 7) {
      desbloqueadas.push({
        id: 'consistencia',
        titulo: CATALOGO_CONQUISTAS.consistencia!.titulo,
        descricao: CATALOGO_CONQUISTAS.consistencia!.descricao,
        projetoId: null,
        desbloqueadaEm: semanaAtual,
      });
    }
  }

  // 6. Resiliência: projeto recuperou de crítico (< 40) para saudável (>= 70)
  if (!jaDesbloqueadas['resiliencia']) {
    for (const proj of projetosAtivos) {
      const historicoProj = dump.instantaneos
        .map((inst) => inst.porProjeto[proj.id])
        .filter((info): info is NonNullable<typeof info> => info !== undefined);

      const esteveCritico = historicoProj.some((h) => h.saude < 40);
      if (esteveCritico) {
        const { saude } = obterFaseESaude(proj.id);
        if (saude >= 70) {
          desbloqueadas.push({
            id: 'resiliencia',
            titulo: CATALOGO_CONQUISTAS.resiliencia!.titulo,
            descricao: CATALOGO_CONQUISTAS.resiliencia!.descricao,
            projetoId: proj.id,
            desbloqueadaEm: semanaAtual,
          });
          break;
        }
      }
    }
  }

  // Evento especial de promoção de fase (Seção 3.4 e 4.4)
  if (fasesAnteriores) {
    for (const proj of projetosAtivos) {
      const faseAnt = fasesAnteriores[proj.id];
      if (faseAnt !== undefined) {
        const { fase } = obterFaseESaude(proj.id);
        if (fase > faseAnt) {
          desbloqueadas.push({
            id: `promocao_fase_${proj.id}_${fase}`,
            titulo: `Evolução de Cidade: ${proj.nome}`,
            descricao: `${proj.nome} ascendeu de ${faseAnt} para a fase ${fase}!`,
            projetoId: proj.id,
            desbloqueadaEm: semanaAtual,
          });
        }
      }
    }
  }

  return desbloqueadas;
}
