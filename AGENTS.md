# 3D Faca — Guia do Projeto

Extensão CEP independente do Adobe Illustrator que lê a faca de uma embalagem
(camada `FACA`) e a monta em 3D, com dobra por articulações, arte externa e
interna mapeadas e diagnóstico de vincos.

**Repositório:** https://github.com/evaneiaw/3d-faca
**Bundle CEP:** `com.mazurky.faca3d`
**Menu do Illustrator:** Janela > Extensões > **3D Faca**
**Versão atual:** 0.7.6

> Esta ferramenta **não faz parte** do Mazurky Tools. É um plugin separado.

## O que o plugin faz

1. Lê o documento ativo do Illustrator (somente a **1ª prancheta**).
2. Coleta os caminhos da camada **FACA** (aceita `FACA`, `FACAS`,
   `FACA DE CORTE`, `LAYOUT` e `CORTE`), classificando corte × vinco pela cor.
3. Constrói o grafo planar, detecta as faces fechadas e monta a árvore de
   dobradiças.
4. Escolhe o sentido de cada dobra (montanha/vale não vem no arquivo) para
   fechar a caixa sem autointersecção.
5. Monta a caixa no Three.js, com órbita/pan/zoom.
6. Exporta as artboards do documento em PNG e aplica como textura externa e
   interna, cada uma no seu lado da folha.
7. Mostra um diagnóstico dos vincos (dobra, rígido, sem par, múltiplos etc.).

## Funcionalidades do painel

### Barra de ferramentas (agrupada)

- **Dobrar / Desdobrar / Reset / Ler novamente**
- **Ângulo** (slider 0–180°) e **Face** (seleção por lista, Ctrl/Shift para
  múltiplas faces)
- **Vista**: perspectiva direita/esquerda, frente, topo, **Plano 0° (arte
  externa)**, lados, interior
- **Arte**: Externa + interna / somente externa / somente interna / sem arte,
  checkbox **Espelhar interna**, **Atualizar artes**
- **Diagnóstico** dos vincos

### Interação

- Arrastar com o botão esquerdo = órbita; direito = pan; roda = zoom.
- Clique numa face = selecionar; Ctrl+clique soma/remove; Shift+clique soma.
- **Dobrar** anima a montagem; **Desdobrar** volta a 0°; **Reset** volta ao
  plano e à vista de arte externa.
- A vista escolhida é mantida ao dobrar (só sai da vista inicial "Plano 0°").

### Detecção automática do documento

- Ao abrir, lê o documento ativo.
- Um polling de 5 s (com debounce de 3 s) compara o **nome** do documento
  ativo; se mudou, relê sozinho.
- Também relê ao focar a aba (`focus` / `visibilitychange`).

## Como funciona (pipeline)

```
Illustrator (documento ativo)
   │  ExtendScript (jsx/faca3d.jsx)
   │  f3dGeometria → caminhos, cores, coordenadas, artboards
   ▼
JS do painel (js/core/*)
   ├─ path-parser  → caminhos/segmentos em mm
   ├─ topology     → grafo planar (nós/arestas)
   ├─ face-detector→ faces fechadas (meias-arestas)
   ├─ structural-lines → linhas virtuais (corte/vinco)
   ├─ hinge-audit  → árvore de dobradiças e classificação dos vincos
   ├─ geometry-engine → orquestra tudo e devolve o resultado
   └─ face-subdivision → subdivide faces cruzadas por vincos
   ▼
js/view/three3d.js
   ├─ monta geometria (BufferGeometry), aplica matrizes de dobra
   ├─ escolhe o lado externo de cada face
   ├─ UV da arte externa/interna
   └─ Three.js + OrbitControls (render sob demanda)
   ▼
Canvas 3D no painel
```

### Camadas do código

- **`jsx/host.jsx`** — despachante ExtendScript. Carrega o `.jsx` da ferramenta
  sob demanda (`carregarFerramenta`), executa a função pedida
  (`chamar`) e reinstala os wrappers no `finally`.
- **`jsx/faca3d.jsx`** — backend da faca:
  - `faca3dGeometria(escopo, inicio, fim)` — caminhos da camada FACA.
  - `faca3dDiagnostico(escopo)` — inventário de artboards/camadas e classes.
  - `faca3dArtes()` — artboards e camadas de arte.
  - `faca3dExportarArte(indicesCsv, pasta, alvoPx)` — exporta PNGs por artboard,
    ocultando as camadas técnicas (FACA, MIRA, COTAS etc.).
  - `faca3dDocAtivo()` — nome do documento ativo (autoleitura).
- **`js/core/protocol.js`** — protocolo textual `CHAVE=valor` (sem JSON no
  ExtendScript).
- **`js/core/loader.js`** — carrega os módulos em ordem, com cache-buster.
- **`js/view/three3d.js`** — cena, câmera, materiais, UVs, seleção, dobras.
- **`js/view/artes.js`** — decide arte externa/interna e gera as texturas.
- **`js/view/diagnostico.js`** — desenho do diagnóstico de vincos.
- **`js/faca3d.js`** — controlador da interface (eventos, leitura, animações).

## Regras técnicas importantes

### ExtendScript (ES3)

