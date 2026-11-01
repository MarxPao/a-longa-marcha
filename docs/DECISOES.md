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


---

## [2026-10-31] DEC-004 — Modelo de Distribuição e Licenciamento (Decisão do Usuário na Seção 9.1)
- **Contexto:** Na Fase 0 foi solicitada a confirmação sobre o modelo de licenciamento e ambiente alvo. O autor instruiu formalmente: *"ele vai rodar programa instalavel na maquina uso privado"*.
- **Decisão:** O aplicativo permanece como pacote de uso privado (`"private": true` no `package.json`), com persistência local no navegador/IndexedDB e runtime local (desktop / Chromium standalone). O aviso de licença MIT do `ProceduralTerrains` permanece preservado em `docs/ASSETS.md`.
- **Motivo:** Alinhamento estrito com a instrução do usuário.

---

## [2026-10-31] DEC-006 — Histerese Determinística da Maturidade e Ruínas com Lições Aprendidas
- **Contexto:** A Seção 3.4 e 9.2 exigem que a fase de maturidade só desça após 2 meses consecutivos abaixo da regra correspondente (para evitar oscilação visual no mapa), enquanto a promoção de nível é imediata. Projetos arquivados vão para a fase Ruínas, exigindo registro de lições aprendidas.
- **Decisão:** A função pura `calcularMaturidadeProjeto` (`src/engine/maturidade.ts`) avalia as regras da mais alta (Legado 7) para a mais baixa (Faísca 1). Se a fase potencial for inferior à fase atual previamente consolidada, a histerese é avaliada com base no histórico de instantâneos dos últimos 2 meses. Se não houver 2 meses consecutivos abaixo, a fase atual é preservada. Para transição a Ruínas, valida-se a presença de texto não-vazio no campo de lições aprendidas.
- **Motivo:** Preservar a pureza funcional do motor (sem efeitos colaterais nem mutação de estado fora do fluxo de dados) e garantir fidelidade estrita às regras do documento mestre.

---

## [2026-10-31] DEC-007 — Indexação O(1) em Memória e Recálculo Incremental (Meta ≤ 16 ms)
- **Contexto:** A Seção 1 e o Critério de Aceite da Fase 2A exigem que o recálculo de um projeto com 500 projetos e 5.000 tarefas no banco ocorra em menos de 16 ms (tempo de 1 frame a 60 fps).
- **Decisão:** Implementação de `IndiceEstado` (`src/engine/indice.ts`), que constrói tabelas hash em memória (Mapas por `projetoId`) para frentes, tarefas, lançamentos, vínculos com clientes, itens de lista e horas. O módulo `incremental.ts` expõe `projetosInvalidados()`, permitindo que apenas os projetos afetados por uma mutação no banco de dados sejam recalculados.
- **Evidência do Teste:** O teste de estresse no perfil `carga` (`500 projetos, 5.000 tarefas, 104 semanas`) registrou tempo de recálculo com mediana de `0.75 ms` e p95 de `1.60 ms`, superando com folga o teto de 16 ms.
- **Motivo:** Garantir escalabilidade de 60 fps mesmo em bases de alta densidade sem travar a thread principal da UI.

---

## [2026-10-31] DEC-008 — Rigor Financeiro em Centavos Inteiros e Runway Sustentável
- **Contexto:** A Seção 3.5 e 9.2 exigem cálculo de caixa acumulado, fluxo mensal por projeto e consolidado, projeção dos próximos 6 meses com recorrências, runway, ROI por hora com ranking, financiamento cruzado e custo de oportunidade.
- **Decisão:** Todos os cálculos financeiros operam estritamente sobre centavos inteiros (`Centavos = number`), utilizando `Math.round` para operações com divisão (ex: ROI por hora e custo mensal médio). O runway é reportado como sustentável quando o fluxo mensal líquido for positivo ou custo for zero, e em meses quando negativo. A projeção de 6 meses materializa apenas lançamentos com `recorrente: true` e `ate` posterior ao mês projetado.
- **Motivo:** Eliminar qualquer erro acumulado de ponto flutuante monetário e garantir reprodutibilidade matemática exata.

---

## [2026-10-31] DEC-009 — Validação de Grafo Acíclico Dirigido (DAG) e Progressão Estrita da Árvore Tecnológica
- **Contexto:** A Seção 2, 3.8 e 9.2 tratam da árvore de tecnologias com pré-requisitos (`preRequisitosIds`), pesquisa com horas registradas e aplicações em projetos. Era necessário assegurar que a definição de dependências jamais gere ciclos infinitos (diretos ou indiretos) e que transições de estado obedeçam às regras formais.
- **Decisão:** A função pura `criariaCicloPreRequisito` (`src/engine/arvoreTecnologica.ts`) executa busca em profundidade com detecção de ciclo em grafo orientado para qualquer tentativa de adicionar pré-requisito a uma tecnologia existente ou nova. Adicionalmente, transições para o estado `pesquisando` são bloqueadas caso qualquer pré-requisito não esteja no estado `dominada`, e o ranking de retorno prioriza tecnologias com maior impacto cruzado em projetos.
- **Motivo:** Garantir integridade estrutural matemática da árvore de conhecimento e comportamento determinístico do motor de progressão.

