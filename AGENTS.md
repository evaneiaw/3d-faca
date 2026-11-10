# 3D Faca — AGENTS.md

CEP extension for Adobe Illustrator (`com.faca3d`, v0.8.0). Standalone plugin. Reads the `FACA` layer of the active doc, builds the planar graph, folds the box in 3D (Three.js), maps external/internal art, diagnoses creases. Menu: **Janela > Extensões > 3D Faca**.

## Layout

- `CSXS/manifest.xml` — bundle id, host `ILST [29.0,99.9]` (Illustrator 2024+), main `faca3d.html`.
- `jsx/host.jsx` — ExtendScript dispatcher (loads `faca3d.jsx` on demand, reinstalls wrappers in `finally`).
- `jsx/faca3d.jsx` — backend: `faca3dGeometria`, `faca3dDiagnostico`, `faca3dArtes`, `faca3dExportarArte`, `faca3dSalvarDobras`/`Ler`/`Apagar`, `faca3dDocAtivo`.
- `js/core/*` — geometry pipeline (path-parser → topology → contour-builder → face-detector → structural-lines → hinge-audit → geometry-engine → face-subdivision).
- `js/view/*` — `three3d.js` (scene, folds, UV), `artes.js`, `diagnostico.js`.
- `js/faca3d.js` — panel controller; `js/core/loader.js` loads modules in `MODULOS` order (base derived from `location.href`).
- `testes/` — 8 Node suites (`.mjs`) + 6 panel suites (`.js`).

## Commands

Node suites (run from repo root; no package.json/build step):
```
node testes/testes-geometria.mjs      # 128/128
node testes/testes-estruturais.mjs    # 28/28
node testes/testes-orientacao.mjs     # 28/28
```
Panel suites (`testes/*.js`) run inside the open CEP panel via CDP on debug port **7778** (`%TEMP%\opencode\cep_cdp2.mjs`). They are state-sensitive: reload the panel between suites. Requires a doc with the right setup (e.g. 2 artboards EXTERNO/INTERNO for artes tests).

There is no lint/typecheck/build config. Do not invent npm scripts.

## Install / run

- Install / Update = copy repo contents (excluding `.git`) to `%APPDATA%\Adobe\CEP\extensions\com.faca3d`, clear `%TEMP%\cep_cache\*`, and **completely restart Adobe Illustrator** so stale versions are never cached.
- `PlayerDebugMode` must be `1` under `HKCU\Software\Adobe\CSXS.<n>` (already set here for 9–15).
- CEP cache (clear if stale version loads): `%TEMP%\cep_cache\ILST_*_com.faca3d`.
- Debug port for tests: 7778.

## ExtendScript (ES3) constraints — do not violate

- No `trim`, `map/filter/forEach`, `JSON`, `Object.keys`.
- DOM collections have no `.item(i)`; use 0-based brackets (`layers[i-1]`, `pathItems[i-1]`).
- `Layer.visibleBounds` is null on Illustrator 30.x; measure union of `pageItem.visibleBounds`.
- `PageItem.transform(array)` does not accept an array; use `resize`/`translate` or a `Matrix` object.

## Invariants

- Only the **1st artboard** provides geometry; the 2nd is the same sheet seen from inside (mirrored), never duplicated geometry.
- Box folds **upward** (`pontuar` penalizes `z < -0.5`); root/base stays fixed.
- Crease vs cut classified by **color**; accepted layer names: `FACA`, `FACAS`, `FACA DE CORTE`, `LAYOUT`, `CORTE`.
- Costura (0.8.0): loose tips (degree-1 vertices) are stitched to the nearest vertex up to 2.5 mm by a short non-crossing segment; larger gaps stay open. Seams go to `grafo.costuras`.
- Holes: a face fully contained in another becomes `face.furos` of the outer face; the inner face is removed from assembly. Edge-adjacent cutouts are separate panels, not holes.
- Duplicate coincident edges of same class are dropped (`aresta.duplicada`); identical-signature faces are discarded.
- Arte: 2 artboards with recognized names (EXTERNO/INTERNO, FRENTE/VERSO) → names win; else order (1st external, 2nd internal). Single-artboard doc has no internal art; internal UV uses the 1st artboard's rect.
- Render is **on demand** (no continuous loop); `enableDamping = false`.
- Document polling compares **name to name** (not path to name) to avoid spurious re-reads every 5 s.
- Base fixa manual: `hinge.construir(res, { raiz })`; invalidates when `engine.assinatura(resultado)` changes. Angles/senses preserved across base change.
- Saved angles: `%APPDATA%\FACA3D\dobras\<doc>-<chave>.json` via ExtendScript `faca3dSalvarDobras`/`Ler`/`Apagar`; key = `engine.chaveDobra(res)` (doc + 8-hex geometry signature).

## Test-sensitive state

- `.mjs` suites run under Node by importing `../js/core/*.js` into a `globalThis.window` shim; they are pure geometry, no Illustrator needed.
- `.js` suites run in the live panel and depend on document/state; reload panel before each. Do not run them headless.

## References

- `documentacao/FACA_3D_REPORT_BASE_FIXA.md`, `..._DOBRAS_SALVAS.md` for base-fixed and saved-angles details. Other reports in `documentacao/` are historical; trust code + tests over prose.