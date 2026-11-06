# FACA 3D — RELATÓRIO DE AUDITORIA DAS DOBRADIÇAS

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`

> **Atualização 0.7.1:** esta auditoria (0.5.0) identificou 7 vincos sem articulação. Na revisão 0.7.x, as abas V10/V11/V18/V20 passaram a ser faces (correção da interseção em “T”) e o anel V0/V2/V4 foi dividido nos bicos em três painéis. **Os 22 vincos agora dobram.** Ver `FACA_3D_REPORT_REVISAO_DOBRAGEM.md`.

**Data:** 05/11/2026

**Versão funcional preservada:** `0.4.0` (backup em `documentacao/backup/0.4.0/`)

**Versão desta entrega:** `0.5.0` (Structural Line Resolver + diagnóstico)

---

## 1. Resumo executivo

Os 22 objetos classificados como **Crease** foram inventariados individualmente e acompanhados por toda a cadeia (extração → classificação → parser → contornos → faces → associação → eixo → hierarquia → animação).

Resultado:

| Situação | Quantidade | Paths |
|---|---|---|
| **Dobram** (dobradiça estrutural com eixo único) | **15** | V1, V3, V5, V6, V7, V8, V9, V12, V13, V14, V15, V16, V17, V19, V21 |
| **Rígidos** (3 linhas estruturais formam o “U” entre as faces 0–1) | **3** | V0, V2, V4 |
| **Sem par de faces** (borda livre do material) | **4** | V10, V11, V18, V20 |

Não houve vinco descartado por tolerância, vinco curvo, nem vinco associado a mais de duas faces neste arquivo.

A montagem 3D foi preservada: **13 de 17 faces**, **11 dobradiças**, **1 ligação rígida**, **0 cruzamentos** entre faces em 0°, 45°, 90° e 180°.

A novidade é o **Structural Line Resolver**: 22 segmentos de vinco foram reorganizados em **18 linhas estruturais**, com **4 conexões virtuais** (lacunas de 60 mm ocupadas por recortes), **8 extensões virtuais** até corte/vinco e **22 conexões rejeitadas** por ambiguidade, desalinhamento, angulação ou cruzamento.

## 2. Preservação da versão funcional

Antes de qualquer alteração, os arquivos do motor 3D 0.4.0 foram copiados para:

`convertidos/faca3d/documentacao/backup/0.4.0/`

Com hashes em `VERSION-0.4.0.txt`. O PDF original não foi tocado (75.135 bytes, SHA-256 `03BC09CE…DEB41B`). Nenhuma outra ferramenta do MazurkyTools foi alterada.

## 3. Três representações separadas

| Representação | Onde vive | O que contém |
|---|---|---|
| **1. Geometria original** | `geometria` (parser) | anchors, handles, segmentos e classes exatamente como vieram do Illustrator. Nunca é alterada. |
| **2. Geometria estrutural** | `estrutural` (novo resolvedor) | linhas contínuas virtuais: fusões de lacunas, extensões até cortes, justificativas e rejeições. Não grava nada no documento. |
| **3. Eixos de dobradiça** | `montagem.pares` | eixo efetivamente usado pelo 3D, derivado de UMA linha estrutural. Se houver mais de uma linha entre o mesmo par de faces, não há eixo único. |

## 4. Structural Line Resolver

### 4.1 Regras aplicadas

- Só entram segmentos de vinco **retos** (curvas ficam fora da continuidade).
- Colinearidade: diferença angular ≤ **2°**.
- Desalinhamento máximo: **0,356 mm** (proporcional à escala; impede juntar paralelas deslocadas).
- Lacuna pequena: até **7,13 mm**.
- Lacuna grande: até **106,9 mm**, somente se os dois trechos compartilham **o mesmo par de faces** (evidência de que a lacuna é um recorte interno, não uma separação).
- A ponte virtual não pode cruzar um **corte** nem outra linha de vinco.
- Extensão de ponta: até **7,13 mm** até um corte ou outro vinco, com ângulo ≥ 10°.
- Duas conexões possíveis com lacunas equivalentes e direções diferentes → **ambiguidade**, ambas rejeitadas.
- Tolerâncias proporcionais à escala do documento e configuráveis (`tolerancias(escala, extra)`).

### 4.2 Resultado no arquivo oficial

| Item | Valor |
|---|---|
| Segmentos de vinco retos | 22 |
| Linhas estruturais | **18** |
| Conexões virtuais | **4** (2 em L5 e 2 em L11, lacunas de 60 mm) |
| Extensões virtuais | **8** |
| Conexões rejeitadas | **22** |
| Linhas com mais de um path | L5 (V5/6/7) e L11 (V13/14/15) |
| Linhas de face única | L8 (V10), L9 (V11), L14 (V18), L16 (V20) |

As 4 conexões virtuais recuperam a continuidade dos vincos **interrompidos pelos recortes 13/14 e 15/16**: os trechos são colineares, compartilham o mesmo par de faces e a lacuna é interna ao material.

As 8 extensões aproximam pontas de cortes/vinco sem alterar a geometria: V0/V4 (2 mm), V12 (6 mm em cada ponta), V18/V20 (4,456 mm), V21 (3 mm em cada ponta).

As 22 rejeições incluem 13 encontros perpendiculares (T), 5 paralelas deslocadas (3–8 mm) e 4 lacunas grandes sem o mesmo par de faces. Nenhuma foi usada para inventar dobradiça.

## 5. Auditoria individual dos 22 vincos

Legenda de categoria:

- **A** — reconhecido e dobrável.
- **B** — reconhecido, mas sem associação entre duas faces.
- **C** — associado, mas sem eixo válido.
- **D** — curvo/composto que exige tratamento especial.
- **E** — descartado por tolerância.
- **F** — interpretado como corte/conexão rígida.
- **G** — dobra no sentido incorreto.
- **H** — não pode virar dobradiça independente pela geometria.

| Path | Seg. | Comp. (mm) | Início → fim (mm) | Tipo | Faces | Linha | Conexões | Extensões | Status (cat.) | Motivo |
|---|---|---|---|---|---|---|---|---|---|---|
| V0 | 1 | 245,0 | (284,0; 756,0) → (284,0; 511,0) | reto | 0,1 | L0 | — | 2 mm → corte | RÍGIDA (H/F) | 3 linhas estruturais entre 0–1 (U); sem eixo único |
| V1 | 1 | 128,2 | (613,0; 759,3) → (613,0; 887,5) | reto | 1,2 | L1 | — | — | DOBRA (A) | linha L1 contínua; eixo único |
| V2 | 1 | 323,0 | (284,0; 756,0) → (607,0; 756,0) | reto | 0,1 | L2 | — | — | RÍGIDA (H/F) | 3 linhas estruturais entre 0–1 (U); sem eixo único |
| V3 | 1 | 128,2 | (278,0; 887,5) → (278,0; 759,3) | reto | 1,3 | L3 | — | — | DOBRA (A) | linha L3 contínua; eixo único |
| V4 | 1 | 245,0 | (607,0; 756,0) → (607,0; 511,0) | reto | 0,1 | L4 | — | 2 mm → corte | RÍGIDA (H/F) | 3 linhas estruturais entre 0–1 (U); sem eixo único |
| V5 | 1 | 60,0 | (616,0; 224,5) → (616,0; 284,5) | reto | 4,5 | L5 | 60 mm recorte; 60 mm recorte | — | DOBRA (A/D) | linha L5 contínua; 2 pontes virtuais |
| V6 | 1 | 32,5 | (616,0; 344,5) → (616,0; 377,0) | reto | 4,5 | L5 | idem | — | DOBRA (A/D) | idem |
| V7 | 1 | 32,5 | (616,0; 132,0) → (616,0; 164,5) | reto | 4,5 | L5 | idem | — | DOBRA (A/D) | idem |
| V8 | 1 | 240,0 | (757,0; 134,5) → (757,0; 374,5) | reto | 6,7 | L6 | — | — | DOBRA (A) | linha L6 contínua; eixo único |
| V9 | 1 | 245,0 | (749,0; 377,0) → (749,0; 132,0) | reto | 5,6 | L7 | — | — | DOBRA (A) | linha L7 contínua; eixo único |
| V10 | 1 | 131,0 | (610,0; 2,0) → (610,0; 133,0) | reto | 8 | L8 | — | — | SEM PAR (B) | só uma face; borda livre |
| V11 | 1 | 131,0 | (281,0; 133,0) → (281,0; 2,0) | reto | 8 | L9 | — | — | SEM PAR (B) | só uma face; borda livre |
| V12 | 1 | 329,0 | (610,0; 133,0) → (281,0; 133,0) | reto | 4,8 | L10 | — | 6 mm → vinco 7; 6 mm → vinco 15 | DOBRA (A) | linha L10 contínua; eixo único |
| V13 | 1 | 60,0 | (275,0; 224,5) → (275,0; 284,5) | reto | 4,9 | L11 | 60 mm recorte; 60 mm recorte | — | DOBRA (A/D) | linha L11 contínua; 2 pontes virtuais |
| V14 | 1 | 32,5 | (275,0; 344,5) → (275,0; 377,0) | reto | 4,9 | L11 | idem | — | DOBRA (A/D) | idem |
| V15 | 1 | 32,5 | (275,0; 132,0) → (275,0; 164,5) | reto | 4,9 | L11 | idem | — | DOBRA (A/D) | idem |
| V16 | 1 | 240,0 | (134,0; 134,5) → (134,0; 374,5) | reto | 10,11 | L12 | — | — | DOBRA (A) | linha L12 contínua; eixo único |
| V17 | 1 | 245,0 | (142,0; 377,0) → (142,0; 132,0) | reto | 9,11 | L13 | — | — | DOBRA (A) | linha L13 contínua; eixo único |
| V18 | 1 | 131,0 | (278,0; 507,0) → (278,0; 376,0) | reto | 12 | L14 | — | 4,456 mm → corte | SEM PAR (B) | só uma face; extensão não cria segunda face |
| V19 | 1 | 323,0 | (607,0; 509,0) → (284,0; 509,0) | reto | 0,12 | L15 | — | — | DOBRA (A) | linha L15 contínua; eixo único |
| V20 | 1 | 131,0 | (613,0; 376,0) → (613,0; 507,0) | reto | 12 | L16 | — | 4,456 mm → corte | SEM PAR (B) | só uma face; extensão não cria segunda face |
| V21 | 1 | 335,0 | (278,0; 376,0) → (613,0; 376,0) | reto | 4,12 | L17 | — | 3 mm → vinco 14; 3 mm → vinco 6 | DOBRA (A) | linha L17 contínua; eixo único |

### 5.1 Contagem por categoria

| Categoria | Paths | Quantidade |
|---|---|---|
| A — dobra | V1, V3, V5, V6, V7, V8, V9, V12, V13, V14, V15, V16, V17, V19, V21 | 15 |
| B — sem par de faces | V10, V11, V18, V20 | 4 |
| C — sem eixo válido | — | 0 |
| D — composto (tratado) | V5/6/7 e V13/14/15 (2 linhas) | 6 paths em 2 linhas |
| E — descartado por tolerância | — | 0 |
| F — rigidez | V0, V2, V4 | 3 |
| G — sentido incorreto | — (nenhum detectado nos testes) | 0 |
| H — não pode ser dobradiça independente | V0, V2, V4 (U) + V10, V11, V18, V20 (face única) | 7 |

Observação: um mesmo path pode aparecer em D e A (composto, mas dobrando) ou em F e H (rígido por geometria).

## 6. Antes × depois

| Aspecto | 0.4.0 (antes) | 0.5.0 (depois) |
|---|---|---|
| Eixo da dobradiça | união bruta das arestas compartilhadas | linha estrutural única |
| Vincos interrompidos (V5/6/7, V13/14/15) | agrupados pela adjacência, sem registro da lacuna | 4 pontes virtuais de 60 mm com justificativa |
| Pontas que não alcançam corte | sem tratamento | 8 extensões virtuais registradas |
| Conexões duvidosas | não avaliadas | 22 rejeições com motivo e ponto |
| Auditoria por path | inexistente | 22 registros com status e motivo |
| Diagnóstico visual | só a montagem 3D | faces, vincos por status, eixos, pontes, extensões e rejeições |
| Faces montadas | 13 | 13 |
| Dobradiças / rigidez | 11 / 1 | 11 / 1 |
| Cruzamentos a 0/45/90/180° | 0 | 0 |
| Testes | 58 | 58 + 28 + 26 |

A montagem **não mudou de resultado** porque os eixos estruturais coincidem com os melhores eixos anteriores. O que mudou é a **comprovação**: agora cada decisão tem linha, lacuna, extensão, rejeição e motivo.

## 7. Defeitos encontrados e correções

1. **Paralelas deslocadas eram unidas.** V18 estava a 3 mm de V13 e foi fundido por proximidade. A projeção foi apertada de 4,455 mm para 0,356 mm; V18/V20 voltaram a ser linhas próprias. Evidência: rejeição `desalinhado` com `proj=3`.
2. **Ligações redundantes.** Três segmentos colineares geravam uma ponte direta além das duas pontes necessárias. O resolvedor passou a manter apenas a **árvore mínima** de conexões (2 pontes, não 3).
3. **Ponte virtual atravessando corte.** O resolvedor passou a rejeitar conexões cuja ponte cruza um corte (`cruzamento-corte`) ou outra linha (`cruzamento-...`).
4. **Ponta que não alcança o corte.** Passou a gerar extensão virtual somente quando há alvo dentro da tolerância, com ângulo ≥ 10° e sem cruzar outra linha.
5. **Diagnóstico encolhia o canvas ao selecionar.** A caixa de detalhes ganhou altura fixa (78 px) para o canvas não mudar de escala entre cliques.
6. **Cache de módulos entre aberturas.** Já corrigido na 0.4.0; mantido.

## 8. Testes

### 8.1 Testes existentes (Fase 2)

`node convertidos/faca3d/testes/testes-geometria.mjs` → **58/58**.

### 8.2 Structural Line Resolver

`node convertidos/faca3d/testes/testes-estruturais.mjs` → **28/28**, cobrindo:

- vinco que termina antes de um corte;
- vinco que termina próximo de outro vinco;
- dois vincos alinhados com pequena lacuna;
- vinco composto por vários segmentos;
- pequena diferença angular;
- duas conexões possíveis (ambiguidade);
- cruzamento de corte e vinco;
- extensão que atravessaria outra linha (para na linha mais próxima);
- paralelas deslocadas (não conectar);
- lacuna grande com faces diferentes (não conectar);
- tolerâncias proporcionais;
- geometria original intacta.

### 8.3 Hierarquia, eixos, sentido e ângulos (painel real)

`convertidos/faca3d/testes/testes-3d-painel.js` via CDP → **26/26**:

- 13 faces montadas, 11 dobradiças, 1 rígida;
- 22 vincos: 15 dobram, 3 rígidos, 4 sem par;
- 18 linhas estruturais, 4 conexões, 8 extensões;
- pai sempre antes do filho na hierarquia;
- sentido definido nas 11 dobradiças;
- **eixo fixo** em 0°, 45°, 90° e 180° (erro < 1e-6);
- matrizes finitas;
- 0° plano (dz ≈ 0), 90° tridimensional (dz > 100), 180° finito;
- **0 cruzamentos** em todos os ângulos.

### 8.4 Diagnóstico visual

Cliques reais no canvas: V10 (sem par), V5 (dobra), V0 (rígido) e V1 (dobra) → detalhes corretos com linha estrutural, conexões e extensões.

## 9. Evidências

- `documentacao/evidencias/auditoria_vincos_22.json` — inventário completo dos 22 vincos, incluindo **anchors e handles Bézier** (pt e mm), arestas, faces, linha estrutural, conexões, extensões, rejeições e motivo.
- `documentacao/evidencias/auditoria_diagnostico.png` — diagnóstico visual com faces, vincos por status, pontes verdes, extensões e rejeições.
- `documentacao/evidencias/etapa3_3d_plano.png` — 0°.
- `documentacao/evidencias/etapa3_3d_dobrando.png` — 45°.
- `documentacao/evidencias/etapa3_3d_montada.png` — 90°.
- `documentacao/backup/0.4.0/` — backup da versão funcional.

## 10. Pendências e limitações

1. **V10, V11, V18, V20** são vincos sobre a **borda livre** do material: só uma face os toca. Não há segunda face para girar, então não podem ser dobradiças. V18/V20 foram estendidos virtualmente até o corte (4,456 mm), mas isso não cria uma segunda face. Se o desenho pretendia que fossem cortes, a correção é na classificação SpotColor de origem — não no motor 3D.
2. **V0, V2, V4** formam um contorno em “U” entre as faces 0–1. São três linhas estruturais retas, mas não existe um eixo único para um painel rígido. A ligação fica **rígida** e está declarada.
3. **Direção montanha/vale** continua inferida (a faca não traz essa informação). O teste de 0/45/90/180 não encontrou cruzamentos, mas a direção física pretendida pode diferir.
4. **Ângulo global** — a caixa real pode exigir 90° em paredes e 180° na tampa.
5. Os **4 recortes** ligados só por corte continuam fora da montagem.
6. **Arte ainda não é material** — suspensa até a validação desta auditoria.

## 11. Conclusão

Os 22 vincos estão contabilizados e justificados. Os 15 geometricamente dobráveis dobram com eixo estrutural contínuo; os 3 do “U” e os 4 de borda livre estão identificados e explicados, não inventados. O resolvedor recuperou as continuidades interrompidas por recortes, registrou as extensões e rejeitou 22 conexões duvidosas. A montagem permanece com 13 faces, 11 dobradiças, 0 cruzamentos em 0/45/90/180° e os 58 testes anteriores aprovados, somados a 28 testes estruturais e 26 testes de painel.
