# 3D Faca — Relatório 0.8.0: costura de pontas e furos

## Problema relatado

No documento real `faaaaccaaaa.pdf` (248 caminhos na camada FACA):

1. **“Os recortes que formam um furo não são lidos”** — a janela do painel e os
   slots apareciam como chapa sólida no 3D.
2. **“Falta um painel”** — a lateral esquerda inteira (com as abas) ficava fora
   da montagem.

O log do painel mostrava `caminhos=248 faces=45 montadas=18` (18 de 45 faces).

## Diagnóstico

A geometria foi reconstruída offline a partir do PDF (mesmo protocolo do
Extenscript) e o pipeline do painel rodado no Node. Com isso o defeito ficou
reproduzido com exatidão (`faces=44 montadas=18`, diferença de 1 face por
sentido de path).

Duas causas independentes:

1. **Borda aberta por picote.** As abas V3/V4/V5 têm picotes de **2 mm** nas
   bases: a linha de corte termina em `(21,y)` e a aba começa em `(23,y)`.
   A tolerância de junção é 0,05 mm, então a borda do painel lateral nunca
   fechava e **a face não existia**. Sem essa face, as faces ligadas a ela
   (lateral, abas e chapas) ficavam “soltas” e não entravam na árvore de
   dobras → o painel que faltava.
2. **Furo tratado como face.** O detector de faces devolvia o polígono da
   face externa cheio (janela de 35.312 mm² e slots de 104 mm² dentro dele)
   e as faces internas eram montadas como painéis. Além disso, linhas
   duplicadas no desenho produziam **faces repetidas** (mesma área/centroide),
   o que também atrapalhava a identificação do furo.

## Correções (0.8.0)

- **`js/core/contour-builder.js` — costura de pontas.** Novo passo 5b: cada
  vértice de grau 1 é ligado ao vértice mais próximo até `costuraMm` (o painel
  usa **2,5 mm**) por uma reta curta que **não cruza** nenhuma aresta
  existente. As emendas são registradas em `grafo.costuras`. O padrão do motor
  é `costuraMm: 0` (desligado) para não mudar os documentos que já fechavam.
- **`js/core/contour-builder.js` — arestas duplicadas** de mesma classe saem
  do grafo (`aresta.duplicada`) e da adjacência dos vértices; antes elas
  criavam ciclos degenerados.
- **`js/core/face-detector.js` — furos.** Faces de assinatura idêntica
  (duplicatas) são descartadas. Uma face inteiramente contida em outra vira
  **furo** da face externa (`face.furos`) e sai da montagem; o caso é
  conservador: recorte encostado na borda não é furo.
- **`js/view/three3d.js` — triangulação com furos.** `triangular()` chama
  `THREE.ShapeUtils.triangulateShape(contorno, furos)`; o resultado usa
  `pontos` = contorno + furos (lista combinada dos índices) e `contorno` = só a
  borda externa, usada em UV, bordas, seleção e centroides.
- **`js/core/topology.js`** — o resumo passa a informar `furos`,
  `facesDuplicadas` e `costuras`.
- **`js/faca3d.js`** — envia `tolerancias: { costuraMm: 2.5 }` ao motor e mostra
  “N furo(s) · N emenda(s)” no status e no log.
- **`js/core/face-subdivision.js`** — não subdivide a face que tem furos (a
  subdivisão recriaria a face e perderia os furos).

## Resultado no documento real

| | antes | depois |
|---|---|---|
| faces | 44 | **35** (5 furos + 5 duplicatas removidas) |
| faces montadas | 18 | **30** |
| furos vazados | 0 | **5** (janela 35.312 mm² + 4 slots) |
| emendas de picote | 0 | **1** |
| faces fora da montagem | 26 | **5** (slots pequenos encostados na borda) |

A lateral esquerda, as abas, as orelhas e as chapas internas passam a montar.
Só ficam fora 2 recortes de 300 mm² e 3 slots de 180 mm² que encostam na borda
do painel (não são furos por definição; continuam fora da árvore de dobras).

Evidências: `documentacao/evidencias/0_8_0_antes.png` e
`0_8_0_depois.png` (azul = face montada; branco com contorno magenta = furo).

## Ferramentas de reprodução

`testes/_repro/`:

- `extrair_pdf.py <pdf> <geo.txt>` — extrai os caminhos da camada `faca` do PDF
  para o protocolo `F3D|1|GEO`.
- `rodar.mjs <geo.txt> [costuraMm]` — roda o pipeline do painel no Node e
  imprime faces, furos, emendas, montagem e faces fora.
- `desenhar.py <repro.json> <png>` — desenha o diagnóstico 2D.

## Testes

| Suíte | Resultado |
|---|---|
| Geometria (`testes/testes-geometria.mjs`) | **82/82** (24 novos: costura, furos e triangulação com furo) |
| Estruturais (`testes/testes-estruturais.mjs`) | **28/28** |

## Hotfix: “Cannot read properties of undefined (reading 'x')”

Na primeira execução no Illustrator o 3D não aparecia. Causa: `triangulateShape`
devolve índices na lista **contorno + furos**, mas o bloco que escolhe o lado
externo da face montava os vértices da normal só com o contorno. Em face com
furo, o primeiro triângulo referenciou um vértice do furo (índice 4 numa lista
de 4) → `undefined.x`.

Correção em `js/view/three3d.js`: a normal usa `tri.pontos` (lista combinada) e
o centroide usa `tri.contorno` (borda externa). O smoke test
`testes/_repro/smoke_render.mjs` reproduz todo o caminho de renderização
(normais, centroide, posições, índices, ponto interno) e passa com as 30 faces
montadas. Os testes de geometria ganharam a regressão “índices ultrapassam o
contorno (lista combinada é obrigatória)”.

As suítes de painel (`testes-artes.js`, `testes-3d-painel.js`,
`testes-articulacoes.js`, `testes-selecao.js`) rodam no Illustrator via CDP e
devem ser repetidas com o painel aberto após reiniciar o Illustrator.
