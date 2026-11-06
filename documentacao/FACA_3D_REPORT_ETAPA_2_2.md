# RELATÓRIO FACA 3D — ETAPA 2.2: RECONSTRUÇÃO DOS CONTORNOS

**Status:** Concluída.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

**Data:** 05/11/2026

---

## 1. Objetivo

Reconstruir contornos a partir dos segmentos, detectando extremidades coincidentes, interseções, conexões, duplicados, sobreposições, ambiguidades e geometrias inválidas — sem alterar a geometria original.

## 2. Módulo

`convertidos/faca3d/js/core/contour-builder.js`

Pipeline:

1. **Achatamento** de cada curva Bézier por subdivisão adaptativa (erro ≤ `curvaMm`).
2. **Índice espacial** (grade adaptativa) para comparar apenas arestas próximas — evita O(n²).
3. **Interseções** entre arestas, com agrupamento por par de segmentos e por proximidade.
4. **Divisão** dos segmentos nos pontos de interseção (cada trecho guarda `segmento de origem` + intervalo `t0..t1`).
5. **Agrupamento de extremidades** em vértices (tolerância de junção).
6. **Duplicados e sobrepostos**.
7. **Contornos** por caminhada no grafo.
8. **Auto-interseções** de contornos fechados (diagnóstico).

## 3. Tolerâncias (explícitas e configuráveis)

Definidas em `Faca3D.geometry.utils.TOLERANCIAS` e aceitas como opção em todo o pipeline. Não há valor escondido no código.

| Tolerância | Padrão | Uso |
|---|---|---|
| `juncaoMm` | 0,05 mm | extremidades a menos disso viram o mesmo vértice |
| `retaMm` | 0,001 mm | handle coincidente com âncora = segmento reto |
| `curvaMm` | 0,02 mm | erro máximo do achatamento da Bézier |
| `intersecaoMm` | 0,01 mm | folga para considerar interseção |
| `areaMinMm2` | 0,01 mm² | faces menores são descartadas |
| `anguloMaxGraus` | 35° | reservado para análise de continuidade (não usado para unir) |

O controle **Tolerância (mm)** já existente no painel corresponde a `juncaoMm`. A configuração do motor aceita os demais valores por opção.

## 4. Política de junção (decisão deliberada)

- **Vértice de grau 2:** continuação inequívoca — o contorno segue.
- **Vértice de grau > 2:** o contorno **para** e a ambiguidade é registrada. Nunca se escolhe um ramo "no chute".
- **Duplicados:** identificados e contabilizados; a geometria não é removida nem fundida.
- **Sobreposição colinear:** identificada e registrada, sem corte arbitrário.

## 5. Resultado no arquivo oficial

| Métrica | Valor |
|---|---|
| Vértices | **112** |
| Arestas (após divisões) | **141** |
| Contornos | **69** |
| — fechados | **13** |
| — abertos | **56** |
| Interseções | **164** |
| — cruzamentos reais (X no interior) | **0** |
| — junções em T | **2** |
| — toques de extremidade | **160** |
| — sobreposições | **2** |
| Duplicados | **0** |
| Sobrepostos reportados | **0** (as 2 sobreposições são colineares pontuais) |
| Ambiguidades (grau > 2) | **52** |
| Inválidos | **15** (segmentos de comprimento zero existentes no PDF) |
| Distribuição de grau | grau 1: 4 · grau 2: 72 · grau 3: 36 |

Tempo: **10–18 ms** para os 128 segmentos.

## 6. Verificação de preservação geométrica

| Classe | Comprimento no parser | Comprimento nas arestas |
|---|---|---|
| Cut | 5.358,77 mm | 5.358,77 mm |
| Crease | 3.800,33 mm | 3.800,33 mm |

A igualdade exata mostra que a divisão em arestas **não alterou** a geometria: apenas repartiu os mesmos trechos.

## 7. Defeito encontrado e corrigido nesta etapa

A primeira execução reportou **464 interseções** e **441 arestas**, mas a distribuição de graus não mostrava vértices de grau 4 — sinal de inconsistência.

Causa: no achatamento de uma curva, arestas **vizinhas** da mesma polilinha compartilham um vértice. Esse vértice era contado como interseção e classificado como "cruzamento", inflando o total (7.529 eventos falsos no diagnóstico).

Correção:

1. ignorar pares de arestas vizinhas do mesmo segmento (`|k1 − k2| ≤ 1`);
2. agrupar interseções **por par de segmentos + proximidade** (um evento por ponto);
3. reclassificar em **toque / junção / cruzamento** pela distância às extremidades do segmento inteiro.

Depois da correção: **164 interseções, 0 cruzamentos reais, 141 arestas, 112 vértices** — coerente com os graus observados.

## 8. Contornos fechados

13 contornos fechados, com áreas entre 480 mm² e 101.331 mm². Eles vêm tanto de caminhos fechados do PDF quanto de cadeias de caminhos abertos cujas extremidades coincidem dentro da tolerância.

## 9. Limitações

- Contornos param em junções (grau > 2); isso é intencional e está registrado como ambiguidade.
- 15 segmentos de comprimento zero são inválidos por natureza do PDF; não entram no grafo.
- Interseções de curvas usam o achatamento (erro ≤ 0,02 mm); não há solver analítico de Bézier×Bézier.
- Não há remoção automática de duplicados/sobrepostos — apenas detecção, para não alterar a geometria.
