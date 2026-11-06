# FACA 3D — Arte Externa e Arte Interna

**Data:** 2026-11-06 · **Versão:** FACA 3D 0.8.0 · painel v0.11.7
**Tipo:** nova funcionalidade (pipeline de arte); nenhuma regra de dobra alterada.

---

## 1. Objetivo

Exibir, na mesma embalagem 3D, duas artes independentes:

- **Arte externa** → faces externas da caixa.
- **Arte interna** → faces internas da caixa (visível ao olhar para dentro).

Documento com **2 artboards**: primeira = faca + arte da **frente (externa)**, segunda = faca **espelhada** + arte do **verso (interna)**.

## 2. Regra fundamental (geometria)

A faca da **primeira artboard** é a única fonte de geometria. A faca espelhada da segunda artboard **não** é lida, não é unida, não duplica faces.

```
Artboard 1 (externo)   → geometria (camada FACA)  + arte (frente)
Artboard 2 (interno)    → ignorado na geometria    + arte (verso)
                           arte extraída ignorando FACA, MIRA, CL, INFO, LOTE, COTAS, DIMENSÃO
```

Implementação: filtro `f3dFiltrarPorArtboard(…, doc, 0)` em `jsx/faca3d.jsx`
— antes de qualquer lote de paths ser enviado ao motor — recorta itens cujo
`geometricBounds` não intersecciona a artboard **1** (`f3dItemIntersectaRet`).
O mesmo filtro vale para `f3dBoundsFaca` (usada só como fallback).

## 3. Pipeline

```
Document (Illustrator)
  → faca3dArtes()          (ExtendScript puro; sem $.evalFile externo)
       — inventário: artboards (nome/rect), camadas (nome/visível/itens/técnica),
         caixa da faca, diretório temporário (%TEMP%\MazurkyTools\faca3d_arte)
  → faca3dExportarArte()   exporta 1 PNG por artboard, 2200 px no lado maior
       — esconde as camadas técnicas **só durante a exportação**;
         restaura a visibilidade no `finally` (nada foi apagado ou reordenado)
  → carregarTextura()      PNG → canvas (#f2e8d5 de fundo) → THREE.CanvasTexture
  → three3d.definirArtes() atribui mapas aos materiais interno/externo

UV por face = (ponto_documento − origem_caixa_faca) / artboard × artboard_rect
  — U (u) → esquerda→direita da artboard
  — V (v) → base→topo      lado interno segue a mesma grade
```

**Caixa da faca (origem):** o motor entrega os pontos em mm sem origem numérica
o item (rebase para a bbox dos anchors). O **`caixaPt`** absoluto em pontos é
capturado em `js/core/geometry-engine.js` (união dos `caixaPt` parciais) e
serve de offset. Assim cada face "casa" com a mesma região da arte nos dois
lados.

**Duas malhas por face:** exterior (`FrontSide`) + interior (`BackSide`), com
UVs independentes. Materiais: `arte-externa`, `arte-interna`,
`sel-arte-*` (quando selecionada) e `papel(*interno)` para sem arte.
O contorno laranja/destaque continua sobre ambos.

## 4. Interface

| Controle | Ação |
|---|---|
| **Arte** (`ambas`/`externa`/`interna`/`nenhuma`) | escolhe quais faces recebem textura |
| **Espelhar interna** | inverte U da arte interna (impressão do verso espelhada) |
| **Atualizar artes** | releitura/re-exportação |
| **Reset** | planifica a caixa (0°) e centraliza a câmera |
| **Interior** (na Vista) | câmera dentro, 72° de campo de visão |

## 5. Identificação de artboards e camadas

**Artboards** (sem distinção de caixa/acentos): `externo`, `frente`, `exterior`
→ externa; `interno`, `verso`, `interior` → interna.
Ambíguo, ausente ou mais de duas → **aviso visível na UI** e ordem do documento.

**Camadas técnicas (ignoradas/ocultadas só na exportação):**
`Faca`, `FACA`, `Facas`, `MIRA(S)`, `CL`, `INFO`, `INFORMACÃO(ES)`, `LOTE`,
`COTAS`, `COTA`, `DIMENSÃO`, `DIMENSOES`, `DIMENSÃO GERAL` (acentos removidos
antes de comparar).

**Camadas gráficas consideradas:** `Arte`, `Fundo`, `Interna` e todas as demais
que não forem técnicas.

## 6. Testes (executados em Illustrator real via harness CDP 7777)

| Suíte | Resultado |
|---|---|
| Geometria (58) | ✅ 58/58 |
| Structural Line Resolver (28) | ✅ 28/28 |
| Painel (26) | ✅ 26/26 |
| Articulações (129) | ✅ 129/129 |
| Seleção (51) | ✅ 51/51 |
| Arte externa/interna (27) | ✅ 27/27 |
| **Total** | **319/319** |

Verificações de arte: leitura dos nomes de artboard (unitário), decisão
externo/interno com acentos, UV nas 19 faces montadas, nenhum par de UV
igual ou degenerado, materiais por lado em cada modo, `espelharInterna`
inverte U apenas na arte interna, câmera interior posiciona-se no interior
do caixa.

Exportação: **0 px** da cor #FF00FF (camadas técnicas) presentes nos PNGs.

## 7. Limitações conhecidas

- **Planificado (0°):** mantém-se a orientação física de cada face (regra
  aprovada); dependendo do sentido de dobra inferido, algumas faces mostram
  o lado interno voltado para cima na planificação. A dobra não muda.
- **Arte interna não é espelhada por padrão** — o checkbox "Espelhar interna"
  cobre o caso de impressão com o verso espelhado.
- A arte é exportada em **PNG raster** (2200 px no lado maior); vetores são
  rasterizados nesse nível de resolução.
- Documento com uma artboard → arte usada como **externa**; interna fica em branco.
- Dois PDFs `Faca teste.pdf` (desktop) têm texto de arte apenas como palavra
  única ("Frente"/"Verso"); a fidelidade de **artes reais de produção** não
  foi testada porque não havia um arquivo de produção disponível (ver
  nota abaixo).

## 8. Integridade dos originais

| Arquivo | Tama‑nho | SHA‑256 |
|---|---|---|
| `C:\Users\user\Desktop\faca teste.pdf` | 100 928 B | `99C5338B4C76980761AED5CD1F9E841F2B99239212D36A469735073470A03174` |

Nenhuma camada foi apagada, renomeada, reordenada ou alterada no documento do
usuário; visibilidade ocultada durante a exportação **sempre** restaurada no
`finally`.

## 9. Evidências

`evidencias/planificada.png` · `evidencias/dobrada_frente.png` ·
`evidencias/dobrada.png` · `evidencias/interior_verso.png`

## 10. Sobre fidelidade a artes reais

O documento `Faca teste.pdf` é um **arquivo de teste**: a arte é um único
rótulo "Frente"/"Verso" (140 KiB de texto). O ponto crucial — **mapeamento de
cada painel na caixa externa e na interna** — foi validado com perfeição, mas
**artes reais de produção (painéis com meio‑tom, imagens, dimensional
complexa) ainda não foram testadas** porque não havia um arquivo de produção
com arte com 2 artboards disponível no momento da entrega.
