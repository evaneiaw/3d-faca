# RELATÓRIO FACA 3D — ETAPA 2.1: INSPEÇÃO GEOMÉTRICA DOS PATHS

**Status:** Concluída.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

**Data:** 05/11/2026

---

## 1. Objetivo

Extrair a geometria real das linhas da faca — âncoras, handles Bézier, segmentos retos e curvos, direção, abertura/fechamento, unidades e classificação — sem perder informação e sem alterar o documento.

## 2. Onde foi implementado

| Camada | Arquivo | Função |
|---|---|---|
| ExtendScript (extração bruta) | `jsx/faca3d.jsx` | `faca3dGeometria(escopo, inicio, fim)` |
| Protocolo | já existente (`F3D\|1\|...`) + tipo `GEO` | transporte textual versionado |
| Parser | `js/core/path-parser.js` | decodifica, converte e associa |
| Utilitários | `js/core/geometry-utils.js` | pt→mm, Bézier, interseções, bbox |

O `jsx/host.jsx` **não foi alterado**: o painel chama a função pelo `chamar()` genérico do host, que já existe. Isso evita reiniciar o Illustrator (e fechar documentos do usuário).

## 3. Protocolo GEO

```
F3D|1|GEO
ESCOPO=documento
TOTAL=106
INICIO=0
FIM=106
ESCALA_COORD=10000
DOC_NOME=...
DOC_CAMINHO=...
DOC_SALVO=sim
P=indice <TAB> classe <TAB> spot <TAB> fechado <TAB> nPontos <TAB> camada <TAB> pai
A=indice <TAB> ponto <TAB> AX <TAB> AY <TAB> LX <TAB> LY <TAB> RX <TAB> RY
TEMPO_MS=...
END
```

Decisões:

- **Coordenadas em inteiros de 1/10000 pt** (`ESCALA_COORD=10000`). Evita separador decimal dependente de locale no ExtendScript e mantém precisão de 0,0001 pt (≈ 0,000035 mm).
- **Paginação** (`inicio`/`fim`, 0-based, fim exclusivo) para não estourar o limite do `evalScript` em documentos grandes.
- `P` traz a **classificação** (`cut`, `crease`, `other`, `unknown`) derivada do nome da SpotColor (Cut/Corte → cut; Crease/Vinco → crease).
- `A` traz **âncora, handle esquerdo e handle direito** de cada ponto.
- A ordem dos pontos é a ordem do caminho no Illustrator — a **direção é preservada**.
- Valores textuais passam pelo escape do protocolo; TAB é removido dos nomes.

## 4. O que o parser entrega

Para cada caminho:

- índice, classe, nome do spot, camada, tipo do pai (`PathItem`, `GroupItem`, `CompoundPathItem`, `Selection`), aberto/fechado;
- pontos com coordenadas em **pt** (originais) e em **mm normalizados**;
- handles em pt e mm;
- segmentos com `p0`, `c1` (handle direito da origem), `c2` (handle esquerdo do destino), `p3`, tipo (`reta`/`curva`), comprimento, caminho de origem e classificação;
- caminhos fechados recebem o segmento de fechamento (último → primeiro).

### Sistema de coordenadas normalizado

- milímetros;
- eixo Y para cima (igual ao Illustrator);
- origem no canto inferior esquerdo da caixa delimitadora do conjunto;
- as coordenadas em pt permanecem intactas para auditoria.

### Reta × curva

Um segmento é **reto** quando o handle direito da origem coincide com a âncora de origem **e** o handle esquerdo do destino coincide com a âncora de destino, dentro de `retaMm` (padrão 0,001 mm). Caso contrário é **curva**. O comprimento de curvas é medido pelo achatamento adaptativo com erro máximo `curvaMm` (padrão 0,02 mm).

## 5. Resultado no arquivo oficial

| Métrica | Valor |
|---|---|
| Caminhos | **106** |
| Segmentos | **128** |
| Pontos (âncoras) | **234** |
| Segmentos retos | **108** |
| Segmentos curvos | **20** |
| Caminhos Cut | **84** |
| Caminhos Crease | **22** |
| Caminhos abertos / fechados | **106 / 0** |
| Caixa delimitadora | **891,0 × 889,5 mm** |
| Comprimento Cut | **5.358,77 mm** |
| Comprimento Crease | **3.800,33 mm** |
| Resposta do ExtendScript | **18.602 bytes**, 1 lote |
| Tempo de extração (ExtendScript) | **56 ms** |

Nenhuma coordenada foi perdida: os comprimentos calculados no parser são idênticos aos somados nas arestas da topologia (ver ETAPA 2.2/2.4).

## 6. Verificações

- `node --check` em todos os módulos JS e no `.jsx` (copiado para `.js`).
- Testes unitários do parser: decodificação, classificação, direção, fechamento, reta/curva, pt→mm, rebase de lotes.
- Execução real no painel CEP (CDP) com o arquivo oficial.

## 7. Limitações

- O ExtendScript devolve a geometria em lotes; o motor junta e rebaseia. Em documentos muito grandes o número de lotes cresce (a resposta de 106 caminhos coube em 1 lote de 200).
- Textos, imagens e caminhos compostos não são geometria de faca e não entram no grafo (apenas `PathItem`, inclusive os internos de `CompoundPathItem`).
- Segmentos de comprimento zero existentes no PDF são preservados no parser e marcados como inválidos no grafo.
