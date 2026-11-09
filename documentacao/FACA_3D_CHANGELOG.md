# FACA 3D — Changelog

Histórico cronológico das alterações do módulo FACA 3D. Não remover entradas.

---

## 2026-11-05 — FASE 0: auditoria e documentação inicial

**Tipo:** documentação / arquitetura (sem código de produto).

### Arquivos criados
- `documentacao/FACA_3D_PLAN.md` — objetivo, arquitetura, estrutura de arquivos, fases, dependências, decisões, critérios de conclusão.
- `documentacao/FACA_3D_STATUS.md` — etapa atual, implementado, pendente, testes, riscos, próxima etapa.
- `documentacao/FACA_3D_CHANGELOG.md` — este arquivo.
- `documentacao/FACA_3D_REPORT.md` — relatório técnico da FASE 0.

### Arquivos modificados
Nenhum. O hub (`js/main.js`), o dispatcher (`jsx/host.jsx`), o manifesto e as ferramentas existentes permanecem intactos.

---

## 2026-11-05 — FASE 1: botão e integração CEP (concluída)

**Tipo:** implementação de infraestrutura + testes de backend.

### Arquivos criados
- `faca3d.html` — interface do módulo (sem `<script>` estático; o hub remove).
- `css/faca3d.css` — estilos com prefixo `faca3d-`, padrão visual do FACA3D.
- `js/faca3d.js` — controlador único carregado pelo hub (`new Function`), inicialização, envio de diagnóstico, UI.
- `js/core/loader.js` — carregador dinâmico de submódulos com cache-buster.
- `js/core/protocol.js` — contrato textual versionado `F3D|1|...` entre JSX e JS.
- `js/core/units.js` — conversão pt/mm, formatação de duração/bytes.
- `js/view/renderer.js` — contrato do renderizador + diagnóstico de WebGL.
- `jsx/faca3d.jsx` — backend ExtendScript: inventário do documento ativo, somente leitura.

### Arquivos modificados
- `js/main.js` — registro da chave `faca3d` (`dir: "faca3d"`, `nome: "FACA 3D"`, `version: "0.1.0"`, `divisor: true`) ao final do mapa; item 19 do grid. Bump do badge `v0.5.5` no `gridHTML()`.
- `index.html` — `js/main.js?v=19` (cache-buster do hub).
- `jsx/host.jsx` — chave `faca3d: "faca3d"` no mapa de ferramentas e wrapper `faca3dDiagnostico` em `instalarWrappers()`.
- `CSXS/manifest.xml` — `ExtensionBundleVersion="0.5.5"` e `ExtensionList Version="0.5.5"`.

> Mudança em `host.jsx` exige reiniciar o Illustrator **uma vez**; depois basta fechar/reabrir a aba para refletir alterações nos demais arquivos.

### Testes executados

Todos executados com Illustrator 30.8.2 real (via COM):

| Teste | Resultado |
|---|---|
| `carregarFerramenta("faca3d")` | `ok` |
| Sem documento aberto | `F3D|1|SEM_DOC` |
| Documento com 13 itens (paths, grupo, composto, texto, oculto, travado) | `F3D|1|DIAG` com todos os campos preenchidos |
| Seleção vazia | `F3D|1|SEM_SELECAO` |
| Seleção de 1 objeto | `F3D|1|DIAG` com contagem da seleção |
| SpotColor com `\|` e `=` no nome | Nome preservado; escape `\e` funcional |
| Protocolo malformado/vazio | Erros `VAZIO`, `FORMATO`, `VERSAO`, `LINHA` lançados corretamente |
| Conversão pt/mm | OK |
| Tamanho da resposta diagnosticada | ~1 ms para documento de teste |

### Testes pendentes
- Teste de WebGL dentro do painel (`renderer.probeWebGL()`).
- Ciclo completo de abertura/fechamento da ferramenta no CEP.
- Verificação do log central `FACA 3D.log`.

---

## 2026-11-05 — FASE 1.1: validação CEP e registro do arquivo de referência

**Tipo:** validação operacional + documentação.

### Resultados

**Registro do arquivo oficial:**
- `faca teste.pdf` localizado em `C:\Users\user\Desktop\faca teste.pdf` (75,135 bytes).
- Criado `REFERENCIA_TESTE.md` com todos os detalhes.

**Teste com `faca teste.pdf` via COM:**
| Campo | Valor |
|---|---|
| Documento aberto | `faca teste.pdf` (Caminho: `C:\\Users\\user\\Desktop\\faca teste.pdf`) |
| Camadas | 1 |
| Artboards | 1 |
| SpotColor definidas | 5 (Cut, Crease e outras 3) |
| Itens | 107 |
| Paths | 106 (todos abertos, 0 fechados) |
| Grupos | 1 |
| Objetos com traço | 106 |
| Objetos com preenchimento | 0 |
| SpotCut | 84 objetos (CMYK 75/68/67/90) |
| SpotCrease | 22 objetos (CMYK 99/100/0) |
| Textos | 0 |
| Imagens | 0 |
| Tempo de leitura | 10 ms |

**Limitações:** Painel CEP indisponível via MCP (panel: down) e CDP (porta 7777 não responde). CSInterface não disponível via COM. Testes de WebGL, ciclo CEP/JSX completo e retorno ao grid requerem execução manual.

