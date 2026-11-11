# Registro de Decisões Técnicas — Mapa Plano com Metrópole Central e Mercado Vivo (`docs/decisions.md`)

## 1. Camada Pura `src/config/layout.ts`
- **Contexto:** A Seção 4.1 exige que todas as medidas de escala e proporção em unidades de mundo (`u`) residam em `src/config/layout.ts` e que qualquer medida derivada seja calculada por razão e registrada ali. Além disso, `src/engine/trade/` e `src/map/` precisam ler essas constantes sem violar a pureza de camadas.
- **Decisão:** `src/config/layout.ts` é definido como módulo base puro (zero dependências externas), autorizado no `.dependency-cruiser.cjs` para ser importado por `src/domain/`, `src/engine/`, `src/store/`, `src/ui/` e `src/map/`.

## 2. Sincronização entre `Projeto.posicao` e `Projeto.x` / `Projeto.z`
- **Contexto:** A Seção 4.2 especifica que *"A posição arrastada pelo usuário sempre prevalece e é guardada em `Projeto.posicao`"*, enquanto o esquema existente de `Projeto` já possui `x: number` e `z: number`.
- **Decisão:** Adicionamos o campo opcional `posicao?: { x: number; z: number } | null` em `Projeto` (`EsquemaProjeto`). Quando o usuário arrasta uma cidade no mapa, a store atualiza tanto `posicao: { x, z }` quanto `x` e `z`. Se `Projeto.posicao` estiver presente, `layoutWorld` usa `Projeto.posicao` como coordenada fixa do usuário; caso contrário (`posicao == null`), `layoutWorld` posiciona a cidade em coordenadas polares dentro da cunha do seu setor com distância inversamente proporcional à receita mensal (proximidade comercial).

## 3. Cálculo da Receita Mensal do Produto e Estado do Ciclo de Vida da Loja
- **Contexto:** A Seção 5 define que *"Receita mensal do produto = média móvel de 3 meses dos lançamentos de receita com `produtoId`. Receita sem produto vira uma banca genérica do projeto, com selo 'associe um produto' e atalho no painel"*, e a Seção 4.3 define que *"Sem receita há 60 dias, fecha (persianas, cor desbotada, sem NPCs). Sem receita há 180 dias, some"*.
- **Decisão:** Para a data de referência `hoje` (formato `AAAA-MM-DD`):
  - A média móvel de 3 meses soma os lançamentos de `tipo === 'receita'` não arquivados na janela `[hoje - 90 dias, hoje]` e divide por `3` (em centavos inteiros arredondados).
  - O número de dias sem receita (`diasSemReceita`) é a diferença em dias entre `hoje` e a maior `Lancamento.data <= hoje` daquele produto (ou, se nunca teve lançamento mas foi criado há $d$ dias, a diferença desde `criadoEm`).
  - Se `produto.arquivadoEm !== null` ou `!produto.ativo`, o estado é `'sumindo'` (exibido brevemente para desmontagem animada ou omitido quando concluído).
  - Se `diasSemReceita >= 180`, a loja some (não é retornada como loja ativa em `deriveShops`).
  - Se `60 <= diasSemReceita < 180`, a loja fica com `estado: 'fechada'` e `receitaMensal: 0` (sem gerar fluxo de NPCs).
  - Se o produto foi criado há menos de 2 segundos de tempo real no cliente (ou recém-adicionado na sessão), inicia em `'abrindo'` e transita para `'aberta'` em `2 s`. Caso contrário, `estado: 'aberta'`.

