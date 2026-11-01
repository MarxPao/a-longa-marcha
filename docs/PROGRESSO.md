# Progresso da Construção — A Longa Marcha

## Visão Geral das Fases (Seção 8)

| Fase | Nome | Tamanho | Status | Tag Git |
| :---: | :--- | :---: | :---: | :---: |
| **0** | Fundação e spike do terreno | P | **CONCLUÍDA** | `fase-0` |
| **1** | Dados e persistência | M | **CONCLUÍDA** | `fase-1` |
| **2A** | Motor I: derivados e finanças | G | **CONCLUÍDA** | `fase-2a` |
| **2B** | Motor II: detectores, P&D, eventos, conquistas e turno | G | **CONCLUÍDA** | `fase-2b` |
| **3** | Store e interface base | G | **CONCLUÍDA** | `fase-3` |
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

---

## Plano e Checklist da Fase 2B — Motor II: Detectores, P&D, Eventos, Conquistas e Turno

1. [x] Implementar os 7 detectores de inteligência em `src/engine/detectores.ts` (`inanicao` com alerta amarelo aos 7d e vermelho aos 30d, `sinergia` entre projetos do mesmo setor/tecnologia sem ligação, `gargalo_atencao` com soma de horas > disponíveis, projeto direto com <1h e troca de contexto com >4 setores, `concentracao_cliente` com cliente respondendo por >40% da receita ou presente em >=3 projetos, `ponto_unico_falha` com fornecedor ou equipamento crítico em >=3 projetos, `estoque` com saldo abaixo do mínimo ou falta na BOM antes do prazo da tarefa cruzado com prazo de entrega do fornecedor, e `tecnologia_alto_retorno` com pesquisa que desbloqueia >=3 projetos).
2. [x] Implementar árvore tecnológica em `src/engine/arvoreTecnologica.ts` com validação de ciclo acíclico dirigido (DAG) que rejeita ciclos diretos e transitivos (`criariaCicloPreRequisito`), transição de estado estrita (só pesquisa se todos os pré-requisitos estiverem `dominada`), progresso por horas registradas e ranking de retorno (`rankingOQuePesquisarPrimeiro`).
3. [x] Implementar motor de eventos puros em `src/engine/eventos.ts` com factory segura, imutabilidade, resposta a eventos com registro histórico de opções e busca cronológica de decisões anteriores.
4. [x] Implementar avaliação determinística de conquistas em `src/engine/conquistas.ts` baseada estritamente em fatos reais (`consistencia`, `expansao`, `sinergia`, `resiliencia`, `escala`, `diplomacia` e promoções de fase da cidade).
5. [x] Implementar cálculo de recorrências em `src/engine/recorrencia.ts` (semanal, mensal com clamp seguro para dias curtos de 28 a 30 dias, trimestral e anual, respeitando a validade `ate`).
6. [x] Implementar motor de fechamento de turno semanal em 6 passos sequenciais e idempotentes em `src/engine/turno.ts` (materialização de recorrências, recálculo de estado derivado, disparo de detectores, avaliação de conquistas, gravação do instantâneo e avanço de semana).
7. [x] Implementar mecanismo de desfazer turno (`desfazerFechamentoTurno`), fechamento em lote de semanas pendentes (`fecharSemanasPendentes`) e prévia pura sem efeitos colaterais (`previaFechamentoTurno`).
8. [x] Implementar Web Worker (`src/workers/fechamento.worker.ts`) e dispatcher com fallback síncrono transparente (`src/workers/index.ts`).
9. [x] Criar suíte completa de testes unitários para a Fase 2B (`engine-detectores.test.ts`, `engine-arvore.test.ts`, `engine-eventos-conquistas.test.ts`, `engine-turno.test.ts`), incluindo teste de propriedade matemática de idempotência com `fast-check`.
10. [x] Comprovar metas de desempenho: perfil real fecha em 44.70 ms (meta: < 100 ms) e perfil de carga com 500 projetos e 5.000 tarefas fecha em 495.14 ms (meta: <= 1.000 ms).
11. [x] Manter cobertura de código de `src/engine/` em 97.14% de linhas (requisito: >= 90%).
12. [x] Manter 172 testes do Vitest, 1 teste E2E do Playwright e 100 módulos do `dependency-cruiser` 100% verdes sem violações.

---

## Plano e Checklist da Fase 3 — Store e Interface Base

1. [x] Implementar barramento tipado de comandos desfazíveis em `src/store/comandos.ts` com validação estrita por Zod para todas as tabelas e schemas do domínio.
2. [x] Implementar store Zustand completa em `src/store/campanhaStore.ts` com pilha de histórico (até 20 comandos para Ctrl+Z), recálculo incremental automático via `projetosInvalidados()` + `recalcularProjetos()` + `calcularDerivadosGlobais()`.
3. [x] Implementar fechamento e reversão de turno semanal na store (`fecharTurno` e `desfazerUltimoTurno`) com prévia analítica dry-run (`obterPreviaTurno`).
4. [x] Centralizar catálogo de textos e vocabulário temático em português brasileiro (`src/textos/pt-BR.ts`).
5. [x] Implementar formatadores puros em `src/ui/formatadores.ts` (`formatarMoeda`, `formatarHoras`, `formatarPercentual`, `formatarData`, `obterInfoSaude`, `obterInfoFase`).
6. [x] Implementar Barra Superior (HUD) com Caixa Total em R$, Runway com badge sustentável, Saldo de Horas Semanais, Semana Atual, botões de ação e atalhos globais.
7. [x] Implementar Painel Lateral do Projeto em 6 abas (Visão Geral com detalhamento transparente de causas de saúde, Tarefas, Clientes, Finanças, Estoque, P&D).
8. [x] Implementar modal de Captura Rápida com atalhos de teclado de tecla única: `[H]` Horas, `[T]` Tarefa, `[L]` Lançamento, `[E]` Evento.
9. [x] Implementar modal de Fechamento de Turno Semanal com prévia dry-run (mudanças de fase, tarefas concluídas, fluxo líquido, alertas dos detectores) e confirmação idempotente.
10. [x] Implementar Editor de Registros e Configurações (Setores, Estágios, Pesos de Fórmulas, Limiares e Aba de Dados com exportação/importação JSON).
11. [x] Implementar alternância entre Vista Mapa (canvas 3D + marcadores estratégicos 2D) e Vista Lista acessível (tabela paginável com ordenação e filtros).
12. [x] Criar suíte de testes unitários da store `tests/unit/store-comandos.test.ts` (6 testes cobrindo inicialização, comandos Zod, exigência de notas de lições para Ruínas, desfazer Ctrl+Z, fechamento/reversão de turno e importação atômica).
13. [x] Criar teste E2E Playwright `tests/e2e/fase3-interface.spec.ts` validando o fluxo completo de aceitação: abrir do zero, criar setor, projeto, tarefa, horas, lançamento, fechar turno, exportar e reimportar JSON sem alteração de dados.
14. [x] Manter suíte 100% verde: 178 testes unitários no Vitest, 2 testes E2E no Playwright, 0 erros no ESLint, 0 violações no `dependency-cruiser` e compilação de produção aprovada pelo Vite.
