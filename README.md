# A Longa Marcha

Painel estratégico de gestão de múltiplos projetos em formato de mapa de campanha 3D inspirado na estética de *Total War: Three Kingdoms* (tinta, jade, laca e pergaminho). Cada setor é um território e cada projeto é uma cidade.

## Pré-requisitos
- Node.js 20+ e npm

## Como rodar do zero

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (abre em http://localhost:5173)
npm run dev
```

## Scripts disponíveis

- `npm run dev` — Inicia o servidor Vite em `http://localhost:5173`.
- `npm run build` — Executa checagem de tipos (`tsc --noEmit`) e gera o pacote de produção em `dist/`.
- `npm test` — Executa a suíte Vitest (testes unitários e verificação automatizada de quebra de camadas).
- `npm run test:e2e` — Executa os testes ponta a ponta no navegador Chromium via Playwright.
- `npm run tsc` — Valida tipos com TypeScript estrito.
- `npm run lint` — Executa o ESLint em `src/` e `tests/`.
- `npm run lint:camadas` — Verifica as regras arquiteturais de importação entre camadas via `dependency-cruiser`.
- `npm run perf` — Executa a suíte de desempenho no Playwright.
