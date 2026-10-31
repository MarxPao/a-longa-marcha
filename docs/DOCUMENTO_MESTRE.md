# A Longa Marcha — Documento Mestre
31 de out. de 2026 · @EL CHOCO LOCO · Versão 1.0 (completa: telas, testes, roteiro, decisões e prompts para o Antigravity)
*(Nota de nomenclatura: originalmente rascunhado como "Império de Projetos", renomeado oficialmente pelo autor para **A Longa Marcha** em 31/10/2026).*

## 1. Visão e princípios
**A Longa Marcha** é um painel de gestão em formato de mapa de campanha: cada setor é um território, cada projeto é uma cidade, e tudo que uma empresa, um P&D e uma to-do list exigem (tarefas, caixa, clientes, estoque, tecnologias) mora dentro da cidade. O objetivo é que o dono veja em 30 segundos onde está o fogo, o ouro e a oportunidade entre dezenas ou centenas de projetos.

Premissas confirmadas: uso individual, no computador, dados guardados no próprio navegador com exportação em JSON, e o Antigravity (modelo Gemini 4 Argon) como construtor.

### Princípios que não se negociam
1. **Dados reais primeiro.** Receita em R$, horas reais, datas reais. O jogo só calcula o que decorre deles; nenhum número é inventado pela mecânica.
2. **Estado derivado nunca é digitado.** Saúde, fase de maturidade, runway e moral são calculados a partir dos dados; o usuário edita a causa, não o resultado.
3. **Tudo é editável dentro do app.** Setores, estágios, tipos de ligação, categorias e até os pesos das fórmulas são registros do usuário, nunca listas fixas no código.
4. **O mapa é uma vista, não a fonte da verdade.** Os dados vivem em um store independente do 3D; o 3D só desenha e devolve eventos (clique, arrastar).
5. **Legível em 30 segundos.** Cor = saúde, tamanho da cidade = maturidade, ícone = alerta. Se precisar clicar para saber se algo vai mal, o desenho falhou.
6. **Escala desde o dia 1.** Meta de 500 projetos e 5.000 tarefas a 60 quadros por segundo em um computador comum.
7. **Inspirado, não copiado.** O visual segue a linguagem de Total War: Three Kingdoms (tinta, jade, laca, pagodas), mas todos os assets, ícones, fontes e modelos são originais ou de licença aberta. Nada da Creative Assembly entra no repositório.

Fora de escopo da v1: multiusuário, login, sincronização entre aparelhos, aplicativo de celular e integrações bancárias. A arquitetura deixa a porta aberta (seção 5), mas nada disso é construído agora.

## 2. Modelo de dados
São 17 entidades principais. Todas têm `id` (UUID), `criadoEm`, `atualizadoEm` e `arquivadoEm` (nulo enquanto ativa; nada é apagado de verdade). O banco carrega um número de versão do esquema para permitir migrações. O esquema técnico completo, com as tabelas auxiliares, está no Anexo A.

| Entidade | Campos principais | Relações |
| :--- | :--- | :--- |
| **Setor** | nome, cor, ícone, bioma, região (polígono no mapa), ordem | tem muitos Projetos |
| **Projeto** | nome, descrição, posição no mapa (x, z), estágio declarado, horas-alvo por semana, autonomia (direto, esparso, autônomo), notas | pertence a 1 Setor; tem Frentes, Tarefas, Lançamentos, Clientes, Aplicações |
| **Frente** | nome, projetoId, paiId (frentes aninhadas), estado | pertence a Projeto; agrupa Tarefas |
| **Tarefa** | título, descrição, status (pendente, em andamento, bloqueada, feita), prioridade, prazo, estimativa em horas, recorrência | pertence a Projeto ou Frente; pode ser bloqueada por outra Tarefa |
| **Cliente** | nome, contato, status da relação, último contato, observações | liga-se a vários Projetos por VínculoCliente (receita recorrente, início, fim) |
| **Lançamento** | data, tipo (receita ou custo), valor em R$, categoria, projetoId, clienteId opcional, recorrente (periodicidade, até) | pertence a Projeto |
| **Fornecedor** | nome, contato, prazo de entrega, observações | fornece Itens de estoque |
| **Armazém** | nome, local, observações | contém Saldos |
| **Item** | nome, unidade, custo unitário, estoque mínimo, fornecedorId, tipo (insumo ou equipamento) | tem Saldos por Armazém |
| **Saldo** | itemId, armazémId, quantidade | movimentações registradas como Movimento (entrada, saída, ajuste, data, projetoId) |
| **ItemDeLista** (lista de materiais) | projetoId, itemId, quantidade necessária, status (falta, reservado, pronto) | liga Projeto a Item; gera alerta se o saldo não cobre |
| **Tecnologia** | nome, descrição, estado (ideia, pesquisando, dominada), estimativa de horas | pré-requisitos: outras Tecnologias |
| **Aplicação** | tecnologiaId, projetoId, efeito (custo, velocidade, receita nova), valor estimado | liga Tecnologia a Projeto |
| **Ligação** | origemId, destinoId, tipo (depende de, fornece insumo, reaproveita código, mesmo cliente, mesmo equipamento, financia), força | entre dois Projetos; os tipos são editáveis |
| **RegistroDeHoras** | data, projetoId, tarefaId opcional, horas, tecnologiaId opcional (horas de pesquisa) | alimenta moral, ROI e gargalo |
| **Evento** | tipo (positivo, negativo, ambíguo), título, projetoId opcional, data, resposta escolhida, resultado | registro de decisões |
| **Instantâneo** | semana, receita, custo, horas, saúde, fase e moral por projeto (JSON compacto) | gravado no fim de cada turno |

Conquistas e configurações (pesos das fórmulas, horas semanais disponíveis, limites de alerta, lentes ativas) ficam em dois registros únicos, `Conquista` e `Config`, fora da tabela acima por não terem relacionamentos.

### Estado derivado
Calculado pelo motor, nunca gravado como verdade (pode ser cacheado). Isso inclui horas gastas por tarefa e progresso e horas investidas por tecnologia: todos vêm dos `RegistroDeHoras`.

| Derivado | De onde vem | Onde aparece |
| :--- | :--- | :--- |
| **Saúde** (saudável, atenção, crítico) | tarefas vencidas, fluxo do mês, moral, bloqueios, falta de material | cor da cidade |
| **Fase de maturidade** | regras da seção 3 sobre receita, clientes, horas e tarefas concluídas | tamanho e modelo da cidade |
| **Moral** (momentum) | tarefas concluídas e horas nos últimos 14 dias contra a média do projeto | brilho, bandeiras, névoa |
| **Runway** | caixa acumulado dividido pelo custo mensal líquido médio | barra superior |
| **ROI por hora** | receita do período dividida pelas horas registradas | lente Finanças e ranking |
| **Concentração de risco** | parcela da receita por cliente e por fornecedor | lente Risco |
| **Cobertura de materiais** | saldo disponível contra a lista de materiais | ícone de armazém e bloqueio |

