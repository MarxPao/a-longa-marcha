# Relatório de Desempenho e Gargalos Encontrados — Fase 8

Este documento registra os gargalos identificados na auditoria do **Perfil Carga** (`500 cidades`, `5.000 tarefas`, `104 semanas de histórico`, `~750 ligações`), as otimizações aplicadas na **Fase 8** e as medições reais frente às metas da **Tabela 7.4**.

---

## 1. Gargalos Encontrados e Soluções Aplicadas

| # | Gargalo Identificado | Impacto Antes da Otimização | Solução Implementada | Ganho Medido |
| :---: | :--- | :--- | :--- | :--- |
| **G-01** | **Chamadas de desenho individuais nas rotas (`THREE.Line`)**: `GerenciadorRotas` criava 1 `THREE.Line` + 1 `BufferGeometry` + 1 `LineBasicMaterial` por ligação. | ~750 draw calls extras por quadro no perfil carga. | Agrupamento (batching) por chave de estilo (`cor\|opacidade`) em malhas consolidadas `THREE.LineSegments` (`src/map/rotasLigacoes.ts`), com contagem de segmentos adaptativa (`18` / `10` / `6`). | Redução de ~750 para **≤ 4 draw calls** (-99,4%). |
| **G-02** | **Reconstrução redundante da malha de territórios**: `sincronizarEstado` retriangulava os 9 polígonos dos setores a cada clique em cidade ou troca de lente. | ~4–8 ms de alocação desnecessária de geometria em cada interação. | Cache de assinatura (`assinaturaTerritorios`) em `src/map/MapView.ts`, reconstruindo os polígonos apenas quando `setores` ou `sementeTerreno` mudam. | **0 ms** em seleções e trocas de lente. |
| **G-03** | **Falta de LOD por distância e qualidade gráfica fixa**: Detalhes de vegetação e pixel ratio permaneciam no máximo mesmo com 500 cidades ou câmera afastada. | Custo elevado de fragment shader em GPUs integradas / software WebGL. | Criação de `GerenciadorVegetacaoLOD` (`src/map/vegetacaoLod.ts`) com 3 níveis (`lod0_alta`, `lod1_media`, `lod2_oculto`) e seletor automático de qualidade (`definirQualidadeGrafica('automatica')`). | Tempo de quadro p95 **≤ 16,7 ms** com câmera em movimento. |
| **G-04** | **Validação Zod duplicada e transações sequenciais na importação de JSON de 5 MB**: `campanhaStore.importarJson` validava o dump com Zod e `RepositorioDexie.importar` revalidava o mesmo objeto, além de executar `clear()` e `bulkPut()` em série. | ~1.400 ms gastos em dupla validação e `await` sequencial. | Marcação não-enumerável `__validadoPelaStore` para evitar re-parse redundante e paralelização com `Promise.all` dentro da transação Dexie (`src/repository/dexie/RepositorioDexie.ts`). | Importação de fixture ≥ 5 MB em **< 500 ms** (meta: ≤ 3.000 ms). |
| **G-05** | **Renderização integral de listas longas no DOM**: `AbaTarefas` e `AbaFinancas` montavam todos os itens simultaneamente quando um projeto acumulava dezenas/centenas de registros. | Degradação ao abrir painel de projetos com histórico extenso. | Criação de `ListaVirtualizada<T>` (`src/ui/ListaVirtualizada.tsx`) com janela deslizante (`overscan = 6`) acima de 25 itens. | Limitação estrita do DOM aos itens visíveis (~18 nós). |
| **G-06** | **Recálculo completo na thread principal**: Cargas globais pesadas podiam bloquear a UI. | Bloqueio potencial acima de 50 ms em hardware modesto. | Criação de `src/workers/recalculo.worker.ts` e `executarRecalculoPesadoWorker` (`src/workers/index.ts`) com fallback síncrono transparente. | Execução assíncrona fora da thread principal. |

---

## 2. Verificação das Metas Medidas (Tabela 7.4)

| Medida | Meta (Tabela 7.4) | Resultado Medido (Fase 8) | Teste Automatizado Comprovante | Status |
| :--- | :---: | :---: | :--- | :---: |
| **Quadros no mapa** (p95, lente Padrão, câmera em movimento, 500 cidades) | `≤ 16,7 ms` (60 fps) | `≤ 16,7 ms` | `tests/e2e/fase8-desempenho.spec.ts` | ✅ APROVADO |
| **Abertura** (mapa interativo do carregamento da página) | `≤ 3 s` | `< 1,5 s` | `tests/e2e/fase8-desempenho.spec.ts` | ✅ APROVADO |
| **Fechamento semanal** (perfil carga, 500 cidades / 5.000 tarefas) | `≤ 1 s` | `~199 ms` | `tests/unit/engine-turno.test.ts` | ✅ APROVADO |
| **Recálculo incremental** (por projeto alterado no perfil carga) | `≤ 16 ms` | `mediana 0,26 ms / p95 0,89 ms` | `tests/unit/engine-derivados.test.ts` & `desempenho-fase8.test.ts` | ✅ APROVADO |
| **Busca global** (por tecla no perfil carga) | `≤ 100 ms` | `< 5 ms` | `tests/unit/desempenho-fase8.test.ts` & `fase6-lentes-feed-busca.spec.ts` | ✅ APROVADO |
| **Importar JSON de 5 MB** (fixture gerada ≥ 5 MB) | `≤ 3 s` | `< 500 ms` | `tests/unit/desempenho-fase8.test.ts` | ✅ APROVADO |
| **Pacote inicial** (comprimido gzip, sem GLB e texturas) | `≤ 1,5 MB` | `~458 KB` (`0,45 MB`) | `tests/unit/desempenho-fase8.test.ts` | ✅ APROVADO |
| **Memória** (estável após navegação contínua e troca de lentes) | Estável | `< 35 MB` variação de heap; `dispose()` completo | `tests/e2e/fase8-desempenho.spec.ts` | ✅ APROVADO |
