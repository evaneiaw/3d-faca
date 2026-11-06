# FACA 3D — FASE 0: auditoria e documentação inicial

## 1. DECISÕES APROVADAS

- D1: Three.js local como renderer pretendido, condicionado à comprovação de WebGL no CEP. Implementar fallback Canvas 2D se necessário.
- D2: Começar com transporte textual pela ponte CEP. Medir limites antes de escolher outra solução.
- D3: Montanha e vale deverão ser configuráveis individualmente. Não presumir que todas as dobras possuem a mesma direção.
- D4: Espessura configurável pelo usuário, com valor inicial de 0,5 mm.
- D5: Documentação obrigatória em `convertidos/faca3d/documentacao/`.

## 2. REGRAS DE TESTE — ARQUIVO OFICIAL DE TESTE

O arquivo `faca teste.pdf` (C:\Users\user\Desktop\faca teste.pdf, 75.135 bytes, criado 11/05/2026) é o referência oficial para validação do módulo FACA 3D. Suas regras:

- **Não modificar** o PDF original.
- **Não substituir** o arquivo.
- **Não mover** o arquivo.
- **Não converter** o original.
- **Não presumir** que o PDF contém uma faca válida antes de inspecioná-lo.
- **Registrar** se está acessível e se contém elementos técnicos adequados para os testes.

## 3. REFERÊNCIA DE TESTE

Documento criado em `convertidos/faca3d/documentacao/REFERENCIA_TESTE.md` com todos os detalhes do arquivo oficial.

## 5. REGISTRO DO ARQUIVO OFICIAL DE TESTE

**Faca teste.pdf** — `C:\Users\user\Desktop\faca teste.pdf` — 75,135 bytes — criado em 11/05/2026.

Será utilizado exclusivamente para validar leituras reais de facas, identificação de cortes e vincos, e reconstrução geométrica. Nunca será modificado, substituído, movido ou convertido.

## 6. PLANO DA ETAPA 1.2 — VALIDAÇÃO AUTOMATIZADA VIA MCP

Objetivo executar os testes pendentes de FASE 1.1 usando ferramentas MCP disponíveis no ambiente OpenCode.

| # | Teste | Método Realizado | Resultado |
|---|---|---|---|
| 1 | Conexão Illustrator | MCP connection status | OK — panel: ok, Illustrator: Adobe Illustrator 30.8.2 |
| 2 | Reconhecimento documento | MCP query_items | OK — `faca teste.pdf` reconhecido, artboard "externo", ~2613×2611pt |
| 3 | Diagnóstico backend | COM (host.jsx + faca3d.jsx) | OK — `F3D|1|DIAG` com 107 itens, 106 paths, 5 spots |
| 4 | Diagnóstico sem documento | COM | Pending (documento aberto na sessão atual) |
| 5 | Teste WebGL | Impossível — não há ferramenta para acionar o botão no painel CEP | Requer execução manual |
| 6 | Ciclo CEP/JSX completo | Impossível — não há ferramenta para abrir o painel/clicar botões | Requer execução manual |
| 7 | Retorno ao grid + outra ferramenta | Impossível — depende da interação do usuário | Requer execução manual |

### Limitações determinadas pela FASE 1.2

1. **MCP Illustrator**: ferramentas controlam documentos diretamente (elementos, camadas, estrutura), mas **não acessam painéis CEP ou interagem com a UI**. Não há ferramenta `illustrator_open_panel`, `illustrator_click_button`, etc.
2. **CDP port 7777**: não responde — o painel de debug não está exposto.
3. **Browser/automation**: nenhum recurso de automação de janela/browser está ativado no momento.
4. **WebGL**: impossível de testar via MCP pois requer o contexto do painel CEP (browser engine inside CEP).

Após a conclusão da FASE 1.2, manterá Pendências Operacionais para validação manual no painel do Illustrator.

## 7. PLANO DA ETAPA 1.3 — AUTOMAÇÃO DA INTERFACE CEP

Objetivo: controlar a interface real do Illustrator e do painel CEP por automação Windows, criar uma prova de conceito reversível e, se funcionasse, executar o teste de WebGL **dentro** do painel (teste externo não vale como evidência).

