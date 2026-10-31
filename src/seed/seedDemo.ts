import {
  criarDumpVazio,
  type DumpBanco,
  type Instantaneo,
  type UUID,
} from '../domain';

export type PerfilSeed = 'pequeno' | 'real' | 'carga' | 'caos';

function criarPrng(semente: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return function proximo(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedDemo(perfil: PerfilSeed, semente: string): DumpBanco {
  const rand = criarPrng(semente);
  const dump = criarDumpVazio();
  dump.meta.config.mapa.sementeTerreno = semente;

  const instanteBase = '2026-10-31T12:00:00.000Z';

  // 1. Setores Oficiais (Seção 4.2)
  const setoresDef = [
    { nome: 'Agricultura', cor: '#7FA35A', icone: 'espiga', bioma: 'planicie com arrozais' },
    { nome: 'Produção alimentícia', cor: '#C9A24B', icone: 'caldeirao', bioma: 'vale fertil' },
    { nome: 'Bebidas', cor: '#7B2D3A', icone: 'jarro', bioma: 'colinas e bambuzais' },
    { nome: 'Química', cor: '#6F7F72', icone: 'alquimia', bioma: 'regiao rochosa' },
    { nome: 'Automação', cor: '#B07A4A', icone: 'engrenagem', bioma: 'vale industrial' },
    { nome: 'Robótica', cor: '#5A7488', icone: 'braco', bioma: 'montanhas e forjas' },
    { nome: 'Software educacional', cor: '#6FA3C7', icone: 'pergaminho', bioma: 'platos e torres' },
    { nome: 'Software profissional', cor: '#6B4E8A', icone: 'selo', bioma: 'cidade amuralhada' },
    { nome: 'Comércio', cor: '#D0B25C', icone: 'balanca', bioma: 'rotas e portos' },
  ];

  setoresDef.forEach((s, idx) => {
    const setorId: UUID = `setor-${idx + 1}`;
    const xBase = (idx % 3) * 60 - 60;
    const zBase = Math.floor(idx / 3) * 60 - 60;
    const regiao: [number, number][] = [
      [xBase, zBase],
      [xBase + 55, zBase],
      [xBase + 55, zBase + 55],
      [xBase, zBase + 55],
    ];

    const arquivado = perfil === 'caos' && idx === 3 ? instanteBase : null;

    dump.setores.push({
      id: setorId,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: arquivado,
      nome: s.nome,
      cor: s.cor,
      icone: s.icone,
      bioma: s.bioma,
      regiao,
      ordem: idx,
    });
  });

  // 2. Tipos de Ligação
  const tiposLigacaoDef = [
    { id: 'tipo-depende', nome: 'depende de', cor: '#8E1F1A', direcional: true },
    { id: 'tipo-insumo', nome: 'fornece insumo', cor: '#7FA35A', direcional: true },
    { id: 'tipo-financia', nome: 'financia', cor: '#B8923A', direcional: true },
  ];

  for (const t of tiposLigacaoDef) {
    dump.tiposLigacao.push({
      id: t.id,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: t.nome,
      cor: t.cor,
      direcional: t.direcional,
    });
  }

  // Quantidade de Projetos, Tarefas e Semanas por Perfil
  let totalProjetos = 12;
  let totalTarefas = 80;
  let totalSemanas = 12;

  if (perfil === 'real') {
    totalProjetos = 60;
    totalTarefas = 600;
    totalSemanas = 52;
  } else if (perfil === 'carga') {
    totalProjetos = 500;
    totalTarefas = 5000;
    totalSemanas = 104;
  } else if (perfil === 'caos') {
    totalProjetos = 15;
    totalTarefas = 90;
    totalSemanas = 16;
  }

  // 3. Projetos
  const autonomias: ('direto' | 'esparso' | 'autonomo')[] = ['direto', 'esparso', 'autonomo'];
  for (let i = 0; i < totalProjetos; i++) {
    const setorIdx = i % dump.setores.length;
    const setor = dump.setores[setorIdx]!;
    const setorId = setor.id;
    const xP = Math.round((rand() * 200 - 100) * 10) / 10;
    const zP = Math.round((rand() * 200 - 100) * 10) / 10;

    let nomeProjeto = `Projeto ${i + 1} (${setor.nome})`;
    if (perfil === 'caos') {
      if (i === 0) {
        nomeProjeto = 'A'.repeat(500); // 500 caracteres
      } else if (i === 1) {
        nomeProjeto = 'Fortaleza dos Três Reinos 🐉🏮⚔️';
      }
    }

    const projetoId: UUID = `proj-${i + 1}`;
    dump.projetos.push({
      id: projetoId,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: nomeProjeto,
      descricao: `Descrição do projeto ${i + 1}`,
      setorId,
      x: xP,
      z: zP,
      estagioId: null,
      horasAlvoSemana: Math.round(5 + rand() * 20),
      autonomia: autonomias[i % autonomias.length]!,
      notas: `Notas estratégicas do projeto ${i + 1}`,
      notaLicoes: null,
    });
  }

  // 4. Frentes de Trabalho
  for (let i = 0; i < Math.min(totalProjetos, 30); i++) {
    const projId = dump.projetos[i]!.id;
    const frenteId: UUID = `frente-${i + 1}`;
    dump.frentes.push({
      id: frenteId,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: `Frente Principal - P${i + 1}`,
      projetoId: projId,
      paiId: null,
      estado: 'ativa',
    });
  }

  // 5. Tarefas
  const prioridades: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  const statusTarefas: ('pendente' | 'em_andamento' | 'bloqueada' | 'feita')[] = [
    'pendente',
    'em_andamento',
    'bloqueada',
    'feita',
  ];

  for (let t = 0; t < totalTarefas; t++) {
    const proj = dump.projetos[t % dump.projetos.length]!;
    let prazo = '2026-11-15';
    if (perfil === 'caos' && t === 0) {
      prazo = '2032-06-15'; // data futura patológica
    }

    dump.tarefas.push({
      id: `tar-${t + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      titulo: `Tarefa ${t + 1} de ${proj.nome.slice(0, 20)}`,
      descricao: 'Execução planejada de sprint',
      projetoId: proj.id,
      frenteId: null,
      status: statusTarefas[t % statusTarefas.length]!,
      prioridade: prioridades[t % prioridades.length]!,
      prazo,
      estimativaHoras: Math.round(1 + rand() * 15),
      concluidaEm: t % 4 === 3 ? '2026-10-30' : null,
      recorrencia: null,
      origemRecorrenciaId: null,
    });
  }

  // 6. Clientes e Vínculos
  const totalClientes = Math.min(20, Math.max(4, Math.floor(totalProjetos * 0.2)));
  for (let c = 0; c < totalClientes; c++) {
    const clienteId: UUID = `cli-${c + 1}`;
    dump.clientes.push({
      id: clienteId,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: `Cliente Corporativo ${c + 1}`,
      contato: `contato@cliente${c + 1}.com.br`,
      statusRelacao: 'ativo',
      ultimoContato: '2026-10-25',
      observacoes: '',
    });

    const projAssociado = dump.projetos[c % dump.projetos.length]!;
    dump.vinculosCliente.push({
      id: `vinc-${c + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      clienteId,
      projetoId: projAssociado.id,
      receitaRecorrenteCentavos: Math.round(50000 + rand() * 450000),
      inicio: '2026-01-01',
      fim: null,
    });
  }

  // 7. Lançamentos Financeiros
  const totalLancamentos = Math.max(10, Math.floor(totalProjetos * 1.5));
  for (let l = 0; l < totalLancamentos; l++) {
    const proj = dump.projetos[l % dump.projetos.length]!;
    let valorCentavos = Math.round(10000 + rand() * 800000);
    if (perfil === 'caos' && l === 0) {
      valorCentavos = 0; // valor zero patológico
    }

    dump.lancamentos.push({
      id: `lanc-${l + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      data: '2026-10-28',
      tipo: l % 2 === 0 ? 'receita' : 'custo',
      valorCentavos,
      categoriaId: 'cat-geral',
      projetoId: proj.id,
      clienteId: dump.clientes[l % dump.clientes.length]?.id ?? null,
      recorrencia: null,
      origemRecorrenciaId: null,
    });
  }

  // 8. Fornecedores, Armazéns, Itens e Saldos
  for (let f = 0; f < 4; f++) {
    dump.fornecedores.push({
      id: `forn-${f + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: `Fornecedor Estratégico ${f + 1}`,
      contato: `fornecedor${f + 1}@forja.com`,
      prazoEntregaDias: 7 + f * 3,
      observacoes: '',
    });
  }

  dump.armazens.push({
    id: 'arm-principal',
    criadoEm: instanteBase,
    atualizadoEm: instanteBase,
    arquivadoEm: null,
    nome: 'Armazém Central',
    local: 'Zona Leste',
    observacoes: '',
  });

  for (let it = 0; it < 6; it++) {
    const itemId: UUID = `item-${it + 1}`;
    dump.itens.push({
      id: itemId,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: `Componente Eletrônico ${it + 1}`,
      unidade: 'un',
      custoUnitarioCentavos: 1500 + it * 800,
      estoqueMinimo: 10,
      fornecedorId: dump.fornecedores[it % dump.fornecedores.length]!.id,
      tipo: it % 2 === 0 ? 'insumo' : 'equipamento',
    });

    dump.saldos.push({
      id: `saldo-${it + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      itemId,
      armazemId: 'arm-principal',
      quantidade: 25 + it * 5,
    });
  }

  // 9. Tecnologias de P&D
  for (let tc = 0; tc < 5; tc++) {
    dump.tecnologias.push({
      id: `tec-${tc + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      nome: `Tecnologia Inovadora ${tc + 1}`,
      descricao: 'Desenvolvimento e patentes',
      estado: tc === 0 ? 'dominada' : tc === 1 ? 'pesquisando' : 'ideia',
      estimativaHoras: 40 + tc * 20,
    });
  }

  // 10. Instantâneos Semanais
  // Formato da semana: 2026-01-05, etc.
  const anoBase = 2026;
  for (let w = 0; w < totalSemanas; w++) {
    const semanaNum = (w % 50) + 1;
    const mesNum = Math.min(12, Math.floor(semanaNum / 4.2) + 1);
    const diaNum = Math.min(28, ((semanaNum * 7) % 28) + 1);
    const mesStr = String(mesNum).padStart(2, '0');
    const diaStr = String(diaNum).padStart(2, '0');
    const dataSemana = `${anoBase}-${mesStr}-${diaStr}`;

    const porProjeto: Instantaneo['porProjeto'] = {};
    for (const proj of dump.projetos) {
      porProjeto[proj.id] = {
        saude: Math.round(60 + rand() * 40),
        fase: Math.min(7, Math.floor(rand() * 5) + 1),
        moral: Math.round((0.4 + rand() * 0.6) * 100) / 100,
      };
    }

    dump.instantaneos.push({
      id: `inst-${w + 1}`,
      criadoEm: instanteBase,
      atualizadoEm: instanteBase,
      arquivadoEm: null,
      semana: dataSemana,
      receitaCentavos: Math.round(1500000 + rand() * 2000000),
      custoCentavos: Math.round(900000 + rand() * 1000000),
      horas: Math.round(35 + rand() * 10),
      porProjeto,
      fechamentoId: `fechamento-semana-${w + 1}`,
    });
  }

  return dump;
}