### Pendências operacionais
- Executar o teste de WebGL no painel do Illustrator.
- Validar o ciclo completo de abertura/fechamento da ferramenta no CEP.
- Confirmar que o retorno ao grid e a abertura de outra ferramenta existente funcionam sem regressão.
- Validar diagnóstico com documento aberto no painel real.

---

## 2026-11-05 — FASE 1.2: validação automática via MCP do Illustrator

**Tipo:** validação parcial via MCP — comprovação do reconhecimento do documento pelo MCP e a recriação do diagnóstico via COM+jsx.

### Resultados

| # | Teste via MCP | Método | Resultado |
|---|---|---|---|
| 1 | Conexão Illustrator | `connection_status(probe:true)` | **OK** — panel: ok, app: Adobe Illustrator 30.8.2 |
| 2 | Reconhecimento documento | `illustrator_query_items` | **OK** — `faca teste.pdf` detectado, artboard "externo" ~2613×2611pt |
| 3 | Diagnóstico backend | COM (host.jsx + faca3d.jsx) | **OK** — `F3D|1|DIAG` com 107 itens, 106 paths, 5 spots |
| 4 | Teste WebGL | Impossível | Requer execução manual no painel CEP |
| 5 | Ciclo CEP/JSX completo | Impossível | Requer execução manual no painel CEP |
| 6 | Retorno ao grid + outra ferramenta | Impossível | Requer execução manual |

### Recursos MCP utilizados
- `illustrator_connection_status` — para verificar se o painel está conectado e o Illustrator está rodando.
- `illustrator_query_items` — para verificar o documento aberto e seus elementos no Illustrator via MCP.

### Limitações apuradas pela FASE 1.2

1. As ferramentas MCP disponíveis controlam **documentos diretamente** (elementos, camadas, estrutura), mas **não interagem com a UI do painel CEP**. Não há ferramenta para abrir painéis CEP, clicar botões ou executar JavaScript dentro do contexto do painel.
2. O teste de WebGL requer o contexto do browser engine dentro do painel CEP, que o MCP não fornece.
3. A CDP (porta 7777) não está acessível.

### Arquivos criados nesta etapa
- `documentacao/FACA_3D_PLAN.md` — atualizado com plano de validação 1.2.

### Arquivos criados na FASE 1.2 (relatório)
- `documentacao/FACA_3D_REPORT_ETAPA_1_2.md` — relatório técnico da validação via MCP.

### Pendências operacionais após FASE 1.2
- Execução manual no painel CEP: abrir FACA 3D → clicar FACA 3D → executar diagnóstico → testar WebGL → retorno ao grid → abrir outra ferramenta.
- A FASE 2 só será autorizada após análise do relatório.
- **Não iniciar a FASE 2 sem nova autorização do responsável de arquitetura.**

---

## 2026-11-05 — FASE 1.3: automação da interface CEP (concluída)

**Tipo:** investigação + prova de conceito + validação operacional real.

### Resultado principal

O bloqueio da FASE 1.2 não existia: o **Chrome DevTools Protocol** do painel estava ativo em `http://127.0.0.1:7777` (processo `CEPHtmlEngine.exe` PID 25796, extensão `com.FACA 3D.tools.panel`). O `Get-NetTCPConnection` retornava vazio (falso negativo) e o `fetch` do runtime de código não tinha `AbortSignal`/contexto de rede — daí a conclusão equivocada.

### Recursos de automação inventariados

| Recurso | Situação | Uso |
|---|---|---|
| CDP CEP (porta 7777) | Disponível | **Adotado** — DOM, JS e screenshot do painel |
| Node 22 (`fetch`/`WebSocket`) | Disponível | Cliente CDP sem dependências |
| Win32 P/Invoke | Disponível | Clique físico real na aba do dock |
| GDI `CopyFromScreen` | Disponível | Captura de tela |
| .NET UI Automation | Carrega, mas não vê o CEP | Descartado (0 descendentes no Illustrator) |
| Python 3.12 (`pywinauto`/`comtypes`) | Ausentes | Não usado (instalação não autorizada) |
| AutoHotkey / WinAppDriver | Ausentes | Não usados |
| MCP Illustrator | Conectado | Só manipula documento; não clica na UI |

### Prova de conceito

Driver criado em `%TEMP%\opencode\cep_cdp.mjs` (Node puro, sem dependências):
`Runtime.evaluate` com `awaitPromise`/`returnByValue`/`userGesture` e `Page.captureScreenshot`.

| Passo | Resultado |
|---|---|
| Identificar o Illustrator | PID 3916, `h=0x804EE`, classe `illustrator` |
| Identificar o painel | PID 25796, página "FACA 3D" |
| Inventariar o grid | 19 botões, `data-tool="faca3d"` |
| Acionar FACA 3D | Montagem em **159 ms**, CSS 7.838 bytes |
| Diagnóstico (`faca teste.pdf`) | 106 caminhos, 106 abertos, Crease 22, Cut 84, 8 ms |
| Testar WebGL | WebGL 1 e 2, ANGLE/NVIDIA GTX 1660, pixel OK, 21 ms |
| Voltar ao grid | 19 botões, "Pronto.", badge `v0.5.5` |
| Abrir outra ferramenta | QR Code montou; retorno ao grid OK |

### Desempenho observado

