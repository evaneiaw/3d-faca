# RELATÓRIO FACA 3D — ETAPA 1.3: AUTOMAÇÃO DA INTERFACE CEP

**Status:** Concluída com sucesso — a interface real do painel CEP foi controlada por automação, o diagnóstico foi executado dentro do painel e o teste de WebGL foi executado e capturado no contexto real do CEP.

**Data:** 05/11/2026

---

## 1. Resumo executivo

A Etapa 1.2 havia concluído que o painel CEP não podia ser controlado. **Essa conclusão estava incorreta**: o Chrome DevTools Protocol (CDP) do painel estava ativo o tempo todo na porta `127.0.0.1:7777`, e o motivo da falha anterior foi apenas o método de verificação usado (`Get-NetTCPConnection` retornou vazio e o `fetch` do runtime de código não tinha `AbortSignal`/contexto de rede).

Com o CDP acessível, foi possível executar **todos** os testes que estavam pendentes, sem cliques manuais do usuário e sem alterar uma linha de código do produto:

1. O painel real foi identificado (processo, extensão e página).
2. O grid do hub foi inspecionado (19 ferramentas).
3. O botão **FACA 3D** foi acionado pelo handler real do hub (evento de clique no DOM).
4. A ferramenta montou no painel em **159 ms** (fetch de HTML/CSS/JS + `new Function` + ponte com o Illustrator).
5. O diagnóstico foi executado **dentro do painel** com o arquivo oficial `faca teste.pdf`: **106 caminhos, 22 Crease, 84 Cut, 5 SpotColors definidas, 8 ms**.
6. O botão **Testar WebGL** foi acionado e o resultado foi lido no painel: **WebGL 1 e WebGL 2 criados, ANGLE/NVIDIA GeForce GTX 1660, desenho e leitura de pixel OK, 21 ms**.
7. O retorno ao grid e a abertura de outra ferramenta (QR Code) foram validados.
8. Evidências visuais foram capturadas, incluindo o painel real dentro do Illustrator.

Nenhuma ferramenta existente foi alterada. O PDF oficial não foi modificado (hash SHA-256 idêntico antes/depois).

---

## 2. Recursos de automação encontrados

| Recurso | Situação no ambiente | Utilidade para o CEP |
|---|---|---|
| **Chrome DevTools Protocol (CEP)** | **Disponível** em `http://127.0.0.1:7777` (a extensão tem `.debug` com `com.FACA 3D.tools.panel` → ILST 7777 e `PlayerDebugMode=1`) | **Sim — solução adotada.** Acesso total ao DOM, JS e screenshot do painel |
| **Node.js 22 (embutido no ambiente)** | `fetch` e `WebSocket` globais | **Sim** — cliente CDP sem instalar dependências |
| **Win32 P/Invoke (user32)** | Disponível (`SetCursorPos`, `mouse_event`, enumeração de janelas) | **Sim** — usado para clique físico real na aba do dock |
| **Captura de tela GDI (System.Drawing)** | Disponível (`CopyFromScreen`) | **Sim** — evidência visual do painel dentro do Illustrator |
| **Windows UI Automation (.NET)** | `UIAutomationClient`/`UIAutomationTypes` carregam | **Não para o painel.** O Illustrator expõe só a janela principal; 0 descendentes. As abas do dock e o conteúdo CEP não são expostos |
| **PowerShell + COM** | Disponível | Sim — abrir/ativar/fechar documentos sem salvar e diagnosticar a porta |
| **MCP Illustrator** | Conectado (Illustrator 30.8.2) | Apenas manipulação de documento; **não** abre painéis nem clica em botões da UI |
| **Python 3.12.10** | Presente, **sem** `pywinauto` e **sem** `comtypes` | Não utilizável sem instalação (não autorizada) |
| **AutoHotkey** | Ausente | — |
| **WinAppDriver** | Ausente | — |

> Não foi instalada nenhuma dependência. A solução final usa apenas recursos já presentes (Node + CDP + Win32 + GDI).

---

## 3. Ambiente e processos identificados

### 3.1 Illustrator

| Item | Valor |
|---|---|
| Processo | `Illustrator.exe` — PID **3916** |
| Janela principal | `h=0x804EE`, classe `illustrator`, visível |
| Título (durante o teste) | `faca teste.pdf @ 16,67 % (CMYK/Preview)` |
| Versão | Adobe Illustrator **30.8.2** |

### 3.2 Painel CEP (FACA 3D)