## 3. Engines de mecânica
O motor é um pacote sem tela: funções puras que recebem o estado (os dados da seção 2) e devolvem estado derivado, alertas e eventos. Nenhuma depende de Three.js ou de React, e cada uma tem testes. Todos os limites abaixo são valores padrão guardados em `Config`, editáveis pelo usuário. As ambiguidades das fórmulas estão resolvidas na seção 9.2.

### 3.1 Turno semanal
O tempo corre em semanas. Durante a semana o usuário registra horas, conclui tarefas e lança valores; o fechamento roda sempre na mesma ordem:
1. Materializar recorrências (lançamentos e tarefas que vencem na semana).
2. Recalcular todo o estado derivado (saúde, fase, moral, runway, ROI, risco, cobertura de materiais).
3. Rodar os detectores da seção 3.6 e criar os Eventos resultantes.
4. Avaliar conquistas (3.9).
5. Gravar o Instantâneo da semana.
6. Abrir a semana seguinte com o orçamento de horas zerado.
O fechamento é idempotente: rodar duas vezes na mesma semana não duplica nada.

### 3.2 Tempo como recurso central
O usuário define as horas disponíveis por semana (padrão 40). Cada projeto tem horas-alvo semanais e um modo de autonomia: direto (precisa de presença), esparso (sobrevive com pouca atenção) ou autônomo (roda sozinho, só alerta). O painel mostra horas planejadas, horas registradas e saldo. Aviso de gargalo quando a soma das horas-alvo passa das horas disponíveis, e aviso de troca de contexto quando uma semana tem mais de 4 setores diferentes com horas registradas (sugestão: agrupar blocos por setor).

### 3.3 Saúde e moral
- **Moral (0 a 1)** = `0,5 × min(1, horas dos últimos 14 dias ÷ (2 × horas-alvo semanais)) + 0,5 × min(1, tarefas concluídas nos últimos 14 dias ÷ média quinzenal histórica do projeto)`. Projetos autônomos trocam a parte de horas por “receita recorrente em dia”.
- **Saúde (0 a 100)** parte de 100 e subtrai: 10 por tarefa vencida (até 40), 20 se o fluxo do mês for negativo (só de Assentamento em diante, porque projetos em ideia não têm de render), 20 se a moral estiver abaixo de 0,4, e 10 por bloqueio ativo, seja por dependência ou por falta de material (até 20). Faixas: saudável a partir de 70, atenção de 40 a 69, crítico abaixo de 40.

### 3.4 Maturidade (ciclo de vida)
A fase é inferida, não decretada. As regras abaixo são avaliadas de cima para baixo e vale a mais alta satisfeita:

| Fase | Nível visual | Regra padrão |
| :--- | :---: | :--- |
| **Faísca** | 1 | Projeto criado, sem horas nem tarefas concluídas |
| **Expedição** | 2 | Ao menos 1 tarefa concluída ou 5 horas registradas |
| **Assentamento** | 3 | Primeira receita registrada |
| **Vila** | 4 | Ao menos 1 cliente com receita recorrente ativa |
| **Cidade** | 5 | 3 ou mais clientes ativos e receita cobrindo o custo por 3 meses seguidos |
| **Metrópole** | 6 | 10 ou mais clientes, ou receita mensal acima do limiar definido em Config, com margem positiva por 6 meses |
| **Legado** | 7 | Metrópole em modo autônomo, com horas semanais abaixo de 10% da média dos projetos diretos |
| **Ruínas** | — | Arquivado; exige uma nota de lições aprendidas |

Para evitar oscilação, a fase só desce depois de 2 meses seguidos abaixo da regra. Subir é imediato e gera um evento de conquista.

### 3.5 Finanças
- **Caixa e fluxo:** saldo acumulado dos lançamentos; fluxo mensal por projeto e consolidado; projeção dos próximos 6 meses só com lançamentos recorrentes (sem adivinhar vendas).
- **Runway:** caixa ÷ custo mensal líquido médio dos últimos 3 meses; se o fluxo líquido for positivo, mostra “sustentável”.
- **ROI por hora:** receita do período ÷ horas registradas, por projeto, com ranking.
- **Financiamento cruzado:** uma Ligação do tipo “financia” mostra no mapa quanto de um projeto lucrativo cobre o prejuízo de outro.
- **Custo de oportunidade:** ao mover horas de um projeto para outro, o painel mostra a diferença estimada de ROI por hora com base no histórico.

### 3.6 Detectores de inteligência
Cada detector devolve um alerta com projeto afetado, motivo em uma frase e ação sugerida. Nenhum age sozinho.

| Detector | Dispara quando | Sugestão |
| :--- | :--- | :--- |
| **Inanição** | projeto ativo sem hora nem tarefa concluída por 7 dias (amarelo) ou 30 dias (vermelho) | reativar, pausar ou arquivar |
| **Sinergia** | dois projetos do mesmo setor, sem ligação, que usam a mesma tecnologia | criar ligação |
| **Gargalo de atenção** | horas-alvo somadas acima das horas disponíveis, ou projeto direto com menos de 1 hora na semana | redistribuir horas |
| **Concentração de cliente** | um cliente responde por mais de 40% da receita total ou está em 3 ou mais projetos | plano de diversificação |
| **Ponto único de falha** | fornecedor ou equipamento compartilhado por 3 ou mais projetos | segundo fornecedor |
| **Estoque** | saldo abaixo do mínimo, ou lista de materiais não coberta antes do prazo da tarefa que a usa | compra sugerida |
| **Tecnologia de alto retorno** | tecnologia em pesquisa que desbloquearia aplicações em 3 ou mais projetos | priorizar pesquisa |

### 3.7 P&D e árvore tecnológica
Tecnologias formam um grafo dirigido e sem ciclos: uma só pode ser marcada como “pesquisando” se seus pré-requisitos estiverem “dominados”. O progresso vem das horas de pesquisa registradas (campo `tecnologiaId` em `RegistroDeHoras`) contra uma estimativa de horas informada pelo usuário. Ao ficar dominada, a tecnologia pode ser aplicada a projetos, e cada `Aplicação` guarda o efeito esperado. A tela da árvore ordena as tecnologias pendentes por “quantos projetos e quantas outras tecnologias ela desbloqueia”, que responde “o que pesquisar primeiro”.

### 3.8 Eventos
Eventos nascem de duas fontes: os detectores (acima) e o registro manual do usuário (cliente cancelou, fornecedor subiu preço, novo concorrente). Cada evento tem tipo positivo, negativo ou ambíguo, e o usuário responde com uma ação (ignorar, mitigar, aproveitar). A resposta e o resultado ficam registrados, e quando o mesmo tipo de evento volta o painel mostra o que foi feito antes.

