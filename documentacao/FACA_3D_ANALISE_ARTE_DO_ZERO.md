# FACA 3D — Análise da arte (do zero) e novo pipeline

**Data:** 2026-11-09 · **Escopo:** camada `ARTE` única, limite = toda a lateral da faca, Three.js vendored (r128 global). Sem reativar código antigo.
**Status:** análise aprovada para implementar do zero.

---

## 1. O que existia (e por que dava problema)

### 1.1 Pipeline antigo

```
jsx/faca3d.jsx: f3dArtes() -> inventário (artboards + camadas + FACA)
             -> f3dExportarArte() -> 1 PNG por artboard (2200px), esconde técnicas no finally
js/faca3d.js: lerArtesDoDocumento() + decidir() (EXTERNO/INTERNO por nome)
js/view/artes.js: carregarTextura() -> CanvasTexture (fundo #f2e8d5)
js/view/three3d.js: uvDaFace(pontos, arte) -> UV planar -> BufferGeometry / ExtrudeGeometry
```

### 1.2 Diagnóstico — 10 causas raiz

| # | Causa | Evidência no código | Efeito |
|---|-------|---------------------|--------|
| D1 | **Três sistemas de coordenadas** | doc pt absoluto (`caixaPt`), mm normalizado origem 0,0 (`path-parser.js:112-120`), rect da artboard em mm (`artes.js:decidir`) + `offset = ptParaMm(caixaPt.minX)` (`faca3d.js:810`) + `conteudo` remapeado (`uvDaFace:968-990`) | Qualquer troca de artboard ou arte sem caixa de conteúdo estica, desloca ou sobra papel branco. |
| D2 | **Decisão por artboard, não por camada** | `artes.js:decidir()` classifica `EXTERNO/INTERNO/FRENTE/VERSO`; `faca3d.jsx` repete com `RE_EXTERNA/RE_INTERNA` | Usuário tem camada `ARTE` única; o sistema esperava 2 artboards. 2ª artboard é vista espelhada do interior (nunca geometria) — confundia dentro com arte interna separada. |
| D3 | **UV calculada e descartada** | `recriarMalhas()` calcula `uv` e `orientarUv()` (`three3d.js:790-801`) mas `ExtrudeGeometry` usa UV interna do Three em unidades de `shape` (mm) | Textura esticada na borda (`ClampToEdge`). Foi introduzido na troca `BufferGeometry -> ExtrudeGeometry` (`0d79770`). |
| D4 | **Duas malhas vs sólido** | `malhas` + `malhasInternas` vs `lado:"solido"` com `[lateral, face]` (`three3d.js:836`). `materialDaMalha()` espera `lado==="interno"` | `atualizarSelecao()` sobrescreve array de materiais por material único; laterais perdem cor com arte. |
| D5 | **Pipeline desligado, UI morta** | `carregarArtes(){return Promise.resolve(null)}` (`faca3d.js:356`, stub em `88939b3`); `faca3dArteModo`/`faca3dEspelharInterna` não existem em `faca3d.html` | Painel mostra "Sem arte" mesmo com `ARTE` presente. |
| D6 | **Bounds inconsistentes no ExtendScript** | `f3dCaixaArteNaArtboard()` usa `visibleBounds` (infla com traço/sombra); `f3dBoundsCamada()` usa `geometricBounds`; `Layer.visibleBounds` nulo no 30.x | Caixa da arte ≠ caixa desenhada; `conteudo` sai errado. |
| D7 | **Exportação dual** | `SOMENTE_ARTE` se há `ARTE`, senão `TECNICAS_OCULTAS` (`f3dExportarArte:1076-1109`); restaura visibilidade no `finally` | Dois comportamentos; erro no meio pode deixar camada oculta visível/oculta errada. |
| D8 | **Testes presos ao contrato antigo** | `testes/testes-artes.js` exige `externa+interna` com textura e modos `ambas/externa/interna/nenhuma` | Qualquer mudança simples quebra 27 asserts. |
| D9 | **Cor sem sRGB** | `CanvasTexture` sem `encoding`/`colorSpace`; `anisotropy=4`, PNG 2200px | Arte lava/desbota vs Illustrator; borra em ângulo rasante. |
| D10 | **Custo por carga** | Exporta 1 PNG por artboard a cada `renderizar3D()` | Lento; CEP trava no `exportFile` síncrono. |

