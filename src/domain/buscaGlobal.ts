import type { DumpBanco, UUID } from './entidades';

export type TipoResultadoBusca =
  | 'projeto'
  | 'tarefa'
  | 'cliente'
  | 'item'
  | 'tecnologia';

export interface ResultadoBuscaGlobal {
  id: UUID;
  tipo: TipoResultadoBusca;
  titulo: string;
  subtitulo: string;
  projetoAlvoId: UUID | null;
  coordenadas: { x: number; z: number } | null;
  relevancia: number;
}

interface EntradaIndiceBusca {
  id: UUID;
  tipo: TipoResultadoBusca;
  titulo: string;
  subtitulo: string;
  textoBuscaNormalizado: string;
  tituloNormalizado: string;
  projetoAlvoId: UUID | null;
  coordenadas: { x: number; z: number } | null;
}

export interface IndiceBuscaGlobal {
  entradas: EntradaIndiceBusca[];
}

export function normalizarTextoBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Constrói um índice em memória normalizado para buscas instantâneas (< 5 ms mesmo com 500 projetos e 5.000 tarefas).
 */
export function construirIndiceBusca(dump: DumpBanco): IndiceBuscaGlobal {
  const entradas: EntradaIndiceBusca[] = [];

  const projetosPorId = new Map(
    dump.projetos.map((p) => [p.id, p])
  );
  const setoresPorId = new Map(
    dump.setores.map((s) => [s.id, s])
  );

  // 1. Projetos
  for (const p of dump.projetos) {
    if (p.arquivadoEm !== null) continue;
    const setorNome = setoresPorId.get(p.setorId)?.nome ?? 'Território';
    const tituloNormalizado = normalizarTextoBusca(p.nome);
    const descNormalizada = normalizarTextoBusca(p.descricao || '');
    entradas.push({
      id: p.id,
      tipo: 'projeto',
      titulo: p.nome,
      subtitulo: `Cidade · ${setorNome} (${Math.round(p.x)}, ${Math.round(p.z)})`,
      textoBuscaNormalizado: `${tituloNormalizado} ${descNormalizada} ${normalizarTextoBusca(setorNome)}`,
      tituloNormalizado,
      projetoAlvoId: p.id,
      coordenadas: { x: p.x, z: p.z },
    });
  }

  // 2. Tarefas
  for (const t of dump.tarefas) {
    if (t.arquivadoEm !== null) continue;
    const proj = projetosPorId.get(t.projetoId);
    const tituloNormalizado = normalizarTextoBusca(t.titulo);
    entradas.push({
      id: t.id,
      tipo: 'tarefa',
      titulo: t.titulo,
      subtitulo: `Tarefa · ${proj?.nome ?? 'Projeto'} (${t.status})`,
      textoBuscaNormalizado: `${tituloNormalizado} ${normalizarTextoBusca(t.descricao || '')} ${normalizarTextoBusca(proj?.nome ?? '')}`,
      tituloNormalizado,
      projetoAlvoId: proj?.id ?? null,
      coordenadas: proj ? { x: proj.x, z: proj.z } : null,
    });
  }

  // Mapear primeiro projeto ativo de cada cliente
  const projetoPorClienteId = new Map<UUID, UUID>();
  for (const v of dump.vinculosCliente) {
    if (v.arquivadoEm === null && !projetoPorClienteId.has(v.clienteId)) {
      projetoPorClienteId.set(v.clienteId, v.projetoId);
    }
  }

  // 3. Clientes
  for (const c of dump.clientes) {
    if (c.arquivadoEm !== null) continue;
    const projId = projetoPorClienteId.get(c.id) ?? null;
    const proj = projId ? projetosPorId.get(projId) : undefined;
    const tituloNormalizado = normalizarTextoBusca(c.nome);
    entradas.push({
      id: c.id,
      tipo: 'cliente',
      titulo: c.nome,
      subtitulo: proj
        ? `Cliente · Vinculado a ${proj.nome}`
        : `Cliente · ${c.statusRelacao}`,
      textoBuscaNormalizado: `${tituloNormalizado} ${normalizarTextoBusca(c.contato || '')}`,
      tituloNormalizado,
      projetoAlvoId: proj?.id ?? null,
      coordenadas: proj ? { x: proj.x, z: proj.z } : null,
    });
  }

  // Mapear primeiro projeto de cada item de estoque
  const projetoPorItemId = new Map<UUID, UUID>();
  for (const il of dump.itensDeLista) {
    if (il.arquivadoEm === null && !projetoPorItemId.has(il.itemId)) {
      projetoPorItemId.set(il.itemId, il.projetoId);
    }
  }

  // 4. Itens de Estoque
  for (const item of dump.itens) {
    if (item.arquivadoEm !== null) continue;
    const projId = projetoPorItemId.get(item.id) ?? null;
    const proj = projId ? projetosPorId.get(projId) : undefined;
    const tituloNormalizado = normalizarTextoBusca(item.nome);
    entradas.push({
      id: item.id,
      tipo: 'item',
      titulo: item.nome,
      subtitulo: proj
        ? `Item (${item.unidade}) · Usado em ${proj.nome}`
        : `Item de Estoque (${item.unidade})`,
      textoBuscaNormalizado: tituloNormalizado,
      tituloNormalizado,
      projetoAlvoId: proj?.id ?? null,
      coordenadas: proj ? { x: proj.x, z: proj.z } : null,
    });
  }

  // Mapear primeiro projeto de cada tecnologia
  const projetoPorTechId = new Map<UUID, UUID>();
  for (const ap of dump.aplicacoes) {
    if (ap.arquivadoEm === null && !projetoPorTechId.has(ap.tecnologiaId)) {
      projetoPorTechId.set(ap.tecnologiaId, ap.projetoId);
    }
  }

  // 5. Tecnologias
  for (const tech of dump.tecnologias) {
    if (tech.arquivadoEm !== null) continue;
    const projId = projetoPorTechId.get(tech.id) ?? null;
    const proj = projId ? projetosPorId.get(projId) : undefined;
    const tituloNormalizado = normalizarTextoBusca(tech.nome);
    entradas.push({
      id: tech.id,
      tipo: 'tecnologia',
      titulo: tech.nome,
      subtitulo: proj
        ? `Tecnologia (${tech.estado}) · Aplicada em ${proj.nome}`
        : `Tecnologia (${tech.estado})`,
      textoBuscaNormalizado: `${tituloNormalizado} ${normalizarTextoBusca(tech.descricao || '')}`,
      tituloNormalizado,
      projetoAlvoId: proj?.id ?? null,
      coordenadas: proj ? { x: proj.x, z: proj.z } : null,
    });
  }

  return { entradas };
}

