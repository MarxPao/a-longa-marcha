import type {
  Aplicacao,
  PreRequisitoTecnologia,
  Projeto,
  RegistroDeHoras,
  Tecnologia,
  UUID,
} from '../domain';

export interface ProgressoTecnologia {
  horasInvestidas: number;
  estimativaHoras: number;
  progresso: number;
  concluida: boolean;
}

export interface ItemRankingTecnologia {
  tecnologia: Tecnologia;
  projetosDesbloqueados: number;
  tecnologiasDesbloqueadas: number;
  pontuacaoImpacto: number;
  podePesquisar: boolean;
}

/**
 * Verifica se adicionar uma dependência onde `tecnologiaId` depende de `preRequisitoId`
 * criaria um ciclo no grafo de pré-requisitos.
 * Retorna true se houver ciclo (ou auto-dependência).
 */
export function criariaCicloPreRequisito(
  preRequisitos: PreRequisitoTecnologia[],
  tecnologiaId: UUID,
  preRequisitoId: UUID
): boolean {
  if (tecnologiaId === preRequisitoId) {
    return true;
  }

  // Constroi grafo: nó -> lista de seus pré-requisitos
  const adj = new Map<UUID, UUID[]>();
  for (const pr of preRequisitos) {
    let list = adj.get(pr.tecnologiaId);
    if (!list) {
      list = [];
      adj.set(pr.tecnologiaId, list);
    }
    list.push(pr.preRequisitoId);
  }

  // Adiciona a nova aresta proposta
  const list = adj.get(tecnologiaId) ?? [];
  list.push(preRequisitoId);
  adj.set(tecnologiaId, list);

  // DFS/BFS para verificar se a partir de preRequisitoId conseguimos alcançar tecnologiaId
  const visitados = new Set<UUID>();
  const fila: UUID[] = [preRequisitoId];

  while (fila.length > 0) {
    const atual = fila.shift()!;
    if (atual === tecnologiaId) {
      return true; // ciclo encontrado!
    }
    if (visitados.has(atual)) continue;
    visitados.add(atual);

    const vizinhos = adj.get(atual) ?? [];
    for (const v of vizinhos) {
      if (!visitados.has(v)) {
        fila.push(v);
      }
    }
  }

  return false;
}

/**
 * Valida se uma tecnologia pode transitar para um novo estado.
 * Uma tecnologia só pode ir para 'pesquisando' se TODOS os seus pré-requisitos imediatos forem 'dominada'.
 */
export function validarTransicaoEstadoTecnologia(
  tecnologiaId: UUID,
  novoEstado: 'ideia' | 'pesquisando' | 'dominada',
  tecnologias: Tecnologia[],
  preRequisitos: PreRequisitoTecnologia[]
): { permitido: boolean; motivo?: string } {
  if (novoEstado === 'ideia') {
    return { permitido: true };
  }

  if (novoEstado === 'pesquisando' || novoEstado === 'dominada') {
    const tecMap = new Map(tecnologias.map((t) => [t.id, t]));
    const preReqs = preRequisitos.filter((pr) => pr.tecnologiaId === tecnologiaId);

    const naoDominados: string[] = [];
    for (const pr of preReqs) {
      const pai = tecMap.get(pr.preRequisitoId);
      if (!pai || pai.estado !== 'dominada') {
        naoDominados.push(pai ? pai.nome : pr.preRequisitoId);
      }
    }

    if (naoDominados.length > 0) {
      return {
        permitido: false,
        motivo: `Pré-requisitos pendentes não dominados: ${naoDominados.join(', ')}.`,
      };
    }
  }

  return { permitido: true };
}

/**
 * Calcula o progresso de pesquisa de uma tecnologia a partir dos registros de horas.
 */
export function calcularProgressoTecnologia(
  tecnologia: Tecnologia,
  registrosHoras: RegistroDeHoras[]
): ProgressoTecnologia {
  let horasInvestidas = 0;
  for (const reg of registrosHoras) {
    if (reg.tecnologiaId === tecnologia.id && reg.arquivadoEm === null) {
      horasInvestidas += reg.horas;
    }
  }

  const estimativaHoras = Math.max(0, tecnologia.estimativaHoras);
  const progresso =
    estimativaHoras > 0 ? Math.min(1, horasInvestidas / estimativaHoras) : 1;

  return {
    horasInvestidas,
    estimativaHoras,
    progresso,
    concluida: horasInvestidas >= estimativaHoras,
  };
}

/**
 * Ordena as tecnologias pendentes por relevância de pesquisa:
 * "quantos projetos e quantas outras tecnologias ela desbloqueia".
 */
export function rankingOQuePesquisarPrimeiro(
  tecnologias: Tecnologia[],
  preRequisitos: PreRequisitoTecnologia[],
  aplicacoes: Aplicacao[],
  projetos: Projeto[]
): ItemRankingTecnologia[] {
  const projetosAtivosMap = new Map(
    projetos.filter((p) => p.arquivadoEm === null).map((p) => [p.id, p])
  );

  // Mapear aplicações por tecnologia
  const projetosPorTec = new Map<UUID, Set<UUID>>();
  for (const ap of aplicacoes) {
    if (ap.arquivadoEm === null && projetosAtivosMap.has(ap.projetoId)) {
      let set = projetosPorTec.get(ap.tecnologiaId);
      if (!set) {
        set = new Set();
        projetosPorTec.set(ap.tecnologiaId, set);
      }
      set.add(ap.projetoId);
    }
  }

  // Mapear quais tecnologias dependem diretamente desta
  const filhasPorTec = new Map<UUID, Set<UUID>>();
  for (const pr of preRequisitos) {
    let set = filhasPorTec.get(pr.preRequisitoId);
    if (!set) {
      set = new Set();
      filhasPorTec.set(pr.preRequisitoId, set);
    }
    set.add(pr.tecnologiaId);
  }

  const ranking: ItemRankingTecnologia[] = [];

  for (const tec of tecnologias) {
    if (tec.arquivadoEm !== null || tec.estado === 'dominada') continue;

    const projs = projetosPorTec.get(tec.id);
    const projetosDesbloqueados = projs ? projs.size : 0;

    // Calcular tecnologias desbloqueadas transitivamente
    const visitadas = new Set<UUID>();
    const fila: UUID[] = Array.from(filhasPorTec.get(tec.id) ?? []);
    while (fila.length > 0) {
      const atual = fila.shift()!;
      if (!visitadas.has(atual)) {
        visitadas.add(atual);
        const prox = filhasPorTec.get(atual);
        if (prox) {
          for (const p of prox) {
            if (!visitadas.has(p)) fila.push(p);
          }
        }
      }
    }
    const tecnologiasDesbloqueadas = visitadas.size;

    const pontuacaoImpacto =
      projetosDesbloqueados * 10 + tecnologiasDesbloqueadas * 5;

    const validacao = validarTransicaoEstadoTecnologia(
      tec.id,
      'pesquisando',
      tecnologias,
      preRequisitos
    );

    ranking.push({
      tecnologia: tec,
      projetosDesbloqueados,
      tecnologiasDesbloqueadas,
      pontuacaoImpacto,
      podePesquisar: validacao.permitido,
    });
  }

  ranking.sort((a, b) => {
    if (b.pontuacaoImpacto !== a.pontuacaoImpacto) {
      return b.pontuacaoImpacto - a.pontuacaoImpacto;
    }
    if (a.podePesquisar !== b.podePesquisar) {
      return a.podePesquisar ? -1 : 1;
    }
    return a.tecnologia.nome.localeCompare(b.tecnologia.nome);
  });

  return ranking;
}
