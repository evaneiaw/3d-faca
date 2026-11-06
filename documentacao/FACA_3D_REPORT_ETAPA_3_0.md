# RELATÓRIO FACA 3D — ETAPA 3.0: MONTAGEM 3D DA FACA

**Status:** Concluída e demonstrada no painel CEP real.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

**Data:** 05/11/2026

---

## 1. Objetivo

Transformar a faca 2D em **3D dobrável**, com a interface mínima: a faca ocupa a tela, o botão **Dobrar** anima a montagem, o ângulo pode ser explorado e o usuário volta para a home por um botão explícito.

O 2D **não faz mais parte da interface**. O renderizador 2D continua no código apenas como diagnóstico, mas não é carregado.

## 2. O que está na tela

| Elemento | Função |
|---|---|
| **← Ferramentas** | Volta ao grid do MazurkyTools (mesmo caminho do ×) |
| **Dobrar** | Anima a dobra de 0° até 90° |
| **Ângulo** | Slider 0–180° com valor em graus |
| **Reiniciar vista** | Volta à câmera inicial |
| **Ler novamente** | Relê o documento e remonta |
| Arrastar | Gira a câmera (órbita) |
| Roda do mouse | Zoom |
| Rodapé | Faces montadas, dobradiças, ligação rígida e ângulo |
| Nota | Explica o que ficou fora e que a direção das dobras é inferida |

## 3. Como a montagem é construída

1. As faces vêm do detector planar já validado na Fase 2 (17 faces em `faca teste.pdf`).
2. Cada **adjacência por vinco** vira uma ligação:
   - **reta** (desvio ≤ 0,05 mm): tem eixo e dobra;
   - **não reta** (ex.: o contorno em “U” entre as faces 0 e 1): é mantida **rígida**, sem dobrar, porque um painel rígido não gira em torno de uma linha quebrada.
3. A raiz é a face com **mais dobradiças** (o centro da caixa), não a maior área. Isso evita montar o corpo “para fora” a partir da tampa.
4. A árvore é percorrida em largura; cada painel recebe uma matriz de dobra em torno do eixo da sua dobradiça.
5. **Direção das dobras:** a faca não traz montanha/vale. O padrão é dobrar cada painel para o lado **+Z do pai** (montagem coerente). Se esse padrão se auto-intersectar, o motor procura o menor conjunto de inversões que elimine os cruzamentos. A interface declara que a direção é inferida.

## 4. Resultado no arquivo oficial

| Métrica | Valor |
|---|---|
| Faces identificadas | **17** |
| Faces montadas | **13** |
| Fora da montagem | **4** (recortes de 480 mm² ligados apenas por corte) |
| Dobradiças que dobram | **11** (retas) |
| Ligações mantidas rígidas | **1** (contorno em “U” entre as faces 0 e 1) |
| Cruzamentos entre faces a 90° | **0** |
| Tempo de leitura + montagem | **115–134 ms** |
| Three.js | r128 local (`js/vendor/three.min.js`, 603.445 bytes) |
| WebGL | renderer real no CEP, sem erro |

A caixa monta com base, paredes, abas e tampa; os quatro recortes pequenos (13–16) não entram porque não têm ligação por vinco.

## 5. Como foi testado

Harness CDP no painel CEP real, com `faca teste.pdf` ativo.

| # | Verificação | Resultado |
|---|---|---|
| 1 | Abertura da ferramenta | Canvas 3D criado, leitura automática |
| 2 | Status | `Faca lida: 106 caminhos · 13 de 17 faces montadas · 126 ms` |
| 3 | Animação inicial | Em ~300 ms estava em 29°; terminou em 90° |
| 4 | Botão Dobrar | Recomeça em 0° e para em 90° |
| 5 | Slider | 0° e 180° alteram o desenho |
| 6 | Rotação | Arrasto altera o hash do canvas |
| 7 | Zoom | Roda altera o hash do canvas |
| 8 | Reiniciar vista | OK |
| 9 | Botão ← Ferramentas | Volta ao grid |
| 10 | Reabrir | Remonta e anima novamente |
| 11 | Cruzamentos | 0 a 90° |
| 12 | Testes unitários | 58/58 |

### Evidências

- `evidencias/etapa3_3d_plano.png` — 0°, faca planificada.
- `evidencias/etapa3_3d_dobrando.png` — 45°, caixa se formando.
- `evidencias/etapa3_3d_montada.png` — 90°, caixa montada.

## 6. Defeitos encontrados e corrigidos

1. **Falta de pedaços da caixa:** a primeira versão descartava a ligação em “U”, perdendo as faces 0, 1, 2 e 3. A ligação passou a ser tratada como **rígida**, e a montagem subiu de 10 para **13 faces**.
2. **Leque de painéis:** o sinal de dobra era aplicado como “+1” para todas as dobradiças, mas o sentido do eixo é arbitrário. Passou a ser calculado por face (dobrar para o +Z do pai), resultando na caixa fechada.
3. **Face externa do contorno em “U”:** a linha de vinco não pode ser desenhada como uma dobradiça reta; passou a ser omitida e a ligação marcada como rígida.
4. **Cache de módulos:** fechar e reabrir a ferramenta mantinha os módulos antigos em memória; o cache do carregador passou a ser limpo a cada abertura.

## 7. Limitações declaradas

- A faca **não informa montanha/vale**; a direção é inferida. O padrão pode não ser o da montagem física pretendida.
- O ângulo é **global** (todas as dobradiças iguais). Uma caixa real pode ter abas a 90° e tampa a 180°; isso exige controle por dobradiça (próxima fase).
- A ligação em “U” fica **rígida** (não dobrada), pois não há eixo único.
- Os 4 recortes pequenos ligados só por corte ficam fora.
- **A arte ainda não é material do 3D** — `faca teste.pdf` não tem arte. Quando houver, a próxima entrega mapeia a arte como textura das faces.
- O painel ancorado limita a janela a 640 px; a câmera enquadra o modelo planificado para caber em todos os ângulos.

## 8. Próxima entrega

1. **Arte como material:** usar a arte do documento (imagens/textos) como textura das faces, dobrando faca e arte juntas.
2. **Dobra por dobradiça:** ângulo individual (90°/180°) e montanha/vale por dobradiça.
3. Melhor enquadramento automático por ângulo, sem perder a faca de vista.