| Documento | Caminhos | Tempo no painel |
|---|---|---|
| `FT 208792_CASINHA DE GATO - MELANCIA_REV00.pdf` | 2.677 | 189 ms |
| `FT 208792_CASINHA DE GATO - QUEIJO_REV00.pdf` | 5.510 | 767 ms |
| `faca teste.pdf` | 106 | 37 ms |

### WebGL no CEP

- `WebGLRenderingContext`, `WebGL2RenderingContext` e `OffscreenCanvas`: sim.
- WebGL 1.0 e 2.0 criados, sem perda de contexto, `readPixels` OK.
- Renderer `ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.16.1088)`.
- 33/17 extensões; textura máx. 16384; viewport 32767×32767; **21 ms**.
- Rodapé do painel: `WebGL disponível neste painel (WebGL2).`

### Arquivos criados

- `documentacao/FACA_3D_REPORT_ETAPA_1_3.md` — relatório completo.
- `documentacao/evidencias/etapa1_3_diagnostico.png`
- `documentacao/evidencias/etapa1_3_painel_no_ilustrador.png`
- `documentacao/evidencias/etapa1_3_webgl_no_painel.png`
- `documentacao/evidencias/etapa1_3_retorno_grid.png`

### Arquivos atualizados

- `FACA_3D_PLAN.md` — plano e resultados da Etapa 1.3.
- `FACA_3D_STATUS.md` — FASE 1 concluída operacionalmente.
- `FACA_3D_CHANGELOG.md` — esta entrada.
- `FACA_3D_REPORT.md` — resumo da 1.2 e relatório da 1.3 (relatórios anteriores preservados).

### Código de produto

**Nenhuma alteração.** Nenhum arquivo do FACA 3D ou de outras ferramentas foi modificado nesta etapa.

### Integridade do arquivo oficial

`faca teste.pdf` manteve tamanho (75.135 bytes), mtime e SHA-256 (`03BC09CE596008467D83431A3D3CB608D22B8C2F86FC53D2CA4BB96484DEB41B`) idênticos. Foi aberto e fechado sem salvar; o documento ativo original foi restaurado.

### Pendências

- **FASE 2 não autorizada.** Aguardar decisão do responsável de arquitetura.
- Manter o `.debug` fora do instalador/produção (já excluído do espelho da rede).

---

## 2026-11-05 — FASE 2: interpretador geométrico e topologia (concluída)

**Tipo:** implementação + testes unitários + validação no painel real.

### Arquivos criados
- `js/core/geometry-utils.js`, `js/core/path-parser.js`, `js/core/contour-builder.js`, `js/core/face-detector.js`, `js/core/topology.js`, `js/core/geometry-engine.js`.
- `testes/testes-geometria.mjs` (58 testes).
- `documentacao/FACA_3D_REPORT_ETAPA_2_0.md` a `FACA_3D_REPORT_ETAPA_2_4.md`.

### Backend
- `jsx/faca3d.jsx`: `faca3dGeometria(escopo, inicio, fim)` com protocolo `F3D|1|GEO`, paginação e `ESCALA_COORD=10000`.
- **Sem alteração em `jsx/host.jsx`** — transporte pelo `chamar()` genérico.

### Resultado (`faca teste.pdf`)
- 106 caminhos, 128 segmentos, 112 vértices, 141 arestas, 69 contornos (13 fechados), 17 faces, 20 adjacências.
- 164 interseções (0 cruzamentos reais, 2 junções, 160 toques), 52 ambiguidades, 15 inválidos.
- Comprimentos cut/crease idênticos entre parser e arestas.

---

## 2026-11-05 — FASE 2.5: visualização 2D funcional (concluída)

**Tipo:** funcionalidade visível + teste no painel real + evidências.

### Mudança de prioridade

A prioridade passou a ser **funcionalidade visível e utilizável**. O marco obrigatório era ver a faca real desenhada no painel, não apenas números.

### Arquivos criados
- `js/view/canvas2d.js` — renderizador Canvas 2D (Bézier original, zoom, pan, ajuste, camadas, faces e regiões não reconstruídas).
- `documentacao/FACA_3D_REPORT_ETAPA_2_5.md`.
- `documentacao/evidencias/etapa2_5_visualizacao_2d.png`.
- `documentacao/evidencias/etapa2_5_visualizacao_2d_zoom.png`.

### Arquivos modificados
- `faca3d.html` — barra de ferramentas (legenda, toggles, zoom, ajustar), canvas e card **Geometria**; badge da fase para “Fase 2 · Visualização 2D”.
- `css/faca3d.css` — toolbar, legenda, canvas, toggles, zoom e estados de erro; área do viewer de 220 → 320 px (340 px no layout estreito).
- `js/faca3d.js` — versão `0.3.0`, carregamento do `canvas2d`, fluxo diagnóstico → geometria → desenho, card de geometria, estados de erro e controles do visor.
- `js/core/topology.js` — `contornos[].arestas` normalizado para ids numéricos.
- `js/main.js` — `faca3d` `0.3.0`; badge do hub `v0.7.0`.
- `index.html` — `js/main.js?v=21`.
- `CSXS/manifest.xml` — `0.7.0`.

### Testes executados (CDP, `faca teste.pdf`)