/**
 * Executa a busca global sobre o índice em memória, retornando resultados ordenados por relevância.
 */
export function executarBuscaGlobal(
  indice: IndiceBuscaGlobal,
  termo: string,
  limite = 18
): ResultadoBuscaGlobal[] {
  const q = normalizarTextoBusca(termo);
  if (!q) {
    // Sem filtro digitado, retorna as primeiras cidades ativas para navegação rápida
    const iniciais: ResultadoBuscaGlobal[] = [];
    for (const e of indice.entradas) {
      if (e.tipo === 'projeto') {
        iniciais.push({
          id: e.id,
          tipo: e.tipo,
          titulo: e.titulo,
          subtitulo: e.subtitulo,
          projetoAlvoId: e.projetoAlvoId,
          coordenadas: e.coordenadas,
          relevancia: 50,
        });
        if (iniciais.length >= limite) break;
      }
    }
    return iniciais;
  }

  const resultados: ResultadoBuscaGlobal[] = [];

  for (let i = 0; i < indice.entradas.length; i++) {
    const e = indice.entradas[i]!;
    if (!e.textoBuscaNormalizado.includes(q)) continue;

    let relevancia = 10;
    if (e.tituloNormalizado === q) {
      relevancia = 100;
    } else if (e.tituloNormalizado.startsWith(q)) {
      relevancia = 80;
    } else if (e.tituloNormalizado.includes(q)) {
      relevancia = 60;
    }

    // Prioriza projetos diretos em caso de empate
    if (e.tipo === 'projeto') relevancia += 5;

    resultados.push({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      subtitulo: e.subtitulo,
      projetoAlvoId: e.projetoAlvoId,
      coordenadas: e.coordenadas,
      relevancia,
    });
  }

  resultados.sort((a, b) => b.relevancia - a.relevancia);
  return resultados.slice(0, limite);
}