### 3.9 Conquistas
São regras sobre dados reais, nunca pontos soltos. Exemplos iniciais: 7 semanas seguidas sem tarefa crítica vencida (consistência), primeiro projeto em um setor novo (expansão), uma tecnologia aplicada em 3 projetos (sinergia), crise superada sem perder cliente (resiliência), primeiro projeto em Metrópole (escala), 10 clientes ativos ao mesmo tempo (diplomacia). Aparecem como evento no mapa e na linha do tempo.

## 4. Direção visual
O visual evoca o mapa de campanha de Three Kingdoms: terra pintada à mão, rios serpenteando entre colinas de karst, névoa amarelada na distância, interface de laca e pergaminho. A referência é a linguagem (paleta, formas, hierarquia), não os arquivos do jogo.

**Regra de originalidade.** Nenhum modelo, ícone, textura, fonte ou som da Creative Assembly entra no projeto. Ícones são SVGs desenhados do zero; modelos são procedurais ou de pacotes CC0 (Kenney, Quaternius); texturas vêm de shader ou de bibliotecas CC0 (ambientCG, Poly Haven); fontes têm licença aberta. Cada asset externo entra com sua licença registrada em `ASSETS.md`.

### 4.1 Paleta e tipografia
| Token | Cor | Uso |
| :--- | :--- | :--- |
| `--pergaminho` | `#E8DCC0` | fundo de painéis e cards |
| `--pergaminho-escuro` | `#CDBB94` | bordas internas, divisórias, abas inativas |
| `--tinta` | `#1F1B16` | texto principal, contornos |
| `--laca` | `#8E1F1A` | molduras de painéis, alertas críticos |
| `--jade` | `#3E7C68` | saúde boa, ações confirmadas |
| `--ouro` | `#B8923A` | destaques, receita, selos |
| `--bronze` | `#7A5A2B` | molduras de ícones, botões |
| `--nevoa` | `#9DAAB0` | céu, névoa de distância, projetos parados |

Títulos em Noto Serif SC (peso 700, sombra dourada discreta); números e tabelas em Inter com algarismos tabulares. As duas têm licença aberta (OFL).

### 4.2 Setores e biomas
Valores iniciais; o usuário cria, renomeia e recolore setores no próprio app.

| Setor | Bioma | Cor do território | Símbolo |
| :--- | :--- | :--- | :--- |
| Agricultura | planície com terraços e arrozais | `#7FA35A` | espiga com folha |
| Produção alimentícia | vale fértil com celeiros | `#C9A24B` | caldeirão sobre o fogo |
| Bebidas | colinas com vinhedos e bambuzais | `#7B2D3A` | jarro selado |
| Química | região rochosa e árida, fumaça leve | `#6F7F72` | espiral de alquimia |
| Automação | vale industrial com mecanismos | `#B07A4A` | engrenagem com flecha |
| Robótica | montanhas com forjas | `#5A7488` | braço articulado |
| Software educacional | platôs com torres de observação | `#6FA3C7` | pergaminho aberto |
| Software profissional | cidade amuralhada central | `#6B4E8A` | selo com chaves de código |
| Comércio | rotas com mercados e portos | `#D0B25C` | balança |

### 4.3 Cidades por maturidade
Um modelo por nível (seção 3.4), todos procedurais no início (formas empilhadas e telhados curvos), substituíveis depois por glTF CC0 sem mudar o código do mapa.

| Nível | Fase | Visual |
| :---: | :--- | :--- |
| 1 | Faísca | tendas e fogueira, sem muralha |
| 2 | Expedição | paliçada de madeira e uma torre simples |
| 3 | Assentamento | muralha baixa, 2 a 3 construções, bandeira |
| 4 | Vila | muralha de pedra e pagode central |
| 5 | Cidade | muralha alta, vários pagodes, portão vermelho |
| 6 | Metrópole | pagode principal alto, muralha dupla, estandarte |
| 7 | Legado | telhados dourados, torres, névoa sagrada |
| — | Ruínas | muros caídos, sem animação, tom desbotado |

### 4.4 Estados no mapa
- **Saúde:** saudável = bandeiras ao vento e luz quente; atenção = bandeiras caídas e luz fria; crítico = fumaça, tom avermelhado e sino de alarme.
- **Moral baixa ou parado:** névoa cobrindo a cidade e animações paradas.
- **Crescimento recente:** partículas douradas subindo por alguns segundos após subir de fase.
- **P&D ativo:** luz azul pulsando na torre de pesquisa.
- **Clientes:** uma bandeirinha por cliente ativo, até 5, depois um número.
- **Alerta:** selo vermelho animado pousando sobre a cidade, como carta de mensageiro.
A cor nunca carrega sozinha a informação de saúde: a seção 6.8 define a redundância por forma e ícone.

### 4.5 Interface (HUD)
| Zona | Conteúdo |
| :--- | :--- |
| Barra superior (pergaminho) | caixa total, runway, horas livres na semana, semana atual, botão Fechar turno |
| Painel direito (laca e pergaminho) | abre ao clicar numa cidade, com abas Visão geral, Tarefas, Clientes, Finanças, Estoque e P&D |
| Minimapa (inferior esquerdo) | visão aérea com os territórios e o seletor de lentes |
| Feed de eventos (inferior direito) | eventos e alertas em ordem de chegada, cada um com ícone e cor por tipo |
| Tela da árvore tecnológica | abre por botão no HUD, fundo escuro de pergaminho com nós ligados por fios dourados |
| Busca global | atalho `/`, encontra projeto, tarefa, cliente ou item e leva a câmera até ele |

### 4.6 Lentes do mapa
O mesmo mapa visto por oito lentes, trocadas pelas teclas 1 a 8: Padrão (saúde e maturidade), Finanças (receita, runway, ROI), Tempo (mapa de calor das horas da semana), Rede (dependências e fluxos), Risco (pontos únicos de falha e concentração), Clientes (território colorido por cliente dominante), Estoque (alertas de material) e P&D (tecnologias e aplicações).

### 4.7 Terreno e atmosfera
Terreno 3D com câmera inclinada, relevo de karst, rios que seguem os vales, florestas instanciadas, mar com costa de areia, luz direcional suave, névoa de distância amarelada e leve efeito de foco nas bordas (tilt-shift) para dar a sensação de maquete. A névoa de guerra tem textura de tinta dissolvida em água e cobre áreas sem projeto ativo. Base técnica: o repositório ProceduralTerrains (licença MIT), conforme a seção 5.

## 5. Arquitetura técnica
O app é uma aplicação web em TypeScript com quatro camadas que só se falam por contratos: motor de regras, store, interface e mapa. O motor e os dados não conhecem a tela nem o 3D, o que permite testar as regras sozinhas e trocar o mapa ou o banco sem reescrever o resto.

