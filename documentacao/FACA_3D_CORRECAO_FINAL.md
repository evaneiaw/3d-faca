# FACA 3D — correção final de geometria e arte

Data: 06/11/2026
Documento de teste: `C:\Users\user\Desktop\faca teste.pdf` (2 artboards: Externo/Interno)
Versão da ferramenta: 0.7.6 (sem bump para 0.8.0)

## Causas encontradas

### 1. Tampa descendo

A seleção de sentido das dobras (`pontuar`) estava penalizando `z > 0.5`, ou seja,
escolhia sempre a solução que dobrava a caixa para **baixo** (-z). Com isso o
corpo descia e a tampa fechava por baixo.

Correção: voltou a penalizar `z < -0.5`; as paredes e a tampa sobem (+z) e a
tampa fecha por cima. Nenhum vinco foi invertido individualmente — o sentido
continua sendo escolhido por articulação pela mesma função, só com a preferência
de lado correta.

### 2. Arte interna ausente

A UV da face interna usava o `rect` da **2ª artboard**. Como a 2ª artboard é a
mesma folha deslocada no documento, o conteúdo dela anda junto com a artboard;
usar aquele retângulo jogava a UV para a margem branca (fora da arte). O material
interno estava correto (textura carregada), mas amostrava a margem.

Correção: a referência de UV das duas faces passou a ser o retângulo da **1ª
artboard** (`refInterna`), que é o quadro relativo do desenho. O "Verso" passou a
aparecer no interior.

### 3. Arte externa espelhada/girada

A face externa é invertida (`inverter`) quando a normal do polígono aponta para o
lado oposto ao exterior; a textura ficava espelhada. Além disso, painéis que
dobram 180° (tampa) ficam girados 90° vistos de cima.

Correção em `orientarUv` (sempre em torno do centro do UV da face, sem mover a
região da arte):
- `frenteNegativa` espelha o U quando a frente da malha aponta para -z;
- faces com profundidade ≥ 2 na árvore (`giroFace`, ex.: tampa) recebem um giro
  de 90° no UV quando a própria dobra passa de 45°, para o desenho continuar em
  pé no topo;
- o checkbox **Espelhar interna** continua espelhando o U da arte interna.

### 4. Vista inicial

Em 0° a face externa fica voltada para baixo (a folha é impressa por cima). Para
a arte externa continuar legível na planificada, a vista inicial é **`baixo`**
(opção "Plano 0° (arte externa)"). Ao clicar em **Dobrar** a câmera passa para a
perspectiva e a caixa monta com a tampa subindo.

## Arquivos alterados

- `convertidos/faca3d/js/view/three3d.js`
  - `pontuar` (sentido da dobra)
  - `ladoExterno`/`giroFace` (lado externo e profundidade da árvore)
  - `frenteNegativa`, `centroUv`, `orientarUv` (UV externa/interna)
  - `refInterna` (referência da 2ª artboard)
  - vista `baixo`
- `convertidos/faca3d/js/faca3d.js`
  - vista inicial `baixo`, troca para perspectiva no Dobrar e no Reset
- `convertidos/faca3d/faca3d.html`
  - opção "Plano 0° (arte externa)"
- `convertidos/faca3d/js/view/artes.js`
  - nomes das artboards mandam quando formam par claro
- `js/main.js` (badge 0.11.6) e `index.html?v=32` (restauração do hub)
- `CSXS/manifest.xml` (painel próprio "3D Faca")

## Validação

Testes automatizados (todos passando):

| Suíte | Resultado |
|---|---|
| geometria | 58/58 |
| estruturais | 28/28 |
| artes | 27/27 |
| 3D painel | 26/26 |
| articulações | 129/129 |
| seleção | 51/51 |

Evidências reais no painel 3D com `faca teste.pdf`
(`convertidos/faca3d/documentacao/evidencias/`):

- `01_planificada_0.png` — planificada 0°, "Frente" legível
- `02_inicio_fechamento.png` — início do fechamento, paredes subindo
- `03_fechada.png` — caixa fechada, tampa por cima
- `03b_fechada_frente_zoom.png` — "Frente" na tampa
- `04_interior_verso.png` — interior com "Verso" e caixa aberta
- `06_exterior_topo.png` — exterior visto de cima
- `07_ambas_artes.png` — caixa aberta com interior e exterior na mesma vista

Observação sobre o arquivo de teste: as artes "Externo"/"Interno" têm apenas um
retângulo colorido sobre o painel principal; as abas e paredes laterais são
brancas no PDF. Por isso as laterais aparecem em papel — não é falha de
mapeamento: a arte daquela região está em branco na própria artboard.
