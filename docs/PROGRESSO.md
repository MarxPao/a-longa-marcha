# Progresso da Construção — A Longa Marcha

## Visão Geral das Fases (Seção 8)

| Fase | Nome | Tamanho | Status | Tag Git |
| :---: | :--- | :---: | :---: | :---: |
| **0** | Fundação e spike do terreno | P | **CONCLUÍDA** | `fase-0` |
| **1** | Dados e persistência | M | Pendente | — |
| **2A** | Motor I: derivados e finanças | G | Pendente | — |
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
