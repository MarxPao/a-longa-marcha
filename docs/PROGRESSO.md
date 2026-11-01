# Progresso da Construção — A Longa Marcha

## Visão Geral das Fases (Seção 8)

| Fase | Nome | Tamanho | Status | Tag Git |
| :---: | :--- | :---: | :---: | :---: |
| **0** | Fundação e spike do terreno | P | **CONCLUÍDA** | `fase-0` |
| **1** | Dados e persistência | M | **CONCLUÍDA** | `fase-1` |
| **2A** | Motor I: derivados e finanças | G | **CONCLUÍDA** | `fase-2a` |
| **2B** | Motor II: detectores, P&D, eventos, conquistas e turno | G | **CONCLUÍDA** | `fase-2b` |
| **3** | Store e interface base | G | **CONCLUÍDA** | `fase-3` |
| **4** | Mapa 3D mínimo | G | **CONCLUÍDA** | `fase-4` |
| **5** | Painel da cidade completo | G | **CONCLUÍDA** | `fase-5` |
| **6** | Lentes, minimapa, feed e busca | M | **CONCLUÍDA** | `fase-6` |
| **7** | Árvore tecnológica e estoque | M | **CONCLUÍDA** | `fase-7` |
| **8** | Desempenho | M | **CONCLUÍDA** | `fase-8` |
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

---

## Plano e Checklist da Fase 4 — Mapa 3D Mínimo

1. [x] Implementar índice espacial em grade O(1) em `src/map/gradeEspacial.ts` (`GradeEspacial<T>`) para seleção, arrasto e raio de tolerância sem varreduras lineares completas.
2. [x] Implementar geometrias procedurais das cidades para os 7 níveis e Ruínas em `src/map/cidadesGeometria.ts` utilizando primitivas Three.js e `BufferGeometryUtils.mergeGeometries`, respeitando a estética de Three Kingdoms (pagodes, telhados curvados, muralhas com ameias e terraços).
3. [x] Implementar renderização em lote com `THREE.InstancedMesh` em `src/map/cidadesInstanciadas.ts`, com alocação dinâmica de capacidade, snap na altura do terreno (`amostrarTerrenoPorSemente`), anel indicador de seleção e colorização dinâmica por pontuação de saúde (Jade, Âmbar, Laca, Pedra gasta).
4. [x] Implementar visualização dos territórios dos setores em `src/map/territorios.ts` (`GerenciadorTerritorios`), subdividindo e adaptando os polígonos ao relevo montanhoso sem recorte indevido, com detecção de ponto-em-polígono para duplo clique.
5. [x] Implementar visualização de rotas e conexões em `src/map/rotasLigacoes.ts` (`GerenciadorRotas`) através de curvas Bezier 3D com cores por tipo de vínculo (fio dourado para financiamento, laca para dependência, jade para insumo).
6. [x] Expandir a classe `MapView` em `src/map/MapView.ts` com gestão completa de interações (clique para seleção, arrastar para mover cidade com emissão de intenção, Shift+arrastar para ligar, duplo clique no terreno para fundação de projeto, órbita com botão direito, pan e zoom suave).
7. [x] Implementar medição real de taxa de quadros e tempo p95 (`medirFps`) para atestar desempenho no perfil carga.
8. [x] Conectar o `MapView` diretamente ao store Zustand no componente raiz `src/app/App.tsx`, operando estritamente com fluxo unidirecional (leitura de estado derivado e emissão de intenções transformadas em comandos validados por Zod com suporte a `Ctrl+Z`).
9. [x] Criar suíte de testes unitários para submódulos do mapa em `tests/unit/mapa-grade-geometria.test.ts` (6 testes aprovados cobrindo inserção/busca na grade espacial, integridade das 8 malhas procedurais, ponto em polígono e mapeamento de fases).
10. [x] Criar teste E2E de aceitação da Fase 4 em `tests/e2e/fase4-mapa3d.spec.ts` comprovando os critérios da Seção 8: cidades renderizadas em InstancedMesh, clique que abre o painel do projeto, persistência de movimento e medição de desempenho no perfil carga.
11. [x] Manter suíte 100% verde: 184 testes unitários no Vitest (14 arquivos), 3 testes E2E no Playwright, 0 erros no ESLint, 0 violações de camada no `dependency-cruiser` (64 módulos) e compilação de produção do Vite bem-sucedida.

---

## Plano e Checklist da Fase 5 — Painel da Cidade Completo