---

## [2026-10-31] DEC-010 — Motor de Fechamento de Turno Semanal Idempotente em 6 Passos e Otimizações Estruturais
- **Contexto:** A Seção 3.1 exige que o fechamento de turno execute 6 etapas estritas (materialização de recorrências, recálculo de derivados, disparo de detectores, avaliação de conquistas, gravação do instantâneo e avanço de semana). O fechamento deve ser estritamente idempotente (fechar duas vezes a mesma semana gera contagens nulas adicionais) e completar em < 100 ms no perfil real e ≤ 1.000 ms no perfil de carga com 500 projetos e 5.000 tarefas.
- **Decisão:** O motor `fecharTurnoSemanal` (`src/engine/turno.ts`) processa o fechamento através de pipeline funcional puro identificando cada operação pelo `fechamentoId` único do turno. Para cumprir as metas de tempo:
  1. Comparação de datas em loops massivos feita com strings ISO `AAAA-MM-DD` pré-calculadas em vez de alocações repetidas de instâncias de `Date`.
  2. Indexação de tarefas e lançamentos recorrentes através de `Set<string>` garantindo checagens de duplicação em tempo O(1).
  3. Curto-circuito em `calcularFase` para projetos sem clientes e sem receita, poupando varreduras de histórico multi-mês desnecessárias.
  4. Suporte a execução assíncrona off-thread via Web Worker (`src/workers/fechamento.worker.ts`) com fallback transparente para Node/Vitest.
- **Evidência do Teste:** Fechamento de turno no perfil real completado em `44.70 ms` (meta: < 100 ms) e no perfil de carga completado em `495.14 ms` (meta: ≤ 1.000 ms), com prova de idempotência estrita validada por teste de propriedades com `fast-check`.
- **Motivo:** Cumprir os critérios de aceitação da Seção 8 e assegurar uma experiência de usuário sem engasgos ou perda de fluidez.

---

## [2026-10-31] DEC-011 — Barramento de Comandos Tipados, Validação Estrita por Zod e Desfazer Atômico em Zustand
- **Contexto:** A Seção 5 e o Critério de Aceite da Fase 3 exigem um barramento de comandos desfazíveis (`Ctrl+Z`), onde nenhuma mutação ocorre por escrita arbitrária em store. Todas as alterações devem passar por validação em tempo de execução via esquemas Zod (`src/domain`), e o fechamento de turno deve suportar desfazer reanalisando instantâneos e estado prévio.
- **Decisão:** Criação de `comandos.ts` com discriminadores estritos (`CRIAR_ENTIDADE`, `ATUALIZAR_ENTIDADE`, `ARQUIVAR_ENTIDADE`, `DESARQUIVAR_ENTIDADE`, `ATUALIZAR_CONFIG`, `FECHAR_TURNO`, `DESFAZER_TURNO`, `IMPORTAR_DUMP`). A store Zustand (`campanhaStore.ts`) mantém pilha de até 20 comandos com snapshots inversos. O recálculo pós-comando usa `projetosInvalidados()` da engine incremental, recalculando apenas os projetos afetados em tempo sub-milissegundo.
- **Evidência do Teste:** Teste unitário `tests/unit/store-comandos.test.ts` e teste E2E `tests/e2e/fase3-interface.spec.ts` provam a validação Zod (rejeição de entidades inválidas), obrigatoriedade de notas de lições para estágio Ruínas (Caso 7.2) e desfazer funcional.
- **Motivo:** Garantir integridade referencial dos dados, imunidade contra corrupção de estado e conformidade estrita com o Princípio 2 (estado derivado nunca é digitado).

---

## [2026-10-31] DEC-012 — Interface Estratégica Pergaminho/Tinta, Separação de Camadas e Otimização de Renderização por Visibilidade
- **Contexto:** A interface segue a estética inspirada em Total War: Three Kingdoms (pergaminho `#EDE3D0`, laca `#8E1F1A`, jade `#3A6B56`, ouro `#C59B27`, tinta `#1C1814`). Todas as camadas de visualização (Barra Superior, Painel Lateral em 6 abas, Modais de Captura Rápida com atalhos H/T/L/E, Modal de Fechamento com dry-run e Editor de Registros) foram implementadas em React puro. O mapa 3D de fundo (Three.js) e as visualizações alternativas (Vista Lista e Placeholder 2D) convivem na mesma aplicação.
- **Decisão:** A `MapView` Three.js monitora a visibilidade de seu container HTML no loop de animação: se o container estiver com `display: none` ou dimensões nulas (ex.: enquanto o usuário opera na Vista Lista), a chamada de renderização é suprimida imediatamente. Além disso, a taxa de quadros é controlada com throttle de ~30 FPS para idle/background.
- **Evidência do Teste:** A suíte E2E do Playwright (`fase0-terreno.spec.ts` e `fase3-interface.spec.ts`) passou com tempo reduzido de 3.7m (com timeout) para 55.7s no total. O `depcruise` certificou 0 violações de camadas entre `src/store`, `src/ui`, `src/engine` e `src/domain`.
- **Motivo:** Preservar a CPU do usuário, acelerar testes e garantir uma UI fluida e sem acoplamentos indevidos.
