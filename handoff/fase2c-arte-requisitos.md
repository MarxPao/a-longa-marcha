# Requisitos — Fase 2c: Identidade Visual de Cidades, Prédios, Ruas e Pessoas

## Escopo e Diretrizes
Fase 2c trata exclusivamente da aparência visual e arquitetural de cidades, edifícios, ruas e pessoas. A câmera e o zoom continuam na Fase 2b. Não alterar `src/engine`, layout lógico, posições, rotas ou lojas.

---

## 1. Passo Zero (H0, Bloqueante): Fim do Preto e Pesquisa

| ID | Requisito | Status | Verificação |
| :--- | :--- | :---: | :--- |
| **R1** | Criar rota/modo `?debug=materials` exibindo edifícios em 4 variantes lado a lado (material final, albedo puro MeshBasicMaterial, MeshNormalMaterial, contorno) sobre chão cinza médio e iluminação real do mapa | FEITO | VisualizadorDebugMateriais e DebugMateriaisView |
| **R2** | Diagnosticar por bisseção a causa exata de renderização preta em cidades, muralhas, bandeiras e árvores | FEITO | Diagnosticado: vertexColors sem atributo 'color' zerava albedo fragment |
| **R3.1** | Lookup de cor em `src/config/layout.ts` falha alto (`throw new Error`) em desenvolvimento se chave for indefinida | FEITO | Proxy estrito em PALETA_MAPA e obterCorPaleta com fail-fast |
| **R3.2** | `vertexColors: true` apenas quando a geometria possui atributo `color` (ou preenche com branco `[1, 1, 1]`) | FEITO | garantirAtributoCorGeometria e colorirGeometriaModular |
| **R3.3** | `metalness: 0` e `roughness` entre 0.8 e 1.0 em tudo (exceto metais pontuais com envMap) | FEITO | obterMaterialEdificiosCampanha com metalness: 0.0 e roughness: 0.85 |
| **R3.4** | Escala estritamente positiva em todas as instâncias; `computeVertexNormals()` em geometrias mescladas | FEITO | mesclarComCores e geometrias de cidades auditadas |
| **R3.5** | Conversão de cor única: `ColorManagement` ativo, cores sRGB na entrada e `outputColorSpace = THREE.SRGBColorSpace` | FEITO | THREE.SRGBColorSpace canônico no MapView e DebugMateriais |
| **R3.6** | Luz de preenchimento (`HemisphereLight`) garantindo luminância mínima de 15% em qualquer face; ajuste de `shadow.bias` e `normalBias` para eliminar acne de sombra | FEITO | HemisphereLight (1.1), bias=-0.0002, normalBias=0.04 |
| **R4** | Unificar pipeline de edifícios: Mercado e Cidades utilizam o mesmo módulo de edifícios e de materiais em `src/map` (apagar duplicados) | FEITO | obterMaterialEdificiosCampanha unificado para cidades e mercado |
| **R5** | Teste Playwright em `?debug=materials` (sem sombras): falha se luminância média < 0.25 ou se > 2% dos pixels ficarem < 0.05 | FEITO | 2/2 testes aprovados em tests/e2e/debug-materials-luminancia.spec.ts |
| **R6** | Teste unitário garantindo que todas as chaves de paleta usadas no código existem em `src/config/layout.ts` | FEITO | 4/4 testes aprovados em tests/unit/paleta-chaves.test.ts |
| **R7** | Registrar causas reais em `docs/decisions.md` | FEITO | Seção 7 em docs/decisions.md |
| **R8** | Entregar `docs/research/art.md` com análise e status das bibliotecas e fontes CC0 da Seção 8 | FEITO | docs/research/art.md completo |
| **R9** | PARADA PARA REVISÃO H0: Salvar capturas em `docs/visual/h0/`, pausar e reportar evidências ao usuário | FEITO | docs/visual/h0/debug-materials-h0.png e cidade-h0.png gerados |

---

## 2. Etapas Seguintes (H1 a H6)

| ID | Requisito | Status |
| :--- | :--- | :---: |
| **R10** | **H1 — Materiais e Luz**: Folha de texturas trim sheet, albedo mínimo `#2A2420`, variação por instância, luz de preenchimento e sombra de contato | FEITO |
| **R11** | **H2 — Fatia Vertical**: Kit de arquitetura com 3 tipos de edifícios para Agricultura e Comércio (6 variantes cada, 36 modelos), muralhas e portões (PARADA PARA REVISÃO) | FEITO |
| **R12** | **H3 — Cidades e Metrópole**: 7 setores restantes, níveis de maturidade 1 a 7 e metrópole com sinais de vida (fumaça, janelas, estandartes com vertex shader) | PENDENTE |
| **R13** | **H4 — Ruas e Estradas**: Grafo com nós, A*, junções com praças, 3 classes de largura, sem cruzamentos secos, assentamento no terreno (PARADA PARA REVISÃO) | PENDENTE |
| **R14** | **H5 — Pessoas, Carroças e Partículas**: Arquétipos low-poly, animação por instâncias, escala 1.7u, vendedores, `?debug=scale` | PENDENTE |
| **R15** | **H6 — Polimento**: Regressão visual, teste cego dos 9 setores, métricas de FPS e relatório final | PENDENTE |