| Verificação | Resultado |
|---|---|
| Ler faca | 106 caminhos · 17 faces · 75 ms |
| Desenho real | 3.117 px de corte, 1.217 px de vinco, ~46.800 px de face |
| Zoom por botão | 100% → 156% |
| Pan | hash do canvas alterado |
| Ajustar | 100% |
| Toggles | Faces, Vincos, Cortes, Abertos e Ambíguos alteram o desenho |
| Zoom pela roda | 143% |
| Seleção vazia | mensagem clara, canvas removido |
| Retorno ao documento | faca redesenhada |

### Defeitos corrigidos
1. Camada “Abertos” não desenhava (arestas do contorno eram objetos, não ids).
2. Halo laranja com saltos por ignorar a direção das arestas (passou a usar a polilinha do contorno).
3. Área útil pequena no painel ancorado.
4. Falta de estado visual de erro de geometria.

### Integridade

`faca teste.pdf` manteve 75.135 bytes, mtime e SHA-256 (`03BC09CE...DEB41B`). Nenhum documento do usuário foi alterado.

### Próxima entrega

Primeira visualização 3D com Three.js local, somente com faces/articulações reais.

---

## 2026-11-05 — FASE 3.0: montagem 3D e interface mínima (concluída)

**Tipo:** funcionalidade visível + Three.js local + teste no painel real.

### Objetivo

Ver a faca **dobrando em 3D**, sem a interface 2D, com controles mínimos e retorno à home. A arte, quando existir, será o material das faces (próxima entrega).

### Arquivos criados
- `js/view/three3d.js` — montagem 3D: árvore de dobradiças, matrizes de dobra, faces trianguladas, bordas, vincos, câmera orbital, slider e animação.
- `js/vendor/three.min.js` — Three.js r128 local (603.445 bytes, MIT).
- `FACA_3D_REPORT_ETAPA_3_0.md`.
- `evidencias/etapa3_3d_plano.png`, `etapa3_3d_dobrando.png`, `etapa3_3d_montada.png`.

### Arquivos modificados
- `faca3d.html` — interface 3D única: **← Ferramentas**, **Dobrar**, slider de ângulo, **Reiniciar vista**, **Ler novamente**, nota de montagem.
- `css/faca3d.css` — layout 3D, botão home, slider, canvas 3D e nota.
- `js/faca3d.js` — reescrito para 3D: carga do Three.js, leitura automática, montagem, animação, erros, home; cache do carregador limpo a cada abertura.
- `js/core/topology.js` — (já na 2.5) ids de arestas dos contornos.
- `js/main.js` — FACA 3D `0.4.0`; badge `v0.8.0`.
- `index.html` — `js/main.js?v=22`.
- `CSXS/manifest.xml` — `0.8.0`.

### Resultado (`faca teste.pdf`)

| Métrica | Valor |
|---|---|
| Faces identificadas | 17 |
| Faces montadas | 13 |
| Dobradiças que dobram | 11 |
| Ligação não reta (rígida) | 1 (contorno em “U” 0–1) |
| Fora | 4 recortes ligados só por corte (480 mm²) |
| Cruzamentos a 90° | 0 |
| Tempo leitura + montagem | 115–134 ms |
| WebGL/Three.js | ok (r128, renderer real no CEP) |

### Direção das dobras

A faca não traz montanha/vale. O padrão dobra cada painel para o **+Z do pai**; se houver autointersecção, o motor procura o menor conjunto de inversões. A interface declara a inferência.

### Testes executados

| Verificação | Resultado |
|---|---|
| Animação inicial | 29° em ~300 ms → 90° |
| Botão Dobrar | 0° → 90° |
| Slider 0°/180° | Desenho muda |
| Rotação / zoom | Canvas muda |
| ← Ferramentas | Volta ao grid |
| Reabrir | Remonta e anima |
| Testes unitários | 58/58 |

### Defeitos corrigidos

1. Faltavam pedaços da caixa: a ligação em “U” passou a ser rígida e as faces 0–3 entraram (10 → 13 faces).
2. Leque de painéis: o sinal da dobra passou a ser coerente por face (+Z do pai).
3. Linha de vinco inexistente em ligação rígida quebrava o render.
4. Cache de módulos entre aberturas da ferramenta.

### Próxima entrega

Arte como material/textura das faces, dobrando faca e arte juntas; depois dobra por dobradiça (ângulo e montanha/vale individuais).

---

## 2026-11-05 — FASE 3.1: auditoria das dobradiças e continuidade estrutural (concluída)

**Tipo:** auditoria + correção geométrica + diagnóstico + testes.

### Preservação

- Backup da versão funcional 0.4.0 em `documentacao/backup/0.4.0/` (com hashes).
- PDF original intacto (75.135 bytes, SHA-256 `03BC09CE…DEB41B`).

### Auditoria

- 22 paths `Crease` inventariados individualmente.
- 15 dobram, 3 formam o “U” rígido (faces 0–1), 4 são de borda livre (uma só face).
- Nenhum descartado por tolerância, nenhum curvo, nenhum com mais de duas faces.
- Inventário completo com anchors/handles em `evidencias/auditoria_vincos_22.json`.

### Arquivos criados

- `js/core/structural-lines.js` — Structural Line Resolver.
- `js/core/hinge-audit.js` — árvore de dobra + auditoria por path.
- `js/view/diagnostico.js` — diagnóstico visual.
- `testes/testes-estruturais.mjs` — 28 testes.
- `testes/testes-3d-painel.js` — 26 testes no painel.
- `FACA_3D_REPORT_AUDITORIA_DOBRADICAS.md`.
- `evidencias/auditoria_vincos_22.json`, `evidencias/auditoria_diagnostico.png`.

