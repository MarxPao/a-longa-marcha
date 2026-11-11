# Requisitos — Motor Gráfico do Mapa (Fase 2b): Zoom Contínuo, Coerência e Acabamento Visual

## 1. Princípios de Coerência (Seção 2)
- **R1**: Único caminho de renderização: não existe modo demo no mapa; dados de exemplo (`seed/demo.json`) entram pelo repositório (via importação/configurações) e passam pelo mesmo pipeline dos dados reais (`layoutWorld`, `deriveShops`, `deriveFlows`, `routeRoads`). Sem dados, a metrópole aparece vazia (praça, portões, sem lojas) com a dica de onboarding "adicione um produto".
- **R2**: Única fonte de verdade: o mapa só desenha estado derivado; nenhuma loja, NPC ou estrada é criado fora de `deriveShops`, `deriveFlows` e `routeRoads`.
- **R3**: Coerência de escala: todas as medidas vêm de `src/config/layout.ts`; densidade de texel constante (64 px por unidade de mundo); modo de depuração mostra NPC, porta e edifício lado a lado para auditar proporções.
- **R4**: Coerência de estilo: um só conjunto de materiais, uma só paleta e um só rig de luz em todos os níveis de zoom (o que muda com o zoom é o detalhe, nunca o estilo).
- **R5**: Sem popping: troca de nível de detalhe (LOD) com dithering e histerese (10%); nenhum objeto surge ou some de forma abrupta.

## 2. Câmera e Zoom Contínuo (Seção 3)
- **R6**: Zoom contínuo em escala logarítmica com `distFit` calculada dinamicamente a partir dos limites do mundo e da proporção da tela (nunca fixa), e limiares de `d / distFit` em `src/config/layout.ts`:
  - **Império** (`d / distFit >= 0.45`, inclinação ~70°): cunhas e cores de setor, cidades como marcadores (ícone e nível), metrópole como silhueta dourada, estradas como fitas luminosas por volume, NPCs como partículas, rótulos só de setores e dos N projetos mais relevantes.
  - **Setor** (`0.15 <= d / distFit < 0.45`, inclinação 55° a 70°): cidades em LOD1 com bandeiras, rótulos de projetos sem sobreposição, NPCs em impostores, metrópole em LOD1.
  - **Cidade e bairro** (`0.04 <= d / distFit < 0.15`, inclinação 38° a 55°): modelos em LOD0, props principais, lojas com placa, NPCs com modelo simples, sombras e oclusão ambiente completas.
  - **Rua** (`d / distFit < 0.04`, cerca de 70 u, inclinação ~32°): tudo em LOD0, props de detalhe (lanternas, barris, toldos), NPCs animados, poeira, foco suave forte, nome da loja no hover.
- **R7**: Inclinação segue curva suave (`smoothstep` sobre o logaritmo da distância) e FOV é constante (30° a 35°, lente longa).
- **R8**: Zoom ao cursor: roda e pinça aproximam em direção ao ponto sob o ponteiro (tolerância de 2 px), fator por passo entre 1,12 e 1,18, suavização exponencial (~120 ms), `deltaY` normalizado entre mouse e trackpad, distância mínima ~24 u e máxima `1,2 * distFit`.
- **R9**: Pan ("agarra o chão" com botão esquerdo e inércia curta) e Rotação (botão direito ou do meio gira ângulo horizontal; inclinação limitada pelo nível; alvo dentro dos limites do mundo).
- **R10**: Teclado: `WASD` e setas movem; `Q` e `E` giram; `+` e `-` dão zoom; `Home` enquadra tudo; `F` foca a seleção; `Esc` volta ao enquadramento anterior (pilha de estados de câmera).
- **R11**: Voar até: duplo clique em cidade, loja ou rota, e botão "Ir à metrópole" (marcador de câmera); duração `clamp(0.6 + 0.35 * log2(1 + dist / d_rua), 0.6, 2.2)` s, interpolando alvo e log-distância com leve arco (até 40% no meio em saltos longos) e ease-in-out; instantâneo com `prefers-reduced-motion`.
- **R12**: HUD de escala: indicador do nível atual (`Império`, `Setor`, `Cidade e bairro`, `Rua`), barra de escala em unidades `u` e trilha breadcrumb (`Império > Setor ... > Cidade ... > Loja ...`); minimapa mostra o trapézio visível e aceita clique para saltar.

