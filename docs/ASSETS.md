# Registro de Assets e Licenças — A Longa Marcha

> **Regra de Originalidade (Seção 4 e Prompt Mestre — Regra 8):**
> Nenhum modelo, ícone, textura, fonte ou som da Creative Assembly entra no projeto. Todo asset ou biblioteca gráfica externa deve ter licença aberta (CC0, MIT ou OFL) registrada neste documento no ato de sua inclusão.

---

## 1. Motor e Biblioteca de Terreno 3D

| Item | Origem / Repositório | Versão | Licença | Uso no Projeto |
| :--- | :--- | :---: | :---: | :--- |
| `procedural-terrains` (`ProceduralTerrains`) | `https://github.com/ZyFou/ProceduralTerrains` | `2.0.5` | **MIT** | Geração procedural de terreno 3D (`createTerrain`, `FiniteTerrain`, amostragem de altura e shaders de relevo karst/vales) em `src/map/MapView.ts`. |

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

## 2. Tipografia e Ícones (Fase 0)

- Na Fase 0 são utilizadas pilhas tipográficas locais do sistema com reserva para empacotamento local das fontes `Noto Serif SC` (SIL Open Font License 1.1) e `Inter` (SIL Open Font License 1.1) na Fase 3 (Seção 4.1 e Prompt Mestre C.3 — Fase 3), garantindo zero requisições a CDNs externos.
- **Verificação Creative Assembly:** `0` arquivos proprietários ou derivados de jogos comerciais.
