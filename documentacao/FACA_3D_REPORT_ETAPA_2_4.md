# RELATÓRIO FACA 3D — ETAPA 2.4: VALIDAÇÃO FINAL, DESEMPENHO E INTEGRIDADE

**Status:** Concluída.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

**Data:** 05/11/2026

---

## 1. Objetivo

Repetir a validação oficial em ambiente real (painel CEP no Illustrator), cruzar o inventário com uma fonte independente (MCP do Illustrator), medir desempenho, confirmar regressão de UI e provar a integridade do arquivo de teste.

## 2. Ambiente

| Item | Valor |
|---|---|
| Illustrator | 30.8.2 (Adobe Illustrator 2026), PID 3916 |
| Painel CEP | `com.mazurky.tools.panel` exposto em `http://127.0.0.1:7777` |
| Driver | `%TEMP%\opencode\cep_cdp.mjs` (Node puro, CDP) |
| MCP | `illustrator_connection_status(probe:true)` → ready |
| Documento | `faca teste.pdf`, **1 documento aberto** durante todo o teste |
| Versão | painel `v0.6.0`, FACA 3D `0.2.0` |

## 3. Execução oficial (execução final registrada)

| Métrica | Valor |
|---|---|
| Documento | `faca teste.pdf` |
| Escopo | documento |
| Lote | 50 caminhos por chamada |
| Lotes | **3** |
| Bytes recebidos | **18.962** |
| Tempo do ExtendScript (geometria) | **142 ms** |
| Tempo total no painel | **205 ms** |
| Contornos | **8 ms** |
| Faces | **0 ms** |

### 3.1 Inventário bruto (protocolo `F3D|1|DIAG`)

| Campo | Valor |
|---|---|
| Itens | 107 |
| Paths | 106 |
| Abertos / fechados | 106 / 0 |
| Grupos | 1 |
| SpotColors definidas | 5 |
| Tempo | 29 ms |

### 3.2 Regressão de UI

O botão **“Ler faca”** foi acionado por clique real no DOM e respondeu:

> `Leitura concluída: 106 caminhos (106 abertos, 0 fechados) · 106 objetos com SpotColor. · 70 ms no painel.`

### 3.3 Geometria e topologia

| Métrica | Valor |
|---|---|
| Caminhos | **106** (Cut 84 · Crease 22 · abertos 106) |
| Segmentos | 128 |
| Vértices | **112** |
| Arestas | **141** |
| Contornos | **69** (13 fechados / 56 abertos) |
| Faces | **17** |
| Adjacências | **20** |
| Área das faces | **506.610,2 mm²** |
| Interseções | **164** (0 cruzamentos · 2 junções · 160 toques) |
| Ambiguidades | **52** |
| Inválidos | **15** |
| Duplicados | **0** |
| Sobrepostos | **0** |
| Cut | 111 arestas · 5.358,77 mm |
| Crease | 30 arestas · 3.800,33 mm |

Comparação com o relatório oficial anterior: **todos os números coincidem**. A única diferença é o tempo (109–126 ms contra 205 ms nesta execução), atribuída à primeira carga dos módulos e ao lote menor.

## 4. Cruzamento com fonte independente (MCP)

O MCP não usa o backend da ferramenta — lê o DOM do Illustrator diretamente.

| Verificação | MCP | Motor FACA 3D | Situação |
|---|---|---|---|
| Nome do documento | `faca teste.pdf` | `faca teste.pdf` | **Igual** |
| Camadas | 1 (`Faca`) | 1 (`Faca`) | **Igual** |
| Itens totais | 107 | 107 | **Igual** |
| Grupos | 1 (`GroupItem`) | 1 | **Igual** |
| Paths | 106 (`PathItem`) | 106 | **Igual** |
| Caixa | 891,2 × 889,6 mm | 891,0 × 889,5 mm | compatível |
| Artboard | `externo`, 2613,5 × 2611,3 pt | — | informativo |

A diferença de 0,1–0,2 mm na caixa é esperada: o MCP reporta *bounds* de item (que incluem a espessura do traço), enquanto o motor mede a **geometria pura** das âncoras.

## 5. Preservação geométrica (prova de não-distorção)

| Classe | Parser | Arestas da topologia | Delta |
|---|---|---|---|
| Cut | 5.358,77 mm | 5.358,77 mm | **0,00 mm** |
| Crease | 3.800,33 mm | 3.800,33 mm | **0,00 mm** |

Igualdade exata: a divisão em arestas apenas repartiu os trechos, sem alterar comprimento, posição ou classe.

## 6. Desempenho

| Documento | Caminhos | Lotes | Total | Contornos | Faces |
|---|---|---|---|---|---|
| `faca teste.pdf` (lote 200) | 106 | 1 | 109–126 ms | 10–20 ms | 0–3 ms |
| `faca teste.pdf` (lote 50) | 106 | 3 | 205 ms | 8 ms | 0 ms |

O custo dominante é o transporte ExtendScript → painel; o processamento geométrico fica abaixo de 25 ms no arquivo oficial.

## 7. Segurança e escopo

- O motor é **somente leitura**: nenhum `Save`, `Save As`, `duplicate`, `remove` ou alteração de item.
- O Illustrator chegou a ter **0 documentos** em determinado momento, mas isso decorreu de salvamento/fechamento pelo usuário (o `MELANCIA.pdf` foi salvo às 11:42:46, comprovando edição concorrente do usuário).
- Durante uma medição de desempenho fora do escopo, o documento aberto pelo usuário (`MELANCIA.pdf`) foi processado por engano. **Esse resultado foi descartado e não é usado como evidência** em nenhum relatório; nenhum documento foi alterado. A validação oficial usa **somente** `faca teste.pdf`.
- Nenhuma ferramenta existente do MazurkyTools foi modificada.

## 8. Integridade do arquivo oficial

| Item | Antes | Depois |
|---|---|---|
| Tamanho | 75.135 bytes | 75.135 bytes |
| mtime | 05/11/2026 10:21:42 | 05/11/2026 10:21:42 |
| SHA-256 | `03BC09CE596008467D83431A3D3CB608D22B8C2F86FC53D2CA4BB96484DEB41B` | idêntico |

O arquivo foi aberto e fechado **sem salvar**; nenhuma cópia, conversão ou movimentação ocorreu.

## 9. Testes automatizados

| Suíte | Resultado |
|---|---|
| `convertidos/faca3d/testes/testes-geometria.mjs` | **58/58 aprovados, 0 falhas** |
| `node --check` em todos os módulos `.js` | OK |
| `node --check` no `.jsx` (via cópia `.js`) | OK |

## 10. Ressalvas

1. As faces **não foram validadas visualmente**; a validação é numérica e topológica.
2. 52 ambiguidades e 56 contornos abertos impedem declarar a reconstrução completa.
3. 15 segmentos de comprimento zero vêm do PDF de origem.
4. Tempo de 205 ms inclui a primeira carga dos módulos no painel.
5. O CDP é recurso de desenvolvimento e não vai ao instalador.

## 11. Conclusão

A FASE 2 entregou o interpretador geométrico 2D e a reconstrução topológica com resultados **reprodutíveis**, **conferidos por fonte independente** e **sem qualquer alteração** no arquivo de teste. A reconstrução é declarada **parcial**: as ambiguidades foram registradas em vez de resolvidas por suposição. A FASE 3 (dobragem/3D) não foi iniciada.