- Sem `trim`, `map/filter/forEach`, `JSON`, `Object.keys`.
- Coleções do DOM **não têm `.item(i)`**: usar colchete 0-based
  (`layers[i-1]`, `pathItems[i-1]`).
- `Layer.visibleBounds` retorna nulo no Illustrator 30.x: medir a união dos
  `pageItem.visibleBounds`.
- `PageItem.transform(array)` não aceita array: usar `resize`/`translate` ou um
  objeto `Matrix`.

### Geometria e dobras

- Somente a **1ª artboard** fornece geometria; a faca espelhada da 2ª é
  ignorada.
- A caixa dobra para **cima** (`pontuar` penaliza `z < -0.5`): paredes e tampa
  sobem e a tampa fecha por cima.
- `ladoExterno` define, por face, qual lado é o de fora da caixa montada.
- `giroFace` marca faces com profundidade ≥ 2 na árvore (a tampa); quando a
  dobra passa de 45°, o UV recebe um giro de 90° para o desenho ficar em pé.

### Arte externa e interna

- A arte externa fica no lado de fora da caixa; a interna no lado de dentro.
- A UV da face interna usa o retângulo da **1ª artboard** como referência
  (a 2ª é a mesma folha vista por dentro, deslocada junto com a artboard).
  Usar o `rect` da 2ª jogava a UV para a margem branca — era o "verso ausente".
- `frenteNegativa` espelha o U quando a frente da malha aponta para -z.
- O checkbox **Espelhar interna** espelha o U da arte interna.
- Com 2 artboards e nomes reconhecidos (EXTERNO/INTERNO, FRENTE/VERSO), os
  **nomes** mandam; senão, usa a ordem (1ª externa, 2ª interna).
- Documento com **1 artboard** não tem arte interna (fica em branco).

### Renderização e estabilidade

- **Não há loop contínuo de renderização.** A cena é redesenhada sob demanda:
  mudança de câmera (`controls` emite `change`), modelo, arte ou resize.
- O OrbitControls fica com `enableDamping = false` para não precisar de loop.
- O polling do documento compara **nome com nome**; comparar caminho com nome
  relia a faca a cada 5 s e causava piscagem/câmera mudando sozinha.
- Ao trocar de documento, a leitura antiga é descartada e a nova é feita.

### Visual

- A área 3D ocupa todo o espaço livre (`flex: 1 1 auto; min-height: 0`).
- A toolbar é dividida em grupos: ações, parâmetros e arte.
- O painel redimensiona junto com a janela do CEP.

## Estrutura de arquivos

```
com.mazurky.faca3d/
  CSXS/manifest.xml          # bundle com.mazurky.faca3d, menu "3D Faca"
  faca3d.html                # página do painel
  css/faca3d.css
  js/
    CSInterface.js
    faca3d.js                # controlador da interface
    core/                    # geometria (parser, topologia, faces, dobras)
    view/                    # three3d, artes, diagnóstico
    vendor/                  # three.min.js + OrbitControls.js
  jsx/
    host.jsx                 # despachante ExtendScript
    faca3d.jsx               # backend da faca
  testes/                    # 6 suítes
  documentacao/              # relatórios, status, evidências
  icons/
```

## Testes

Executar no painel aberto (porta de debug 7778):

| Suíte | Arquivo | Resultado |
|---|---|---|
| Geometria | `testes/testes-geometria.mjs` | 58/58 |
| Estruturais | `testes/testes-estruturais.mjs` | 28/28 |
| Artes | `testes/testes-artes.js` | 27/27 |
| Painel 3D | `testes/testes-3d-painel.js` | 26/26 |
| Articulações | `testes/testes-articulacoes.js` | 129/129 |
| Seleção | `testes/testes-selecao.js` | 51/51 |

As suítes `.mjs` rodam no Node; as `.js` rodam na página do painel via CDP
(`%TEMP%\opencode\cep_cdp2.mjs`). Elas são sensíveis ao estado: rode cada uma
após recarregar o painel.

## Limitações conhecidas

- Só monta faces ligadas por **vinco**; faces ligadas apenas por corte ficam
  fora (ex.: recortes/inserts separados). Em documentos reais isso pode deixar
  uma parte da faca de fora.
- **Furos/recortes internos** ainda não são vazados no 3D: a face externa é
  triangulada como um polígono sólido (o detector de faces não passa os furos
  para o `triangulateShape`).
- A arte interna só existe quando o documento tem **2 artboards**.
- Documentos com a camada da faca fora dos nomes aceitos não são lidos.

## Repositório e publicação

- Código-fonte: `C:\Users\user\AppData\Roaming\Adobe\CEP\extensions\com.mazurky.faca3d`
- GitHub: https://github.com/evaneiaw/3d-faca (branch `master`)
- Instalação: copiar a pasta para
  `%APPDATA%\Adobe\CEP\extensions\com.mazurky.faca3d` e reiniciar o Illustrator
  uma vez (o CEP lê o manifesto na inicialização).
- Alterações em `manifest.xml` exigem reinício; o resto basta fechar/reabrir a
  aba.
- Cache do CEP (limpar em caso de versão antiga):
  `%TEMP%\cep_cache\ILST_*_com.mazurky.faca3d`.