### Arquivos modificados

- `js/faca3d.js` — versão `0.5.0`, carga do resolvedor e do diagnóstico, botão **Diagnóstico**, detalhes por vinco.
- `faca3d.html` / `css/faca3d.css` — overlay de diagnóstico, legenda e painel de detalhes.
- `js/view/three3d.js` — eixos vindos da auditoria estrutural; `inspecionar()` para testes.
- `js/main.js` — FACA 3D `0.5.0`, badge `v0.9.0`.
- `index.html` — `main.js?v=23`.
- `CSXS/manifest.xml` — `0.9.0`.

### Resultado

| Item | Valor |
|---|---|
| Linhas estruturais | 18 |
| Conexões virtuais | 4 (60 mm cada) |
| Extensões virtuais | 8 |
| Conexões rejeitadas | 22 |
| Montagem | 13 faces, 11 dobradiças, 1 rígida |
| Cruzamentos 0/45/90/180° | 0 |
| Testes | 58 + 28 + 26 |

### Defeitos corrigidos

1. Paralelas deslocadas 3 mm eram fundidas — projeção apertada para 0,356 mm.
2. Ligações redundantes — árvore mínima de conexões.
3. Ponte virtual atravessando corte — rejeitada.
4. Extensão sem alvo válido — só com distância/ângulo e sem cruzamento.
5. Canvas do diagnóstico mudava de escala ao selecionar — altura fixa da caixa de detalhes.

### Próxima entrega

Arte como material do 3D, após avaliação.

---

## 2026-11-05 — FASE 3.2: revisão crítica do motor de dobragem (0.6.0)

**Tipo:** correção estrutural + modo de articulação individual + evidências.

### Preservação

- Backup da 0.5.0 em `documentacao/backup/0.5.0/`.

### Defeitos encontrados

1. A otimização de autointersecção invertia paredes/abas para baixo: z entre −133 e +205 mm.
2. Ângulo global 90° não representa a caixa (paredes/tampa 90°, abas/orelhas 180°).
3. A face 1 (“U”) era rígida; a subdivisão foi investigada e recusada por falta de corner slit.

### Correções

- Sentido por interior da caixa (centro da raiz, nunca abaixo da base).
- Perfil por profundidade: 90° (paredes/tampa) e 180° (abas de segunda dobra/orelhas).
- Modo **Articulação** no painel: uma dobradiça isolada, 0–180°, sentido ±.
- Módulo `js/core/face-subdivision.js` (tenta subdividir; não cria corte sem evidência).
- Diagnóstico mostra subdivisão virtual e mantém as demais camadas.

### Arquivos

- `js/view/three3d.js` — sinal estrutural, perfil, `definirAngulos`, `perfilPadrao`, `cruzamentosAtuais`, `inspecionar`.
- `js/faca3d.js` — perfil inicial, animação por perfil, seletor de articulação, sentido.
- `faca3d.html` / `css/faca3d.css` — controles de articulação.
- `js/core/face-subdivision.js` — subdivisão estrutural (no-op neste arquivo).
- `testes/testes-articulacoes.js` — 44 verificações.
- `documentacao/FACA_3D_REPORT_REVISAO_DOBRAGEM.md`.
- `evidencias/montagem_perfil.png`, `antes_0_5_0.png`, `perfil_abas180.png`, `art_*.png`.

### Resultado

| Item | Valor |
|---|---|
| Faixa z | 0 a +133 mm |
| Penetrações | 0 |
| Contatos de topo | 4 |
| Faces / dobradiças / rígidas | 13 / 11 / 1 |
| Vincos | 15 dobram, 3 rígidos (U), 4 sem par |
| Testes | 58 + 28 + 26 + 44 |

### Pendências

- Decidir sobre corner slit para V0/V2/V4 ou manter tampa rígida.
- Revisar na origem a classificação de V10/V11/V18/V20 (borda livre).
- Arte continua suspensa.

---

## 2026-11-05 - FASE 3.3: abas, U, curvas, camada FACA, grade e base (0.7.0)

**Tipo:** correções estruturais + UI + testes.

### Correções

1. **Somente camada FACA** na extração (`faca3d.jsx`), com subcamadas; sem FACA → `SEM_FACA` e mensagem clara.
2. **Tolerância de interseção** em `geometry-utils.js`: 1e-9 → 1e-6. A junção em “T” das abas era rejeitada por erro de ponto flutuante. V10/V11/V18/V20 passaram a ser faces e dobram.
3. **Anel em “U”** (`face-subdivision.js`): face 1 dividida nos dois bicos em 3 painéis reais (21/22/23). V0/V2/V4 dobram; orelhas 2/3 passam ao painel de topo.
4. **Curvas preservadas** (`face-detector.js`): a face percorre a polilinha da aresta (82 pontos nas orelhas), em vez de só as pontas.
5. **Perfil**: paredes/tampa/abas/saia 90°; somente orelhas 180°. A aba 12 não vai mais a 180° no Dobrar.
6. **Grade 3D removida**; 4 câmeras: **Perspectiva, Frente, Topo e Lado** (Z é altura); **pan com botão direito**; orbit com esquerdo; roda zoom.

### Arquivos