### 5.1 Stack
| Camada | Escolha | Por quê |
| :--- | :--- | :--- |
| Linguagem e build | TypeScript estrito e Vite | o repositório de terreno já usa Vite; os tipos protegem o modelo da seção 2 |
| Interface | React | painéis, formulários e árvore tecnológica; o repositório de terreno também é React |
| Mapa | Three.js direto, numa classe `MapView`, sem `react-three-fiber` | controle fino de desempenho com centenas de cidades; o React não re-renderiza a cena |
| Estado de aplicação | Zustand | seleção, lente ativa e painéis abertos; os dados de negócio ficam no repositório |
| Persistência | IndexedDB via Dexie | localStorage tem limite perto de 5 MB e não indexa; Dexie dá consulta por índice (projeto, data) |
| Validação | Zod | importação de JSON e formulários, com esquema versionado |
| Testes | Vitest e Playwright | motor e repositório em Vitest; fluxos de tela e captura do mapa em Playwright |
| Terreno | ProceduralTerrains (MIT) | base visual da seção 4.7; integração descrita em 5.4 |

### 5.2 Regras de camada
1. `engine` não importa React, Three.js nem IndexedDB.
2. `map` só lê estado derivado e emite intenções (selecionar, arrastar, ligar); nunca grava no repositório.
3. Interface e mapa alteram dados apenas por comandos da store.
4. O repositório é uma interface (`Repository`); a implementação em IndexedDB pode ser trocada por uma API sem mudar mais nada.
As regras 1 a 4 são verificadas automaticamente por lint de dependências (Anexo B); violá-las quebra o build.

### 5.3 Desempenho para centenas de projetos
- Cidades do mesmo nível são desenhadas com `InstancedMesh`, uma chamada de desenho por nível.
- A seleção por clique usa um índice espacial em grade, sem varrer todos os objetos.
- O recálculo é incremental: só projetos alterados são recalculados; o fechamento semanal roda num Web Worker se passar de 50 ms.
- Árvores e detalhes têm níveis de detalhe por distância e um seletor de qualidade (baixa, média, alta) escolhido automaticamente pelo desempenho medido.
- Listas longas (tarefas, lançamentos) são virtualizadas nos painéis.
Meta medida em teste: 60 quadros por segundo com 500 cidades e 5.000 tarefas num computador comum (perfil de referência na seção 7.4).

### 5.4 Integração com o terreno
O ProceduralTerrains tem um build de biblioteca (`npm run build:lib` e `pack:lib`) e uma pasta `packages`. Ainda não foi verificado se esse pacote pode ser embutido em outro app, então a Fase 0 do roteiro (seção 8) pede ao Antigravity que decida entre duas rotas: (a) usar o pacote de terreno como dependência, ou (b) gerar o terreno uma vez no estúdio, exportar em GLB com mapa de altura e carregar esses arquivos no mapa do app. A rota (b) é a reserva e funciona mesmo que o pacote não seja embutível. Em qualquer caso a semente do terreno fica guardada em `Config`, para o mapa ser o mesmo a cada abertura.

### 5.5 Persistência e porta para o backend
Na v1 tudo fica em IndexedDB, no navegador. Dois cuidados obrigatórios: exportar e importar JSON com a versão do esquema, e um aviso na tela de que limpar os dados do navegador apaga tudo, com lembrete de exportar a cada fechamento de turno. O app também pede armazenamento persistente ao navegador (`navigator.storage.persist`) para reduzir o risco de remoção automática. Para a v2, a mesma interface `Repository` ganha uma implementação sobre API (Supabase, ou SQLite com servidor próprio) com login, sem tocar no motor, no mapa ou na interface. A estratégia de sincronização entre aparelhos é uma decisão em aberto (seção 9.1).

## 6. Telas e fluxos de uso
Esta seção descreve o que o usuário faz, tela a tela. Princípio guia: se lançar um dado dá trabalho, o usuário para de lançar, e sem dados reais o jogo não vale nada (princípio 1). Por isso a captura rápida (6.3) é prioridade.

### 6.1 Primeira abertura
A primeira abertura é um brief de campanha: um roteiro de 8 etapas em que tudo o que o jogo usa já vem preenchido com o padrão deste documento e tudo pode ser editado, trocado ou removido antes de a campanha começar. Nada no brief é fixo, nem os 9 setores iniciais. Ele usa os mesmos componentes do editor de registros (6.6), então existe um só código de edição; no brief eles aparecem em sequência e guiados. Cada etapa pode ser pulada (os padrões valem), o brief pode ser reaberto a qualquer momento em Configurações, e nada escolhido nele é definitivo.
1. **Caminho.** Começar com os padrões, importar um JSON ou começar vazio (neste caso o brief só pede o essencial: etapas 2, 5 e 8).
2. **Seu tempo.** Horas disponíveis por semana (padrão 40), dia em que a semana começa (padrão segunda-feira) e fuso horário.
3. **Setores e biomas.** Os 9 setores da seção 4.2 aparecem como lista editável: nome, cor, ícone, bioma, ordem e território (polígono ajustável sobre o minimapa). É possível renomear, recolorir, remover (arquiva) e criar setores novos.
4. **Vocabulário.** Estágios declarados, tipos de ligação, categorias de lançamento e os nomes das quatro prioridades de tarefa. Cada lista vem com o padrão e é totalmente editável.
5. **Regras do jogo.** Todos os pesos e limites de `Config` (moral, saúde, maturidade, detectores), cada um com o valor padrão, uma frase sobre o efeito e o botão Restaurar padrão. É aqui que se preenche o limiar de receita mensal da Metrópole, o único valor que o jogo pede explicitamente.
6. **Mapa.** Semente do terreno com prévia (sortear ou digitar), lentes ativas e qualidade gráfica (automática ou fixa).
7. **Primeiros projetos (opcional).** Uma lista rápida com nome, setor, horas-alvo e autonomia; cada linha vira uma cidade em Faísca dentro do território do setor, que pode ser arrastada depois.
8. **Revisão.** Resumo de tudo o que foi escolhido, aviso de que os dados ficam no navegador (5.5), botão para exportar o JSON inicial e o botão Começar campanha.

Ao concluir, o mapa abre com os territórios e as cidades criadas, com a dica “clique no mapa para fundar uma cidade”, e `Config` registra que o brief foi concluído. Um tutorial de 4 passos (fundar, registrar horas, ver o painel, fechar turno) é opcional e pode ser reaberto no menu.

### 6.2 Criar, mover e ligar projetos
- **Fundar:** duplo clique num ponto do território abre um modal curto com nome (obrigatório), setor (já preenchido pelo território clicado), horas-alvo semanais e autonomia. O resto se edita depois no painel.
- **Mover:** arrastar a cidade emite uma intenção de nova posição; o comando da store valida (dentro de algum território, distância mínima entre cidades) e grava.
- **Ligar:** arrastar de uma cidade a outra com Shift pressionado abre a escolha de tipo e força da ligação.
- **Arquivar:** no menu da cidade. Arquivar como Ruínas exige a nota de lições aprendidas; arquivar sem virar Ruínas apenas oculta o projeto (e pode ser desfeito).

