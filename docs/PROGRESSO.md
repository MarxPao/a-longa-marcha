# Progresso da Construção — A Longa Marcha

## Visão Geral das Fases (Seção 8)

| Fase | Nome | Tamanho | Status | Tag Git |
| :---: | :--- | :---: | :---: | :---: |
| **0** | Fundação e spike do terreno | P | **CONCLUÍDA** | `fase-0` |
| **1** | Dados e persistência | M | **CONCLUÍDA** | `fase-1` |
| **2A** | Motor I: derivados e finanças | G | **CONCLUÍDA** | `fase-2a` |
| **2B** | Motor II: detectores, P&D, eventos, conquistas e turno | G | Pendente | — |
| **3** | Store e interface base | G | Pendente | — |
| **4** | Mapa 3D mínimo | G | Pendente | — |
| **5** | Painel da cidade completo | G | Pendente | — |
| **6** | Lentes, minimapa, feed e busca | M | Pendente | — |
| **7** | Árvore tecnológica e estoque | M | Pendente | — |
| **8** | Desempenho | M | Pendente | — |
| **9** | Atmosfera e acabamento | G | Pendente | — |
| **10** | Endurecimento e entrega | P | Pendente | — |

---

## Plano e Checklist da Fase 0 — Fundação e Spike do Terreno

1. [x] Criar estrutura de diretórios do Anexo B (`docs/`, `src/{domain,engine,repository,store,ui,map,workers,seed,textos,app}`, `tests/e2e/`, `public/`).
2. [x] Configurar Vite, React, TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess: true`), ESLint, Vitest, Playwright e `dependency-cruiser` (`.dependency-cruiser.cjs`).
3. [x] Criar `docs/DOCUMENTO_MESTRE.md`, `docs/ASSETS.md`, `docs/DECISOES.md` e `docs/PROGRESSO.md`.
4. [x] Executar spike real do `ProceduralTerrains` (clone externo, execução de `npm run build:lib` e `npm run pack:lib`, validação da Rota (a) em branch `spike/terreno-rota-a` e merge para `main`).
5. [x] Implementar página de teste do terreno por semente (`MapView` em Three.js + `procedural-terrains`, store Zustand, UI com paleta da Seção 4.1 e textos centralizados em `src/textos/pt-BR.ts`).
6. [x] Criar testes automatizados de unidade e de lint de camadas (incluindo prova automatizada de que importar `react` em `src/engine` quebra `npm run lint:camadas`) e teste E2E Playwright da página do terreno.


---

## Plano e Checklist da Fase 1 — Dados e Persistência

1. [x] Criar tipos TypeScript e esquemas Zod completos do Anexo A e Seção 9.2 em `src/domain/entidades.ts` (17 entidades principais + tabelas auxiliares).
2. [x] Validar que dinheiro é estritamente centavos inteiros (`EsquemaCentavos`), datas em `AAAA-MM-DD` (`EsquemaData`) e instantes em ISO 8601 UTC (`EsquemaInstante`).
3. [x] Criar suite de testes de domínio `tests/unit/dominio-zod.test.ts` cobrindo fixtures válidas e inválidas para todas as entidades (Tabela 7.1).
4. [x] Implementar interface `Repository` e funções de persistência segura em `src/repository/types.ts`.
5. [x] Implementar `RepositorioMemoria` em `src/repository/memoria/RepositorioMemoria.ts`.
6. [x] Implementar `RepositorioDexie` em `src/repository/dexie/RepositorioDexie.ts` utilizando Dexie v4 com suporte transacional.
7. [x] Implementar migração automática do esquema v0 -> v1 (`migrarDumpParaVersaoAtual`).
8. [x] Implementar suite de testes de contrato do repositório `tests/unit/repositorio.test.ts` cobrindo todos os casos da Tabela 7.2 (round-trip de exportar/importar, arquivamento sem exclusão física, importação atômica que rejeita campo inválido sem gravar nada, e migração com fixture v0).
9. [x] Implementar gerador determinístico `seedDemo(perfil, semente)` em `src/seed/seedDemo.ts` cobrindo os 4 perfis (`pequeno`, `real`, `carga` e `caos`), com teste automatizado garantindo que o perfil carga gera 500 projetos, 5.000 tarefas e 104 semanas em menos de 5 segundos.
10. [x] Manter lint de camadas (`dependency-cruiser`), `tsc`, `lint`, `vitest` e `playwright` 100% verdes sem violações arquiteturais.

---

## Plano e Checklist da Fase 2A — Motor I: Derivados e Finanças

1. [x] Implementar aritmética de tempo de calendário UTC puro em `src/engine/tempo.ts` (dias no mês, anos bissextos, janelas de 14 dias).
2. [x] Implementar cálculo de Moral (0 a 1) e Momentum em `src/engine/moral.ts` (fórmula Seção 3.3 e 9.2, média quinzenal histórica, modo autônomo com receita recorrente).
3. [x] Implementar cálculo de Saúde (0 a 100) e faixas (saudável, atenção, crítico) em `src/engine/saude.ts` (descontos de tarefas vencidas, fluxo mensal negativo para Assentamento+, moral baixa e bloqueios ativos).
4. [x] Implementar cálculo de Cobertura de Materiais em `src/engine/materiais.ts` (saldos multi-armazém, reservas e detecção de faltas na lista de materiais).
5. [x] Implementar cálculo de Fase de Maturidade em `src/engine/maturidade.ts` (Faísca 1 a Legado 7, Ruínas 0 com exigência de lições aprendidas, e histerese temporal de 2 meses para rebaixamento).
6. [x] Implementar finanças e métricas econômicas em `src/engine/financas.ts` (caixa acumulado, fluxo mensal por projeto e consolidado, projeção de 6 meses de recorrências, runway com status sustentável, ROI por hora em centavos com ranking, financiamento cruzado e custo de oportunidade).
7. [x] Implementar concentração de risco em `src/engine/risco.ts` (por cliente e fornecedor).
8. [x] Implementar estrutura de índice `IndiceEstado` em `src/engine/indice.ts` para acesso O(1) e agregação sem varreduras lineares completas.
9. [x] Implementar orquestrador de estado derivado em `src/engine/derivados.ts` (`calcularDerivadosProjeto`, `calcularDerivadosGlobais`, `recalcularProjetos`).
10. [x] Implementar mapeador de dependências em `src/engine/incremental.ts` (`projetosInvalidados`) para recálculo incremental baseado na tabela de mutação.
11. [x] Criar suíte completa de testes unitários da engine (`engine-moral-saude.test.ts`, `engine-maturidade.test.ts`, `engine-financas.test.ts`, `engine-derivados.test.ts`) totalizando 89 testes unitários dedicados da engine.
12. [x] Medir e comprovar recálculo incremental sub-16ms em banco de carga (500 projetos, 5.000 tarefas): mediana de 0.75 ms e p95 de 1.60 ms.
13. [x] Medir e comprovar cobertura de código de `src/engine/`: 98.29% de linhas cobertas (exigência: >= 90%).
14. [x] Manter todos os linters (`tsc`, `lint`, `lint:camadas`), 122 testes do Vitest e 1 teste E2E do Playwright 100% verdes.