| Item | Valor |
|---|---|
| Extensão | `com.FACA 3D.tools.panel` |
| Processo browser (dono da porta) | `CEPHtmlEngine.exe` — PID **25796** |
| Processos renderer | PIDs **10312** e **24856** |
| `windowid` interno | **792558** |
| Argumento de debug | `--remote-debugging-port=7777` (presente nos renderers da extensão) |
| Motor | Chrome/99.0.4844.84 — AdobeCEP/12.1.1 |
| Página exposta | `file:///C:/Users/user/AppData/Roaming/Adobe/CEP/extensions/com.FACA 3D.tools/index.html` |
| Título da página | `FACA 3D` |
| WebSocket | `ws://127.0.0.1:7777/devtools/page/0F0B4C7C0E321F7062A9B3AD876E879C` |

O log `%TEMP%\CEPHtmlEngine12-ILST-30.8.2-com.FACA 3D.tools.panel.log` confirma:

```
DevTools listening on ws://127.0.0.1:7777/devtools/browser/91fbf4f7-f2e8-43e8-9842-b5a1f4b86513
```

### 3.3 Janelas

As janelas CEF aparecem na enumeração Win32 como `Chrome_WidgetWin_0` com `vis=False`, porque o painel estava **recolhido como aba no dock direito** do Illustrator. Ainda assim o DOM permanece vivo e o CDP continua funcional — inclusive com a aba recolhida.

---

## 4. Correção da conclusão da Etapa 1.2

A Etapa 1.2 afirmou que "a porta 7777 não está acessível". A investigação desta etapa mostrou:

| Verificação | Resultado real |
|---|---|
| `Get-NetTCPConnection -LocalPort 7777` | retornou vazio (**falso negativo**) |
| `netstat -ano \| findstr :7777` | `TCP 127.0.0.1:7777 0.0.0.0:0 LISTENING 25796` |
| `Invoke-WebRequest http://127.0.0.1:7777/json/list` | **HTTP 200**, com a página "FACA 3D" |
| `Invoke-WebRequest http://127.0.0.1:7777/json/version` | **HTTP 200**, Chrome/99.0.4844.84 |

Ou seja: **o painel estava depurável desde 11:13:32** (momento em que foi carregado). O bloqueio nunca existiu; havia apenas um erro de verificação.

---

## 5. Prova de conceito (executada)

### 5.1 Ferramenta criada para o teste

`%TEMP%\opencode\cep_cdp.mjs` — driver CDP em Node puro (sem dependências):

- lê `http://127.0.0.1:7777/json/list`;
- conecta no `webSocketDebuggerUrl` da página "FACA 3D";
- executa `Runtime.evaluate` com `awaitPromise: true`, `returnByValue: true` e `userGesture: true`;
- opcionalmente salva `Page.captureScreenshot` em PNG.

Uso: `node cep_cdp.mjs <script.js> [saida.png]`, onde `script.js` é o corpo de uma função `async` executada **dentro do painel**.

### 5.2 Passo a passo executado

| # | Ação | Método | Resultado |
|---|---|---|---|
| 1 | Identificar a janela do Illustrator | Win32 `EnumWindows` + `GetWindowText`/`GetClassName` | PID 3916, `h=0x804EE`, classe `illustrator` |
| 2 | Identificar o painel CEP | `Get-CimInstance Win32_Process` + `/json/list` | PID 25796, extensão `com.FACA 3D.tools.panel`, página "FACA 3D" |
| 3 | Acessar a interface do painel | CDP `Runtime.evaluate` | DOM completo do hub disponível |
| 4 | Inventariar o grid | `document.querySelectorAll(".tool-btn")` | **19 botões**; `data-tool="faca3d"` = "19 · FACA 3D" |
| 5 | Acionar FACA 3D | `btn.click()` (dispara o mesmo handler do usuário) | Ferramenta montada em **159 ms** |
| 6 | Verificar o carregamento | DOM após a montagem | `#faca3dApp` presente, CSS de 7.838 bytes aplicado, 4 botões da ferramenta presentes |
| 7 | Executar o diagnóstico | clique em `#faca3dBtnLer` | Leitura concluída em **122 ms** (tempo de relógio) |
| 8 | Testar WebGL | clique em `#faca3dBtnWebGL` | Resultado completo exibido em `#faca3dWebGL` |
| 9 | Voltar ao grid | clique em `#faca3dBtnFechar` (interceptado → `voltar()`) | 19 botões, status "Pronto.", badge `v0.5.5` |
| 10 | Abrir outra ferramenta | clique em `data-tool="qrcode"` | QR Code montado; retorno ao grid OK |
| 11 | Evidência visual | `Page.captureScreenshot` + GDI `CopyFromScreen` | 4 imagens preservadas em `documentacao/evidencias/` |