### 6.3 Rotina diária: captura rápida
Uma barra de comando abre sobre o mapa por atalho, já preenchida com o último projeto usado, e fecha com Enter (Esc cancela). Os atalhos são `H` (registrar horas: projeto, horas, tarefa opcional, tecnologia opcional), `T` (nova tarefa), `L` (novo lançamento) e `E` (evento manual). Concluir tarefa é uma caixa de seleção no painel. Depois de qualquer edição, só os projetos afetados são recalculados e a cor da cidade muda na hora. `Ctrl+Z` desfaz o último comando (até 20).

### 6.4 Fechar turno
- O botão da barra superior abre uma prévia sem gravar nada (dry-run): horas registradas contra planejadas, receita e custo da semana, tarefas concluídas, cidades que mudariam de fase ou de saúde, eventos e conquistas que seriam gerados.
- Ao confirmar, o motor executa as 6 etapas da seção 3.1 e a tela mostra o resumo da semana.
- O botão Exportar JSON agora aparece em destaque (lembrete da seção 5.5).
- Se houver mais de uma semana pendente, elas fecham em ordem, da mais antiga para a mais recente, com um resumo agregado.
- Tudo que o fechamento cria (instantâneo, eventos de detector, conquistas, recorrências materializadas) leva um `fechamentoId`. Desfazer fechamento apaga apenas o que tem o `fechamentoId` da última rodada.

### 6.5 Painel da cidade
| Aba | Conteúdo | Ações principais |
| :--- | :--- | :--- |
| **Visão geral** | nome, setor, fase, saúde com a lista dos descontos que a compõem (por exemplo “−10: tarefa X vencida”), moral, horas da semana (meta e registrado), ligações, alertas ativos, notas | editar, arquivar, mudar de setor |
| **Tarefas** | lista agrupada por frente (alternável para quadro por status), filtros por status e prazo, bloqueios visíveis; virtualizada | criar, concluir, bloquear, registrar horas |
| **Clientes** | vínculos com receita recorrente, status da relação, último contato (alerta após 60 dias, configurável) | vincular, encerrar vínculo |
| **Finanças** | fluxo do mês, gráfico de 12 meses, projeção de 6 meses, ROI por hora, lista de lançamentos (virtualizada) | lançar, criar recorrência |
| **Estoque** | lista de materiais, cobertura, saldos por armazém | adicionar item, copiar lista de compra sugerida |
| **P&D** | tecnologias aplicadas ou candidatas ao projeto, horas de pesquisa, efeitos esperados | aplicar tecnologia |

A lista de descontos da saúde é obrigatória: é ela que cumpre o princípio 2 (o usuário edita a causa, não o resultado).

### 6.6 Editor de registros (Configurações)
Uma tela única, a mesma que o brief inicial (6.1) usa em etapas, com uma aba por tipo de registro editável: setores (nome, cor, ícone, bioma e polígono desenhado sobre o minimapa), estágios declarados, tipos de ligação, categorias de lançamento, pesos e limites (`Config`) e lentes. Em pesos e limites há Restaurar padrão e Prévia de impacto, que mostra quantas cidades mudariam de saúde ou de fase com o novo valor antes de salvar. A aba Dados concentra exportar, importar, limpar (com dupla confirmação) e a versão do esquema.

### 6.7 Atalhos
| Tecla | Ação |
| :--- | :--- |
| `/` | busca global |
| `1` a `8` | lentes do mapa |
| `H`, `T`, `L`, `E` | registrar horas, tarefa, lançamento, evento |
| `F` | centralizar a câmera na cidade selecionada |
| `G` | abrir a árvore tecnológica |
| `Esc` | fechar painel, modal ou barra de comando |
| `Ctrl+Z` | desfazer o último comando |

Todos os atalhos de letra e número ficam desativados enquanto um campo de texto tem foco.

### 6.8 Estados vazios, erros e acessibilidade
- **Estados vazios:** cada aba e lista vazia mostra uma frase e o botão da ação que a preenche.
- **Importação atômica:** o JSON é validado por inteiro com Zod; se algo falhar, nada é gravado e a tela lista os erros pelo caminho do campo.
- **Cor nunca sozinha:** saúde também aparece por forma (bandeira erguida, caída ou fumaça), por ícone e por texto no painel, porque jade e laca se confundem em daltonismo vermelho-verde.
- **Vista em lista:** além do mapa, uma tabela ordenável de todos os projetos (saúde, fase, moral, horas) que serve a leitores de tela, a quem prefere lista e a conferência rápida.
- **Movimento e contraste:** respeita a preferência do sistema por reduzir movimento (desliga partículas e animações de névoa); contraste AA nos painéis; tamanho de fonte ajustável de 90% a 130%; todos os painéis navegáveis por teclado.

## 7. Plano de testes e critérios de aceite
O motor calcula dinheiro, prazos e saúde de projetos reais; um erro de fórmula leva o dono a decidir errado sem perceber. Por isso as regras da seção 3 são testadas caso a caso, e cada fase do roteiro só termina quando seus critérios passam.

### 7.1 Estratégia
| Camada | Ferramenta | O que cobre | Meta |
| :--- | :--- | :--- | :--- |
| `engine` | Vitest (e fast-check para propriedades) | todas as regras numéricas das seções 3.3 a 3.9, com casos tabelados; idempotência do turno por propriedade | cobertura de linhas ≥ 90%, 100% das regras com ao menos um caso de limite |
| `repository` | Vitest com fake-indexeddb | CRUD, arquivamento, migração, round-trip de exportar e importar | todos os casos da tabela 7.2 |
| `domain` (Zod) | Vitest | fixtures válidas e inválidas de cada entidade | cada entidade com ao menos 1 inválida |
| `store` e interface | Vitest com Testing Library | comandos, validação de formulários, atalhos | fluxos críticos de 6.2 a 6.4 |
| ponta a ponta | Playwright | fluxos 6.1 a 6.4 do começo ao fim, em Chromium | todos verdes antes de cada tag de fase |
| visual | Playwright (capturas com semente fixa) | mapa em cada lente e em cada nível de cidade | diferença máxima de pixels configurada; mudança intencional atualiza a referência |
| desempenho | Playwright em Chromium sem interface, perfil carga | quadros, abertura, fechamento, busca | metas da tabela 7.4 |

### 7.2 Casos obrigatórios do motor e do repositório
Valores calculados com a `Config` padrão. Cada linha vira pelo menos um teste automatizado.

