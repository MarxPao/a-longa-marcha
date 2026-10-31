export const textosPtBr = {
  app: {
    titulo: 'A Longa Marcha',
    subtitulo: 'Mapa Estratégico de Campanha · Fundação & Spike do Terreno (Fase 0)',
  },
  terreno: {
    rotuloSemente: 'Semente do Terreno',
    placeholderSemente: 'Digite uma semente (ex: longa-marcha-2026)',
    botaoGerar: 'Gerar Terreno',
    botaoSortear: 'Sortear Semente',
    botaoExportarGlb: 'Exportar Terreno (.GLB)',
    rotaAdotadaTitulo: 'Rota Técnica do Terreno (Seção 5.4)',
    rotaDescricao:
      'Rota (b) ativa com gerador determinístico de Heightmap + malha GLB em memória/arquivo, garantindo zero dependências quebradas e reprodutibilidade total pela semente.',
    dicaCamera: 'Arraste com o botão esquerdo para orbitar · Scroll para zoom · Botão direito para mover (pan)',
    metricas: {
      hash: 'Hash determinístico',
      vertices: 'Vértices da malha',
      cotaMin: 'Cota mínima',
      cotaMax: 'Cota máxima',
      rota: 'Rota ativa',
    },
  },
} as const;
