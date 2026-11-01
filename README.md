# A Longa Marcha — v1.0.0

Painel estratégico de gestão de múltiplos projetos em formato de mapa de campanha 3D inspirado na estética de *Total War: Three Kingdoms* (tinta, jade, laca, bronze e pergaminho). Cada setor é um território no relevo de karst e cada projeto é uma cidade cuja maturidade, saúde e moral refletem fatos reais lançados na rotina diária.

---

## Pré-requisitos
- **Node.js 20+** e **npm**
- Navegador moderno com suporte a WebGL2 e IndexedDB (Chrome ou Edge recomendados).

## Como abrir e rodar do zero

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor local (abre em http://127.0.0.1:5173)
npm run dev
```

Para gerar e servir a versão otimizada de produção:

```bash
npm run build
npm run preview
```

---

## Guia Curto de Uso (Rotina Diária e Semanal)

1. **Primeira Abertura (Brief de Campanha — Seção 6.1)**:
   - Escolha começar com os padrões (ou carregar a campanha de demonstração), importar um arquivo `.json` existente ou iniciar vazio.
   - Configure suas horas semanais disponíveis (padrão: `40h`), setores, limiar de receita mensal da Metrópole e semente do terreno 3D.
2. **Fundar, Mover e Ligar Cidades (Seção 6.2)**:
   - **Fundar**: dê **duplo clique** num ponto do território no mapa 3D (ou use o botão `+ Cidade` na barra superior).
   - **Mover**: clique e arraste uma cidade pelo terreno para reposicioná-la.
   - **Ligar**: segure **Shift** e arraste de uma cidade até outra para criar uma rota estratégica (financiamento cruzado, dependência ou insumo).
3. **Captura Rápida Diária (Seção 6.3)**:
   - Pressione **`H`** para registrar horas trabalhadas, **`T`** para nova tarefa, **`L`** para lançamento financeiro (`receita` ou `custo`) e **`E`** para registrar evento manual.
   - Todos os valores derivados (Saúde, Moral, Fase de Maturidade, Fluxo e Runway) recalculam incrementalmente na hora. **`Ctrl+Z`** desfaz até 20 comandos.
4. **Painel da Cidade (6 Abas — Seção 6.5)**:
   - Clique em qualquer cidade para inspecionar **Visão Geral** (com a lista transparente de todos os descontos que compõem a pontuação de Saúde), **Tarefas** (Lista ou Kanban virtualizado), **Clientes**, **Finanças** (gráfico SVG de 12 meses + ROI/h), **Estoque** (BOM + compra sugerida) e **P&D**.
5. **Fechamento de Turno Semanal e Backup (Seções 5.5 e 6.4)**:
   - Ao fim da semana, clique em **📜 Fechar Turno** para ver a prévia (*dry-run*) sem gravar nada.
   - Ao confirmar, o motor executa as 6 etapas idempotentes (recorrências, derivados, 7 detectores de inteligência, conquistas, instantâneo e avanço da semana).
   - **Backup Obrigatório**: os dados vivem no IndexedDB do navegador. Exporte o `.json` ao fim de cada turno ou use **📁 Salvar em Pasta Escolhida** (File System Access API).

---

## Atalhos de Teclado (Seção 6.7)

| Tecla | Ação |
| :---: | :--- |
| **`/`** ou **`Ctrl+K`** | Busca Global (encontra projeto, tarefa, cliente, item ou tecnologia e voa com a câmera até a cidade) |
| **`1` a `8`** | Alterna as 8 Lentes do Mapa (`1` Padrão, `2` Finanças, `3` Tempo, `4` Rede, `5` Risco, `6` Clientes, `7` Estoque, `8` P&D) |
| **`H`, `T`, `L`, `E`** | Captura Rápida: Horas (`H`), Tarefa (`T`), Lançamento (`L`), Evento (`E`) |
| **`F`** | Centraliza a câmera na cidade selecionada |
| **`G`** | Abre a Árvore Tecnológica e Sabedoria do Império (P&D) |
| **`Esc`** | Fecha o painel lateral, modal ativo ou barra de comando |
| **`Ctrl+Z`** | Desfaz o último comando |

---

## Scripts de Verificação e Qualidade

- `npm test` — Executa a suíte unitária completa no Vitest (motor, domínio Zod, repositório, árvore, detectores, turno e pacotes).
- `npm run test:e2e` — Executa a suíte ponta a ponta no Playwright (fases 0 a 10).
- `npm run perf` — Executa a bateria automatizada de desempenho no perfil carga (`500 cidades` e `5.000 tarefas`).
- `npm run lint` — Executa o ESLint estrito em `src/` e `tests/`.
- `npm run lint:camadas` — Verifica as fronteiras arquiteturais (`domain`, `engine`, `repository`, `store`, `map`, `ui`) via `dependency-cruiser`.