### 5.3 Diagnóstico dentro do painel (arquivo oficial)

Com `faca teste.pdf` ativo no Illustrator, o clique em **"Ler faca"** produziu, no próprio painel:

```
Documento      faca teste.pdf
Illustrator    Adobe Illustrator 30.8.2
Pranchetas     1 (ativa: externo)
Tempo          8 ms

Caminhos (PathItem)      106
Abertos / fechados       106 / 0
Grupos                   1
Com traço                106
Com preenchimento        0
Objetos com SpotColor    106
Textos / Imagens         0 / 0
Recortes / Ocultos / Travados / Guias   0 / 0 / 0 / 0

Crease   22 obj.
Cut      84 obj.

Traço · SPOT   106
```

Rodapé: `Leitura concluída: 106 caminhos (106 abertos, 0 fechados) · 106 objetos com SpotColor. · 37 ms no painel.`

**Este resultado é idêntico ao baseline obtido via COM na Etapa 1.1** (107 itens, 106 paths, 5 SpotColors, 22 Crease, 84 Cut), agora comprovado dentro do CEP real.

### 5.4 Desempenho observado em documentos reais

| Documento | Caminhos | Tempo no painel |
|---|---|---|
| `FT 208792_CASINHA DE GATO - MELANCIA_REV00.pdf` | 2.677 | 189 ms |
| `FT 208792_CASINHA DE GATO - QUEIJO_REV00.pdf` | 5.510 | 767 ms |
| `faca teste.pdf` | 106 | 37 ms |

---

## 6. Teste de WebGL (resultado real, dentro do CEP)

Acionado pelo botão **"Testar WebGL"** do painel. Texto integral exibido em `#faca3dWebGL`:

```
User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 AdobeCEP/12.1.1 Safari/537.36
Plataforma: Win32 | DPR 1
Tela: 1920x1080
WebGLRenderingContext exposto: sim
WebGL2RenderingContext exposto: sim
OffscreenCanvas: sim

[WebGL 1]
Resultado: contexto criado
Versão: WebGL 1.0 (OpenGL ES 2.0 Chromium)
Fornecedor: Google Inc. (NVIDIA)
Renderizador: ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.16.1088)
GLSL: WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)
Máx. textura: 16384
Máx. viewport: 32767x32767
Extensões: 33
Debug renderer: sim
Contexto perdido: não
Desenho/leitura de pixel: OK

[WebGL 2]
Resultado: contexto criado
Versão: WebGL 2.0 (OpenGL ES 3.0 Chromium)
Fornecedor: Google Inc. (NVIDIA)
Renderizador: ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.16.1088)
GLSL: WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)
Máx. textura: 16384
Máx. viewport: 32767x32767
Extensões: 17
Debug renderer: sim
Contexto perdido: não
Desenho/leitura de pixel: OK

Tempo do teste: 21 ms
```

Rodapé: `WebGL disponível neste painel (WebGL2).`

**Conclusão:** WebGL funciona no CEP desta instalação, com aceleração por hardware (ANGLE/D3D11). A decisão D1 (Three.js) está tecnicamente viabilizada. Não foi usado teste externo: a execução ocorreu na página do painel (`AdobeCEP/12.1.1`).

---

## 7. Evidências visuais

Arquivos preservados em `documentacao/evidencias/`:

| Arquivo | Conteúdo |
|---|---|
| `etapa1_3_diagnostico.png` | Painel FACA 3D com o inventário de `faca teste.pdf` (106 caminhos, Crease 22, Cut 84, 8 ms) |
| `etapa1_3_painel_no_ilustrador.png` | Painel real dentro do Illustrator, FACA 3D aberto, documento e leitura concluída |
| `etapa1_3_webgl_no_painel.png` | Painel dentro do Illustrator com o relatório de WebGL (WebGL 1.0 criado, ANGLE/NVIDIA) e rodapé "WebGL disponível neste painel (WebGL2)." |
| `etapa1_3_retorno_grid.png` | Retorno ao grid: 19 ferramentas, campo FT, status "Pronto." |

As capturas do painel foram feitas por `Page.captureScreenshot` (render real do CEP) e as capturas de tela por GDI, com o painel expandido no dock.

---

## 8. Limitações

