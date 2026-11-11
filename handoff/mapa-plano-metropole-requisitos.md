# Requisitos Numerados — Converter o Mapa em um Mapa Plano com Metrópole Central, Mercado Vivo e Fluxo de NPCs

## Pedido Original e Mapeamento de Exigências (R1..R48)

### 1. Arquitetura e Camadas
- **R1:** Stack em TypeScript, Vite, React (painéis), Three.js direto na classe `MapView` (sem `react-three-fiber`), Zustand e IndexedDB via Dexie.
- **R2:** O motor de regras (`src/engine`) é feito de funções puras, sem dependência de React, Three.js ou banco (Dexie).
- **R3:** O mapa (`src/map`) só desenha estado derivado e emite intenções (selecionar, arrastar, ligar); nunca grava no repositório.
- **R4:** Princípio de dados reais: cada loja, NPC e estrada existe porque um dado real o justifica, e some quando o dado some.
- **R5:** Distinção semântica: "Metrópole Central" (`CentralHub`) é o lugar central do mapa em `(0, 0)`, sem confundir com a fase de maturidade "Metrópole" (nível 6) das cidades, que continua existindo.

### 2. Terreno Plano, Paleta e Atmosfera (Seção 3)
- **R6:** Terreno plano: sem relevo (`y = 0`), sem karst, sem rios gerados por altura. Mantém câmera inclinada (`30°` a `55°`), pan e zoom.
- **R7:** Chão não vazio: textura de papel e terra gerada por shader/procedural (ou CC0), fronteiras em tinta, névoa de tinta nas bordas do mapa, luz suave e névoa de distância amarelada.
- **R8:** A Metrópole Central fica em `(0, 0)`. Os setores são cunhas radiais ao redor dela; cada cidade fica dentro da cunha do seu setor.
- **R9:** Assets procedurais ou CC0 (zero assets da Creative Assembly).
- **R10:** Paleta obrigatória: pergaminho `#E8DCC0`, tinta `#1F1B16`, laca `#8E1F1A`, jade `#3E7C68`, ouro `#B8923A`, bronze `#7A5A2B`, névoa `#9DAAB0`.

### 3. Escala e Proporção em `src/config/layout.ts` (Seção 4.1)
- **R11:** Todos os valores de escala e proporção (em unidade de mundo `u`) vivem em `src/config/layout.ts`; nada fica fixo no código:
  - Metrópole Central: raio `140 u` (chega a `200 u` no nível máximo 4)
  - Anel livre entre muralha e primeira cidade: `60 u`
  - Cidade: raio `14 u` (nível 1) a `44 u` (nível 7), crescimento suave
  - Raio do mapa: pelo menos `6` vezes o da metrópole (`840 u`), com `25%` de folga além da cidade mais distante
  - Edifício comum: `4` a `8 u`
  - Loja do mercado: `6 u` (`P`), `9 u` (`M`), `13 u` (`G`)
  - NPC: `1,6 u` de altura, desenhado com `NPC_VISUAL_SCALE = 2` para ler na câmera de jogo; carroça `3 u`
  - Estrada: tronco `5 u`, ramal `3 u`, trilha cidade a cidade `2 u`
  - Limiares de nível da metrópole (0 a 4) e demais constantes derivadas por razão registrados em `src/config/layout.ts`.

### 4. Layout Radial de Cunhas e Posicionamento de Cidades (Seção 4.2)
- **R12:** Cada setor ocupa uma cunha com ângulo proporcional a $\sqrt{\text{projetos ativos} + 1}$, mínimo de `20°`, normalizado para somar `360°` (se o mínimo não couber, reduz proporcionalmente). Setores vazios viram cunha estreita em névoa. A ordem das cunhas segue a ordem dos setores (`Setor.ordem`).
- **R13:** Cidades ficam em coordenadas polares dentro da cunha; distância padrão ao centro é menor para quem vende mais (proximidade comercial). A posição arrastada pelo usuário sempre prevalece (`Projeto.posicao` / coordenadas persistidas no projeto).
- **R14:** Anti-colisão por relaxamento iterativo com separação mínima = `soma dos raios + 12 u`, 100% determinístico (mesma entrada -> mesmo mapa).
- **R15:** Fronteira entre setores em linha de tinta (`#1F1B16`); chão da cunha tingido com a cor do setor a `12%` de opacidade.