### 7.1 Recursos avaliados

| Recurso | Situação | Decisão |
|---|---|---|
| CDP do CEP | Ativo em `127.0.0.1:7777` | **Adotado** |
| Node 22 (`fetch`/`WebSocket`) | Disponível | **Adotado** (cliente CDP sem dependências) |
| Win32 P/Invoke (mouse) | Disponível | **Adotado** apenas para clique físico na aba do dock |
| GDI `CopyFromScreen` | Disponível | **Adotado** para captura de tela |
| .NET UI Automation | Carrega, mas Illustrator expõe 0 descendentes | Descartado |
| Python 3.12 + pywinauto/comtypes | pywinauto/comtypes ausentes | Não usado (instalação exige autorização) |
| AutoHotkey / WinAppDriver | Ausentes | Não usados |
| MCP Illustrator | Conectado | Insuficiente (não clica na UI) |

### 7.2 Correção da conclusão da Etapa 1.2

A afirmação "CDP porta 7777 não responde" estava **incorreta**:

- `Get-NetTCPConnection -LocalPort 7777` → vazio (falso negativo);
- `netstat -ano` → `127.0.0.1:7777 LISTENING 25796`;
- `Invoke-WebRequest http://127.0.0.1:7777/json/list` → HTTP 200 com a página "Mazurky Tools";
- log do painel → `DevTools listening on ws://127.0.0.1:7777/devtools/browser/...`.

### 7.3 Resultados

| Teste | Resultado |
|---|---|
| Janela do Illustrator | PID 3916, `h=0x804EE`, classe `illustrator` |
| Painel CEP | PID 25796, `com.mazurky.tools.panel`, `windowid` 792558 |
| Grid | 19 ferramentas; `data-tool="faca3d"` |
| Abrir FACA 3D | Montagem em 159 ms |
| Diagnóstico (`faca teste.pdf`) | 106 caminhos, 106 abertos, Crease 22, Cut 84, 8 ms |
| WebGL no painel | WebGL 1 e 2, ANGLE/NVIDIA GTX 1660, pixel OK, 21 ms |
| Retorno ao grid | 19 botões, "Pronto.", badge `v0.5.5` |
| Outra ferramenta | QR Code montou e voltou ao grid |

### 7.4 Regras para reutilização

- O harness `%TEMP%\opencode\cep_cdp.mjs` (Node puro) é o mecanismo oficial de validação automatizada das próximas fases.
- O `.debug` é **exclusivo de desenvolvimento** e não pode ir para o instalador/produção.
- A automação nunca deve fechar ou salvar documentos do usuário; `faca teste.pdf` só pode ser aberto e fechado **sem salvar**.
- Ao final de cada execução, restaurar o estado do painel (grid) e do documento ativo.

### 7.5 Conclusão da FASE 1

Com o WebGL comprovado no CEP e o ciclo completo validado, a **FASE 1 está concluída operacionalmente**. A FASE 2 permanece **não autorizada** até decisão do responsável de arquitetura.

## 8. FASE 2.5 — VISUALIZAÇÃO 2D (mudança de prioridade)

**Contexto:** a prioridade do projeto passou a ser funcionalidade visível e utilizável. A infraestrutura (leitura, protocolo, geometria, topologia, WebGL) já estava validada, mas o usuário ainda não via a faca.

**Marco obrigatório:** abrir o FACA 3D, clicar em **Ler faca** e visualizar a faca real desenhada no painel, com cortes e vincos diferenciados.

### 8.1 Escopo entregue

- Renderizador **Canvas 2D** (`js/view/canvas2d.js`): Bézier original, corte contínuo vermelho, vinco tracejado azul, faces translúcidas, halo laranja nos contornos abertos, anel nos vértices ambíguos.
- Zoom (botões, roda, duplo clique), pan por arrasto e ajuste automático à área.
- Camadas alternáveis: Cortes, Vincos, Faces, Abertos, Ambíguos.
- Card de geometria com contagens e nota do que não foi reconstruído.
- Estados de erro claros (sem documento, sem seleção, nenhum caminho, falha de geometria).

### 8.2 Resultado real (`faca teste.pdf`)

