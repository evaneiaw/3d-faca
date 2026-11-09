# FACA 3D — Relatório: bibliotecas de mapeamento (arte)

## Onde estamos hoje

- Three.js **vendored** (`js/vendor/three.min.js`, build global, ~2021) + `OrbitControls` próprio. Nada de CDN ou bundler — o CEP (CEF Chromium antigo) exige arquivo local e código sem `import`/ES modules obrigatório.
- Arte: ExtendScript exporta 1 PNG por artboard → `js/view/artes.js` cria `CanvasTexture` (anisotropy 4) → `js/view/three3d.js` faz **UV planar por face** (coordenada do documento → retângulo da artboard, com remapeamento pela caixa de conteúdo). Funciona, mas o resultado fica “colado” (sem projeção por perspectiva, sem iluminação ambiente real, sem offset/rotação por face).

## O que pesquisei (maio–jun 2026)

### 1. `three.js` atual (r187, 30/10/2026)
- Roteiro oficial: **ES modules** (`import { WebGLRenderer } from 'three/webgpu'` / `three/module`). O build global UMD (`three.min.js`) foi aposentado; painel CEP teria de carregar por `<script type="module">`/`importmap` ou empacotar localmente.
- Ganhos reais para nós: `MeshPhysicalMaterial` + PMREM/environment, sombras melhores, `SRGBColorSpace` consistente.
- Custo: reescrever o carregador (`js/core/loader.js`), trocar `OrbitControls`, retestar tudo no CEF antigo. **Não é plug-and-play.**

### 2. Projeção de textura (`three-projected-material`)
- `@lume/three-projected-material` / `marcofugaro/three-projected-material`: material que **projeta** uma textura a partir de uma câmera projetora sobre qualquer mesh (conceito do tutorial Codrops). Útil como alternativa ao UV planar: coloca a arte e ela “imprime” na caixa dobrada, com `textureScale`/`textureOffset`, `cover/contain`.
- Só ES modules na versão atual, mas o núcleo é um **ShaderMaterial curto** (vertex usa `projectionMatrixCamera * viewMatrixCamera * savedModelMatrix`) — dá para **portar o shader para dentro do `three3d.js` sem dependência nova**. É o caminho mais barato para “arte melhor no painel”.
- Requer WebGL2 na prática (a lib antiga saiu do WebGL1); no CEF do Illustrator 2026 funciona.

### 3. Embalagem / caixas (padrões)
- **3D Box Studio** (React Three Fiber + drei), **virtual-tryon-packaging** (Vue 3), **Dialine-to-3D** (React+Vite): todos são **apps com bundler** (React/Vue + Vite) — **incompatíveis com o painel CEP** (sem npm/bundler).
- O que dá para aproveitar como **padrão de UI**, sem importar o framework: textura **por face** com offset/escala/rotação/espelho por lado (já temos `orientarUv`), presets de material (papelão ondulado/kraft), exportação PNG em alta.

### 4. Atlas UV (`xatlas.js`)
- Gera UV por atlas para baking/pintura em meshes arbitrárias. Nossos painéis são **planos** (UV planar já é o certo) — WASM + worker complicam sem benefício. **Não recomendado.**

### 5. `Threepipe`
- Framework completo de viewer/editor (asset manager, pipeline, plugins). Pesado demais para um painel; exigiria bundler. **Não recomendado.**

## Recomendação para o FACA 3D (CEP)

**Não introduzir biblioteca externa.** Manter o Three.js vendored e evoluir em camadas, do mais barato ao mais caro:

1. **Qualidade do mapeamento atual** (sem lib nova):
   - `sRGB` nas texturas de arte (`texture.colorSpace = SRGBColorSpace`) — cores fiéis ao Illustrator;
   - anisotropia maior (8–16) e PNG de arte em 4K (hoje 2200 px);
   - offset/escala/rotação por face já existem via `orientarUv` — expor na UI.
2. **Projeção estilo `three-projected-material`** (shader próprio no `three3d.js`, ~150 linhas):
   - modo “projetar” que imprime a arte externa na caixa dobrada a partir de uma câmera projetora (frente), com escala/offset — ideal para provar fidelidade de impressão.
3. **Luz realista**: PMREM/`RoomEnvironment` + sombras suaves para o papelão não parecer “papel colado”.
4. **Depois**: avaliar migração do Three.js para build em módulos (r17x/r18x) — projeto separado, com testes no CEF.

## Próximo passo sugerido

Começar pelo item 1 (cores fiéis + resolução) e medir no painel com a câmera frente-esquerda. Se aprovar, portar o shader de projeção.

Fontes: three.js r187 (out/2026); GitHub `@lume/three-projected-material`, `marcofugaro/three-projected-material`, `repalash/xatlas.js`; Codrops “Playing with Texture Projection in Three.js”; 3D Box Studio / virtual-tryon-packaging (padrões de UI).
