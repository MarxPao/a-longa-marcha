# Plano de Conversão do Mapa — Mapa Plano, Metrópole Central, Mercado Vivo e Fluxo de NPCs (`docs/map-plan.md`)

## 1. Visão Geral da Mudança

Substituição do terreno com relevo (heightmap/karst e rios por vale) por um **mapa plano estratégico (`y = 0`)** centrado na **Metrópole Central (`CentralHub`)** em `(0, 0)`, cercada por **cunhas radiais** para cada setor, com **lojas geradas por produtos ativos**, **estradas Catmull-Rom (avenidas de setor, ramais de cidades e trilhas entre cidades)** e **fluxo vivo de NPCs e carroças em `InstancedMesh`** guiados estritamente pelos dados reais de receita, insumos e ligações.

---

## 2. O Que Sai vs. O Que é Reaproveitado

### 2.1 O Que é Reaproveitado (`src/map` e `src/engine`)
- **Iluminação, Céu, Luz Suave e Névoa de Distância (`MapView.ts`):**
  - Luz hemisférica (`#E8DCC0` / `#3E7C68`), luz direcional suave (`#FFF3D6`) e névoa de distância amarelada (`THREE.FogExp2('#E8DCC0', ...)`).
- **Câmera Inclinada e Navegação (`MapView.ts`):**
  - Câmera inclinada entre `30°` e `55°` (`anguloElevacao`), pan, órbita, zoom (`wheel`) e voo suave (`voarAte` com interpolação `easeOutCubic`), ajustados para o raio do mapa (`≥ 840 u`).
- **Cidades Instanciadas, Formas de Saúde, Moral e Alertas (`cidadesInstanciadas.ts`, `cidadesGeometria.ts`, `atmosferaTerreno.ts`):**
  - As 8 geometrias de fase de maturidade das cidades (`0` Ruínas a `7` Legado), escaladas conforme os raios de `src/config/layout.ts` (`14 u` no nível 1 até `44 u` no nível 7).
  - Redundância tridimensional de saúde (`malhaBandeirasErguidas`, `malhaBandeirasCaidas`, `malhaFumacaCritica`), halo azul de P&D (`malhaLuzesPd`), anéis de névoa de moral baixa (`malhaNevoaMoralBaixa`) e partículas douradas de crescimento (`pontosParticulasOuro`).
  - Névoa de tinta nas bordas do mapa e sobre cunhas de setores vazios.
- **Grade Espacial (`gradeEspacial.ts`) e Sistema de Lentes (`lentesCores.ts`):**
  - Indexação espacial 2D para seleção/hover/arrasto em $O(1)$ e cálculo de cores por lente, estendido com as regras da Seção 4.6 para lojas, estradas e filtros por setor/produto.
- **Motor Financeiro e Derivados (`src/engine/`):**
  - Funções puras de tempo UTC (`tempo.ts`), moral, saúde, maturidade, finanças, detectores e fechamento de turno permanecem intactas.

### 2.2 O Que Sai ou é Substituído
- **Sai o Relevo / Karst / Rios por Cota (`MapView.ts`, `atmosferaTerreno.ts`):**
  - `obterAlturaTerreno(x, z)` passa a retornar `0` em todo o plano do mapa (terreno 100% plano, sem colinas karst, sem picos rochosos e sem rios gerados por altura).
  - O pacote `procedural-terrains` deixa de deslocar vértices em `Y`; o chão passa a ser um plano estilo pergaminho e terra pintado proceduralmente (`shader`/textura procedural de papel envelhecido `#E8DCC0`, grão de fibra e manchas sutis de terra `#7A5A2B` / tinta `#1F1B16`).
- **Substituição de Polígonos Arbitrários por Cunhas Radiais (`territorios.ts` -> `layoutWorld`):**
  - Os setores deixam de ser polígonos retangulares soltos e passam a ser **cunhas radiais** ao redor de `(0, 0)` calculadas por `layoutWorld(state, config)` com ângulo proporcional a $\sqrt{\text{projetos ativos} + 1}$ (mínimo `20°`, soma `360°`), chão tingido com a cor do setor a `12%` de opacidade e fronteiras em linha de tinta (`#1F1B16`).