**Conclusão:** não é bug pontual. É acoplamento de artboard + offset + conteudo + Extrude sem UV. Reativar = arrastar D1-D10 de volta.

---

## 2. Requisitos novos (fechados com o usuário)

- **Fonte única:** camada `ARTE` (normalizada sem acento/caixa; inclui subcamadas). Sem `ARTE` → modo papel.
- **Limite:** toda a lateral da faca = bbox 2D normalizada `mm [0,W]×[0,H]` (`path-parser` já normaliza). Nada de `rect` da artboard nem `conteudo`.
- **Comportamento:** como é UV no espaço do objeto, ao dobrar a matriz move vértice+UV juntos — arte **gruda** e não desliza.
- **Stack:** continuar no Three.js vendored, sem lib nova, sem ES modules, sem buldler (regra CEP).
- **Interior:** mesmo textura vista por trás (DoubleSide, espelhada). Não há segunda arte.

---

## 3. Novo pipeline (do zero)

```
Illustrator (artboard 0 = faca)
  -> faca3dArteUnica()  (novo, JSX) : { hasArte, bboxArte(pt), bboxFaca(pt), rect0(pt), doc, temp }
  -> faca3dExportarArteUnica(indice0, pasta) (novo, JSX) : exporta SO a camada ARTE em PNG artboard
  -> js/view/arteUnica.js (novo, substitui artes.js):
        recortarParaFaca(png, rect0, bboxFaca, Wmm, Hmm) -> canvas faca W×H (crop em JS, sem tocar no doc)
        criarTextura(canvas) -> CanvasTexture sRGB, anisotropy 8, flipY=true
  -> js/view/three3d.js:
        uvFaca(x,y) = (x/W, y/H)   // W,H = caixa (0..W,0..H) já normalizada
        patch na geometria ANTES da matriz de dobra -> dobra move junto
        overlay decal por face (ShapeGeometry) + Extrude sólido (papel/lateral)
  -> js/faca3d.js: carregarArteUnica() (novo) orquestra e chama viewer.definirArteUnica()
```

### 3.1 Coordenadas (única fórmula)

- `W,H` = `geometria.caixa.largura/altura` (mm normalizado) = `planaMax-planaMin` em `recriarMalhas`.
- Para todo vértice `(x,y)` em mm normalizado: `u = x/W`, `v = y/H` (Y para cima, `v=0` base).
- PNG da artboard: `artboardRect` em pt → mm. `bboxFaca(pt)` = `caixaPt` (absoluto). Crop em px:
  `cx = (facaLeft-abLeft)/abW * pngW`, `cy = (abTop-facaTop)/abH * pngH` (Y invertido do PNG), `cw = facaW/abW*pngW`, `ch = facaH/abH*pngH`. Desenha esse recorte num canvas `round(W*escala)×round(H*escala)`. Textura 0..1 = faca inteira.
- `V`: com `flipY=true`, `v=1` = topo do PNG = `y=H`. Confere com `v=y/H`.

### 3.2 Geometria — por que overlay, não patch no Extrude

`ExtrudeGeometry` tem 2 grupos: `0=laterais`, `1=tampas(f+r)` com um único material de tampa. Não dá para ter externa/interna separadas e ainda cor lateral distinta sem hexágono.

Solução nova:

- **Sólido:** `ExtrudeGeometry` como hoje, materiais `papel/lateral` (sem textura). Espessura e furos continuam funcionando.
- **Decal de arte:** 1 `ShapeGeometry` por face (mesma triangulação `tri.pontos/triangulos`, mesmos `furos`), UV planar do §3.1, `DoubleSide`, deslocado `normal*(espessura/2+0.02mm)` para não z-fight. Mesma `matriz` da face — dobra junto.
- **Seleção:** decal ganha `emissive` laranja quando `facesSelecionadas`; sólido mantém cor de seleção atual. Não sobrescrever array de materiais.

Alternativa descartada: patchar a UV do Extrude — cola também nas paredes laterais (estiramento de 1,5mm visível de perto) e obrigaria a quebrar o sólido. O overlay isola o risco.