| Métrica | Valor |
|---|---|
| Caminhos desenhados | 106 (84 cortes, 22 vincos) |
| Segmentos | 128 (108 retos, 20 curvos) |
| Contornos | 69 (13 fechados, 56 abertos) |
| Faces | 17 (20 adjacências) |
| Ambiguidades / inválidos | 52 / 15 |
| Tempo de leitura + geometria | 75–99 ms |
| Evidência | `evidencias/etapa2_5_visualizacao_2d.png` e `..._zoom.png` |

### 8.3 Próxima entrega

**Primeira visualização 3D** com Three.js local, montada somente a partir das faces e articulações identificadas; se a faca não permitir montagem completa, exibir a parcial e explicar o motivo. Não fabricar caixa genérica.

### 8.4 Regras mantidas

- Somente `faca teste.pdf` como arquivo de teste; nunca modificá-lo.
- Cada entrega é executada no painel CEP real (harness CDP) com screenshot.
- Nenhuma ferramenta existente do MazurkyTools é alterada.
- Documentação registra resultados reais, não substitui a implementação.

## 9. FASE 3.0 — MONTAGEM 3D (prioridade: ver a faca dobrar)

**Mudança de foco:** o usuário não precisa da tela 2D; quer a faca **dobrando em 3D** e, quando houver arte, a arte como material das faces.

### 9.1 Escopo entregue

- Interface 3D única, sem 2D: **← Ferramentas** (home), **Dobrar**, **Ângulo** (0–180°), **Reiniciar vista**, **Ler novamente**.
- Three.js r128 local em `js/vendor/three.min.js`.
- Montagem por árvore de dobradiças de vinco:
  - 11 dobradiças retas dobram;
  - 1 ligação não reta (contorno em “U” 0–1) é mantida rígida;
  - 13 de 17 faces montadas;
  - 4 recortes de 480 mm² (só corte) ficam fora.
- Direção das dobras inferida (+Z do pai; busca de inversões se houver autointersecção).
- Animação de abertura, órbita e zoom.

### 9.2 Resultado real

| Métrica | Valor |
|---|---|
| Faces montadas | 13 de 17 |
| Cruzamentos a 90° | 0 |
| Tempo leitura + montagem | 115–134 ms |
| Evidências | `etapa3_3d_plano.png`, `etapa3_3d_dobrando.png`, `etapa3_3d_montada.png` |

### 9.3 Limitações registradas

- Montanha/vale não existe na faca: a direção é inferida.
- Ângulo global; falta dobra por dobradiça.
- Ligação em “U” rígida.
- **Arte ainda não é material do 3D** (o arquivo de teste não tem arte).

### 9.4 Próxima entrega

1. Arte como textura/material das faces, dobrando faca e arte juntas.
2. Dobra por dobradiça (ângulo individual e montanha/vale).
3. Enquadramento automático por ângulo.

## 10. FASE 3.1 — AUDITORIA DAS DOBRADIÇAS E CONTINUIDADE ESTRUTURAL

**Motivo:** vincos interrompidos/desalinhados não se comportavam como dobra. A prioridade da arte foi suspensa até esta auditoria.

### 10.1 Entregas

- Backup da versão 0.4.0 em `documentacao/backup/0.4.0/`.
- Auditoria individual dos 22 paths Crease, com anchors/handles em `evidencias/auditoria_vincos_22.json`.
- **Structural Line Resolver** (`js/core/structural-lines.js`): três representações (original, estrutural, eixos), tolerâncias proporcionais, pontes virtuais, extensões, ambiguidade e rejeições.
- Integração ao motor: eixos das dobradiças vêm de **uma** linha estrutural; mais de uma linha entre o mesmo par → rígido.
- Diagnóstico visual (`js/view/diagnostico.js`): faces, vincos por status, pontes, extensões, eixos e rejeições.
- 28 testes estruturais + 26 testes de painel (hierarquia, eixos, sentido, 0/45/90/180°).

### 10.2 Resultado