1. **O CDP exige o arquivo `.debug`** na pasta da extensão e `PlayerDebugMode=1` no registro. Isso é configuração de **desenvolvimento**: `.debug` é repo-only e **não pode ir para o instalador/produção** (já é excluído do espelho da rede). Em máquina de produção a automação não existirá.
2. **A porta só existe quando a extensão é carregada** com o `.debug` presente. Se o Illustrator iniciar sem o painel aberto, não há porta; é preciso abrir o painel uma vez.
3. **`element.click()` é um clique sintético no DOM**, não um clique físico. Ele dispara exatamente o mesmo handler que o usuário dispararia (o hub usa delegação de evento em `document`), mas **não** valida hit-testing/posicionamento do painel. O clique físico foi validado à parte, com `mouse_event`, ao expandir a aba do dock.
4. **Automação por coordenadas é frágil**: depende de DPI, layout do dock e de o painel estar visível. Serve para evidência visual, não como mecanismo principal.
5. **UI Automation não expõe o conteúdo CEP**: o Illustrator mostrou 0 descendentes na árvore UIA; as abas do dock são desenhadas pelo app. Portanto UIA não é alternativa viável aqui.
6. **Sem pywinauto/AutoHotkey/WinAppDriver**: a instalação exigiria autorização e não era necessária, pois o CDP resolveu o problema.
7. **Painel recolhido**: o DOM continua vivo e o CDP funciona, mas não há conteúdo visível na tela; para evidência em tela é preciso expandir a aba (clique físico) e depois recolher.
8. **Badge de versão da ferramenta não aparece**: o `main.js` procura `.title`, e o `faca3d.html` usa `.faca3d-title`. É apenas cosmético; não foi alterado nesta etapa (o código do FACA 3D não podia ser modificado).

---

## 9. Reutilização nas próximas etapas

**Sim — a automação é diretamente reutilizável.** Sugestão de uso como harness oficial de validação do FACA 3D:

- `cep_cdp.mjs` permite rodar qualquer sequência no painel real (abrir ferramenta, clicar botões, ler resultados, capturar screenshot) sem dependências e sem tocar no produto.
- Para as próximas fases, o mesmo harness pode:
  - carregar uma faca real e comparar o inventário com o baseline (`faca teste.pdf`);
  - acionar futuros botões de reconstrução 2D/3D e ler o estado do renderizador;
  - medir tempo de resposta da ponte CEP/JSX em documentos grandes;
  - capturar screenshots automáticos como evidência de regressão.
- Recomendação de processo: manter os scripts de teste fora da extensão (em `%TEMP%\opencode\`), usar `.debug` apenas na máquina de desenvolvimento e restaurar o estado do painel ao final de cada execução.

---

## 10. Integridade

| Item | Resultado |
|---|---|
| Código do FACA 3D | **Não alterado** nesta etapa |
| Outras ferramentas | **Não alteradas** |
| `js/main.js`, `jsx/host.jsx`, `CSXS/manifest.xml`, `index.html` | **Não alterados** nesta etapa |
| PDF oficial `faca teste.pdf` | Tamanho 75.135 bytes, mtime `05/11/2026 10:21:42` e SHA-256 `03BC09CE596008467D83431A3D3CB608D22B8C2F86FC53D2CA4BB96484DEB41B` **idênticos antes e depois** |
| Documentos do usuário | O PDF de teste foi aberto e fechado **sem salvar**; o documento ativo original foi restaurado. Observação: durante a execução, um documento (`...ARCO IRIS_REV00.pdf`) saiu da lista de abertos fora do fluxo automatizado; os três documentos restantes permanecem `salvo=True` |

Arquivos criados nesta etapa:

- `documentacao/FACA_3D_REPORT_ETAPA_1_3.md` (este relatório)
- `documentacao/evidencias/` (4 PNGs)

Arquivos atualizados nesta etapa:

- `FACA_3D_PLAN.md`, `FACA_3D_STATUS.md`, `FACA_3D_CHANGELOG.md`, `FACA_3D_REPORT.md`

---

## 11. Conclusão

A Etapa 1.3 **resolveu o bloqueio da Etapa 1.2**. A interface real do painel CEP é controlável por CDP, o FACA 3D carrega no painel real, o diagnóstico foi executado com o arquivo oficial e o **WebGL foi comprovado dentro do CEP** (WebGL 2, ANGLE/NVIDIA, 21 ms).

Com isso, a **FASE 1 pode ser considerada concluída** do ponto de vista operacional. A FASE 2 permanece **não autorizada** até decisão do responsável de arquitetura.