| Área | Caso | Resultado esperado |
| :--- | :--- | :--- |
| Moral | 10 h nos últimos 14 dias, meta de 10 h por semana, 2 tarefas feitas, média quinzenal 2 | 0,5 × 0,5 + 0,5 × 1 = 0,75 |
| Moral | 40 h em 14 dias, meta de 10 h por semana, 0 tarefas, média quinzenal 3 | 0,5 × 1 + 0,5 × 0 = 0,50 |
| Moral | projeto sem histórico (média quinzenal 0) | usa média de 1 tarefa por quinzena (9.2); nunca divide por zero |
| Moral | meta de horas igual a 0, 1 tarefa feita, média 2 | parte de horas dispensada; moral = 0,5 |
| Moral | projeto autônomo com 2 de 4 vínculos de cliente em dia | parte de horas = 0,5 (receita recorrente em dia) |
| Saúde | 3 tarefas vencidas, projeto em Vila com fluxo negativo, moral 0,3, 1 bloqueio | 100 − 30 − 20 − 20 − 10 = 20, crítico |
| Saúde | projeto em Faísca, 1 tarefa vencida, fluxo negativo | 90, saudável (fluxo negativo não desconta antes de Assentamento) |
| Saúde | 5 tarefas vencidas e 3 bloqueios | tetos aplicados: 100 − 40 − 20 = 40, atenção |
| Saúde | fronteiras | 70 é saudável, 69 é atenção, 40 é atenção, 39 é crítico (testado com pesos customizados) |
| Maturidade | 4,9 h e nenhuma tarefa feita / 5 h | Faísca / Expedição |
| Maturidade | primeira receita sem cliente recorrente | Assentamento |
| Maturidade | 3 clientes ativos, receita cobrindo custo por 3 meses / só por 2 meses | Cidade / Vila |
| Maturidade | Cidade abaixo da regra por 1 mês / por 2 meses seguidos | permanece Cidade / desce para a mais alta fase satisfeita |
| Maturidade | mês abaixo, mês cumprindo, mês abaixo | contador zera; permanece na fase |
| Maturidade | subir de fase | imediato, no mesmo fechamento, com evento de conquista |
| Maturidade | arquivar como Ruínas sem nota de lições | comando rejeitado |
| Finanças | caixa de R$ 30.000, custo líquido médio de R$ 5.000 por mês | runway de 6,0 meses |
| Finanças | fluxo líquido dos últimos 3 meses positivo | runway mostra “sustentável” |
| Finanças | R$ 6.000 de receita em 40 h / receita com 0 h | R$ 150 por hora / sem valor, nunca infinito |
| Finanças | recorrência mensal no dia 31 | cai no último dia dos meses curtos; projeção de 6 meses só soma recorrentes |
| Detectores | inanição com 6 / 7 / 30 dias sem atividade | nada / amarelo / vermelho |
| Detectores | cliente com 41% da receita / exatamente 40% / em 3 projetos | dispara / não dispara / dispara |
| Detectores | fornecedor em 3 projetos / em 2 | dispara / não dispara |
| Detectores | metas somam 45 h com 40 h disponíveis; projeto direto com 0,5 h na semana | gargalo dispara nos dois casos |
| Detectores | 5 setores com horas na semana / 4 | aviso de troca de contexto / nada |
| Detectores | saldo 3 com mínimo 5 | alerta de estoque |
| Detectores | lista pede 10, disponível 6, tarefa em 5 dias, entrega do fornecedor em 10 dias | alerta com compra sugerida de 4 |
| Árvore | marcar “pesquisando” com pré-requisito não dominado / criar ciclo A → B → A | rejeitado / rejeitado |
| Turno | fechar a mesma semana duas vezes | contagens de lançamentos, tarefas, eventos, conquistas e instantâneos idênticas |
| Turno | 3 semanas pendentes fechadas de uma vez / uma a uma | resultado idêntico |
| Turno | desfazer o último fechamento | contagens voltam às anteriores; nada além do fechamentoId é apagado |
| Repositório | exportar, importar, exportar | os dois JSON são idênticos |
| Repositório | arquivar um registro | continua no banco; consultas padrão o ocultam |
| Repositório | importar JSON com um campo inválido | nada é gravado; erros listados pelo caminho do campo |
| Repositório | abrir banco de uma versão antiga (fixture por versão) | migração preserva todos os dados |

### 7.3 Dados de teste
Um gerador determinístico, `seedDemo(perfil, semente)`, produz sempre os mesmos dados para a mesma semente.

| Perfil | Tamanho | Uso |
| :--- | :--- | :--- |
| `pequeno` | 12 projetos, 80 tarefas, 12 semanas de histórico | testes de interface e tutorial |
| `real` | 60 projetos, 600 tarefas, 52 semanas | revisão visual e calibração de pesos |
| `carga` | 500 projetos, 5.000 tarefas, 104 semanas | desempenho (meta da seção 1) |
| `caos` | dados patológicos: datas futuras, valores zero, nomes de 500 caracteres, emojis, tentativas de ciclo, projetos de setor arquivado | robustez: nenhum erro, nenhum NaN ou “undefined” na tela |

### 7.4 Metas medidas
Propostas; ajuste conforme o hardware de referência que você escolher (seção 9.1). Até lá, a referência é um notebook de uso geral com GPU integrada, 8 GB de RAM e um Chromium atual.

| Medida | Meta | Como medir |
| :--- | :--- | :--- |
| Quadros no mapa | p95 do tempo de quadro ≤ 16,7 ms (60 fps), lente Padrão, câmera em movimento | perfil carga, Playwright |
| Abertura | mapa interativo em ≤ 3 s | perfil carga, do carregamento da página |
| Fechamento semanal | ≤ 1 s (em Worker se passar de 50 ms) | perfil carga |
| Recálculo incremental | ≤ 16 ms por projeto alterado | perfil carga |
| Busca global | ≤ 100 ms por tecla | perfil carga |
| Importar JSON de 5 MB | ≤ 3 s | fixture gerada |
| Pacote inicial | ≤ 1,5 MB comprimido, sem GLB e texturas | build de produção |
| Memória | estável após 5 minutos navegando o mapa | medição de heap |

### 7.5 Definição de pronto de cada fase
Uma fase só termina quando todos os itens abaixo são verdadeiros e estão no relatório de fechamento.
1. Os critérios de aceite da fase foram atendidos e demonstrados (saída de testes, capturas ou números medidos).
2. Testes novos e antigos passam, `tsc` estrito sem erros e lint de camadas sem violações.
3. Nenhum asset externo sem licença registrada em `ASSETS.md`; nenhum asset da Creative Assembly.
4. Nenhum número inventado: todo valor derivado mostra de onde vem.
5. Exportar e importar ainda fazem round-trip.
6. `PROGRESSO.md` e `DECISOES.md` estão atualizados e há um commit com a tag da fase.
7. O app abre do zero seguindo apenas o `README`.

## 8. Roteiro de construção
O roteiro segue uma ordem de dependência: dados e regras antes de gráficos, porque o mapa é só uma vista (princípio 4) e as regras são o que mais custa errar. Cada fase termina em algo utilizável e testado, e o Antigravity para ao fim de cada uma para entregar o relatório. Tamanhos: P cabe em uma sessão curta, M em algumas, G em várias.

