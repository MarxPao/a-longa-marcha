import type {
  Config,
  Data,
  DumpBanco,
  Item,
  UUID,
} from '../domain';
import type { IndiceEstado } from './indice';
import { diferencaDias, fimDaSemana } from './tempo';

export type TipoDetector =
  | 'inanicao'
  | 'sinergia'
  | 'gargalo_atencao'
  | 'concentracao_cliente'
  | 'ponto_unico_falha'
  | 'estoque'
  | 'tecnologia_alto_retorno';

export type NivelAlerta = 'amarelo' | 'vermelho';

export interface AlertaDetector {
  detector: TipoDetector;
  nivel: NivelAlerta;
  tipoEvento: string;
  titulo: string;
  projetoId: UUID | null;
  motivo: string;
  acaoSugerida: string;
  detalhes?: Record<string, unknown>;
}

/**
 * Executa todos os 7 detectores de inteligência da Seção 3.6 sobre os dados do banco.
 * Devolve lista pura de alertas. Nenhum detector altera dados diretamente.
 */
export function executarDetectores(
  dump: DumpBanco,
  hoje: Data,
  semana: Data,
  config: Config = dump.meta.config,
  indice?: IndiceEstado
): AlertaDetector[] {
  const alertas: AlertaDetector[] = [];

  const projetosAtivos = dump.projetos.filter((p) => p.arquivadoEm === null);
  const mapProjetosAtivos = new Map(projetosAtivos.map((p) => [p.id, p]));

  // --------------------------------------------------------------------------
  // 1. Inanição
  // Projeto ativo sem hora nem tarefa concluída por 7 dias (amarelo) ou 30 dias (vermelho)
  // --------------------------------------------------------------------------
  for (const projeto of projetosAtivos) {
    let ultimaAtividade: Data = projeto.criadoEm.slice(0, 10);

    const registrosDoProjeto = indice
      ? (indice.registrosPorProjeto.get(projeto.id) ?? [])
      : dump.registrosDeHoras.filter((h) => h.projetoId === projeto.id);

    for (const h of registrosDoProjeto) {
      if (h.arquivadoEm === null && h.data > ultimaAtividade) {
        ultimaAtividade = h.data;
      }
    }

    const tarefasDoProjeto = indice
      ? (indice.tarefasPorProjeto.get(projeto.id) ?? [])
      : dump.tarefas.filter((t) => t.projetoId === projeto.id);

    for (const t of tarefasDoProjeto) {
      if (t.concluidaEm && t.arquivadoEm === null && t.concluidaEm > ultimaAtividade) {
        ultimaAtividade = t.concluidaEm;
      }
    }

    const diasSemAtividade = Math.max(0, diferencaDias(hoje, ultimaAtividade));

    if (diasSemAtividade >= config.detectores.inanicaoVermelhoDias) {
      alertas.push({
        detector: 'inanicao',
        nivel: 'vermelho',
        tipoEvento: 'detector:inanicao_vermelho',
        titulo: `Inanição Crítica: ${projeto.nome}`,
        projetoId: projeto.id,
        motivo: `Projeto ativo sem registro de horas nem tarefas concluídas há ${diasSemAtividade} dias.`,
        acaoSugerida: 'reativar, pausar ou arquivar',
        detalhes: { diasSemAtividade, limite: config.detectores.inanicaoVermelhoDias },
      });
    } else if (diasSemAtividade >= config.detectores.inanicaoAmareloDias) {
      alertas.push({
        detector: 'inanicao',
        nivel: 'amarelo',
        tipoEvento: 'detector:inanicao_amarelo',
        titulo: `Inanição: ${projeto.nome}`,
        projetoId: projeto.id,
        motivo: `Projeto ativo sem registro de horas nem tarefas concluídas há ${diasSemAtividade} dias.`,
        acaoSugerida: 'reativar, pausar ou arquivar',
        detalhes: { diasSemAtividade, limite: config.detectores.inanicaoAmareloDias },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Sinergia
  // Dois projetos do mesmo setor, sem ligação, que usam a mesma tecnologia
  // --------------------------------------------------------------------------
  const tecsPorProjeto = new Map<UUID, Set<UUID>>();
  for (const ap of dump.aplicacoes) {
    if (ap.arquivadoEm === null && mapProjetosAtivos.has(ap.projetoId)) {
      let set = tecsPorProjeto.get(ap.projetoId);
      if (!set) {
        set = new Set();
        tecsPorProjeto.set(ap.projetoId, set);
      }
      set.add(ap.tecnologiaId);
    }
  }

  const paresLigados = new Set<string>();
  for (const lig of dump.ligacoes) {
    if (lig.arquivadoEm === null) {
      paresLigados.add(`${lig.origemId}:${lig.destinoId}`);
      paresLigados.add(`${lig.destinoId}:${lig.origemId}`);
    }
  }

  // Agrupar projetos por setor para evitar comparações entre setores diferentes
  const projetosPorSetor = new Map<UUID, typeof projetosAtivos>();
  for (const p of projetosAtivos) {
    let list = projetosPorSetor.get(p.setorId);
    if (!list) {
      list = [];
      projetosPorSetor.set(p.setorId, list);
    }
    list.push(p);
  }

  for (const grupoSetor of projetosPorSetor.values()) {
    for (let i = 0; i < grupoSetor.length; i++) {
      const p1 = grupoSetor[i]!;
      const tecs1 = tecsPorProjeto.get(p1.id);
      if (!tecs1 || tecs1.size === 0) continue;

      for (let j = i + 1; j < grupoSetor.length; j++) {
        const p2 = grupoSetor[j]!;
        if (paresLigados.has(`${p1.id}:${p2.id}`)) continue;

        const tecs2 = tecsPorProjeto.get(p2.id);
        if (!tecs2) continue;

        for (const tecId of tecs1) {
          if (tecs2.has(tecId)) {
            const tec = dump.tecnologias.find((t) => t.id === tecId);
            const tecNome = tec ? tec.nome : 'Tecnologia compartilhada';
            alertas.push({
              detector: 'sinergia',
              nivel: 'amarelo',
              tipoEvento: 'detector:sinergia',
              titulo: `Oportunidade de Sinergia: ${p1.nome} e ${p2.nome}`,
              projetoId: p1.id,
              motivo: `Ambos os projetos pertencem ao mesmo setor e aplicam a tecnologia ${tecNome}, sem ligação entre si.`,
              acaoSugerida: 'criar ligação',
              detalhes: { projeto1Id: p1.id, projeto2Id: p2.id, tecnologiaId: tecId },
            });
            break;
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Gargalo de atenção
  // a) Horas-alvo somadas > horas disponíveis
  // b) Projeto direto com menos de horasMinimasProjetoDireto na semana
  // c) Troca de contexto (> setoresTrocaContexto na semana)
  // --------------------------------------------------------------------------
  const somaHorasAlvo = projetosAtivos.reduce((s, p) => s + p.horasAlvoSemana, 0);
  if (somaHorasAlvo > config.horasSemanaisDisponiveis) {
    alertas.push({
      detector: 'gargalo_atencao',
      nivel: 'amarelo',
      tipoEvento: 'detector:gargalo_horas_totais',
      titulo: 'Gargalo de Atenção: Horas Planejadas Excessivas',
      projetoId: null,
      motivo: `As metas somam ${somaHorasAlvo} h por semana, acima das ${config.horasSemanaisDisponiveis} h disponíveis.`,
      acaoSugerida: 'redistribuir horas',
      detalhes: { somaHorasAlvo, disponiveis: config.horasSemanaisDisponiveis },
    });
  }

  const horasNaSemanaPorProjeto = new Map<UUID, number>();
  const setoresComHorasNaSemana = new Set<UUID>();
  const fimSemanaCalc = fimDaSemana(semana);

  for (const h of dump.registrosDeHoras) {
    if (h.arquivadoEm === null && h.data >= semana && h.data <= fimSemanaCalc) {
      const atual = horasNaSemanaPorProjeto.get(h.projetoId) ?? 0;
      horasNaSemanaPorProjeto.set(h.projetoId, atual + h.horas);

      const proj = mapProjetosAtivos.get(h.projetoId);
      if (proj) {
        setoresComHorasNaSemana.add(proj.setorId);
      }
    }
  }

  for (const p of projetosAtivos) {
    if (p.autonomia === 'direto') {
      const horasReg = horasNaSemanaPorProjeto.get(p.id) ?? 0;
      if (horasReg < config.detectores.horasMinimasProjetoDireto) {
        alertas.push({
          detector: 'gargalo_atencao',
          nivel: 'amarelo',
          tipoEvento: 'detector:gargalo_projeto_direto',
          titulo: `Atenção Insuficiente: ${p.nome}`,
          projetoId: p.id,
          motivo: `Projeto direto registrou ${horasReg} h nesta semana (mínimo esperado: ${config.detectores.horasMinimasProjetoDireto} h).`,
          acaoSugerida: 'redistribuir horas',
          detalhes: { horasRegistradas: horasReg, minimoEsperado: config.detectores.horasMinimasProjetoDireto },
        });
      }
    }
  }

  if (setoresComHorasNaSemana.size > config.detectores.setoresTrocaContexto) {
    alertas.push({
      detector: 'gargalo_atencao',
      nivel: 'amarelo',
      tipoEvento: 'detector:troca_contexto',
      titulo: 'Dispersão de Atenção: Muitos Setores Ativos',
      projetoId: null,
      motivo: `Horas registradas em ${setoresComHorasNaSemana.size} setores nesta semana (limite recomendado: ${config.detectores.setoresTrocaContexto}).`,
      acaoSugerida: 'agrupar blocos por setor',
      detalhes: { setoresAtivos: setoresComHorasNaSemana.size, limite: config.detectores.setoresTrocaContexto },
    });
  }

  // --------------------------------------------------------------------------
  // 4. Concentração de cliente
  // --------------------------------------------------------------------------
  let receitaTotalCentavos = 0;
  const receitaPorCliente = new Map<UUID, number>();

  for (const l of dump.lancamentos) {
    if (l.arquivadoEm === null && l.tipo === 'receita') {
      receitaTotalCentavos += l.valorCentavos;
      if (l.clienteId) {
        const atual = receitaPorCliente.get(l.clienteId) ?? 0;
        receitaPorCliente.set(l.clienteId, atual + l.valorCentavos);
      }
    }
  }

  const projetosPorCliente = new Map<UUID, Set<UUID>>();
  for (const v of dump.vinculosCliente) {
    if (v.arquivadoEm === null && (v.fim === null || v.fim >= hoje)) {
      if (mapProjetosAtivos.has(v.projetoId)) {
        let set = projetosPorCliente.get(v.clienteId);
        if (!set) {
          set = new Set();
          projetosPorCliente.set(v.clienteId, set);
        }
        set.add(v.projetoId);
      }
    }
  }

  const clientesAtivos = dump.clientes.filter((c) => c.arquivadoEm === null);
  for (const cliente of clientesAtivos) {
    const receitaCli = receitaPorCliente.get(cliente.id) ?? 0;
    const razaoReceita = receitaTotalCentavos > 0 ? receitaCli / receitaTotalCentavos : 0;
    const projs = projetosPorCliente.get(cliente.id);
    const qtdProjetos = projs ? projs.size : 0;

    const excedeReceita = razaoReceita > config.detectores.concentracaoClientePercentual;
    const excedeProjetos = qtdProjetos >= config.detectores.projetosPorCliente;

    if (excedeReceita || excedeProjetos) {
      const motivos: string[] = [];
      if (excedeReceita) {
        motivos.push(`responde por ${(razaoReceita * 100).toFixed(1)}% da receita total`);
      }
      if (excedeProjetos) {
        motivos.push(`está presente em ${qtdProjetos} projetos simultâneos`);
      }

      alertas.push({
        detector: 'concentracao_cliente',
        nivel: 'amarelo',
        tipoEvento: 'detector:concentracao_cliente',
        titulo: `Concentração de Cliente: ${cliente.nome}`,
        projetoId: projs && projs.size > 0 ? Array.from(projs)[0]! : null,
        motivo: `Cliente ${cliente.nome} ${motivos.join(' e ')}.`,
        acaoSugerida: 'plano de diversificação',
        detalhes: { clienteId: cliente.id, razaoReceita, qtdProjetos },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. Ponto único de falha
  // --------------------------------------------------------------------------
  const itensMap = new Map<UUID, Item>(dump.itens.map((i) => [i.id, i]));
  const fornecedoresMap = new Map(dump.fornecedores.map((f) => [f.id, f]));
  const projetosPorFornecedor = new Map<UUID, Set<UUID>>();
  const projetosPorEquipamento = new Map<UUID, Set<UUID>>();

  for (const il of dump.itensDeLista) {
    if (il.arquivadoEm === null && mapProjetosAtivos.has(il.projetoId)) {
      const item = itensMap.get(il.itemId);
      if (!item || item.arquivadoEm !== null) continue;

      if (item.fornecedorId) {
        let set = projetosPorFornecedor.get(item.fornecedorId);
        if (!set) {
          set = new Set();
          projetosPorFornecedor.set(item.fornecedorId, set);
        }
        set.add(il.projetoId);
      }

      if (item.tipo === 'equipamento') {
        let set = projetosPorEquipamento.get(item.id);
        if (!set) {
          set = new Set();
          projetosPorEquipamento.set(item.id, set);
        }
        set.add(il.projetoId);
      }
    }
  }

  for (const [fornecedorId, projs] of projetosPorFornecedor.entries()) {
    if (projs.size >= config.detectores.projetosPontoUnico) {
      const forn = fornecedoresMap.get(fornecedorId);
      const fornNome = forn ? forn.nome : 'Fornecedor';
      alertas.push({
        detector: 'ponto_unico_falha',
        nivel: 'amarelo',
        tipoEvento: 'detector:ponto_unico_fornecedor',
        titulo: `Ponto Único de Falha: Fornecedor ${fornNome}`,
        projetoId: Array.from(projs)[0]!,
        motivo: `Fornecedor ${fornNome} é compartilhado por ${projs.size} projetos distintos.`,
        acaoSugerida: 'segundo fornecedor',
        detalhes: { fornecedorId, qtdProjetos: projs.size },
      });
    }
  }

  for (const [equipamentoId, projs] of projetosPorEquipamento.entries()) {
    if (projs.size >= config.detectores.projetosPontoUnico) {
      const equip = itensMap.get(equipamentoId);
      const equipNome = equip ? equip.nome : 'Equipamento';
      alertas.push({
        detector: 'ponto_unico_falha',
        nivel: 'amarelo',
        tipoEvento: 'detector:ponto_unico_equipamento',
        titulo: `Ponto Único de Falha: Equipamento ${equipNome}`,
        projetoId: Array.from(projs)[0]!,
        motivo: `Equipamento ${equipNome} é compartilhado por ${projs.size} projetos distintos.`,
        acaoSugerida: 'segundo fornecedor',
        detalhes: { equipamentoId, qtdProjetos: projs.size },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. Estoque
  // --------------------------------------------------------------------------
  const saldosPorItem = new Map<UUID, number>();
  for (const s of dump.saldos) {
    if (s.arquivadoEm === null) {
      const atual = saldosPorItem.get(s.itemId) ?? 0;
      saldosPorItem.set(s.itemId, atual + s.quantidade);
    }
  }

  for (const item of dump.itens) {
    if (item.arquivadoEm !== null) continue;
    const saldo = saldosPorItem.get(item.id) ?? 0;

    if (item.estoqueMinimo > 0 && saldo < item.estoqueMinimo) {
      const compraSugerida = item.estoqueMinimo - saldo;
      alertas.push({
        detector: 'estoque',
        nivel: 'amarelo',
        tipoEvento: 'detector:estoque_minimo',
        titulo: `Estoque Baixo: ${item.nome}`,
        projetoId: null,
        motivo: `Saldo de ${saldo} ${item.unidade} está abaixo do estoque mínimo de ${item.estoqueMinimo}.`,
        acaoSugerida: `compra sugerida de ${compraSugerida}`,
        detalhes: { itemId: item.id, saldo, estoqueMinimo: item.estoqueMinimo, compraSugerida },
      });
    }
  }

  const tarefasPorProjeto = new Map<UUID, typeof dump.tarefas>();
  for (const t of dump.tarefas) {
    if (t.arquivadoEm === null && t.status !== 'feita' && t.prazo) {
      let list = tarefasPorProjeto.get(t.projetoId);
      if (!list) {
        list = [];
        tarefasPorProjeto.set(t.projetoId, list);
      }
      list.push(t);
    }
  }

  for (const il of dump.itensDeLista) {
    if (il.arquivadoEm === null && mapProjetosAtivos.has(il.projetoId)) {
      const item = itensMap.get(il.itemId);
      if (!item || item.arquivadoEm !== null) continue;

      const saldo = saldosPorItem.get(item.id) ?? 0;
      if (il.quantidade > saldo) {
        const falta = il.quantidade - saldo;
        const forn = item.fornecedorId ? fornecedoresMap.get(item.fornecedorId) : null;
        const prazoEntrega = forn ? forn.prazoEntregaDias : 0;

        const tarefas = tarefasPorProjeto.get(il.projetoId) ?? [];
        for (const t of tarefas) {
          if (t.prazo) {
            const diasAtePrazo = diferencaDias(t.prazo, hoje);
            if (diasAtePrazo >= 0 && diasAtePrazo < prazoEntrega) {
              alertas.push({
                detector: 'estoque',
                nivel: 'vermelho',
                tipoEvento: 'detector:estoque_prazo_insuficiente',
                titulo: `Risco de Material: ${item.nome} para ${t.titulo}`,
                projetoId: il.projetoId,
                motivo: `Lista pede ${il.quantidade}, disponível ${saldo}. Tarefa vence em ${diasAtePrazo} dias e entrega do fornecedor leva ${prazoEntrega} dias.`,
                acaoSugerida: `compra sugerida de ${falta}`,
                detalhes: {
                  itemId: item.id,
                  projetoId: il.projetoId,
                  tarefaId: t.id,
                  falta,
                  diasAtePrazo,
                  prazoEntrega,
                },
              });
              break;
            }
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. Tecnologia de alto retorno
  // --------------------------------------------------------------------------
  const projetosPorTecEmPesquisa = new Map<UUID, Set<UUID>>();
  for (const ap of dump.aplicacoes) {
    if (ap.arquivadoEm === null && mapProjetosAtivos.has(ap.projetoId)) {
      const tec = dump.tecnologias.find((t) => t.id === ap.tecnologiaId);
      if (tec && tec.arquivadoEm === null && tec.estado === 'pesquisando') {
        let set = projetosPorTecEmPesquisa.get(tec.id);
        if (!set) {
          set = new Set();
          projetosPorTecEmPesquisa.set(tec.id, set);
        }
        set.add(ap.projetoId);
      }
    }
  }

  for (const [tecId, projs] of projetosPorTecEmPesquisa.entries()) {
    if (projs.size >= config.detectores.projetosTecnologiaAltoRetorno) {
      const tec = dump.tecnologias.find((t) => t.id === tecId);
      const tecNome = tec ? tec.nome : 'Tecnologia';
      alertas.push({
        detector: 'tecnologia_alto_retorno',
        nivel: 'amarelo',
        tipoEvento: 'detector:tecnologia_alto_retorno',
        titulo: `Tecnologia de Alto Retorno: ${tecNome}`,
        projetoId: Array.from(projs)[0]!,
        motivo: `Tecnologia em pesquisa desbloqueará aplicações em ${projs.size} projetos.`,
        acaoSugerida: 'priorizar pesquisa',
        detalhes: { tecnologiaId: tecId, qtdProjetos: projs.size },
      });
    }
  }

  return alertas;
}