## 4. Volume de Fluxo de Ligação entre Cidades
- **Contexto:** A Seção 4.5 define que os fluxos de `ligacao` (cidade para cidade) ocorrem para os tipos *"fornece insumo"*, *"reaproveita código"*, *"mesmo cliente"* e *"financia"*, com *"volume = força da ligação, ou o valor real se houver lançamento vinculado"*.
- **Decisão:** Para mapear `forca` (`1 | 2 | 3`) na mesma escala monetária de `volumeBase = R$ 500` (`50.000` centavos) quando não há lançamento vinculado explícito, cada ponto de `forca` equivale a `forca * volumeBase` (`R$ 500`, `R$ 1.000`, `R$ 1.500`), produzindo `1` a `4` NPCs determinísticos na trilha entre cidades. Se houver fluxo financeiro/insumo real vinculado entre os projetos, usa-se o valor real em centavos.

## 5. Unificação de Pipeline (Fase 2b — Etapa G0)
- **Contexto:** A Seção 2 (Princípio 1) e a Etapa G0 exigem um único caminho de renderização: remover o botão `"Demo Mercado"` da barra do mapa (`src/app/App.tsx`), garantir zero ocorrências de `demo` em `src/map/`, transformar `"Ir à metrópole"` em marcador puro de câmera, mover `"Carregar dados de exemplo"` para Importar/Configurações (`src/ui/EditorRegistros.tsx`) e exibir a metrópole vazia (praça e portões, zero lojas) com a dica `"adicione um produto"` quando não houver produtos ativos.
- **Decisão (registro de alteração fora de `src/map`, `src/assets` e `src/config` conforme Seção 8):**
  - `src/app/App.tsx`: remoção do botão `"Demo Mercado"` do mapa; renomeação de `"🏛️ Metrópole (0,0)"` para `"🏛️ Ir à metrópole"` (atalho de câmera `voarAte(0, 0)`); inclusão da dica de onboarding `"Metrópole Central vazia — adicione um produto..."` quando não há produtos ativos e do HUD de escala/breadcrumb da câmera (`Seção 3.2`).
  - `src/ui/EditorRegistros.tsx`: inclusão do botão `"📂 Carregar dados de exemplo (seed/demo.json)"` na aba Dados, importando os dados pelo repositório (`importarJson`).
  - `src/ui/Minimapa.tsx`: sincronização do trapézio de frustum visível da câmera (`Seção 3.2`).
  - `src/engine/trade/deriveFlows.ts`: inclusão de todos os `produtoIds` ativos com receita do projeto no fluxo de produção para garantir rastreabilidade completa dos produtos transportados.
  - Tecla de atalho de evento: como a tecla `E` é canônica da câmera (Seção 3.2: `Q` e `E` giram a câmera), o atalho global de captura rápida de evento no `App.tsx` foi remanejado para `V` (de e**V**ento), mantendo `H` (horas), `T` (tarefa) e `L` (lançamento).

## 6. Pós-Processamento e Sombra sem Dependências Pesadas (> 300 kB) (Fase 2b — Etapas G2 e G3)
- **Contexto:** A Seção 8 determina que qualquer nova dependência acima de 300 kB deve ser justificada neste arquivo.
- **Decisão:** Implementamos o pipeline de pós-processamento unificado (GTAO/SSAO em screen-space, bloom seletivo em emissivos, tilt-shift, curva de cor quente e vinheta) e o ajuste de sombras ao frustum com ancoragem de texels (texel snapping + cascatas na qualidade Alta) diretamente sobre `three` (`ShaderMaterial` / `WebGLRenderTarget` nativos), adicionando **0 kB** de dependências externas novas.