- **Substituição de Arcos Aéreos por Estradas no Chão (`rotasLigacoes.ts` -> `routeRoads`):**
  - As ligações deixam de ser arcos parabólicos no ar e passam a ser estradas sobre o chão plano geradas por `routeRoads(layout, flows)`:
    - **Avenidas tronco (`5 u`)**: do centro/portão do setor na Metrópole Central para o interior da cunha.
    - **Ramais (`3 u`)**: de cada cidade até o portão/avenida do seu setor em curvas suaves Catmull-Rom sem atravessar cidades.
    - **Trilhas cidade a cidade (`2 u`)**: para cada `Ligacao` com fluxo entre cidades.

---

## 3. Novos Módulos e Arquitetura

1. **`src/config/layout.ts`**:
   - Fonte única de verdade para todas as medidas em unidades de mundo (`u`), raios, larguras de estrada, tamanhos de loja (`P = 6 u`, `M = 9 u`, `G = 13 u`), escala de NPC (`altura = 1.6 u`, `NPC_VISUAL_SCALE = 2`, `carroca = 3 u`), parâmetros de fluxo (`k = 2`, `volumeBaseCentavos = 50000`, `nMax = 12`, `tetoGlobalNpcs = 1500`, `velocidadeNpc = 6`), limiares de nível da Metrópole Central (`0` a `4`) e paleta oficial.
2. **`src/engine/trade/` (Motor Puro de Comércio e Layout)**:
   - `layoutWorld(state, config)`: calcula cunhas dos setores, nível e anéis da Metrópole Central, portões por setor e posições polares/cartesianas das cidades com relaxamento anti-colisão determinístico (`soma dos raios + 12 u`), respeitando `Projeto.posicao` quando arrastado pelo usuário.
   - `deriveShops(state, config)`: calcula a média móvel de 3 meses de receita por `Produto` (e bancas genéricas para receitas sem produto), percentis de tamanho (`P`/`M`/`G`), alocação em arcos concêntricos no bairro do setor e estado do ciclo de vida (`abrindo`, `aberta`, `fechada` aos 60 dias sem receita, removida aos 180 dias, `sumindo` se arquivado).
   - `deriveFlows(state, config)`: gera fluxos de `producao` (cidade -> loja na metrópole), `insumo` (metrópole -> cidade) e `ligacao` (cidade -> cidade), calculando a quantidade de NPCs pela fórmula logarítmica com teto global proporcional de `1.500`.
   - `routeRoads(layout, flows, config)`: gera polilinhas Catmull-Rom determinísticas para avenidas, ramais e trilhas desviando de colisões com cidades.
3. **`src/map/metropoleCentral.ts` & `src/map/shopRegistry.ts`**:
   - Renderização da Metrópole Central (`CentralHub`) em `(0, 0)` com praça central, monumento escalonado pelo nível (`0..4`), anéis de ruas, muralha baixa, um portão por setor e bairros em cunha.
   - Registro extensível `shopRegistry` com os 8 modelos procedurais de loja (`padaria`, `acougue`, `taverna`, `armazem_graos`, `ferraria`, `laboratorio_alquimista`, `casa_escribas`, `balanca_cambio`) + `banca_generica`, renderizados via `InstancedMesh` com placas de ícone e estados visuais (`abrindo` com andaime, `aberta`, `fechada` com persianas/desbotada, `sumindo`).
4. **`src/map/estradasMapa.ts` & `src/map/npcsFluxo.ts`**:
   - Malhas de estradas no chão com espessura e brilho logarítmicos, suporte a hover (destaque dos extremos + tooltip de volume e produtos) e transição suave de `400 ms` ao arrastar uma cidade.
   - Sistema de NPCs e carroças em `InstancedMesh` (corpo, bandeirola na cor do setor, carga por tipo de produto) avançando parâmetro `t` a `6 u/s` com balanço de caminhada no vertex shader e transição para partículas em câmera distante.