## 3. Arquitetura do Motor Gráfico (Seção 4)
- **R13**: 5 camadas de cena: (1) Chão em blocos de 128 u com splat por vértice e detalhe triplanar; (2) Estradas em fita (ribbon) agrupadas por bloco com textura de pavimento; (3) Estáticos instanciados (`InstancedMesh` por modelo/variante/bloco); (4) Dinâmicos (NPCs, carroças, partículas); (5) Sobreposições (rótulos HTML projetados, máx 80 com prioridade por receita/saúde e anti-colisão; contorno de seleção).
- **R14**: Blocos de 128 u com culling por frustum e distância por bloco, reuso de pools de instâncias.
- **R15**: LOD em 3 níveis por modelo (`LOD0` completo, `LOD1` simplificado, `LOD2` impostor), escolhidos por tamanho em tela / razão de distância com histerese de 10% e transição por dithering (alpha hash ~250 ms).
- **R16**: Seleção (picking) por buffer de IDs ou grade espacial O(1) para milhares de instâncias, e estradas por distância analítica à polilinha.
- **R17**: Sombras ajustadas ao frustum visível com ancoragem de texels (sem tremor / shadow swimming) e cascatas (3 cascatas / CSM) na qualidade Alta.
- **R18**: Loop com simulação de NPCs a 30 Hz e interpolação no render, pausa com aba oculta (`document.hidden`), e resolução dinâmica (DPR entre 0,75 e o teto da qualidade) conforme tempo de quadro.
- **R19**: Gestão de memória e cor: texturas procedurais/KTX2 com mipmaps e anisotropia 8, teto de 512 MB VRAM, sem alocação por quadro no render loop, `dispose` completo, `SRGBColorSpace` e `ACESFilmicToneMapping`.
- **R20**: Seletor de qualidade (`Baixa`, `Média`, `Alta`) com detecção automática e ajuste adaptativo obedecendo à tabela da Seção 4.3 (NPCs 400/900/1500, sombra 1024/2048/CSM-4096, GTAO desligada/meia/cheia, bloom+tilt-shift desligados/ligados/ligados, teto DPR 1.0/1.25/1.5, árvores 30%/60%/100%) e orçamento na Alta (<= 400 draw calls e <= 2M triângulos).
- **R21**: Ferramentas de depuração (`?debug=1` ou toggle): painel de estatísticas (CPU, GPU via `EXT_disjoint_timer_query_webgl2` quando disponível, draw calls, triângulos, texturas, instâncias) e sobreposições de depuração (cor por nível de LOD, grade de blocos 128 u, auditoria de escala NPC/porta/edifício, cascatas de sombra).

## 4. Direção de Arte e Pipeline Visual (Seção 5)
- **R22**: Luz e atmosfera (Seção 5.1): luz direcional baixa (25° a 35°), `HemisphereLight` fria, névoa exponencial com altura na cor do céu, skydome com gradiente e nuvens; parâmetro de hora do dia com 3 presets (`dia_mercado` padrão, `entardecer`, `noite_lanternas`) comandando sol, cores, névoa, lanternas e janelas emissivas.
- **R23**: Pós-processamento em cadeia única (Seção 5.2): oclusão ambiente (GTAO/SSAO), bloom seletivo (só emissivos), tilt-shift, correção de cor quente, vinheta leve e antisserrilhado.
- **R24**: Materiais, chão e estradas (Seção 5.3): texturas PBR com variação HSL por instância e desgaste por vértice, shaders `onBeforeCompile` (dithering LOD, vento, janelas emissivas); chão plano com microvariação de normal, splat terra/grama/tinta de setor (12%) e fronteiras em decalque suave de tinta (sem linhas retas finas); estradas em fita pavimentada com bordas e praças nos cruzamentos; plataforma da metrópole elevada ~1 u com borda de pedra.
- **R25**: Arquitetura modular (Seção 5.4): kit de peças (base, parede, beiral curvo, telhado empilhado, coluna, janela) montado por semente, `tipoLoja` e nível da cidade, mínimo de 4 variações por tipo, silhueta distinta por `tipoLoja` (padaria, taverna, ferraria, alquimista, escribas, balança, armazém, açougue), muralha da metrópole com ameias e telha, portões e salão central com silhueta própria.
- **R26**: Props, vida e partículas (Seção 5.5): toldos de pano por tipo de loja, barris, caixas, cordões de lanternas (emissivo + bloom, máx 8 luzes reais realocadas para as mais próximas da câmera), estandartes, 3–4 espécies de árvores instanciadas com vento no vertex shader, arbustos, cercas; NPCs low-poly com 2–3 variações de cor e caminhada, carroças; partículas de fumaça de chaminé, poeira nas ruas e folhas.

## 5. Plano de Execução e Paradas Obrigatórias (Seções 6, 7, 8 e 9)
- **R27**: Executar na ordem **G0 → G1 → G2 → G3**, capturando as 5 vistas (`imperio`, `setor`, `cidade`, `rua`, `metropole-perto`) antes e depois em `docs/visual/<etapa>/`, relatando FPS e tempo de quadro, e **PARAR após G3** para revisão humana antes de prosseguir para G4–G7.