### 3.3 ExtendScript novo (ES3, sem tocar em `f3dArtes` antigo)

- `faca3dArteUnica()`: lista só `ARTE_CAMADA` + `FACA` bbox + `ARTBOARD[0]` bbox + `DOC/TEMP`. Reusa `f3dColetarCamadasArte`, `f3dBoundsCamada` (geometricBounds, consistente), `f3dBoundsFaca`.
- `faca3dExportarArteUnica(pasta)`: snapshot visibilidade, mantém só `ARTE` (+ancestrais), `exportFile` PNG24 do artboard 0 com `artBoardClipping=true, transparency=true`, `alvo=4096px` no maior lado, restaura tudo no `finally`, devolve `ARQUIVO=0\tpath\tWpx\tHpx`.
- Se `ARTE` vazia ou só em artboard 1 → `hasArte=0`, painel avisa (não exporta artboard espelhada).

### 3.4 Painel (novo)

- `js/faca3d.js`: `carregarArteUnica()` chamado 1× após `renderizar3D()` (não a cada dobra). Erro → papel + `registrarLog`.
- Nota em `faca3dNotaArtes`: `Arte: camada ARTE · 300×200 mm · 0,42s` ou `Sem camada ARTE: papel.`
- Toggle único `Mostrar arte` (checkbox) — substitui `arteModo(4)/espelharInterna`. Sem `ARTE`, desabilitado.

### 3.5 Erros e fallback

| Situação | Ação |
|----------|------|
| Sem camada ARTE | Sólido papel, nota amarela |
| PNG não gerado | Papel + log, não quebra dobra |
| `W/H` degenerado | Papel |
| Crop fora da artboard | `clamp` ao PNG, aviso |

Nenhum erro apaga/altera o documento; visibilidade restaurada no `finally` (padrão já existente).

---

## 4. Testes novos

- `testes/testes-arte-unica.mjs` (Node, sem Illustrator): pure functions `recortarParaFaca` + `uvFaca` — cobre bbox cheia, crop parcial, Y invertido, clamp, W/H zero. Meta: 12/12.
- `testes/testes-artes.js` (painel, novo contrato): sem arte → papel; com ARTE → UV 0..1 em todas as faces, nenhuma degenerada, material `arte` em `malhas+decals`, toggle muda só visibilidade (não a UV), DVRGLER (dobra 0°/90° não altera UV).
- Manter `testes-geometria.mjs (126)`, `testes-estruturais.mjs (28)`, `testes-chapa-fisica.mjs`, `testes-placa*.mjs` verdes. `testes-artes.js` antigo é substituído.

---

## 5. Riscos e alternativas consideradas

- **Artboard temporária `addRect(facaBBox)` no JSX** — exportaria PNG já recortado (sem crop JS), mas cria/remove artboard (mexe no doc, pode bater com limite de artboards e com `setActiveArtboardIndex`). Descartado nesta versão; crop em JS é stateless e testável.
- **Projeção por câmera projetora (`three-projected-material`)** — boa para prova de impressão, mas estica em laterais dobradas e exige shader novo. O UV planar na faca planificada é o que o offset printing realmente faz. Descartado.
- **Atlas UV (`xatlas`)** — painéis são planos; UV planar é o correto. Descartado.

## 6. Arquivos tocados na implementação

| Arquivo | Mudança |
|---------|---------|
| `jsx/faca3d.jsx` | + `faca3dArteUnica`, `faca3dExportarArteUnica` (mantém antigos p/ compat) |
| `js/view/arteUnica.js` | **novo** (recorte + textura) |
| `js/view/artes.js` | depreca `decidir`; mantém `normalizar` só como shim |
| `js/view/three3d.js` | `uvFaca`, decal por face, `definirArteUnica`, `inspecionar().artesUnica` |
| `js/faca3d.js` | `carregarArteUnica`, nota, toggle único |
| `faca3d.html` | toggle `faca3dMostrarArte` (remove `faca3dArteModo`/`faca3dEspelharInterna` órfãos) |
| `testes/testes-arte-unica.mjs` | novo |
| `testes/testes-artes.js` | reescrito |

