/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'config-puro',
      comment: 'Seção 4.1: src/config é puro e não importa nenhuma outra camada ou biblioteca externa.',
      severity: 'error',
      from: { path: '^src/config/' },
      to: {
        pathNot: ['^src/config/'],
      },
    },
    {
      name: 'domain-apenas-zod',
      comment: 'Anexo B: domain pode importar apenas zod, config e outros arquivos de domain.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: {
        pathNot: [
          '^src/domain/',
          '^src/config/',
          '^node_modules/zod',
        ],
      },
    },
    {
      name: 'engine-puro',
      comment: 'Seção 5.2 / Anexo B: engine pode importar apenas domain e config (proibido react, three, dexie, repository, store, ui, map, workers).',
      severity: 'error',
      from: { path: '^src/engine/' },
      to: {
        pathNot: [
          '^src/engine/',
          '^src/domain/',
          '^src/config/',
        ],
      },
    },
    {
      name: 'repository-isolado',
      comment: 'Anexo B: repository pode importar apenas domain, config e dexie (proibido engine, store, ui, map).',
      severity: 'error',
      from: { path: '^src/repository/' },
      to: {
        pathNot: [
          '^src/repository/',
          '^src/domain/',
          '^src/config/',
          '^node_modules/dexie',
        ],
      },
    },
    {
      name: 'store-sem-ui-map-three',
      comment: 'Anexo B: store pode importar domain, config, engine, repository e zustand (proibido ui, map, three).',
      severity: 'error',
      from: { path: '^src/store/' },
      to: {
        pathNot: [
          '^src/store/',
          '^src/domain/',
          '^src/config/',
          '^src/engine/',
          '^src/repository/',
          '^node_modules/zustand',
          '^node_modules/zod',
        ],
      },
    },
    {
      name: 'ui-sem-repository-map-three',
      comment: 'Anexo B: ui pode importar domain, config, store, textos e react (proibido repository, map internals, three).',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: {
        pathNot: [
          '^src/ui/',
          '^src/domain/',
          '^src/config/',
          '^src/store/',
          '^src/textos/',
          '^node_modules/react',
          '^node_modules/react-dom',
          '^node_modules/zustand',
        ],
      },
    },
    {
      name: 'map-sem-repository-store-react-ui',
      comment: 'Seção 5.2 / Anexo B: map pode importar domain, config, tipos do engine e three (proibido repository, store, react, ui).',
      severity: 'error',
      from: { path: '^src/map/' },
      to: {
        pathNot: [
          '^src/map/',
          '^src/domain/',
          '^src/config/',
          '^src/engine/',
          '^node_modules/three',
          '^node_modules/procedural-terrains',
        ],
      },
    },
    {
      name: 'workers-apenas-domain-e-engine',
      comment: 'Anexo B: workers pode importar apenas domain, config e engine.',
      severity: 'error',
      from: { path: '^src/workers/' },
      to: {
        pathNot: [
          '^src/workers/',
          '^src/domain/',
          '^src/config/',
          '^src/engine/',
        ],
      },
    },
    {
      name: 'sem-ciclos',
      comment: 'Proíbe dependências circulares entre módulos.',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