| Item | Valor |
|---|---|
| Vincos | 22 (15 dobram, 3 rígidos, 4 sem par) |
| Linhas estruturais | 18 |
| Conexões virtuais | 4 (lacunas de 60 mm) |
| Extensões virtuais | 8 |
| Conexões rejeitadas | 22 |
| Faces montadas | 13 de 17 |
| Cruzamentos a 0/45/90/180° | 0 |

### 10.3 Regras mantidas

- Não aumentar tolerância global para “fazer caber”.
- Não conectar somente por proximidade (projeção máx. 0,356 mm).
- Não inventar dobradiça para vinco de borda livre.
- Não alterar a geometria original nem o PDF.

### 10.4 Próxima etapa

Arte como material do 3D, somente após avaliação desta auditoria.

## 11. FASE 3.2 — REVISÃO CRÍTICA DO MOTOR DE DOBRAGEM

**Motivo:** a 0.5.0 passava nos testes, mas a montagem visual estava errada. A classificação dos 22 vincos deixou de ser prova de interpretação correta.

### 11.1 Correções

- Sentido das dobras pelo **interior da caixa** (centro da raiz; nunca abaixo da base).
- **Perfil por dobradiça:** paredes/tampa 90°, abas de segunda dobra/orelhas 180°.
- **Modo de articulação individual** (uma dobradiça isolada, 0–180°, sentido ±).
- Subdivisão estrutural investigada (`face-subdivision.js`); recusada neste desenho por falta de corner slit.
- Diagnóstico ampliado (eixos, sentido, pontes, extensões, rejeições, subdivisão).

### 11.2 Resultado

| Item | 0.5.0 | 0.6.0 |
|---|---|---|
| Faixa z a 90° | −133…+205 | **0…+133** |
| Penetrações | 2 + contatos | **0** |
| Contatos de topo | 5 | **4** |
| Articulações individuais | — | **11/11 (44 verificações)** |
| Faces/dobradiças/rígidas | 13/11/1 | 13/11/1 |

15 vincos dobram; V0/V2/V4 (U) são rígidos; V10/V11/V18/V20 são de borda livre. Nenhuma articulação em corte.

### 11.3 Testes

58 geometria + 28 estrutural + 26 painel + 44 articulações = **156**.

### 11.4 Decisão pendente

- Tampa rígida definitiva **ou** corner slit/relief para V0/V2/V4.
- Revisar na origem a classificação de V10/V11/V18/V20.
- Arte suspensa até decisão.

## 12. FASE 3.3 — CORREÇÕES FINAIS DE DOBRAGEM (0.7.0)

### 12.1 Correções

- Extração restrita à **camada FACA** (e subcamadas).
- Folga paramétrica da interseção em “T” (1e-6): abas V10/V11/V18/V20 passam a existir e dobrar.
- **Anel em “U”** dividido nos bicos em 3 painéis reais (21/22/23): V0/V2/V4 dobram.
- **Curvas** preservadas nos polígonos das faces (orelhas 2/3 com 82 pontos).
- Perfil: paredes/tampa/abas/saia **90°**; somente orelhas **180°**.
- **Grade removida**; 4 câmeras (**Perspectiva, Frente, Topo, Lado**); **pan com botão direito**.

### 12.2 Resultado

| Item | Valor |
|---|---|
| Faces / montadas | 23 / 19 |
| Dobradiças / rígidas | 18 / 0 |
| Vincos | **22/22 dobram** |
| Faixa z | −1,0 a +133 mm |
| Contatos | 4 (~1 mm) |
| Testes | 58 + 28 + 26 + 72 = 184 |

### 12.3 Pendências

- Direção/perfil inferidos; 4 contatos de ~1 mm; 4 recortes sem vinco; ArtiosCAD ausente; arte suspensa até avaliação.

### 12.4 Câmera 0.7.2 — OrbitControls e 6 vistas

- **OrbitControls** r128 local, com damping; esquerdo orbita, direito faz pan, roda zoom.
- **6 câmeras:** Perspectiva frente-direita e frente-esquerda (ambas em -Y), **Frente = face 8** (-Y), **Topo** (+Z alinhado em Y), **Lado direito** (+X) e **Lado esquerdo** (-X). Z é altura.
- Nenhuma vista fica atrás da caixa; sem inversão/salto ao sair de uma vista.
- Fechada mostra o **externo**; aberta mostra o **interior**. Arte interna/externa fica para a fase de materiais.