### 5. Metrópole Central e Lojas do Mercado (Seção 4.3)
- **R16:** Estrutura da Metrópole Central (`CentralHub`): praça central com monumento, anel de ruas, muralha baixa e um portão por setor voltado para a direção da cunha (bissetriz da cunha), ligando à avenida do setor. Dividida nas mesmas cunhas dos setores (bairros com cor e ícone do setor).
- **R17:** Cada `Produto` ativo gera uma loja no bairro do seu setor, em arcos concêntricos a partir da praça (maior receita mensal mais perto da praça, espaçamento uniforme, sem sobreposição). Receita de projeto sem produto associado gera uma banca genérica com selo *"associe um produto"* e atalho no painel.
- **R18:** `Produto.tipoLoja` escolhe o modelo no registro extensível (`shopRegistry`): `padaria`, `acougue`, `taverna` (bebidas), `armazem_graos` (agricultura), `ferraria` (automação e robótica), `laboratorio_alquimista` (química), `casa_escribas` (software), `balanca_cambio` (comércio); tipo desconhecido usa banca genérica com o ícone do produto.
- **R19:** Tamanho da loja por percentil da receita do produto entre todos: `P` até `50%`, `M` até `85%`, `G` acima de `85%`.
- **R20:** Ciclo de vida da loja: nasce em `2 s` (`abrindo` com andaime -> `aberta`); sem receita há `60 dias` -> `fechada` (persianas, cor desbotada, sem NPCs); sem receita há `180 dias` -> some (ou `sumindo` quando produto é arquivado).
- **R21:** Placa com o ícone do produto sobre a porta, sempre legível; nome aparece no hover ou com zoom próximo.
- **R22:** Nível da Metrópole Central (`0` a `4`) sobe com receita total e número de lojas (mais anéis de ruas, edifícios mais altos, portões mais ornamentados; limiares em `src/config/layout.ts`).

### 6. Estradas (Seção 4.4)
- **R23:** Cada cidade tem um ramal (`3 u`) até o portão/avenida do seu setor (`5 u`). Curvas suaves Catmull-Rom geradas de forma determinística, desviando para não atravessar outras cidades.
- **R24:** Cada `Ligacao` com fluxo cria uma trilha direta cidade a cidade (`2 u`).
- **R25:** Espessura e brilho seguem o volume de fluxo em escala logarítmica; estrada sem fluxo fica apagada.

### 7. NPCs e Fluxo (Seção 4.5)
- **R26:** Três tipos de fluxo derivados dos dados:
  - `producao` (cidade -> metrópole/loja): volume = receita mensal dos produtos do projeto; carga = modelo do produto (sacos, barris, caixas, rolos de pergaminho).
  - `insumo` (metrópole -> cidade): volume = custos de insumos do projeto; carga = moedas ou insumos.
  - `ligacao` (cidade -> cidade): tipos "fornece insumo", "reaproveita código", "mesmo cliente" e "financia", com volume = força da ligação ou valor real vinculado.
- **R27:** Quantidade de NPCs por rota: `n = clamp(round(k * log2(1 + volume / volumeBase)), 0, nMax)` com `k = 2`, `volumeBase = R$ 500` (`50.000` centavos), `nMax = 12`, e no mínimo `1` se `volume > 0`. Teto global de `1.500` NPCs (redução proporcional sem cortar rota inteira).
- **R28:** Comportamento dos NPCs: andam sobre a polilinha pré-calculada a `6 u/s` (avançando parâmetro `t`, sem pathfinding por frame), entram na loja ou portão com fade curto, mantêm espaçamento mínimo, exibem bandeirola na cor do setor de origem e carga do produto, com aleatoriedade determinística por `hash(rotaId, semana)`.
- **R29:** Densidade por distância da câmera: câmera distante exibe partículas fluindo na estrada; câmera próxima exibe modelos instanciados completos (com balanço de caminhada).