- `jsx/faca3d.jsx` — camada FACA.
- `js/core/geometry-utils.js` — folga paramétrica.
- `js/core/face-subdivision.js` — divisão do anel.
- `js/core/face-detector.js` — polígonos com curvas.
- `js/view/three3d.js` - perfil, 4 câmeras (Perspectiva/Frente/Topo/Lado), pan, grade removida.
- `js/faca3d.js`, `faca3d.html`, `css/faca3d.css` — seletor de vista, controles, textos.
- `testes/testes-3d-painel.js` — 19/23, 18, 0, 22/22.
- `testes/testes-articulacoes.js` — 72 verificações.
- `documentacao/FACA_3D_REPORT_REVISAO_DOBRAGEM.md` (reescrito), `auditoria_vincos_22.json` (regenerado).
- `js/main.js` — 0.7.0, badge v0.11.0; `index.html` v25; manifesto 0.11.0.

### Resultado

| Item | Valor |
|---|---|
| Faces / montadas | 23 / 19 |
| Dobradiças / rígidas | 18 / 0 |
| Vincos | **22/22 dobram** |
| Faixa z | −1,0 a +133 mm |
| Contatos | 4 (~1 mm) |
| Testes | 58 + 28 + 26 + 72 = 184 |

### Evidências

`auditoria_diagnostico.png` (22 dobram), `vista_z_topo_0.png` (curvas), `vista_iso_sem_grade.png`, `vista_x.png`, `vista_z.png`, `art_*.png`, `auditoria_vincos_22.json`.

### Pendências

Direção/perfil inferidos; 4 contatos de ~1 mm; 4 recortes sem vinco; ArtiosCAD ausente; arte suspensa.

---

## 2026-11-05 — FASE 3.4: 4 câmeras com OrbitControls (0.7.1)

**Tipo:** correção da câmera/orbita.

### Correções

1. **OrbitControls** do Three.js r128 vendorizado (`js/vendor/OrbitControls.js`): órbita suave com **damping**, sem inversão de sentido e sem salto ao sair de uma vista.
2. **4 câmeras:** **Perspectiva** (+Y, frente/tampa), **Frente** (+Y), **Topo** (Z, alinhado em Y) e **Lado** (+X). Z é a altura; o modelo não é rotacionado.
3. **Botão esquerdo orbita**, **botão direito faz pan**, roda zoom.
4. Perspectiva voltou a mostrar a **frente** da caixa (não as costas).
5. Grade continua removida.

### Arquivos

- `js/vendor/OrbitControls.js` (novo).
- `js/view/three3d.js` — OrbitControls, Z-up, presets de câmera, loop de damping.
- `js/faca3d.js` — carrega OrbitControls após o Three.js.
- `faca3d.html` — seletor Perspectiva/Frente/Topo/Lado.
- `js/main.js` 0.7.1, badge v0.11.1; `index.html` v26; manifesto 0.11.1.

### Resultado

Mesma geometria: 19/23 faces, 18 dobradiças, 0 rígidas, 22/22 vincos dobram, 4 contatos de ~1 mm. Câmera orbital fluida, 4 vistas, pan no direito.

### Evidências

`camera_perspectiva.png`, `camera_frente.png`, `camera_topo.png`, `camera_lado.png`.

### Pendências

Direção/perfil inferidos; 4 contatos de ~1 mm; 4 recortes sem vinco; ArtiosCAD ausente; arte suspensa.

---

## 2026-11-05 — FASE 3.5: 6 câmeras (frente face 8, 2 lados, 2 perspectivas) — 0.7.2

**Tipo:** presets de câmera + orientação.

- **Frente = face 8** (lado -Y): corrigido; antes a frente mostrava as costas.
- **Lado direito** (+X, face 5) e **Lado esquerdo** (-X, face 11).
- **Perspectiva frente-direita** (+X, -Y, +Z) e **frente-esquerda** (-X, -Y, +Z): ambas na frente, nunca atrás da caixa.
- **Topo** em +Z alinhado em Y; **perspectiva** mantém o OrbitControls (damping, pan no direito, zoom na roda).
- A dobra não mudou: 19/23 faces, 18 dobradiças, 0 rígidas, 22/22 vincos.
- Leitura: fechada mostra o **externo**; aberta mostra o **interior**. Arte interna/externa fica para a fase de materiais.

**Versão:** FACA 3D 0.7.2 · painel v0.11.2.

**Evidências:** `camera_perspectiva_direita.png`, `camera_perspectiva_esquerda.png`, `camera_frente.png`, `camera_topo.png`, `camera_lado_direito.png`, `camera_lado_esquerdo.png`.

**Pendências:** as mesmas (4 contatos ~1 mm; perfil inferido; ArtiosCAD ausente; arte suspensa).

---

## 2026-11-05 — FASE 3.6: detente de 90° na barra (0.7.3)

- Ao arrastar a barra **Ângulo**, qualquer valor entre **85° e 95°** é convertido para **90°**; o polegar e o rótulo pulam para 90.
- Abaixo de 85° e acima de 95° o valor segue normalmente (96 → 96; 180 → 180).
- Vale para o ângulo **global** e para a **articulação individual**.
- **Dobrar**, perfil, animação e câmeras não são afetados.
- Versão 0.7.3 · painel v0.11.3.

---

## 2026-11-05 — FASE 3.7: articulação por clique + Desdobrar animado (0.7.4)

