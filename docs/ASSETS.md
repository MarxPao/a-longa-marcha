# Registro de Assets e Licenças — A Longa Marcha

> **Regra de Originalidade (Seção 4 e Prompt Mestre — Regra 8):**
> Nenhum modelo, ícone, textura, fonte ou som da Creative Assembly entra no projeto. Todo asset ou biblioteca gráfica externa deve ter licença aberta (CC0, MIT ou OFL) registrada neste documento no ato de sua inclusão.

---

## 1. Motor e Biblioteca de Terreno 3D

| Item | Origem / Repositório | Versão | Licença | Uso no Projeto |
| :--- | :--- | :---: | :---: | :--- |
| `procedural-terrains` (`ProceduralTerrains`) | `https://github.com/ZyFou/ProceduralTerrains` | `2.0.5` | **MIT** | Geração procedural de terreno 3D (`createTerrain`, `FiniteTerrain`, amostragem de altura e shaders de relevo karst/vales) em `src/map/MapView.ts`. |
| `three` (`Three.js`) | `https://github.com/mrdoob/three.js` | `^0.181.0` | **MIT** | Renderização WebGL, `InstancedMesh`, `LineSegments`, `TubeGeometry`, iluminação e pós-processamento atmosférico. |

### Aviso de Copyright Obrigatório (`ProceduralTerrains` — MIT License)

```text
MIT License

Copyright (c) 2026 ZyFou

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense,
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. Modelos 3D Procedurais Originais (Zero Assets Externos Proprietários)

| Conjunto 3D | Arquivo no Repositório | Autor / Origem | Licença | Descrição |
| :--- | :--- | :--- | :---: | :--- |
| **Cidades por Maturidade (Níveis 1 a 7 + Ruínas)** | `src/map/cidadesGeometria.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Geometrias procedurais mescladas (`mergeGeometries`): Faísca (tendas/fogueira), Expedição (paliçada/torre), Assentamento, Vila (pagode), Cidade (muralha/portão), Metrópole, Legado e Ruínas. |
| **Florestas Instanciadas com LOD (Pinheiros Imperiais)** | `src/map/vegetacaoLod.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Malhas procedurais de pinheiros em 2 níveis de detalhe (`lod0_alta` e `lod1_media`) com descarte por distância (`lod2_oculto`). |
| **Rios Sinuosos, Névoa de Guerra e Partículas de Crescimento** | `src/map/atmosferaTerreno.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Leitos de rios em `TubeGeometry`, discos de tinta aguada para névoa de guerra, anéis de névoa de moral baixa e partículas douradas em `THREE.Points`. |
| **Formas Redundantes de Saúde e Halos P&D** | `src/map/cidadesInstanciadas.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Bandeira erguida (saudável), bandeira inclinada (atenção), coluna de fumaça (crítico) e halo azul celeste de P&D. |

---

## 3. Tipografia, Ícones SVG e Áudio

| Item | Arquivo / Fonte | Licença | Observações |
| :--- | :--- | :---: | :--- |
| **Ícones SVG dos 9 Setores e Formas de Saúde** | `src/ui/IconesSetoresSvg.tsx` | **MIT / Uso Privado** | Vetores SVG originais desenhados em código para Agricultura, Alimentícia, Bebidas, Química, Automação, Robótica, Software Educacional, Software Profissional, Comércio e redundância de saúde. |
| **Gráficos Financeiros e Fios Dourados da Árvore** | `src/ui/painel/GraficoFinancasSvg.tsx`, `src/ui/TelaArvoreTecnologica.tsx` | **MIT / Uso Privado** | Renderização vetorial nativa em SVG puro sem bibliotecas fechadas. |
| **Tipografia (`Noto Serif SC` & `Inter`)** | `src/ui/styles.css` | **SIL Open Font License 1.1 (OFL)** | Pilha tipográfica local com `font-variant-numeric: tabular-nums` para tabelas e valores financeiros. |
| **Ganchos de Som (`v1`)** | `src/ui/ganchosSom.ts` | **MIT / Uso Privado** | Ganchos silenciosos prontos no código conforme Seção 9.1 (nenhum arquivo de áudio de terceiros). |

---

## 4. Fase 2b — Shaders Procedurais, Materiais PBR e Props Modulares

| Componente | Arquivo no Repositório | Autor / Origem | Licença | Descrição |
| :--- | :--- | :--- | :---: | :--- |
| **Texturas Procedurais (Ruído, Normais e Pavimento)** | `src/map/materiaisAvancados.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Geração procedimental em `HTMLCanvasElement` 2D (ruído Perlin simulado, cálculo de normais por gradiente Sobel, calçamento em blocos hexagonais/retangulares de pedra para ruas da metrópole e estradas). |
| **Shaders PBR Customizados com Injeção de Vento e Emissão** | `src/map/materiaisAvancados.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Customização de `MeshStandardMaterial.onBeforeCompile` com animação senoidal de vento em vértices superiores e mapa de iluminação noturna pontual para janelas de lojas. |
| **Kit Modular de Edifícios e Lojas** | `src/map/arquiteturaModular.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Geometrias procedurais paramétricas montadas em Three.js nativo (base de pedra, paredes rebocadas, portas em escala humana de 2,4 u, beirais curvos com perfil dinástico e telhados de 4 águas ou duplos). |
| **Props de Mercado Instanciados e Poeira** | `src/map/propsEParticulas.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Barris de ripas, caixas de madeira, fardos de carga e toldos listrados instanciados (`InstancedMesh`) com variação determinística por hash; sistema de partículas de poeira e fuligem em `THREE.Points`. |
| **Dithering LOD (Alpha-Hash) e Culling Espacial** | `src/map/infraRenderer.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Injeção de shader chunk `SHADER_CHUNK_DITHER_LOD` para transição estocástica sem popping visual entre LODs; particionamento em grade de blocos de 128 u (`GradeBlocosEspaciais128`). |
| **Rig de Luz Rasante, Skydome e Anti-Swimming** | `src/map/luzAtmosferaPos.ts` | Autoria original (`A Longa Marcha`) | **MIT / Uso Privado** | Sol direcional rasante (25°–35°), skydome hemisférico com gradiente zenital/horizonte, 3 presets de hora do dia (`dia_mercado`, `entardecer`, `noite_lanternas`) e texel snapping anti-swimming em matriz de projeção ortográfica. |

---

## 5. Auditoria de Conformidade e Licenciamento

- **Zero Dependências Proprietárias:** Nenhum arquivo binário, textura, modelo, malha, áudio ou fonte pertencente à Creative Assembly, SEGA ou outros jogos comerciais foi introduzido.
- **Tamanho Adicional de Bundles de Terceiros:** `0 kB` — todas as geometrias, texturas e efeitos atmosféricos utilizam APIs puras do Three.js e Canvas 2D nativas.

- **Verificação Final Creative Assembly:** `0` arquivos proprietários, texturas, ícones, fontes ou modelos extraídos de jogos comerciais.