### 12.5 Barra de ângulo 0.7.3 — detente de 90°

- Arrastar a barra: **85°–95° → 90°**; fora da faixa segue normal (84→84, 96→96, 180→180).
- Vale para ângulo global e articulação individual.
- **Dobrar**, perfil, animação e câmeras não mudam.

### 12.6 Articulação 0.7.4 — seleção por clique

- **Sem droplist:** clicar na face do modelo (raycast, ≤4 px entre down/up) seleciona; destaque amarelo + contorno laranja.
- Clicar na mesma face ou fora da caixa **desmarca**; arrastar (>4 px) é órbita/pan e não seleciona.
- `angulos[face]` e `sinais[face]` persistem: trocar de face **não zera** as outras; o slider e o Sentido valem só para a face selecionada (Sentido desabilitado sem seleção).
- Sem seleção, a barra volta ao modo **global**.
- **Desdobrar** anima todas as faces até 0° (inverso do **Dobrar**, que reaplica o perfil); ambos limpam a seleção.
- Testes: 268 (58+28+26+129+27), 0 falhas.

### 12.7 Seleção múltipla 0.7.5 - Ctrl/Shift

- **Ctrl+clique** alterna a face na seleção (soma/remove); **Shift+clique** só soma; clique simples seleciona uma (e desmarca se for a única) e clique fora limpa tudo.
- `facesSelecionadas` é um mapa `face -> true`; a barra usa `definirArticulacoes(faces, graus, sinal)` e move **todas** as selecionadas, cada uma guardando o próprio ângulo.
- **Sentido +/-** (`definirSinais`) vale para o conjunto; desabilitado sem seleção.
- Rótulo `N faces · a, b, c` e info `N faces selecionadas (a, b, c) · sentido ± · X°`; Dobrar/Desdobrar limpam a seleção.
- Testes: 280 (58+28+26+129+39), 0 falhas. Evidência: `evidencias/selecao_multipla.png`.

### 12.8 Droplist de faces + dobras a 90° (0.7.6)

- **Droplist Face de volta**, junto com o clique: opções `todas as dobras` + as 18 faces com o pai; Ctrl/Shift ao escolher soma/remove.
- Sincronizado: clique no modelo atualiza a lista; com 2+ faces o primeiro item mostra `N faces · a, b, c`.
- **Perfil 90° em tudo:** a orelha ia a 180° e ficava deitada sobre o painel (parecia atravessar a face). Agora entra a 90° para dentro; a barra continua aceitando até 180° por face.
- Testes: 292 (58+28+26+129+51), 0 falhas.

### 12.9 Arte externa e arte interna (0.8.0)

- Pipeline: `faca3dArtes()` (inventário) → `faca3dExportarArte()` (PNG 2200 px por artboard, camadas técnicas ocultadas só na exportação e restauradas no `finally`) → `js/view/artes.js` (classificação externo/interno por nome sem caixa/acento + aviso em ambiguidade) → `js/view/three3d.js` (UV por face, duas malhas por face, `FrontSide`/`BackSide`).
- **A faca da primeira artboard é a única fonte de geometria** (filtro `f3dFiltrarPorArtboard(..., 0)`); a faca espelhada da segunda artboard é ignorada. Duas artes no mesmo caixa 3D, geometria única.
- Controles: Arte (ambas/externa/interna/nenhuma), **Espelhar interna**, **Atualizar artes**, Vista **Interior** (câmera dentro, fov 72°).
- Estado inicial: **planificado (0°)**; **Reset** volta a 0°; sem animação automática na abertura.
- Testes: **319** (58+28+26+129+51+27), 0 falhas. Evidências: `planificada.png`, `dobrada_frente.png`, `interior_verso.png`, `perfil_90.png`.

### 12.10 Próximos passos

- Validar artes reais (arquivo de produção com arte pixel/imagem) — hoje a arte é um único rótulo "Frente"/"Verso" (cliente).
- Visualização planificada com seleção independente externa/interna (sem alterar geometria), se necessário.
- Eventual "Zerar face" isolado, se necessário na prática.