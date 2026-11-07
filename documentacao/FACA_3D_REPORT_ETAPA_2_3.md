# RELATÓRIO FACA 3D — ETAPA 2.3: FACES E TOPOLOGIA CONSOLIDADA

**Status:** Concluída com ressalvas registradas (reconstrução **parcial**, não integral).

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

**Data:** 05/11/2026

---

## 1. Objetivo

Converter o grafo de contornos em uma **representação topológica única e independente de renderer**: vértices, arestas, contornos, faces, adjacências entre faces, regiões abertas, ambiguidades e erros — sem recalcular geometria e sem escolher ramos em junções.

## 2. Módulos

| Arquivo | Responsabilidade |
|---|---|
| `js/core/face-detector.js` | meias-arestas, faces e adjacências |
| `js/core/topology.js` | consolidação e resumo |
| `js/core/geometry-engine.js` | orquestração, tempos e `resumoTexto` |

## 3. Algoritmo de faces

1. Cada aresta gera **duas meias-arestas** (`id = aresta*2` e `aresta*2+1`), com a oposta preenchida.
2. Em cada vértice, as meias-arestas de saída são ordenadas por **ângulo** (anti-horário).
3. A próxima meia-aresta é a **imediatamente anterior (horária)** à oposta na ordenação angular — caminhada clássica de faces planares.
4. Faces fechadas têm **área assinada positiva**; a face externa tem área negativa.
5. A face externa é a de **maior área negativa**; as demais viram faces internas e são reindexadas.
6. Cadeias que não fecham ou com área abaixo de `areaMinMm2` vão para `regioesAbertas` com motivo (`nao-fechou` / `area-degenerada`) — nunca viram face.
7. **Adjacência** = aresta compartilhada por duas faces internas; o par é registrado uma única vez com a lista de arestas e a contagem por classe.

Consequências do método:

- Não pressupõe caixas retangulares nem eixos alinhados.
- Arestas “penduradas” (grau 1) não geram face artificial.
- O resultado é puramente topológico: o mesmo objeto serve a qualquer renderer.

## 4. Resultado no arquivo oficial

### 4.1 Estrutura

| Métrica | Valor |
|---|---|
| Vértices | **112** |
| Arestas | **141** |
| Contornos | **69** (13 fechados / 56 abertos) |
| Faces internas | **17** |
| Adjacências entre faces | **20** |
| Regiões abertas | **56** (coerente com os contornos abertos) |
| Área somada das faces | **506.610,16 mm²** |
| Face externa | presente (área negativa, descartada da soma) |

### 4.2 Classes nas arestas

| Classe | Arestas | Comprimento |
|---|---|---|
| Cut | 111 | 5.358,77 mm |
| Crease | 30 | 3.800,33 mm |
| Other | 0 | 0 |
| Unknown | 0 | 0 |

### 4.3 Distribuição de grau

| Grau | Vértices |
|---|---|
| 1 (extremidade solta) | 4 |
| 2 (continuação) | 72 |
| 3 (junção ambígua) | 36 |

Não há vértices de grau 4 ou mais no arquivo oficial — consistente com **zero cruzamentos reais**.

### 4.4 Faces — amostra

| Face | Área (mm²) | Perímetro (mm) | Lados | Cut | Crease |
|---|---|---|---|---|---|
| 0 | 79.781,01 | 817 | 6 | 2 | 4 |

Faixa de áreas: **480,00 mm²** (menor) até **101.331,1 mm²** (maior). As maiores: 101.331,1 · 80.952,0 · 79.781,0.

### 4.5 Adjacências — amostra

| Par | Arestas compartilhadas | Classes |
|---|---|---|
| 0 ↔ 1 | 3 | crease: 3 |

Ou seja: a adjacência entre as duas primeiras faces se dá **por vinco**, que é exatamente a relação necessária para a futura dobragem 3D.

## 5. Interpretação

- As faces são **regiões fechadas do desenho da faca**, não “faces 3D”.
- Uma adjacência por `crease` significa que as duas regiões compartilham uma linha de vinco — candidata natural a aresta de dobradiça.
- Uma adjacência por `cut` indicaria duas regiões separadas por corte (não ligadas fisicamente).
- **17 faces com 20 adjacências** é uma contagem plausível, mas **não foi validada visualmente** nesta fase. A validação foi numérica: fechamento, área, perímetro, adjacência e coerência com os graus.

## 6. O que NÃO foi feito (por decisão de escopo)

- Não houve escolha de ramo em vértices de grau 3: **52 ambiguidades** ficaram registradas e os contornos param ali.
- Não houve união de segmentos por proximidade para “fechar” regiões.
- Não houve remoção de duplicados/sobrepostos: apenas detecção (0 duplicados, 0 sobrepostos neste arquivo).
- Não houve montagem 3D, dobra, animação ou simulação.
- Não houve validação visual das faces (renderer 3D é FASE 3+).

## 7. Critério de honestidade do resultado

A reconstrução **não pode ser declarada completa**:

- 56 contornos abertos e 52 ambiguidades significam que parte da rede não admite caminhada única.
- 15 segmentos inválidos (comprimento zero) existem no PDF de origem e foram preservados como diagnóstico.
- As 17 faces são as regiões **inequivocamente fechadas**; regiões que dependem de resolução de junção ficaram de fora por decisão explícita.

Isso é o comportamento correto: reportar a ambiguidade em vez de inventar topologia.

## 8. Verificações

- 58/58 testes unitários (inclui “linha aberta não gera face”, “1 face em quadrado”, “arestas preservam caminho”, “sem dependência de renderer”).
- Execução real no painel CEP com o arquivo oficial.
- Soma de áreas e contagem de adjacências coerentes com o grafo.
- `JSON.stringify(topologia)` funciona (142.804 bytes no arquivo oficial) — a estrutura é serializável e sem ciclos.

## 9. Tempo

| Etapa | Tempo |
|---|---|
| Contornos | 8–20 ms |
| Faces | 0–3 ms |
| Total (com ExtendScript) | 109–126 ms |

## 10. Conclusão da etapa

A topologia consolidada existe, é serializável, independente de renderer e preserva integralmente a geometria de entrada (comprimentos idênticos aos do parser). As faces são detectadas por um método planar clássico e as adjacências por vinco estão disponíveis para a FASE 3 — mas a reconstrução permanece **parcial e declarada como tal**, devido às 52 ambiguidades e aos 56 contornos abertos.