### 8. Interação, Lentes e Filtros (Seção 4.6)
- **R30:** Clique na loja abre o projeto na aba **Finanças** com o produto destacado. Clique na cidade leva a câmera até ela e abre o painel. Hover numa estrada realça os dois extremos e mostra volume mensal e produtos.
- **R31:** Lentes:
  - `Padrão`: fluxo discreto.
  - `Finanças`: espessura de estrada e tamanho de loja por receita.
  - `Rede`: só trilhas cidade a cidade.
  - `Clientes`: estradas coloridas pelo cliente dominante.
- **R32:** Filtros por setor e por produto; um produto isolado mostra sua loja, rota e cidade, atenuando o resto.
- **R33:** Arrastar uma cidade não move as outras e recalcula só as estradas dela, com transição de `400 ms`.
- **R34:** Saúde, moral, fase e alertas das cidades continuam funcionando (cor, bandeiras, fumaça, névoa).

### 9. Dados, Migração e Motor `src/engine/trade/` (Seção 5)
- **R35:** Adicionar entidade `Produto` (`id, projetoId, nome, categoria, tipoLoja, icone, ativo, arquivadoEm`) e vínculo opcional `produtoId?: string | null` em `Lancamento` (e `posicao?: { x: number; z: number } | null` em `Projeto` sincronizado com `x, z`).
- **R36:** Subir versão do esquema (`versaoEsquema = 2`) com migração automática: cria um `Produto` padrão por projeto com receita (usando o nome do projeto) e vincula nos lançamentos quando aplicável; projetos sem `produtoId` em receita exibem banca genérica com selo *"associe um produto"*.
- **R37:** Implementar e testar funções puras em `src/engine/trade/`:
  - `layoutWorld(state, config)`
  - `deriveShops(state, config): Loja[]`
  - `deriveFlows(state, config): Fluxo[]`
  - `routeRoads(layout, flows)`
- **R38:** Formulário de gestão de Produtos no painel do projeto (aba Finanças) permitindo criar, editar, escolher `tipoLoja`/`icone`, arquivar produtos e vincular `produtoId` aos lançamentos.

### 10. Desempenho, Plano de Execução e Entregáveis (Seções 6, 7, 8, 9 e 10)
- **R39:** `InstancedMesh` para NPCs, cargas, lojas e construções da metrópole; seletor de qualidade (`baixa`, `media`, `alta`) limitando NPCs a `400`, `900` e `1.500` e ajustando sombras; recálculo incremental quando apenas 1 projeto é movido/alterado.
- **R40:** Criar `docs/map-plan.md` detalhando o que muda e o que é reaproveitado.
- **R41:** Criar `docs/decisions.md` registrando decisões técnicas tomadas diante de qualquer detalhe de implementação.
- **R42:** Criar `src/seed/demo.json` (e suporte em `seedDemo`) com `9 setores`, `40 projetos`, `70 produtos` e `60 ligações`, incluindo explicitamente o projeto de exemplo **"Padaria do Zé"** (setor **Produção alimentícia**, produto **Pão**, `tipoLoja: 'padaria'`, receita > 0).
- **R43:** Cumprir Critério de Aceite 1: Projeto "Padaria do Zé" (setor Produção alimentícia, produto Pão, receita > 0) exibe uma padaria no bairro do setor e NPCs com sacos de pão andando da cidade até ela.
- **R44:** Cumprir Critério de Aceite 2: Sem lançamentos de receita e com data simulada avançada `60 dias`, a loja fecha (`fechada`); com `180 dias`, some.
- **R45:** Cumprir Critério de Aceite 3: O mesmo estado de dados gera o mesmo layout em duas aberturas (teste de snapshot/determinismo).
- **R46:** Cumprir Critério de Aceite 4: Arrastar uma cidade não move as outras e recalcula só as estradas dela.
- **R47:** Cumprir Critério de Aceite 5: Média de `60 fps` no cenário de demonstração, com número medido no relatório.
- **R48:** Cumprir Critérios de Aceite 6, 7, 8 e 9: `src/engine` sem importar Three.js/React/Dexie; toda medida vinda de `src/config/layout.ts`; typecheck e testes passando; relatório final com capturas de tela em três níveis de zoom (próximo, médio e distante).
