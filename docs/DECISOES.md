# Registro de Decisões Técnicas e Arquiteturais — A Longa Marcha

Este documento registra todas as decisões de arquitetura, resultados de spikes técnicos e desvios ou esclarecimentos sobre o `docs/DOCUMENTO_MESTRE.md`.

---

## [2026-10-31] DEC-001 — Renomeação Oficial do Produto para «A Longa Marcha»
- **Contexto:** O documento mestre original trazia o título provisório *Império de Projetos*, mas o autor determinou expressamente na abertura do projeto: *"o nome do app é A Longa Marcha e não império de projetos"*.
- **Decisão:** Adotar **A Longa Marcha** (`a-longa-marcha`) como nome oficial do aplicativo na interface (`src/textos/pt-BR.ts`), no `package.json`, no `index.html` e no `docs/DOCUMENTO_MESTRE.md`.
- **Motivo:** Fidelidade estrita à determinação explícita do autor do projeto.

---

## [2026-10-31] DEC-002 — Spike do Terreno (Seção 5.4): Escolha da Rota (a) com Fallback Determinístico
- **Contexto:** A Seção 5.4 e a Fase 0 exigem clonar o repositório `ProceduralTerrains` (MIT) fora do repositório do app, testar de verdade os scripts `npm run build:lib` e `npm run pack:lib` (pasta `packages/procedural-terrains`) em um branch de spike (`spike/terreno-rota-a`), e decidir com evidência entre:
  - **Rota (a):** Embutir o pacote `procedural-terrains` como dependência direta na camada `src/map`.
  - **Rota (b):** Exportar GLB estático com mapa de altura no estúdio e carregá-lo no app.
- **Evidência do Teste Real:**
  1. O repositório `https://github.com/ZyFou/ProceduralTerrains.git` (`v2.0.5`) foi clonado fora da árvore do projeto.
  2. A inspeção de `vite.lib.config.js` e `packages/procedural-terrains/package.json` comprovou que o pacote possui um plugin de fronteira (`terrain-runtime-boundary`) que bloqueia qualquer dependência de React, Electron ou Leaflet, gerando módulos ESM puros com declarações TypeScript (`types/index.d.ts`) e apenas `three` (`~0.185.1`) e `fflate` como dependências externas.
  3. Os comandos `npm run build:lib` e `npm run pack:lib` foram executados no clone externo e compilaram 158 módulos em `13.47s`, gerando o pacote `dist/npm/procedural-terrains-2.0.5.tgz` (`1.343.098 bytes`).
  4. O pacote `procedural-terrains@2.0.5` também está publicado no registro oficial npm e foi instalado e integrado diretamente em `src/map/MapView.ts` via `createTerrain({ renderer, configuration })`.
  5. No servidor de desenvolvimento Vite (`npm run dev`), o pré-empacotador (`optimizeDeps`) precisa excluir `procedural-terrains` (`optimizeDeps: { exclude: ['procedural-terrains'] }` em `vite.config.ts`) para preservar os caminhos relativos dos Web Workers pré-compilados (`DetailPageWorker`, `SurfacePreparation.worker`).
- **Decisão:** Adotar a **Rota (a)** (`procedural-terrains` embutido como dependência em `src/map/MapView.ts`), mantendo na própria `MapView` um gerador de malha heightmap determinístico como fallback automático para ambientes de teste headless sem WebGL2 completo.
- **Motivo:** A Rota (a) funciona de verdade sem acoplamento ao estúdio, permite alterar a semente (`seed`) em tempo real na própria aplicação com `terrain.configure({ source: { seed } })`, expõe `terrain.sampleHeight(x, z)` para posicionar cidades sobre o relevo e preserva todas as regras de camada do Anexo B (`src/map` importa apenas `domain`, `engine`, `three` e `procedural-terrains`).

---

## [2026-10-31] DEC-003 — Isolamento Estrito entre `ui` e `map` via Camada `app`
- **Contexto:** O Anexo B determina que `ui` pode importar apenas `domain`, `store`, `textos` e `react` (não podendo importar `map` nem `three`), enquanto `map` pode importar apenas `domain`, tipos do `engine` e `three` (não podendo importar `store` nem `react`).
- **Decisão:** A conexão reativa entre o estado da `store` (Zustand), o container DOM renderizado pela `ui` (`PainelTerrenoFase0`) e a instância imperativa `MapView` (`src/map/MapView.ts`) é feita exclusivamente em `src/app/App.tsx`, que tem permissão arquitetural no Anexo B para importar todas as camadas.
- **Motivo:** Garantir cumprimento 100% estrito das regras do `dependency-cruiser` (`npm run lint:camadas`) sem exceções.