1. [x] Implementar componente `GraficoFinancasSvg.tsx` nativo em SVG para projeção e histórico financeiro de 12 meses (6 meses históricos + 6 meses projetados por recorrência) com barras duplas de receita/custo, linha de base zero e responsividade.
2. [x] Implementar `AbaVisaoGeral.tsx` com decomposição transparente da pontuação de saúde (penalidades por tarefas vencidas, fluxo negativo, baixa moral e bloqueios), metas de horas semanais com barra de progresso, resumo de conexões estratégicas e notas com edição em linha/modal.
3. [x] Implementar `AbaTarefas.tsx` com alternância entre visualização em Lista hierárquica por Frente e Quadro Kanban de 4 colunas (Pendente, Em Andamento, Bloqueada, Feita), filtros por status e prazo, destaque de dependências impeditivas e registro ágil de horas.
4. [x] Implementar `AbaClientes.tsx` com listagem de clientes vinculados, contratos recorrentes (R$/mês), cálculo de concentração de receita, alerta para falta de contato há mais de 60 dias (`Config.detectores.diasUltimoContatoCliente`) e botão de ação rápida "Contato Hoje".
5. [x] Implementar `AbaFinancas.tsx` integrando o fluxo líquido do mês atual, o gráfico analítico SVG de 12 meses, a projeção de 6 meses de recorrência, o ROI por hora com ranking imperial (`#X no Império`), detalhamento de financiamento cruzado e histórico de lançamentos com filtros.
6. [x] Implementar `AbaEstoque.tsx` exibindo a Lista de Materiais (BOM) do projeto, status de cobertura (`✓ Coberto` vs. `⚠️ Em Falta`), detalhamento de saldos por armazém e síntese de compras com botão de cópia de texto formatado para a área de transferência (`navigator.clipboard`).
7. [x] Implementar `AbaPd.tsx` com tecnologias aplicadas ao projeto (efeitos em velocidade, custo ou receita), banco de tecnologias dominadas disponíveis no império, horas de pesquisa acumuladas e modal de aplicação de tecnologia.
8. [x] Implementar `ModalEditarProjeto.tsx` para alteração de nome, setor, horas-alvo por semana, modalidade de autonomia e notas.
9. [x] Orquestrar todas as abas e modais no `PainelProjeto.tsx`, mantendo persistência de estado e modal de arquivamento para Ruínas com exigência obrigatória de lições aprendidas.
10. [x] Criar suíte de testes E2E dedicada da Fase 5 em `tests/e2e/fase5-painel.spec.ts` com 6 cenários de teste automatizados validando individualmente cada uma das 6 abas e todos os elementos da Tabela 6.5.
11. [x] Manter suíte 100% verde: 184 testes unitários no Vitest (14 arquivos), 9 testes E2E no Playwright (4 arquivos: fase 0, 3, 4 e 5), 0 erros no ESLint, 0 violações no `dependency-cruiser` (72 módulos) e compilação de produção aprovada.

---

## Plano e Checklist da Fase 6 — Lentes, Minimapa, Feed e Busca

1. [x] Implementar as 8 lentes estratégicas de visualização do mapa (atalhos 1 a 8) em `src/domain/lentesCores.ts`, `src/map/cidadesInstanciadas.ts` e `src/map/rotasLigacoes.ts`:
   - `[1]` Padrão (cor por saúde: Jade ≥70, Âmbar ≥40, Laca <40, Pedra para Ruínas)
   - `[2]` Finanças (cor por fluxo de caixa mensal; realce em ouro das rotas de financiamento cruzado)
   - `[3]` Tempo (cor por horas registradas vs. horas-alvo na semana)
   - `[4]` Rede (realce de hubs com ≥2 conexões em ouro, 1 conexão em jade e atenuação de nós isolados)
   - `[5]` Risco (cor por concentração de clientes e fornecedores)
   - `[6]` Clientes (cor por clientes ativos e dias desde o último contato contra o limiar de 60 dias)
   - `[7]` Estoque (cor por cobertura de materiais da BOM)
   - `[8]` P&D (cor azul celeste para cidades com tecnologias dominadas/aplicadas)
2. [x] Implementar Minimapa aéreo em `src/ui/Minimapa.tsx` no canto inferior esquerdo com contornos poligonais dos territórios dos setores, pontos das cidades coloridos pela lente ativa, retângulo de frustum da câmera clicável e seletor integrado das 8 lentes.
3. [x] Implementar Feed de Eventos cronológico em `src/ui/FeedEventos.tsx` com selo de alerta animado (carta de mensageiro `.selo-mensageiro-animado`), alertas vivos de campanha e ações interativas de resposta (`aproveitar`, `mitigar`, `ignorar`).
4. [x] Implementar Busca Global (`/` ou `Ctrl+K`) em `src/domain/buscaGlobal.ts` e `src/ui/BuscaGlobal.tsx` encontrando projeto, tarefa, cliente, item e tecnologia em `≤ 100 ms` por tecla no perfil carga, com voo suave de câmera (`MapView.voarAte`) até o destino.
5. [x] Criar suíte de testes unitários `tests/unit/lentes-e-busca.test.ts` (6 testes) e suíte E2E `tests/e2e/fase6-lentes-feed-busca.spec.ts` (3 cenários, incluindo 8 capturas de referência por lente com semente fixa e verificação de imutabilidade do `THREE.Scene`).
6. [x] Manter suíte 100% verde: 190 testes unitários no Vitest (15 arquivos), 12 testes E2E no Playwright (5 arquivos), 0 erros no ESLint, 0 violações no `dependency-cruiser` (78 módulos) e compilação de produção aprovada.

