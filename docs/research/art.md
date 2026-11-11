# Pesquisa Técnica de Ativos e Bibliotecas de Arte (Fase 2c — Seção 8)

**Documento:** `docs/research/art.md`  
**Escopo:** Avaliação de kits de modelos CC0, texturas PBR, geradores procedurais, técnicas de renderização de multidões e arquitetura visual para o mapa de campanha estilo *Total War: Three Kingdoms* (Han/Wuxia) no navegador via Three.js.

---

## 1. Kits de Modelos CC0: Kenney & Quaternius

### 1.1 Kenney (CC0)
- **Kits Avaliados:** *Medieval Kit*, *Fantasy Town Kit*, *City Kit (Commercial)*.
- **Modelos Utilizáveis:**
  - Telhados de telha, suportes de madeira, ameias de muralha de pedra, mastros, caixas, barris e carretas de carga.
  - Formato original: GLTF/GLB e FBX.
- **Escala e Proporção:**
  - Kenney adota grid métrico modular de 1m a 2m. No nosso sistema de unidades de mundo (`u` em `src/config/layout.ts`), 1u $\approx$ 1 metro no nível rua.
  - Edifícios residenciais médios Kenney ocupam 4x4m a 6x6m, perfeitamente compatíveis com as medidas de `4u a 8u` estabelecidas na Seção 4.1.
- **Necessidade de Conversão / Adaptação Cultural:**
  - Os modelos Kenney são predominantemente de estilo medieval europeu ocidental (enxaimel, telhados de duas águas íngremes).
  - *Veredito de Uso:* Aproveitáveis para **props de chão** (barris, caixas de mercado, carroças de tração, estacas de paliçada). Não devem ser usados crus para templos, pagodes e portais centrais da dinastia Han sem mesclagem ou substituição por telhados abaulados com beirais curvos procedurais (`criarTelhadoChines` em `cidadesGeometria.ts`).

### 1.2 Quaternius (CC0)
- **Kits Avaliados:** *Ultimate Modular Characters*, *Medieval Village Kit*, *Ancient East Kit* (ou adaptações orientais).
- **Personagens & Animações:**
  - Modelos low-poly de camponeses, mercadores, soldados e guardas (300 a 800 triângulos por modelo).
  - Rig / Esqueleto padrão Humanoid (compatível com Mixamo / Godot / Unity / Three.js Skeleton).
  - Animações disponíveis: Idle, Walk, Run, Carry Heavy Box, Hammer/Work, Wave.
- **Escala:**
  - Altura padrão de 1.8m a 2.0m. Na nossa convenção de layout:
    - Altura lógica do NPC = $1.6u$;
    - Escala visual em câmera de campanha = `NPC_VISUAL_SCALE = 2.0` (altura desenhada $\approx 3.2u$) para permitir leitura nítida na faixa de zoom de Setor e Cidade sem virar ruído de 2 pixels.
- **Veredito de Uso:**
  - Fonte primária recomendada para a malha base dos NPCs (vendedores, mercadores e carregadores).

---

## 2. Texturas PBR e Trim Sheets: ambientCG & Poly Haven (CC0)

### 2.1 Categorias de Superfície
1. **Madeira de Construção (Pilar e Vigas):** Madeira escura encerada/envelhecida (`#56402E`).
2. **Reboco / Taipa (Paredes de Casas e Lojas):** Argila/calcário claro tradicional (`#D8CEBC`).
3. **Telhas Cerâmicas (Beirais e Coberturas):** Telha cerâmica cinza-azulada / chumbo (`#2F353B`) e esmaltada ocre/ouro para edifícios imperiais.
4. **Pedra Maciça (Muralhas, Portões, Pavimento de Rua):** Cantaria de granito cinza e blocos talhados (`#8A8275`).
5. **Solo / Chão do Mapa:** Solo batido, cascalho, campos cultivados de trigo dourado (`#D9C9A5`).

### 2.2 Resolução Recomendada e Gestão de Memória VRAM
- **Diretriz de Resolução: 512px vs. 1024px:**
  - **Atlas / Trim Sheet Unificado (Recomendado):** Uma única folha de texturas (Trim Sheet) de **1024x1024px** contendo as faixas horizontais de madeira, pedra, reboco e telhas compactadas. Com compressão WebP/Basis Universal, consome menos de 400 kB de download e 1.3 MB em VRAM.
  - **Mapas Individuais de Ruído e Detalhe:** Texturas tileable secundárias (ruído de rugosidade, micro-detalhe de terra) devem ser de **256x256px** ou **512x512px**, gerando impacto nulo na taxa de quadros (60 FPS garantidos mesmo em GPUs integradas).
  - Mapas de 2k ou 4k são estritamente vetados devido ao teto orçamentário do navegador móvel e tempo de inicialização.