## 7. Diagnóstico e Resolução Definitiva de Artefatos Pretos e Unificação de Materiais (Fase 2c — Passo Zero H0)
- **Contexto:** Na Fase 2b/2c, cidades, muralhas, generais e árvores apareciam completamente pretos na cena de campanha, enquanto as tendas e lojas do mercado da Metrópole Central apresentavam cores visíveis.
- **Causa Raiz Identificada por Bisseção:**
  1. **Multiplicação de Albedo por Zero via VertexColors Desvinculados:** `cidadesInstanciadas.ts`, `vegetacaoLod.ts` e `cidadesGeometria.ts` instanciam materiais com `vertexColors: true`. No entanto, as geometrias procedurais geradas por `mergeGeometries` não possuíam o atributo de buffer `color`. O compilador de shaders do Three.js injeta `#include <color_fragment>`, que executa `diffuseColor *= vColor;`. Na ausência do atributo `color`, a GPU lê `vec3(0.0, 0.0, 0.0)`, multiplicando todo o albedo por zero e tornando o modelo inteiramente preto. As lojas do mercado tinham cor porque `shopRegistry.ts` definia explicitamente `setAttribute('color', ...)` em cada submódulo antes da mesclagem.
  2. **Fragmentação de Construtores de Materiais:** As cidades e o mercado da metrópole utilizavam funções distintas e materiais com parâmetros desiguais.
  3. **Ausência de Fail-Fast na Paleta:** Leituras de propriedades indefinidas na paleta não falhavam alto em desenvolvimento.
- **Solução Implementada e Aprovada:**
  1. **Lookup Fail-Fast Estrito:** `src/config/layout.ts` implementa `Proxy` sobre `PALETA_MAPA` e a função `obterCorPaleta(chave)`, lançando `throw new Error` explícito caso qualquer chave inexistente seja acessada.
  2. **Injeção de Segurança de Atributo de Cor:** `garantirAtributoCorGeometria()` em `src/map/materiaisAvancados.ts` injeta `[1.0, 1.0, 1.0]` em qualquer `BufferGeometry` desprovida de atributo `color`.
  3. **Pintura Modular com Albedo Mínimo (`#2A2420`):** `colorirGeometriaModular()` aplica cores arquiteturais canônicas da dinastia Han (reboco claro, telha cinza-azulada, madeira escura, pedra) garantindo albedo mínimo seguro em cada componente.
  4. **Unificação Canônica de Materiais:** `obterMaterialEdificiosCampanha()` em `src/map/materiaisAvancados.ts` atua como fonte única de verdade para edifícios de cidades, generais e lojas do mercado da metrópole (`roughness: 0.85`, `metalness: 0.0`, `vertexColors: true`, textura de ruído procedural para micro-rugosidade).
  5. **Iluminação de Preenchimento e Eliminação de Acne:** Luz hemisférica ajustada (`HemisphereLight` 1.1) e viés de sombras configurado (`shadow.bias = -0.0002`, `normalBias = 0.04`), garantindo zero pixels pretos (`< 0.05`) e luminância média $\ge 0.25$ em todos os modelos.

## 8. Fase 2c — Etapa H2: Fatia Vertical (Agricultura e Comércio)

- **Kit de Arquitetura Modular:**
  - **Agricultura (Verde-Jade):** 3 tipos com 6 variantes procedurais cada (18 modelos): `casa_taipa_palha` (bases elevadas, painéis de reboco, beirais curvos, varandas e anexos), `celeiro_elevado` (estacas elevadas, assoalho, rampas, guindastes e estrados) e `moinho_agua` (roda d'água monumental de 8 pás, calha de madeira e silo superior).
  - **Comércio (Laca e Ouro):** 3 tipos com 6 variantes procedurais cada (18 modelos): `armazem_longo` (edifícios compridos, portões com anéis de ferro, caixas empilhadas), `portico_comercial` (colunata aberta em laca, telhado duplo, balcão de câmbio, balança e lanternas) e `barraca_mercado` (balcões com saia mercantil, toldos em tecido e listras de laca/ouro a $\le 15\%$ da área).
  - **Defesa:** `muralha` modular com ameias e contrafortes, e `portao` fortificado Han com torres de cantaria, portas de laca e pavilhão de guarda superior.
- **Validação Automatizada:**
  - Suíte Playwright `tests/e2e/fase2c-h2-fatia-vertical.spec.ts` executada com sucesso comprovando 38/38 modelos aprovados (0% pixels pretos, luminância $\ge 0.25$).
  - Capturas de Setor, Cidade e Rua salvas em `docs/visual/h2/` e integradas ao visualizador interativo em `?debug=h2`.