---

## Plano e Checklist da Fase 7 — Árvore Tecnológica e Estoque Completo

1. [x] Expandir `src/store/campanhaStore.ts` com modais `'arvoreTecnologica'` e `'estoqueGlobal'` e ações validadas pelo motor puro: `adicionarPreRequisitoTecnologia` (bloqueio de ciclos no DAG via `criariaCicloPreRequisito`), `removerPreRequisitoTecnologia`, `alterarEstadoTecnologia` (validação de pré-requisitos dominados via `validarTransicaoEstadoTecnologia`), `obterRankingTecnologias` (`rankingOQuePesquisarPrimeiro`) e `registrarMovimentoEstoque` (bloqueio de saldo negativo e recálculo automático da BOM).
2. [x] Implementar `src/ui/TelaArvoreTecnologica.tsx` (atalho `G` e botão HUD `🔬 P&D [G]`) com fundo de laca escura (`#1B1814`), layout topológico em colunas, fios dourados em curvas Bezier SVG (`svg-fios-arvore`), alerta de bloqueio de ciclo/pré-requisito (`alerta-erro-arvore`), seção *"O Que Pesquisar Primeiro"* (`secao-ranking-pesquisa`) e aplicação de tecnologias dominadas às cidades.
3. [x] Implementar marcador visual de luz azul P&D (`#3182CE`) em `src/map/cidadesInstanciadas.ts` (`malhaLuzesPd` em `THREE.InstancedMesh`) e `MapView.obterTotalLuzesPdAtivas()` destacando no mapa 3D as cidades com tecnologias aplicadas.
4. [x] Implementar `src/ui/TelaEstoqueGlobal.tsx` (botão HUD `📦 Estoque`) com 3 abas: Saldos & Movimentos (registro de entrada, saída e ajuste com bloqueio de saldo negativo), Cadastros de Fornecedores, Armazéns e Itens, e Lista de Materiais (BOM) & Compra Sugerida consolidada por fornecedor.
5. [x] Criar suíte E2E `tests/e2e/fase7-arvore-estoque.spec.ts` (2 cenários completos exercitando pela interface todos os casos de árvore e estoque da Tabela 7.2).
6. [x] Manter suíte 100% verde: 190 testes unitários no Vitest (15 arquivos), 14 testes E2E no Playwright (6 arquivos), 0 erros no ESLint, 0 violações no `dependency-cruiser` (80 módulos) e compilação de produção aprovada.

---

## Plano e Checklist da Fase 8 — Desempenho

1. [x] Implementar batching de rotas em `src/map/rotasLigacoes.ts` (`THREE.LineSegments` agrupados por cor/opacidade), reduzindo ~500–750 chamadas de desenho no perfil carga para `≤ 4` draw calls.
2. [x] Implementar níveis de detalhe (LOD) por distância para árvores e detalhes (`src/map/vegetacaoLod.ts` — `lod0_alta`, `lod1_media`, `lod2_oculto`) e seletor automático de qualidade gráfica (`definirQualidadeGrafica('automatica')`) em `src/map/MapView.ts`.
3. [x] Implementar cache de assinatura de territórios (`assinaturaTerritorios`) em `src/map/MapView.ts` para evitar retriangulação redundante de polígonos em seleções e trocas de lente.
4. [x] Implementar Web Worker dedicado para recálculos pesados (`src/workers/recalculo.worker.ts` e `executarRecalculoPesadoWorker` em `src/workers/index.ts`).
5. [x] Implementar componente de virtualização por janela `src/ui/ListaVirtualizada.tsx` e integrá-lo em `src/ui/painel/AbaTarefas.tsx` e `src/ui/painel/AbaFinancas.tsx`.
6. [x] Otimizar importação atômica de JSON de 5 MB (`src/store/campanhaStore.ts` e `src/repository/dexie/RepositorioDexie.ts`) e configurar code-splitting (`manualChunks`) em `vite.config.ts` (`450,01 KB` gzip total, meta `≤ 1,5 MB`).
7. [x] Documentar relatório completo de gargalos e medições em `docs/RELATORIO_DESEMPENHO_FASE8.md`.
8. [x] Criar suíte de testes unitários de desempenho `tests/unit/desempenho-fase8.test.ts` (6 testes) e suíte E2E `tests/e2e/fase8-desempenho.spec.ts` comprovando todas as 8 metas da Tabela 7.4.
9. [x] Manter suíte 100% verde: 196 testes unitários no Vitest (16 arquivos), 15 testes E2E no Playwright (7 arquivos), 0 erros no ESLint, 0 violações no `dependency-cruiser` (83 módulos) e compilação de produção aprovada.




