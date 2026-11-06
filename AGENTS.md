# 3D Faca — Guia do Projeto

Extensão CEP independente do Adobe Illustrator que lê a faca de uma embalagem
(camada `FACA`) e a monta em 3D, com dobra por articulações, arte externa e
interna mapeadas e diagnóstico de vincos.

**Repositório:** https://github.com/evaneiaw/3d-faca
**Bundle CEP:** `com.mazurky.faca3d`
**Menu do Illustrator:** Janela > Extensões > **3D Faca**
**Versão atual:** 0.8.0

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
- **Base fixa**: no diagnóstico, `Definir base fixa` + `Base automática`; o
  painel base pode ser escolhido no canvas do diagnóstico, na vista 3D ou na
  lista **Face**, com confirmação (`Definir Painel N como base fixa?`).
- **Dobra salva**: `Salvar ângulos` grava no disco os ângulos/sentidos que o
  usuário definiu à mão para aquela faca; `Restaurar` traz de volta (também é
  restaurado sozinho ao reler a mesma faca).

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
   ├─ contour-builder → grafo planar + costura de pontas soltas (picotes)
   ├─ face-detector→ faces fechadas (meias-arestas), furos e duplicatas
   ├─ structural-lines → linhas virtuais (corte/vinco)
   ├─ hinge-audit  → árvore de dobradiças e classificação dos vincos
   ├─ geometry-engine → orquestra tudo e devolve o resultado
   └─ face-subdivision → subdivide faces cruzadas por vincos
   ▼
js/view/three3d.js
   ├─ monta geometria (BufferGeometry), aplica matrizes de dobra
   ├─ triangula cada face com os furos (recortes vazados)
   ├─ escolhe o lado externo de cada face
   ├─ UV da arte externa/interna
   └─ Three.js + OrbitControls (render sob demanda)
   ▼
Canvas 3D no painel
```

### Costura de pontas e furos (0.8.0)

- **Costura**: o desenho real tem picotes de ~2 mm nas bases das abas; a borda
  do painel fica aberta e o painel não vira face. O `contour-builder` liga cada
  ponta solta (vértice de grau 1) ao vértice mais próximo até `costuraMm`
  (o painel passa 2,5 mm; o motor padrão é 0) por uma reta curta que **não
  cruza** nenhuma aresta existente. As emendas vão para `grafo.costuras` e são
  contadas no resumo.
- **Furos**: uma face inteiramente contida em outra é recorte/janela, não
  painel. O `face-detector` guarda o polígono em `face.furos` da face externa e
  remove a face interna da montagem; o `three3d` triangula com
  `THREE.ShapeUtils.triangulateShape(contorno, furos)`. O retorno tri usa
  `pontos` = contorno + furos (os índices apontam para a lista combinada) e
  `contorno` = só a borda externa (usada em UV/borda/seleção).
- **Duplicatas**: arestas coincidentes de mesma classe são retiradas do grafo
  (`aresta.duplicada`) e faces de assinatura idêntica são descartadas; sem isso
  o ciclo duplicado gerava faces repetidas e podia esconder o furo.
- **Regras conservadoras**: furo só quando a face está totalmente contida;
  recorte encostado na borda do painel continua sendo um painel separado (fica
  fora da montagem, mas não vira buraco).


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
  - `faca3dSalvarDobras(chave, texto)` / `faca3dLerDobras(chave)` /
    `faca3dApagarDobras(chave)` — ângulos salvos por faca (texto no disco; o
    JSON é montado no painel).
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

### Base fixa manual (0.8.0)

- A raiz da árvore é a base fixa: `hinge.construir(res, { raiz })` aceita a
  face escolhida (precisa existir, estar no componente principal ligado por
  vinco e ter dobradiça); senão mantém a automática e devolve `motivoBase`.
- `three3d.definirBase(id)` / `definirBaseAutomatica()` trocam a raiz, recalculam
  sinais/matrizes/malhas e **não** mexem na câmera; ângulos e sentidos do
  usuário são preservados.
- `engine.assinatura(resultado)` invalida a base manual quando a faca muda
  (documento, caminhos, faces, caixa, soma das áreas).
- `matrizDobra3`, `matrizesDaMontagem` e `escolherSinaisCom` ficam no escopo do
  módulo `three3d` (exportados para teste no Node). `matrizesDaMontagem` deixa a
  raiz com identidade; todo o resto gira em torno das dobradiças.
- Relatório: `documentacao/FACA_3D_REPORT_BASE_FIXA.md`.

### Ângulos salvos (0.8.0)

- `Salvar ângulos` grava `%APPDATA%\MazurkyTools\faca3d\dobras\<doc>-<chave>.json`
  (via ExtendScript `faca3dSalvarDobras` / `faca3dLerDobras` /
  `faca3dApagarDobras`). A chave vem de `engine.chaveDobra(res)` — documento +
  assinatura da geometria (8 hex). Faca diferente = arquivo diferente.
- Conteúdo: `anguloGlobal`, `angulos` por face, `sinais` (-1) e a `base` usada.
- `three3d.aplicarDobras(config)` normaliza (`normalizarDobras`, exportada para
  teste), reaplica ângulos/sentidos e redesenha sem mexer na câmera.
- Ao ler a faca, o painel tenta restaurar em silêncio; o botão `Restaurar` é
  explícito e avisa quando não há nada salvo. Relatório:
  `documentacao/FACA_3D_REPORT_DOBRAS_SALVAS.md`.

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
  testes/                    # 8 suítes
  documentacao/              # relatórios, status, evidências
  icons/
```

## Testes

Executar no painel aberto (porta de debug 7778):

| Suíte | Arquivo | Resultado |
|---|---|---|
| Geometria | `testes/testes-geometria.mjs` | 126/126 |
| Estruturais | `testes/testes-estruturais.mjs` | 28/28 |
| Artes | `testes/testes-artes.js` | 27/27 |
| Painel 3D | `testes/testes-3d-painel.js` | 26/26 |
| Articulações | `testes/testes-articulacoes.js` | 129/129 |
| Seleção | `testes/testes-selecao.js` | 51/51 |
| Base fixa | `testes/testes-base-fixa.js` | (rodar no painel) |
| Dobras salvas | `testes/testes-dobras.js` | (rodar no painel) |

As suítes `.mjs` rodam no Node; as `.js` rodam na página do painel via CDP
(`%TEMP%\opencode\cep_cdp2.mjs`). Elas são sensíveis ao estado: rode cada uma
após recarregar o painel.

## Limitações conhecidas

- Só monta faces ligadas por **vinco**; faces ligadas apenas por corte ficam
  fora (ex.: recortes/inserts separados). Em documentos reais isso pode deixar
  uma parte da faca de fora.
- **Costura de pontas** (0.8.0): vãos de até 2,5 mm entre ponta solta e outro
  vértice são emendados por uma reta curta que não cruza nenhuma linha, para o
  painel fechar (picotes nas bases das abas). Vãos maiores continuam abertos.
- **Furos** (0.8.0): faces totalmente contidas em outra viram furo da face
  externa (trianguladas com `triangulateShape(contorno, furos)`); recortes que
  encostam na borda do painel não são furos. Faces repetidas (linhas
  duplicadas no desenho) são descartadas.
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