**Tipo:** interação (seleção de face) + estado por face.

- **Sem droplist:** a face é escolhida **clicando no modelo**. Raycast na face; clique com deslocamento ≤ 4 px (arrastar continua sendo órbita/pan).
- **Destaque:** a face selecionada recebe material amarelo e contorno laranja (sempre visível).
- **Cada face guarda o próprio ângulo e o próprio sentido.** Antes, `definirArticulacao` zerava as outras faces — era o motivo do ângulo voltar a 0 ao trocar de face. Agora as demais permanecem intactas.
- **Desmarcar:** clicar na mesma face ou **fora da caixa**; o rótulo volta para “todas as dobras” e o slider volta ao modo global.
- **Sentido** é por face (botão desabilitado sem seleção).
- **Desdobrar (novo):** anima todas as faces até **0°**, o inverso do **Dobrar** (que reaplica o perfil 90/180). Ambos limpam a seleção.
- Snap **85°–95° → 90°** continua valendo na barra, inclusive na face selecionada.
- **Testes:** 268 (58 geometria + 28 estruturais + 26 painel + 129 articulações + 27 seleção), 0 falhas.

**Versão:** FACA 3D 0.7.4 · painel v0.11.4 · `index.html?v=29` · manifesto 0.11.4.

**Evidências:** `selecao_face_0.png`, `selecao_face_22.png`.

---

## 2026-11-05 — FASE 3.8: seleção múltipla de faces (0.7.5)

**Tipo:** interação (multi-seleção) + barra aplicada ao conjunto.

- **Ctrl+clique** (ou ⌘) **alterna** a face na seleção: soma se não estava, remove se estava. **Shift+clique** só soma.
- **Clique simples** seleciona apenas aquela face (clicar na única selecionada desmarca); **clique fora da caixa** limpa tudo. Arrastar > 4 px continua sendo órbita/pan.
- **A barra Ângulo move todas as selecionadas** de uma vez (`definirArticulacoes`), e cada face continua guardando o próprio ângulo — somar ou remover uma face não altera as demais.
- **Sentido +/-** (`definirSinais`) vale para todas as selecionadas; desabilitado sem seleção.
- **Rótulo:** `todas as dobras` · `face N (de P)` · `N faces · a, b, c`; a info mostra `N faces selecionadas (a, b, c) · sentido ± · X°`.
- **Dobrar** e **Desdobrar** limpam a seleção inteira e voltam ao modo global.
- **Testes:** 280 (58 geometria + 28 estruturais + 26 painel + 129 articulações + 39 seleção), 0 falhas.

**Versão:** FACA 3D 0.7.5 · painel v0.11.5 · `index.html?v=30` · manifesto 0.11.5.

**Evidências:** `selecao_multipla.png` (faces 0, 2 e 3 a 45°).

---

## 2026-11-05 — FASE 3.9: droplist de faces de volta + dobras a 90° (0.7.6)

**Tipo:** interface (seleção por lista) + correção de perfil de dobra.

- **Droplist Face (de volta):** lista `todas as dobras` + as **18 faces articuláveis** com o pai (`face 22 (de 0)`). Escolher na lista seleciona a face; **Ctrl+escolha** alterna (soma/remove) e **Shift+escolha** só soma.
- **Sincronizado nos dois sentidos:** clicar no modelo atualiza o droplist; com várias faces, o primeiro item vira `N faces · a, b, c` e o valor fica vazio.
- **Todas as dobras em 90°:** a orelha (faces 2/3) ia a **180°** no perfil e ficava **deitada sobre o painel vizinho**, parecendo atravessar a face. Agora o perfil fecha tudo em **90°** e a orelha encosta para dentro da caixa. O slider continua permitindo qualquer ângulo (inclusive 180°) por face.
- Rótulos/infos atualizados: `montagem por perfil (todas as dobras 90°)`.
- **Testes:** 292 (58 geometria + 28 estruturais + 26 painel + 129 articulações + 51 seleção), 0 falhas. A suíte de seleção ganhou os casos do droplist e do perfil só com 90°.

**Versão:** FACA 3D 0.7.6 · painel v0.11.6 · `index.html?v=31` · manifesto 0.11.6.

**Evidências:** `selecao_droplist.png` (face 22 pelo droplist) e `perfil_90.png` (caixa fechada sem aba sobre o painel).
---

## 2026-11-06 — FASE 3.10: arte externa/interna, planificado em 0° e correção de codificação (0.8.0)

**Tipo:** extração de arte por artboard + UV por face + correção de texto corrompido.

### Codificação (Etapa A)

- `js/main.js` sozinho estava com UTF‑8 reinterpretado como cp1252: `extensão`, `Resolução`, `Código de Barras`, `múltiplas`, `— hub`, `FACA ARD (→) VETOR`, `não inicializado`. Nenhum outro arquivo corrompido.
- Reparo pontual (não conversão em massa). `<meta charset="utf-8">` já em todo o painel. Ida‑e‑volta CEP ↔ ExtendScript com todo o alfabeto, localStorage, cache de FT e 19 ferramentas verificados — sem perdas.
- `setWindowTitle` removidos nas três ferramentas que o emitiam; o painel passou a definir **"FACA 3D"** no `init()` e em `voltar()`, sem tocar no `manifest.xml` (já correto).

### Arte externa/interna (Etapa B)