| Fase | Nome | Resultado visível | Tamanho |
| :---: | :--- | :--- | :---: |
| 0 | Fundação e spike do terreno | projeto roda, rota do terreno decidida, lint de camadas ativo | P |
| 1 | Dados e persistência | exportar e importar JSON funcionam, banco versionado | M |
| 2A | Motor I: derivados e finanças | saúde, moral, fase, runway e ROI calculados e testados | G |
| 2B | Motor II: detectores, P&D, eventos, conquistas e turno | fechamento semanal completo e idempotente | G |
| 3 | Store e interface base | dá para cadastrar tudo por formulários, sem 3D | G |
| 4 | Mapa 3D mínimo | cidades no terreno, cor por saúde, clique abre o painel | G |
| 5 | Painel da cidade completo | as 6 abas funcionando: ponto de uso real | G |
| 6 | Lentes, minimapa, feed e busca | 8 lentes, busca que leva a câmera | M |
| 7 | Árvore tecnológica e estoque | “o que pesquisar primeiro”, lista de materiais | M |
| 8 | Desempenho | 500 cidades e 5.000 tarefas a 60 fps | M |
| 9 | Atmosfera e acabamento | névoa, tilt-shift, partículas, modelos finais, acessibilidade | G |
| 10 | Endurecimento e entrega | backup, E2E completos, versão 1.0 | P |

## 9. Decisões em aberto e lacunas resolvidas

### 9.1 Decisões que dependem de você
| Decisão | Opções | Recomendação | Quando |
| :--- | :--- | :--- | :--- |
| Sincronização entre aparelhos (v2) | Supabase (banco e login prontos) ou SQLite com servidor próprio | Supabase, se você não quer manter servidor; SQLite só se quiser controle total. A v1 já prepara o caminho: UUIDs, `atualizadoEm` e arquivamento permitem mesclar por “última edição vence” | antes de iniciar a v2 |
| Limiar de receita mensal da Metrópole | valor em R$ por mês | você define na etapa 5 do brief inicial (6.1); provisório de R$ 50.000 marcado como “a confirmar” em `Config` até lá | até a Fase 5 |
| Hardware de referência das metas | modelo do seu computador (CPU, GPU, RAM) | informar para as metas serem medidas nele | antes da Fase 8 |
| Rota do terreno | (a) pacote como dependência ou (b) GLB exportado | o Antigravity decide na Fase 0 com evidência; (b) é a reserva | Fase 0 |
| Backup | só exportação manual, ou também gravação automática numa pasta | ambos; a gravação automática é opcional e só onde o navegador suporta | Fase 10 |
| Licença do código do app | privado ou aberta (MIT) | privado enquanto for de uso pessoal; manter o aviso de copyright do ProceduralTerrains (MIT) | Fase 0 |
| Sons | nenhum na v1, ou trilha e efeitos originais | sem som na v1, com ganchos prontos no código | Fase 9 |
| Idioma | só português do Brasil, ou multilíngue | só pt-BR, com todos os textos num arquivo único para tradução futura | Fase 3 |
| Navegador alvo | Chrome ou Edge atuais, Firefox, Safari | Chrome e Edge garantidos; Firefox esperado; Safari não garantido (pode remover dados de sites sem uso) | Fase 0 |

### 9.2 Lacunas encontradas na revisão
| Lacuna | Decisão adotada |
| :--- | :--- |
| Moral de projeto sem histórico (média quinzenal 0) ou com meta de horas 0 | média quinzenal 0 usa 1 tarefa por quinzena; meta de horas 0 dispensa a parte de horas e a moral vira o quociente de tarefas |
| Fórmula da moral em 3.3 (“horas ÷ 2 × horas-alvo”) | lida como `horas dos 14 dias ÷ (2 × horas-alvo semanais)`, isto é, contra as horas esperadas em duas semanas |
| “Receita recorrente em dia” (projetos autônomos) | vínculos de cliente ativos com receita registrada no período esperado (±7 dias) ÷ vínculos ativos; sem vínculos vale 0 |
| Definição de semana | segunda a domingo, fuso `America/Sao_Paulo`, identificada pela data da segunda-feira |
| Fechamento atrasado | semanas pendentes fecham em ordem; nada fecha sozinho; o app avisa ao abrir |
| Dinheiro | inteiros em centavos (`valorCentavos`), nunca ponto flutuante; formatação em R$ só na tela |
| Datas | calendário em `AAAA-MM-DD`; `criadoEm` e `atualizadoEm` em instante UTC (ISO 8601) |
| Recorrência | periodicidade (`semanal`, `mensal`, `trimestral`, `anual`), intervalo, dia de referência e data final; ocorrências guardam `origemRecorrenciaId`; dia 31 cai no último dia de meses curtos; tarefa recorrente concluída gera a próxima só no fechamento |
| Equipamento não tinha entidade | `Item` ganhou o campo `tipo` (`insumo` ou `equipamento`); equipamento compartilhado = `Item` de tipo `equipamento` na lista de materiais de 3 ou mais projetos |
| Campos derivados listados como dados | `Tarefa.horasGastas`, `Tecnologia.progresso` e `Tecnologia.horasInvestidas` viram derivados de `RegistroDeHoras` (princípio 2); `Tecnologia` guarda só a estimativa de horas |
| Histerese da fase depende do histórico | o motor recebe os `Instantâneos`, que guardam fase e moral por projeto; os meses abaixo da regra são reconstruídos dos instantâneos do fim de cada mês, nunca gravados à parte |
| Estágio declarado contra fase inferida | estágio declarado é um rótulo de lista editável, sem efeito em cálculo; a tela mostra o descompasso quando difere da fase inferida |
| Tarefa vencida e bloqueio ativo | vencida = prazo anterior a hoje e status diferente de `feita`; bloqueio = tarefa com status `bloqueada` ou dependência aberta, ou item de lista em falta sem cobertura, cada um contado individualmente (teto 20) |
| Prioridade da tarefa | 1 crítica, 2 alta, 3 média, 4 baixa; “tarefa crítica” na conquista de consistência é prioridade 1 |
| Tabelas do banco | 17 entidades, mais `Movimento` e `VínculoCliente`, mais 3 listas editáveis (`TipoLigação`, `CategoriaLançamento`, `Estágio`), 2 tabelas de junção (`BloqueioTarefa`, `PreRequisitoTecnologia`) e o registro `meta` com `Config` e `Conquistas` |
| Cidade fora do território após editar o polígono | é movida para o ponto mais próximo da borda, com aviso |
| Privacidade | nenhum dado sai do navegador; sem telemetria; fontes locais em produção, sem scripts de CDN; política de conteúdo restrita |

