# RELATÓRIO FACA 3D — ETAPA 2.5: VISUALIZAÇÃO 2D FUNCIONAL

**Status:** Concluída e demonstrada no painel CEP real.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

**Data:** 05/11/2026

---

## 1. Objetivo

Entregar o **primeiro marco visível**: abrir o FACA 3D, clicar em **Ler faca** e **ver a faca real desenhada**, com cortes e vincos diferenciados, curvas preservadas, zoom, movimentação e ajuste automático.

## 2. O que foi implementado

### 2.1 Novo renderizador 2D

`convertidos/faca3d/js/view/canvas2d.js` — Canvas 2D nativo, sem dependências.

| Recurso | Implementação |
|---|---|
| Curvas Bézier | `bezierCurveTo` com os handles originais (`c1`, `c2`), não a polilinha achatada |
| Corte | vermelho `#d7373f`, linha contínua 1,5 px |
| Vinco | azul `#1473e6`, linha tracejada 5/3 px |
| Faces | preenchimento azul translúcido + contorno fino |
| Regiões não reconstruídas | halo laranja sobre a polilinha real dos contornos abertos |
| Vértices ambíguos (grau > 2) | anel laranja com miolo branco |
| Zoom | botões −/+, roda do mouse e duplo clique para ajustar |
| Movimentação | arrasto com o botão esquerdo |
| Ajuste | “Ajustar” e duplo clique; reajusta ao redimensionar |
| Coordenadas | cursor em mm no rodapé, ao lado do zoom |

Transformação: milímetros (Y para cima) → tela (Y para baixo), via `xTela = x·k + tx` e `yTela = ty − y·k`. O desenho é vetorial em memória e só é rasterizado no canvas.

### 2.2 Interface

- Barra de ferramentas acima do canvas: legenda (Corte, Vinco, Face, Aberto, Ambíguo), toggles **Cortes / Vincos / Faces / Abertos / Ambíguos**, botões −, +, Ajustar e porcentagem de zoom.
- Card **Geometria** na lateral: caminhos, cortes, vincos, segmentos (retos/curvos), contornos (fechados/abertos), faces/adjacências, ambiguidades, inválidos, área e tempo.
- Nota explícita do que **não** foi reconstruído.
- Rodapé do canvas: resumo (caminhos, cortes, vincos, segmentos) e posição do cursor em mm.
- Estados de erro claros: sem documento, sem seleção, nenhum caminho, falha de geometria.

### 2.3 Fluxo

Ao abrir a ferramenta, a leitura do documento e o desenho acontecem automaticamente. O botão **Ler faca** repete o ciclo completo (diagnóstico → geometria → desenho) e **Atualizar** também.

## 3. Como foi testado

Harness CDP oficial (`%TEMP%\opencode\cep_cdp.mjs`), painel CEP dentro do Illustrator 30.8.2, com `faca teste.pdf` ativo.

| # | Verificação | Resultado |
|---|---|---|
| 1 | Ferramenta abre e módulos carregam | `Faca3D.versao = 0.3.0`, `view.canvas2d` presente |
| 2 | Canvas único (sem duplicação) | 1 canvas, 601 × 340 px |
| 3 | Clique em **Ler faca** | `Faca desenhada: 106 caminhos · 17 faces · 75 ms` |
| 4 | Resumo no rodapé | `106 caminhos · 84 cortes · 22 vincos · 128 segmentos (108 retos, 20 curvos)` |
| 5 | Card de geometria | contornos 69 (13 fechados, 56 abertos), 17 faces, 52 ambiguidades, 15 inválidos |
| 6 | Pixels de corte | 3.117 px vermelhos |
| 7 | Pixels de vinco | 1.217 px azuis fortes |
| 8 | Pixels de face | ~46.800 px de preenchimento |
| 9 | Zoom por botão | 100% → 156%, pixels 59.386 → 113.271 |
| 10 | Pan por arrasto | hash do canvas mudou após mover 80 px |
| 11 | Ajustar | volta para 100% |
| 12 | Toggle Faces | face px 46.820 → 0 |
| 13 | Toggle Vincos | azul 1.217 → 0 |
| 14 | Toggle Cortes | vermelho 3.220 → 0 |
| 15 | Toggle Abertos | hash mudou |
| 16 | Toggle Ambíguos | hash mudou |
| 17 | Zoom pela roda | 143% |
| 18 | Margens do ajuste | 20 px topo/base, conteúdo centralizado |
| 19 | Escopo Seleção sem seleção | “Nenhum objeto selecionado”, canvas removido, geometria limpa |
| 20 | Volta para Documento | faca redesenhada (106 caminhos, 17 faces) |

## 4. Evidências

- `documentacao/evidencias/etapa2_5_visualizacao_2d.png` — faca inteira no painel, ajustada.
- `documentacao/evidencias/etapa2_5_visualizacao_2d_zoom.png` — detalhe a 244%, mostrando curvas Bézier e tracejado de vinco.

## 5. Defeitos encontrados e corrigidos durante a execução

1. **Camada “Abertos” não desenhava.** `topologia.contornos[].arestas` continha objetos `{id, direcao}` em vez de ids numéricos; o visualizador indexava o array com um objeto e obtinha `undefined`. Corrigido normalizando a topologia para ids e aceitando as duas formas no visualizador.
2. **Saltos no halo laranja.** A primeira correção desenhava cada aresta sempre no sentido `a→b`, ignorando a direção da caminhada. Trocado pelo uso da polilinha real do contorno (`grafo.contornos[].pontos`), que já respeita a direção.
3. **Área útil pequena no painel ancorado.** O canvas tinha `min-height: 220px`; elevado para 320 px (340 px no layout estreito), com padding de ajuste de 24 px.
4. **Estado de erro.** Adicionado caso “nenhum caminho de faca” e estilo visual de erro distinto.

## 6. Limitações (declaradas)

- As faces exibidas são as **regiões inequivocamente fechadas** (17). Os 56 contornos abertos e as 52 ambiguidades são marcados, não “resolvidos no chute”.
- Não há seleção/edição de faces, nem dobras — a visualização é somente leitura e informativa.
- O painel ancorado do Illustrator limita a janela a 640 px de largura neste ambiente; o layout responde empilhando os cards, mas `window.resizeTo` é ignorado quando ancorado.
- A validação visual das faces é a desta entrega; não houve conferência manual face a face contra o desenho original.
- Não há 3D nesta etapa.

## 7. Conclusão

O marco obrigatório foi atingido: **a faca real aparece no painel**, com cortes e vincos diferenciados, curvas preservadas, zoom, pan, ajuste e camadas. A reconstrução topológica também está visível (faces, abertos e ambiguidades), sem inventar geometria. A próxima entrega é a **primeira visualização 3D**.