---

## 3. Geração Procedural de Vegetação: ez-tree e Abordagens Leves

### 3.1 Análise de Bibliotecas
- **ez-tree (Procedural Tree Generator):**
  - Gera árvores ramificadas baseadas em regras de Lindenmayer (L-systems) ou cilindros hierárquicos.
  - *Problema:* Gera árvores com contagem poligonal alta (3.000 a 15.000 vértices por árvore), o que inviabiliza florestas densas de campanha com milhares de instâncias se executado em tempo real.
- **Abordagem Adotada (`vegetacaoLod.ts`):**
  - Geometrias proceduralmente geradas em inicialização única com `mergeGeometries`:
    - **LOD0 (Vista Próxima/Rua):** Pinheiro/plátano outonal com tronco facetado e 3 níveis de folhagem cônica/folhas esféricas (120 triângulos).
    - **LOD1 (Vista Média/Setor):** Cruzamento de quads billboard ou cone simplificado (24 triângulos).
    - **LOD2 (Vista Império):** Ponto instanciado / impostor.
  - Todas as instâncias são renderizadas via `THREE.InstancedMesh` com matrizes transformadas por chunks espaciais, eliminando draw calls individuais.

---

## 4. Técnicas de Multidões de NPCs em Three.js: VAT vs. Instancing Simples

### 4.1 Trade-off Arquitetural
Para simular de 100 a 500 NPCs se movimentando pelas estradas e pelo mercado simultaneamente:

| Técnica | Draw Calls | Custo CPU | Custo GPU / Shader | Complexidade de Pipeline |
| :--- | :---: | :---: | :---: | :---: |
| **SkinnedMesh Convencional** | Alto ($N$ malhas) | Muito alto ($N$ rigs avaliados por frame) | Médio | Baixa |
| **InstancedMesh com VAT (Vertex Animation Texture)** | **1** | Mínimo (apenas update de matriz de posição/rotação) | Baixo (leitura de posição na textura de vértices no vertex shader) | Média (exige assar animações em textura 2D) |
| **InstancedMesh com Animação Procedural em Shader** | **1** | Mínimo (deslocamento puramente matemático) | Muito Baixo (funções `sin`/`cos` de balanço de passada no vertex shader) | **Baixa e Leve** |

### 4.2 Decisão Técnica para o Projeto
- **Fase 2c / H5:**
  - Para a locomoção de mercadores, carroças e pedestres nas estradas de spline e na praça da metrópole, utilizamos **`THREE.InstancedMesh` com Animação Procedural no Vertex Shader** (ou oscilação calculada nos nós de avanço).
  - Cada NPC carrega uma matriz de transformação contendo posição, rotação para a direção da estrada e escala visual `NPC_VISUAL_SCALE = 2`.
  - O shader aplica balanço de caminhada (`wobble` de passo e inclinação de passada) em função do tempo global `uTempo` e da fase da instância, permitindo centenas de transeuntes a 60 FPS estáveis com zero overhead de esqueleto.

---

## 5. Repositórios de Referência Open-Source
- **freeciv-web:** Referência para gerenciamento de grade isométrica, fog of war determinístico e posicionamento de cidades em territórios contíguos.
- **Three.js Examples (webgl_instancing_dynamic, webgl_instancing_performance):** Demonstração oficial de atualização de buffers de instância com `setMatrixAt` e `instanceMatrix.needsUpdate = true`.
- **Tiny-Empire / WebGL Strategy Projects no GitHub:** Padrão arquitetural de segregação estrita entre o grafo lógico do jogo e a árvore de renderização do WebGL.

---

## 6. Bibliotecas Auxiliares: Colisão & Partículas

### 6.1 `three-mesh-bvh`
- Avaliada para raycasting de alta performance sobre relevo e malhas complexas.
- *Status:* Desnecessária para a fase atual. Como o mapa é predominantemente plano com estradas projetadas matematicamente e picking centrado em raio de cilindro/esfera de cidade, o raycaster nativo de caixas delimitadoras e planos polares é centenas de vezes mais leve e adiciona zero dependências extras.

### 6.2 `three.quarks` vs. Partículas Nativas por Shaders
- `three.quarks` é um framework completo de partículas com editor visual. No entanto, adicionaria peso ao bundle.
- *Status:* Conforme demonstrado em `propsEParticulas.ts`, implementamos o sistema de partículas atmosféricas (poeira dourada flutuante, folhas de outono e fumaça de chaminé) com `THREE.Points` e `ShaderMaterial` nativo em um único arquivo de menos de 10 kB, com custo de download e memória virtualmente nulo.