- **A faca da primeira artboard é a única fonte de geometria** (`f3dFiltrarPorArtboard(..., 0)` antes de enviar qualquer path); a faca espelhada da segunda artboard foi **ignorada completamente**.
- Pipeline: `faca3dArtes()` (inventário) → `faca3dExportarArte()` (1 PNG 2200 px por artboard, camadas técnicas `FACA`, `MIRA`, `CL`, `INFO`, `LOTE`, `COTAS`, `DIMENSÃO` **ocultadas só durante a exportação** e restauradas no `finally`) → `js/view/artes.js` (UI de decisão) → `three3d.js` (`UV por face`, duas malhas por face, `FrontSide`/`BackSide`).
- **Externo → faces externas; Interno → faces internas.** UV = posição do ponto no documento mapeada para a rect da artboard (mm), com offset da bbox dos anchors (`geometria.caixaPt`).
- Controles novos: **Arte** (ambas/externa/interna/nenhuma), **Espelhar interna**, **Atualizar artes**, **Vista interior** (câmera dentro da caixa, 72°).
- **Estado inicial em 0°** (planificado); **Reset** retorna a 0°; sem animação ao abrir.
- Testes: **319** (58 geometria + 28 estruturais + 26 painel + 129 articulações + 51 seleção + 27 arte), 0 falhas.

**Versão:** FACA 3D 0.8.0 · painel v0.11.7 · `index.html?v=33` · manifesto 0.11.7.

**Evidências:** `planificada.png`, `dobrada.png`, `dobrada_frente.png`, `interior_verso.png`; ver `FACA_3D_REPORT_ARTE_EXTERNA_INTERNA.md` e `FACA_3D_REPORT_CODIFICACAO.md`.


## Independencia de identidade (0.8.0)

- Removidas todas as referencias a extensao antiga.
- Novo identificador CEP independente: com.faca3d (bundle) / com.faca3d.panel.
- host.jsx simplificado para atender apenas o FACA 3D.
- Caminhos de armazenamento migrados para %APPDATA%\\FACA3D.
- Logs migrados para %APPDATA%\\FACA3D\\logs.
- Criado README.md independente.


## Redesign visual (0.8.0)

- Sistema profissional de botoes: estados hover/pressed/focus/disabled/selected/loading.
- Paleta coerente via variaveis CSS, tipografia Adobe Clean, cantos arredondados, sombras discretas.
- Icones SVG inline nos botoes principais (Dobrar, Desdobrar, Reset, Ler, Diagnostico, Confirmar, Cancelar).
- Inputs/selects alinhados ao mesmo acabamento.
- Responsividade aprimorada para painel CEP estreito.


## 0.8.4 — Painel superior de faaaaccaaaa.pdf (V14/V19) + zoom no diagnóstico

**Tipo:** correção de geometria + recurso de visualização.

### Causa (V14/V19 `sem-par`)
O corte horizontal terminando em `(186,797)` devia partir a vertical `x=186`
na junção em T, mas a folga paramétrica fixa de `1e-6` em
`intersecaoRetas` rejeitava a junção por um desvio de `0,00006 mm`
(paramétrico ~1,5e-6). A ponta ficava solta (vértice de grau 1, aresta em
ponte) e o painel de cima fundia com o de baixo numa única face, de modo
que V14/V19 não tinham segunda face e não dobravam.

### Correção
- `js/core/geometry-utils.js`: folga paramétrica proporcional em
  `intersecaoRetas` (até `tol` mm além do segmento, máx. 1% do comprimento).
  O T é detectado, a vertical é partida em dois trechos (5 + 10 mm) e o
  painel de cima vira face própria. No arquivo real, V14/V19 passam a
  `dobra` (faces 16–17, eixo de 268 mm em `y≈792`, com 1 conexão virtual de
  recorte cobrindo o vão de 140 mm entre 86–226) e a face 17 articula no 3D.
- Testes novos em `testes/testes-geometria.mjs` (intersecção em T na ponta
  com desvio sub-micrométrico + partida da vertical no grafo).

### Zoom no diagnóstico
- Roda do mouse = zoom centrado no cursor; arrastar = mover; duplo clique =
  ajustar; botão esquerdo move fora do modo base (Alt+botão esquerdo também
  move dentro do modo base); indicador de nível no canto do canvas.

### Testes
- Node: `testes/testes-geometria.mjs` 128/128; `testes/testes-estruturais.mjs`
  28/28. AO vivo (Illustrator 30.8.2 + `faaaaccaaaa.pdf`): V14/V19 `dobra`,
  grau do vértice em `(186,797)` = 3.


## 0.8.5 — Câmera inicial frente-esquerda

**Tipo:** ajuste de vista padrão.

- `js/view/three3d.js`: `ajustarCamera()` (abertura do 3D e `resetarVista()`) e
  o estado inicial passam de `perspectiva_direita` para
  `perspectiva_esquerda` (frente-esquerda, pedido do usuário).
- `js/faca3d.js`: `renderizar3D()` (botão **Ler novamente**), botão **Reset** e
  a dobra (`animarMontagem`, quando vinha do plano) também usam
  `perspectiva_esquerda`; o seletor *Vista* abre marcado nessa opção
  (`faca3d.html`).
- Verificação ao vivo: seletor = `perspectiva_esquerda`, câmera em
  x/y negativos (frente-esquerda) e V14/V19 seguem `dobra` (34 no total).