## 10. Riscos e mitigações
- **Perder tudo ao limpar os dados do navegador:** lembrete de exportar a cada fechamento; armazenamento persistente solicitado; gravação automática opcional em pasta (Fase 10).
- **O pacote ProceduralTerrains não ser embutível:** rota (b): GLB e mapa de altura gerados no estúdio (seção 5.4), decidida na Fase 0.
- **Escopo grande demais (17 entidades):** roteiro em fases; formulários CRUD gerados a partir dos esquemas; Fase 5 já é utilizável.
- **Fórmulas que não refletem a realidade:** pesos em `Config`, prévia de impacto e 4 semanas de calibração depois da Fase 5.
- **Desempenho do 3D só descoberto no fim:** medição desde a Fase 4; instancing e níveis de detalhe desde o começo.
- **O construtor desviar das regras:** prompt mestre com regras inegociáveis, lint de camadas que quebra o build e relatório obrigatório por fase.
- **Cansaço de lançamento:** captura rápida por atalho, valores pré-preenchidos, tela de fechamento curta (seção 6).
- **Asset com licença errada ou da Creative Assembly:** `ASSETS.md` obrigatório e verificação de licenças na Fase 10.
- **Dados perdidos numa migração de esquema:** fixture por versão, migrações testadas, exportação antes de migrar.

## Anexo A. Esquema técnico
```ts
type UUID = string;
type Data = string;      // AAAA-MM-DD
type Instante = string;  // ISO 8601 em UTC
type Centavos = number;  // inteiro, nunca ponto flutuante

interface Base { id: UUID; criadoEm: Instante; atualizadoEm: Instante; arquivadoEm: Instante | null; }
interface Recorrencia { periodicidade: 'semanal' | 'mensal' | 'trimestral' | 'anual'; intervalo: number; diaRef: number; ate: Data | null; }
interface Setor extends Base { nome: string; cor: string; icone: string; bioma: string; regiao: [number, number][]; ordem: number; }
interface Projeto extends Base { nome: string; descricao: string; setorId: UUID; x: number; z: number; estagioId: UUID | null; horasAlvoSemana: number; autonomia: 'direto' | 'esparso' | 'autonomo'; notas: string; notaLicoes: string | null; }
interface Frente extends Base { nome: string; projetoId: UUID; paiId: UUID | null; estado: 'ativa' | 'pausada' | 'concluida'; }
interface Tarefa extends Base { titulo: string; descricao: string; projetoId: UUID; frenteId: UUID | null; status: 'pendente' | 'em_andamento' | 'bloqueada' | 'feita'; prioridade: 1 | 2 | 3 | 4; prazo: Data | null; estimativaHoras: number | null; concluidaEm: Data | null; recorrencia: Recorrencia | null; origemRecorrenciaId: UUID | null; }
interface BloqueioTarefa { tarefaId: UUID; bloqueadaPorId: UUID; }
interface Cliente extends Base { nome: string; contato: string; statusRelacao: 'prospecto' | 'ativo' | 'em_risco' | 'inativo'; ultimoContato: Data | null; observacoes: string; }
interface VinculoCliente extends Base { clienteId: UUID; projetoId: UUID; receitaRecorrenteCentavos: Centavos; inicio: Data; fim: Data | null; }
interface Lancamento extends Base { data: Data; tipo: 'receita' | 'custo'; valorCentavos: Centavos; categoriaId: UUID; projetoId: UUID; clienteId: UUID | null; recorrencia: Recorrencia | null; origemRecorrenciaId: UUID | null; }
interface Fornecedor extends Base { nome: string; contato: string; prazoEntregaDias: number; observacoes: string; }
interface Armazem extends Base { nome: string; local: string; observacoes: string; }
interface Item extends Base { nome: string; unidade: string; custoUnitarioCentavos: Centavos; estoqueMinimo: number; fornecedorId: UUID | null; tipo: 'insumo' | 'equipamento'; }
interface Saldo extends Base { itemId: UUID; armazemId: UUID; quantidade: number; }
interface Movimento extends Base { itemId: UUID; armazemId: UUID; tipo: 'entrada' | 'saida' | 'ajuste'; quantidade: number; data: Data; projetoId: UUID | null; }
interface ItemDeLista extends Base { projetoId: UUID; itemId: UUID; quantidade: number; status: 'falta' | 'reservado' | 'pronto'; }
interface Tecnologia extends Base { nome: string; descricao: string; estado: 'ideia' | 'pesquisando' | 'dominada'; estimativaHoras: number; }
interface PreRequisitoTecnologia { tecnologiaId: UUID; preRequisitoId: UUID; }
interface Aplicacao extends Base { tecnologiaId: UUID; projetoId: UUID; efeito: 'custo' | 'velocidade' | 'receita_nova'; valorEstimadoCentavos: Centavos | null; }
interface TipoLigacao extends Base { nome: string; cor: string; direcional: boolean; }
interface Ligacao extends Base { origemId: UUID; destinoId: UUID; tipoId: UUID; forca: 1 | 2 | 3; }
interface RegistroDeHoras extends Base { data: Data; projetoId: UUID; tarefaId: UUID | null; horas: number; tecnologiaId: UUID | null; }
interface Evento extends Base { tipo: 'positivo' | 'negativo' | 'ambiguo'; tipoEvento: string; titulo: string; projetoId: UUID | null; data: Data; origem: 'detector' | 'manual' | 'conquista'; resposta: 'ignorar' | 'mitigar' | 'aproveitar' | null; resultado: string; fechamentoId: UUID | null; }
interface Instantaneo extends Base { semana: Data; receitaCentavos: Centavos; custoCentavos: Centavos; horas: number; porProjeto: Record<UUID, { saude: number; fase: number; moral: number }>; fechamentoId: UUID; }
interface ListaEditavel extends Base { nome: string; ordem: number; }  // usada por Estagio e CategoriaLancamento
interface Meta { versaoEsquema: number; config: Config; conquistas: Record<string, { desbloqueadaEm: Data; projetoId: UUID | null }>; }
```

## Anexo B. Estrutura do repositório e lint de camadas
```text
a-longa-marcha/
├─ docs/
│  ├─ DOCUMENTO_MESTRE.md   (este documento)
│  ├─ ASSETS.md             (licença de cada asset externo)
│  ├─ DECISOES.md           (decisões e desvios, com data e motivo)
│  └─ PROGRESSO.md          (plano e estado de cada fase)
├─ src/
│  ├─ domain/       tipos e esquemas Zod, sem lógica
│  ├─ engine/       funções puras do motor
│  ├─ repository/   interface, dexie/ e memoria/
│  ├─ store/        Zustand e comandos
│  ├─ ui/           React: HUD, painéis, formulários
│  ├─ map/          MapView (Three.js), seleção, lentes
│  ├─ workers/      fechamento e recálculos pesados
│  ├─ seed/         seedDemo
│  ├─ textos/       pt-BR.ts
│  └─ app/          main.tsx, composição
├─ tests/e2e/
├─ public/          fontes e terreno (GLB)
└─ package.json
```
