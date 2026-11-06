# FACA 3D — Relatórios Técnicos

Histórico de relatórios por etapa. **Não substituir relatórios anteriores.**

---

## RELATÓRIO FACA 3D — ETAPA 0

**Status:** Concluída.

### 1. Objetivo da etapa

Executar a FASE 0: auditar a estrutura real do Mazurkytools, mapear a integração CEP, identificar pontos de extensão e recursos reaproveitáveis, propor a arquitetura de integração do FACA 3D e criar a documentação inicial. Sem implementar motor geométrico e sem alterar ferramentas existentes.

### 2. Implementações realizadas

Nenhuma implementação de produto. Foram realizadas:

1. Leitura integral do hub (`js/main.js`, 320 linhas), do `index.html`, do manifesto CEP e do dispatcher `jsx/host.jsx` (330 linhas).
2. Leitura de ferramentas representativas: `simplefaca` (classificação por SpotColor), `removerlinhas` (leitura de paths/âncoras/alças e coleções do DOM), `centerline` (UI, seleção de documentos), `caixa-maleta` (carga dinâmica de pdf.js) e `gerarLayout-ft` (fallback de leitura de arquivo).
3. Levantamento das 21 pastas em `convertidos/` e das 18 ferramentas registradas.
4. Confirmação, no código, das armadilhas de ExtendScript já documentadas no AGENTS.md.
5. Proposta de arquitetura em camadas, contrato de dados, estrutura de arquivos, forma de integração do botão e riscos.
6. Criação dos quatro documentos obrigatórios em `convertidos/faca3d/documentacao/`.

### 3. Arquivos criados

| Arquivo | Função |
|---|---|
| `convertidos/faca3d/documentacao/FACA_3D_PLAN.md` | Objetivo, arquitetura, estrutura de arquivos, fases, dependências, decisões, critérios de conclusão |
| `convertidos/faca3d/documentacao/FACA_3D_STATUS.md` | Etapa atual, implementado, pendente, testes, riscos, próxima etapa |
| `convertidos/faca3d/documentacao/FACA_3D_CHANGELOG.md` | Histórico cronológico da FASE 0 |
| `convertidos/faca3d/documentacao/FACA_3D_REPORT.md` | Este relatório |

### 4. Arquivos modificados

Nenhum. Não foram tocados `js/main.js`, `jsx/host.jsx`, `CSXS/manifest.xml`, `index.html`, `css/styles.css` nem qualquer arquivo de ferramenta existente.

### 5. Funcionamento (o que já funciona)

Nada do FACA 3D está implementado. O que já funciona no projeto e será reaproveitado:

- **Hub único:** `index.html` → `js/main.js` → grid de botões. Ao clicar, `abrirFerramenta(key)` faz `fetch` de `<dir>.html`, `css/<dir>.css` e `js/<dir>.js` com `cache: "no-store"` e `?v=Date.now()`, remove as tags `<script>` do HTML, injeta o corpo e o CSS (`<style id="mazurkyToolStyle">`) e executa o JS com `new Function(js)()`.
- **Ponte com o Illustrator:** `sendToHost(fn, args)` monta `fn(args)` e chama `csInterface.evalScript`. No host, `chamar()` executa `$.evalFile` do `.jsx` da ferramenta aberta, chama a função pedida e **reinstala os wrappers** no `finally`.
- **Seleção de ferramenta no host:** `carregarFerramenta(key, extRoot)` valida a existência do `.jsx` antes de abrir a aba.
- **Log central:** `mazurkyLog()` grava em `%APPDATA%\MazurkyTools\logs\mazurky.log`; o hub registra erros de status.
- **Retorno ao grid:** `window.close` e `CSInterface.closeExtension` são interceptados; ferramentas usam `window.close()`.
- **Persistência de configuração:** `localStorage["mazurky_<ferramenta>_config"]`.
- **Carregamento de biblioteca externa:** `<script>` criado dinamicamente pelo JS da ferramenta funciona no CEP (padrão comprovado com pdf.js na Caixa Maleta), contornando a remoção das tags `<script>` estáticas.
- **Redimensionamento do painel:** `window.resizeTo/moveTo` é usado hoje por ferramentas com preview (ex.: Remover Linhas), portanto é viável dar ao 3D uma área grande.

### 6. Testes realizados

Todos os testes desta fase foram de **inspeção estática** e verificação de ambiente. Não houve teste funcional porque não há código novo.

| # | Verificação | Comando/evidência | Resultado |
|---|---|---|---|
| 1 | Ferramentas registradas | leitura de `js/main.js` linhas 5–24 | 18 ferramentas, todas numeradas; `barcode` é a 18ª |
| 2 | Dispatcher do host | leitura de `jsx/host.jsx` linhas 8–31, 134–202 | mapa de 20 chaves; wrappers explícitos; `instalarWrappers()` no `finally` |
| 3 | Manifesto | `CSXS/manifest.xml` | `ExtensionBundleVersion="0.5.4"`, `ScriptPath=./jsx/host.jsx`, host `[29.0,99.9]` |
| 4 | Padrão de UI | `centerline.html` + `css/styles.css` | `#app`, `.header`, `.content`, `.status`, `.actions` |
| 5 | Carga dinâmica de lib | `caixa-maleta/js/caixa-maleta.js` 165–184 | `document.createElement("script")` + `onload`; funciona no CEP |
| 6 | Leitura de paths | `removerlinhas/jsx/removerlinhas.jsx` 17–74 | `pathPoints` com `anchor/leftDirection/rightDirection`; acesso 0-based |
| 7 | Classificação por spot | `simplefaca/jsx/simplefaca.jsx` 51–64 | `item.fillColor/strokeColor` + `typename === "SpotColor"` + `spot.name` |
| 8 | Fallback de arquivo local | `gerarLayout-ft/js/gerarLayout-ft.js` 655–666 | `fetch` → fallback `lerArquivo` no host |
| 9 | WebGL no CEP | `Invoke-WebRequest http://127.0.0.1:7777/json/list` | **falhou**: Illustrator não estava com o painel de debug aberto. Não medido |
| 10 | Integridade do repositório | `git status --short` | alterações pré-existentes do usuário (remoção de `gerarLayout`, edições em `lote/jsx/lote.jsx` e `js/main.js`) — não tocadas |

### 7. Problemas encontrados

1. **WebGL não verificado.** Não foi possível abrir o CDP nesta execução.
   Não é seguro assumir que `WebGLRenderer` do three.js funcione no CEP desta
   instalação. Isso precisa de medição na FASE 1.
2. **`host.jsx` é carregado pelo manifesto.** Registrar a ferramenta no
   dispatcher exige reiniciar o Illustrator **uma vez**; depois disso,
   fechar/reabrir a aba basta.
3. **Toda função nova do backend precisa de wrapper em `instalarWrappers()`**,
   senão o `evalScript` falha com "função não encontrada". O wrapper é
   reinstalado a cada chamada, mas precisa estar listado.
4. **Sem JSON no ExtendScript.** O retorno de `evalScript` é string; o contrato
   de dados precisa ser textual e versionado.
5. **Custo de DOM em documentos PDF não ativos** (~180 ms por acesso). Se o
   usuário pedir leitura de todos os documentos, é obrigatório ativar cada um
   antes de ler e restaurar o ativo no fim.
6. **`Layer.visibleBounds` retorna `null`** no Illustrator 30.x; limites devem
   ser medidos por itens.
7. **Diferença entre AGENTS.md e o repositório atual:** o AGENTS descreve
   `caixamaleta`/`gerarLayout` "(antigo)" no grid e o "removidos do grid"
   `tiler`/`fecharobjetos`, mas o `js/main.js` atual **não** os tem; em
   compensação tem `barcode`, que não está listado no AGENTS. O host ainda
   mantém `caixamaleta`, `gerarLayout`, `tiler` e `fecharobjetos` no mapa. Isso
   não bloqueia o FACA 3D, mas deve ser reconciliado depois.
8. **Documentação não tem local consolidado.** A pasta `doc/` da raiz é
   ignorada pelo git e excluída do instalador (recursos do CEP). Por isso a
   documentação do módulo foi criada em `convertidos/faca3d/documentacao/`.

### 8. Pendências

- Aprovar a arquitetura e as decisões D1–D5.
- FASE 1: botão, estrutura, tela inicial, ponte JSX e spike de WebGL.
- Reconciliar a divergência entre AGENTS.md e `js/main.js` (fora do escopo
  autorizado; apenas registrado).
- Definir uma faca real de referência para os testes da FASE 2 (o usuário deve
  indicar o arquivo; não usar PDF técnico do MDMBox).

### 9. Integridade do projeto

- Nenhum arquivo de ferramenta existente foi alterado.
- Nenhuma linha de `js/main.js`, `jsx/host.jsx`, `CSXS/manifest.xml` ou
  `index.html` foi modificada.
- Foram criados apenas 4 arquivos Markdown em uma pasta nova.
- As alterações que aparecem no `git status` (`gerarLayout` removido,
  `lote/jsx/lote.jsx` e `js/main.js` modificados) **já existiam** antes desta
  execução e não foram tocadas por mim.
- Reversão trivial: apagar `convertidos/faca3d/`.

### 10. Próxima etapa sugerida

FASE 1 — Botão e estrutura inicial, **sem iniciar as fases seguintes**:

1. Registrar `faca3d` em `js/main.js` (com `divisor: true`) e em
   `jsx/host.jsx` (mapa + wrapper `faca3dPing`/`faca3dLer`).
2. Criar `faca3d.html`, `css/faca3d.css`, `js/faca3d.js`,
   `js/core/loader.js` e `jsx/faca3d.jsx` (apenas funções de diagnóstico:
   versão do Illustrator, documento ativo, contagem bruta de paths por classe
   de cor — sem montar geometria).
3. Fazer um **spike** que reporte `navigator.userAgent`, presença de
   `WebGLRenderingContext`, `getContext("webgl")`/`webgl2`, renderer e
   limitações, para decidir D1.
4. Testar abrindo o painel real e registrando a saída no relatório da etapa.
5. Bumpar a versão nos três lugares exigidos.

Aguardando autorização.

### 11. Documentação

- `convertidos/faca3d/documentacao/FACA_3D_PLAN.md` (criado)
- `convertidos/faca3d/documentacao/FACA_3D_STATUS.md` (criado)
- `convertidos/faca3d/documentacao/FACA_3D_CHANGELOG.md` (criado)
- `convertidos/faca3d/documentacao/FACA_3D_REPORT.md` (criado, este relatório)

---

## RELATÓRIO FACA 3D — ETAPA 1

**Status:** Concluída.

### 1. Objetivo da etapa

Criar o botão FACA 3D no Mazurkytools e estabelecer toda a infraestrutura inicial de integração com o Illustrator. Ao clicar no botão, a ferramenta deve abrir sua própria interface, comunicar-se com o Illustrator e retornar informações reais do documento ativo. FASE 1 autorizada, sem motor geométrico.

### 2. Implementações realizadas

**Integração no Mazurkytools (3 arquivos modificados, aditivos):**

- `js/main.js`: nova entrada `faca3d: { dir: "faca3d", nome: "FACA 3D", version: "0.1.0", divisor: true }` ao final de `MAZURKY_TOOLS` — vira item 19 do grid, com divisor visual separando o grupo novo. Badge do hub subiu de `v0.5.4` para `v0.5.5`.
- `jsx/host.jsx`: nova chave `faca3d: "faca3d"` no mapa de ferramentas e wrapper `faca3dDiagnostico = function () { return chamar("faca3dDiagnostico", arguments); }` em `instalarWrappers()`.
- `CSXS/manifest.xml`: `ExtensionBundleVersion` e `ExtensionList Version` de `0.5.4` para `0.5.5`.
- `index.html`: `js/main.js?v=18` → `v=19`.

**Módulo FACA 3D (8 arquivos criados):**

| Arquivo | Função |
|---|---|
| `convertidos/faca3d/faca3d.html` | Interface: header, área de visualização (vazia até Fase 4), card de documento, inventário, cores especiais, configurações, compatibilidade gráfica, status. Sem tags `<script>` estáticas (o hub remove). |
| `convertidos/faca3d/css/faca3d.css` | Estilos com prefixo `faca3d-`, padrão visual do Mazurkytools (header, cards, botões, status, grid de visualização). |
| `convertidos/faca3d/js/faca3d.js` | Controlador único carregado pelo hub. Namespace `window.Faca3D`, carregamento de submódulos, decodificação do protocolo, UI (preenchimento de documento/inventário/spots/tipos), configurações em `localStorage`, diagnóstico e teste de WebGL. |
| `convertidos/faca3d/js/core/loader.js` | Carregador dinâmico de submódulos via `<script>` com cache-buster, evitando dependência de tags estáticas. |
| `convertidos/faca3d/js/core/protocol.js` | Contrato textual versionado `F3D|1|TIPO` com escape de `\|=\n\r`, decodificação com validação de versão/tipo, tratamento de erros (`VAZIO`, `FORMATO`, `VERSAO`, `LINHA`). |
| `convertidos/faca3d/js/core/units.js` | Conversão pt/mm, formatação de mm/duração/bytes. |
| `convertidos/faca3d/js/view/renderer.js` | Contrato do renderizador + diagnóstico de WebGL (`probeWebGL()`, `formatarRelatorio()`). |
| `convertidos/faca3d/jsx/faca3d.jsx` | Backend ExtendScript: inventário do documento ativo, somente leitura, protocolo textual. |

### 3. Arquivos criados

- `convertidos/faca3d/faca3d.html`
- `convertidos/faca3d/css/faca3d.css`
- `convertidos/faca3d/js/faca3d.js`
- `convertidos/faca3d/js/core/loader.js`
- `convertidos/faca3d/js/core/protocol.js`
- `convertidos/faca3d/js/core/units.js`
- `convertidos/faca3d/js/view/renderer.js`
- `convertidos/faca3d/jsx/faca3d.jsx`

### 4. Arquivos modificados

| Arquivo | Alteração | Justificativa |
|---|---|---|
| `js/main.js` | Nova entrada em `MAZURKY_TOOLS` + badge `v0.5.5` | Registro do botão FACA 3D como item 19 |
| `index.html` | `?v=18` → `?v=19` | Cache-buster do hub |
| `jsx/host.jsx` | Nova chave no mapa + wrapper `faca3dDiagnostico` | Ponte com o backend da nova ferramenta |
| `CSXS/manifest.xml` | `ExtensionBundleVersion` e `ExtensionList` para `0.5.5` | Convenção do projeto (3 lugares) |

Nenhum arquivo de ferramenta existente foi alterado.

### 5. Funcionamento comprovado

**Backend (ExtendScript, ES3, Illustrator 30.8.2 real via COM):**

O `faca3d.jsx` inventaria o documento sem alterá-lo. Testado com documento sintético de 13 itens (10 paths, 1 grupo, 1 composto, 1 texto, 1 oculto, 1 travado; 4 spots definidas):

- `faca3dDiagnostico("documento")` → `F3D|1|DIAG` com todos os campos preenchidos (APP_NOME, APP_VERSAO, DOC_NOME, DOC_CAMINHO, UNIDADES, ARTBOARDS, CAMADAS, SPOT_DEFINIDOS, ITENS, PATHS, PATHS_ABERTOS, PATHS_FECHADOS, GRUPOS, COMPOSTOS, RECORTES, GUIAS, OCULTOS, TRAVADOS, COM_TRACO, COM_PREENCHIMENTO, SPOT_OBJETOS, TEXTOS, IMAGENS, TEMPO_MS, listas SPOT/TRACO/PREENCHIMENTO).
- `faca3dDiagnostico("selecao")` com seleção vazia → `F3D|1|SEM_SELECAO`.
- `faca3dDiagnostico("selecao")` com 1 objeto selecionado → `F3D|1|DIAG` com contagem correta da seleção.
- Sem documento aberto → `F3D|1|SEM_DOC`.

**Protocolo (Node):**

- 23 testes passaram: decodificação de DIAG/SEM_DOC/SEM_SELECAO, tratamento de VAZIO/FORMATO/VERSAO/LINHA, preservação de nomes com `|` e `=` (escape `\e`), contagem de campos em listas, CMYK correto.
- Conversão pt/mm OK. Resposta do documento de teste em ~1 ms.

**Integridade do host:**

- `carregarFerramenta("faca3d", raiz)` → `ok` via `$.evalFile` do `host.jsx`.
- A correção do `Stack overrun` foi aplicada: o `.jsx` define `faca3dDiagnostico` como alias de `f3dDiagnostico`, pois `chamar()` resolve o nome via `eval()` e, sem o alias, entraria em recursão com o wrapper de `instalarWrappers()`.

### 6. Testes executados e resultados

| # | Teste | Método | Resultado |
|---|---|---|---|
| 1 | `carregarFerramenta("faca3d")` | COM + `$.evalFile(host.jsx)` | `ok` |
| 2 | Sem documento aberto | COM | `F3D|1|SEM_DOC` |
| 3 | Documento com 13 itens (paths, grupo, composto, texto, oculto, travado) | COM | `F3D|1|DIAG` com todos os campos preenchidos |
| 4 | Seleção vazia | COM | `F3D|1|SEM_SELECAO` |
| 5 | Seleção de 1 objeto | COM | `F3D|1|DIAG` com contagem da seleção |
| 6 | SpotColor com `|` e `=` no nome | COM + Node | Nome preservado |
| 7 | Protocolo malformado/vazio | Node | Erros `VAZIO`, `FORMATO`, `VERSAO`, `LINHA` |
| 8 | Conversão pt/mm | Node | OK |
| 9 | Sintaxe JS/JSX | `node --check` | 8 arquivos OK |
| 10 | Integridade do repositório | `git status` | Apenas alterações autorizadas |

### 7. Evidência do teste WebGL

O teste de WebGL **não foi executado no CEP real**. O código está pronto em `renderer.js` (`probeWebGL()` e `formatarRelatorio()`) e acionado pelo botão "Testar WebGL" da interface. O teste é real: cria um canvas, obtém contexto webgl/webgl2, lê `VERSION`, `VENDOR`, `RENDERER`, `SHADING_LANGUAGE_VERSION`, `MAX_TEXTURE_SIZE`, `MAX_VIEWPORT_DIMS`, extensões, `WEBGL_debug_renderer_info`, `isContextLost()` e executa `readPixels` verificando pixel vermelho.

**Bloqueio:** o painel CEP não está acessível via CDP (`127.0.0.1:7777` não responde) e o Illustrator MCP reporta `panel: down`. O Illustrator 2026 (30.8.2) está rodando, mas o painel de debug do CEP não foi aberto e a extensão MCP não está conectada. Testes via COM confirmam o backend, mas o ciclo completo do painel (fetch → new Function → renderer) depende de o painel estar carregado no Illustrator.

### 8. Resultado da comunicação CEP/JSX

- **Transporte textual versionado** (`F3D|1|...`) implementado e validado.
- **Wrapper `faca3dDiagnostico`** registrado em `instalarWrappers()` e reavaliado corretamente.
- **Resposta real do ExtendScript** obtida via COM para 4 cenários (sem doc, doc completo, seleção vazia, seleção unitária).
- **Escape de caracteres especiais** (`\`, `=`, `|`, `\n`, `\r`) testado e funcional.
- **Tamanho da resposta** diagnosticado: ~1 ms e ~500 bytes para documento de teste — dentro dos limites do `evalScript`.

### 9. Problemas encontrados

1. **Teste de WebGL não executado no CEP real.** Bloqueio de acesso ao painel CEP (CDP e MCP indisponíveis). O teste está pronto no código; requer execução manual no painel do Illustrator.
2. **Abertura completa da ferramenta no CEP não testada.** O ciclo `fetch` → `new Function` não pôde ser exercido sem o CEP acessível. A sintaxe de todos os arquivos foi verificada com `node --check`.
3. **Correção do `Stack overrun` aplicada.** O `chamar()` do `host.jsx` resolve `faca3dDiagnostico` via `eval()`. Sem o alias no `.jsx`, o nome resolvia para o próprio wrapper de `instalarWrappers()`, gerando recursão infinita. Corrigido e validado.
4. **Divergência AGENTS.md × repositório** (registrada na FASE 0): `barcode` está no `main.js` mas não no AGENTS; `caixamaleta`/`gerarLayout`/`tiler`/`fecharobjetos` aparecem no AGENTS ou host de forma desalinhada. Não bloqueia o FACA 3D; pendente de reconciliação fora do escopo autorizado.

### 10. Pendências

- Executar o teste de WebGL no painel do Illustrator e registrar o resultado.
- Validar o ciclo completo de abertura/fechamento da ferramenta no CEP.
- Confirmar que o retorno ao grid e a abertura de outra ferramenta existente funcionam sem regressão.
- Aprovação da FASE 2.

### 11. Integridade das ferramentas existentes

- Nenhum arquivo de ferramenta existente foi alterado.
- `git status` mostra apenas as alterações autorizadas: `js/main.js`, `index.html`, `jsx/host.jsx`, `CSXS/manifest.xml` e os novos arquivos em `convertidos/faca3d/`.
- As alterações preexistentes do usuário (`gerarLayout` removido, `lote/jsx/lote.jsx` e `js/main.js` modificados) **já existiam** e não foram tocadas.
- Reversão trivial: apagar `convertidos/faca3d/` e reverter os 4 arquivos modificados.

### 12. Documentação atualizada

- `convertidos/faca3d/documentacao/FACA_3D_PLAN.md` — atualizado para refletir a conclusão da FASE 1.
- `convertidos/faca3d/documentacao/FACA_3D_STATUS.md` — atualizado com etapa atual, implementações, testes e pendências.
- `convertidos/faca3d/documentacao/FACA_3D_CHANGELOG.md` — nova entrada da FASE 1 com arquivos criados/modificados, testes e problemas.
- `convertidos/faca3d/documentacao/FACA_3D_REPORT.md` — este relatório.

---

## RELATÓRIO FACA 3D — ETAPA 1.1

**Status:** Parcialmente concluída (validação operacional no CEP pendente de execução manual).

### 1. Objetivo da etapa

Validar a operação do painel CEP do FACA 3D e registrar o arquivo oficial de teste (`faca teste.pdf`) como referência para validação futura.

### 2. Implementações realizadas

**Registro do arquivo oficial de teste:**
- `faca teste.pdf` localizado em `C:\Users\user\Desktop\faca teste.pdf`.
- 75,135 bytes, criado em 11/05/2026 às 10:21:30.
- Criado `REFERENCIA_TESTE.md` com todos os detalhes do arquivo.

**Teste com `faca teste.pdf` via COM (Illustrator 30.8.2 real):**

| Campo | Valor |
|---|---|
| Documento aberto | `faca teste.pdf` (Caminho: `C:\Users\user\Desktop\faca teste.pdf`) |
| Camadas | 1 |
| Artboards | 1 |
| SpotColor definidas | 5 |
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

### 3. Arquivos criados

- `convertidos/faca3d/documentacao/REFERENCIA_TESTE.md` — registro do arquivo oficial de teste.

### 4. Arquivos modificados

| Arquivo | Alteração | Justificativa |
|---|---|---|
| `convertidos/faca3d/documentacao/FACA_3D_PLAN.md` | Registrado o caminho do arquivo oficial de teste | Documentar referência de teste |
| `convertidos/faca3d/documentacao/FACA_3D_STATUS.md` | Atualizado com resultados dos testes do PDF | Registrar estado da validação |
| `convertidos/faca3d/documentacao/FACA_3D_CHANGELOG.md` | Nova entrada da FASE 1.1 | Histórico cronológico |
| `convertidos/faca3d/documentacao/FACA_3D_REPORT.md` | Este relatório | Registro técnico |

### 5. Funcionamento comprovado

**Com `faca teste.pdf`:**
- O arquivo é acessível e contém elementos técnicos adequados para testes (contornos de corte e vinco com SpotColors).
- O backend `faca3dDiagnostico("documento")` retorna `F3D|1|DIAG` com 107 itens, 106 paths, 5 SpotColor definidas (22 Crease, 84 Cut), e todas as outras informações de inventário.
- Tempo de leitura: 10 ms — performance aceitável para documentos reais.

### 6. Testes executados e resultados

| # | Teste | Método | Resultado |
|---|---|---|---|
| 1 | Localização do `faca teste.pdf` | PowerShell | `C:\Users\user\Desktop\faca teste.pdf` (75,135 bytes) |
| 2 | Abertura do PDF no Illustrator | COM | Documento aberto com sucesso |
| 3 | Diagnóstico do PDF | COM | `F3D|1|DIAG` com 107 itens, 106 paths, 5 spots |
| 4 | Identificação de SpotColors | COM | Cut (84 objetos), Crease (22 objetos), CMYK extraído |
| 5 | Sem seleção (PDF) | COM | `F3D|1|SEM_SELECAO` |

### 7. Evidência do teste WebGL

**Não executado no CEP real.**

O teste de WebGL está implementado em `renderer.js` (`probeWebGL()` + `formatarRelatorio()`) e exposto via botão "Testar WebGL" na interface, mas não pôde ser executado pois:
- O painel CEP não está acessível via CDP (`127.0.0.1:7777` não responde).
- O Illustrator MCP reporta `panel: down`.
- CSInterface não está disponível via COM (só funciona dentro do contexto CEP).

**Instruções para teste manual:**
1. Abrir o Adobe Illustrator 2026.
2. Abrir o painel CEP "Mazurky Tools" (Window > Extensions > Mazurky Tools).
3. Clicar no botão "FACA 3D" (item 19 do grid).
4. Clicar em "Testar WebGL".
5. O resultado será exibido na área de compatibilidade gráfica do módulo.

### 8. Resultado da comunicação CEP/JSX

- **Transporte textual versionado** (`F3D|1|...`) implementado e validado via COM para 4 cenários.
- **Wrapper `faca3dDiagnostico`** registrado e funcionando corretamente.
- **Resposta real do ExtendScript** obtida para `faca teste.pdf` com 107 itens, 106 paths, 5 spots.
- **Escape de caracteres especiais** testado e funcional.
- **Tamanho da resposta:** ~10 ms para `faca teste.pdf` (107 itens).

### 9. Problemas encontrados

1. **Teste de WebGL não executado no CEP real.** Requer execução manual no painel do Illustrator.
2. **Abertura completa da ferramenta no CEP não testada.** O ciclo `fetch` → `new Function` não pôde ser exercido sem o CEP acessível.
3. **CSInterface não disponível via COM.** Não é possível testar operações de interface do CEP (abrir botão, carregar HTML/CSS/JS, clique em botões) via COM. Requer execução manual.
4. **Divórcio entre validação de backend (COM) e validação de interface (CEP).** O backend está validado, mas a interface do CEP precisa de validação manual.

### 10. Pendências

- Executar o teste de WebGL no painel do Illustrator.
- Validar o ciclo completo de abertura/fechamento da ferramenta no CEP.
- Confirmar que o retorno ao grid e a abertura de outra ferramenta existente funcionam sem regressão.
- Validar diagnóstico com documento aberto no CEP real.

### 11. Integridade das ferramentas existentes

- Nenhum arquivo de ferramenta existente foi alterado.
- Apenas alterações autorizadas foram feitas (`js/main.js`, `index.html`, `jsx/host.jsx`, `CSXS/manifest.xml` e novos arquivos em `convertidos/faca3d/`).
- Reversão trivial: apagar `convertidos/faca3d/` e reverter os 4 arquivos modificados.

### 12. Documentação atualizada

- `convertidos/faca3d/documentacao/FACA_3D_PLAN.md` — atualizado com registro do arquivo oficial de teste.
- `convertidos/faca3d/documentacao/FACA_3D_STATUS.md` — atualizado com resultados dos testes do PDF e pendências.
- `convertidos/faca3d/documentacao/FACA_3D_CHANGELOG.md` — nova entrada da FASE 1.1.
- `convertidos/faca3d/documentacao/FACA_3D_REPORT.md` — este relatório.
- `convertidos/faca3d/documentacao/REFERENCIA_TESTE.md` — criado com detalhes do arquivo oficial de teste.

### 13. Situação final da FASE 1

**FASE 1 — Parcialmente concluída.**

A infraestrutura está 100% implementada e validada via COM (Illustrator real). A validação operacional do painel CEP (abrir botão, carregar interface, executar diagnóstico, WebGL, retorno ao grid) está pendente de execução manual no Illustrator.

### 14. Próxima etapa sugerida

Executar validação manual no CEP (abrir painel, botão FACA 3D, diagnóstico, WebGL) e aguardar autorização para a FASE 2.

Não iniciar a FASE 2 sem nova autorização do responsável de arquitetura.

---

## RELATÓRIO FACA 3D — ETAPA 1.2 (resumo)

**Status:** Parcialmente concluída.

Relatório completo em `FACA_3D_REPORT_ETAPA_1_2.md`.

- Illustrator conectado via MCP: `connection_status(probe:true)` → panel `ok`, Adobe Illustrator **30.8.2**.
- Documento reconhecido: `faca teste.pdf` (artboard "externo", ~2613×2611 pt).
- Diagnóstico de backend refeito via COM (`host.jsx` + `faca3d.jsx`): `F3D\|1\|DIAG` com 107 itens, 106 paths, 5 SpotColors.
- WebGL, ciclo CEP/JSX, retorno ao grid e outra ferramenta: **não executados** — conclusão (incorreta) de que o CDP da porta 7777 não respondia. Corrigido na Etapa 1.3.

---

## RELATÓRIO FACA 3D — ETAPA 1.3

**Status:** Concluída com sucesso.

Relatório completo em `FACA_3D_REPORT_ETAPA_1_3.md`.

### 1. Objetivo da etapa

Encontrar uma forma de controlar a interface real do Illustrator e do painel CEP por automação Windows, criar uma prova de conceito reversível e, se funcionasse, executar o teste de WebGL dentro do painel real.

### 2. O que foi descoberto

- O bloqueio da Etapa 1.2 **não existia**: o CDP do painel estava ativo em `http://127.0.0.1:7777`.
  - `Get-NetTCPConnection -LocalPort 7777` retornava vazio (falso negativo).
  - `netstat -ano` mostra `127.0.0.1:7777 LISTENING 25796`.
  - `Invoke-WebRequest /json/list` → HTTP 200 com a página "Mazurky Tools".
- O log `CEPHtmlEngine12-ILST-30.8.2-com.mazurky.tools.panel.log` registra `DevTools listening on ws://127.0.0.1:7777/devtools/browser/...`.
- Processo dono da porta: `CEPHtmlEngine.exe` **PID 25796** (extensão `com.mazurky.tools.panel`, `windowid` 792558, `--remote-debugging-port=7777`).
- Windows UI Automation **não** expõe o conteúdo CEP: o Illustrator devolve 0 descendentes na árvore UIA.
- Python 3.12 existe, mas sem `pywinauto`/`comtypes`; **sem** AutoHotkey e **sem** WinAppDriver. Nada foi instalado.

### 3. Prova de conceito executada

Driver `%TEMP%\opencode\cep_cdp.mjs` (Node puro: `fetch` + `WebSocket` + `Runtime.evaluate` + `Page.captureScreenshot`), sem dependências.

| # | Ação | Resultado |
|---|---|---|
| 1 | Identificar a janela do Illustrator | PID 3916, `h=0x804EE`, classe `illustrator` |
| 2 | Identificar o painel CEP | PID 25796, página "Mazurky Tools" |
| 3 | Acessar a interface | DOM do hub disponível via CDP |
| 4 | Inventariar o grid | 19 botões; `data-tool="faca3d"` |
| 5 | Acionar FACA 3D | Montagem em **159 ms**; CSS 7.838 bytes aplicado |
| 6 | Executar diagnóstico | `faca teste.pdf`: 106 caminhos, Crease 22, Cut 84, 8 ms |
| 7 | Testar WebGL | WebGL 1 e 2 criados, ANGLE/NVIDIA GTX 1660, pixel OK, 21 ms |
| 8 | Voltar ao grid | 19 botões, status "Pronto.", badge `v0.5.5` |
| 9 | Abrir outra ferramenta | QR Code montou; retorno ao grid OK |

### 4. Resultado do diagnóstico (dentro do painel)

`faca teste.pdf` — 106 caminhos (106 abertos, 0 fechados), 1 grupo, 106 com traço, 0 com preenchimento, 106 com SpotColor, 0 textos, 0 imagens, Crease 22, Cut 84, 8 ms no Illustrator e 37 ms no painel. **Idêntico ao baseline da Etapa 1.1.**

### 5. Resultado do WebGL (dentro do CEP)

- `WebGLRenderingContext`: sim; `WebGL2RenderingContext`: sim; `OffscreenCanvas`: sim.
- WebGL 1.0 e WebGL 2.0 criados, sem perda de contexto, desenho/leitura de pixel **OK**.
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.16.1088)`.
- 33 extensões (WebGL 1) e 17 (WebGL 2); textura máx. 16384; viewport máx. 32767×32767.
- Tempo do teste: **21 ms**. Rodapé: `WebGL disponível neste painel (WebGL2).`

### 6. Evidências visuais

Em `convertidos/faca3d/documentacao/evidencias/`:

- `etapa1_3_diagnostico.png` — inventário de `faca teste.pdf` no painel.
- `etapa1_3_painel_no_ilustrador.png` — painel real dentro do Illustrator com FACA 3D.
- `etapa1_3_webgl_no_painel.png` — relatório de WebGL visível no painel dentro do Illustrator.
- `etapa1_3_retorno_grid.png` — grid restaurado com 19 ferramentas.

### 7. Limitações

1. O CDP exige `.debug` + `PlayerDebugMode=1` — configuração **de desenvolvimento**, que não pode ir para o instalador/produção.
2. A porta só existe quando a extensão é carregada com o `.debug` presente.
3. `element.click()` é clique sintético no DOM (dispara o handler real, mas não valida hit-testing). O clique físico foi validado à parte com `mouse_event`.
4. Automação por coordenadas é frágil (DPI/layout/painel recolhido).
5. UI Automation não expõe o CEP; pywinauto/AHK/WinAppDriver não estão instalados.
6. Com o painel recolhido o DOM continua vivo e o CDP funciona, mas não há conteúdo visível na tela.
7. Badge de versão da ferramenta não aparece (`main.js` procura `.title`; o HTML usa `.faca3d-title`) — apenas cosmético.

### 8. Reutilização

Sim. O `cep_cdp.mjs` pode ser o harness oficial de validação das próximas fases: abrir ferramenta, acionar botões, ler resultados, medir tempos e capturar screenshots de regressão, sem dependências e sem alterar o produto.

### 9. Integridade

- Código do FACA 3D e demais ferramentas: **não alterados** nesta etapa.
- `faca teste.pdf`: 75.135 bytes, mtime e SHA-256 (`03BC09CE...DEB41B`) **idênticos antes e depois**; aberto e fechado sem salvar.
- Documento ativo original restaurado.

### 10. Situação final

**FASE 1 concluída operacionalmente:** botão, carregamento no CEP, ponte CEP/JSX, diagnóstico real, WebGL real, retorno ao grid e outra ferramenta — todos comprovados no painel real.

**FASE 2 não autorizada.** Aguardando decisão do responsável de arquitetura.

---

## RELATÓRIO FACA 3D — ETAPA 2.5: VISUALIZAÇÃO 2D FUNCIONAL

**Status:** Concluída e demonstrada no painel CEP real.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

### 1. Objetivo

Entregar o primeiro marco visível: abrir o FACA 3D, clicar em **Ler faca** e **ver a faca real desenhada**, com cortes e vincos diferenciados, curvas preservadas, zoom, movimentação e ajuste automático.

### 2. Implementação

- `js/view/canvas2d.js`: renderizador Canvas 2D sem dependências.
- Bézier desenhada com os handles originais (`bezierCurveTo`), não com a polilinha achatada.
- Corte: `#d7373f` contínuo; vinco: `#1473e6` tracejado; faces translúcidas; contornos abertos com halo laranja; vértices de grau > 2 com anel laranja.
- Zoom por botões, roda e duplo clique; pan por arrasto; ajuste automático e no redimensionamento.
- Camadas alternáveis: Cortes, Vincos, Faces, Abertos, Ambíguos.
- Card de geometria e nota explícita do que não foi reconstruído.
- Estados de erro: sem documento, sem seleção, nenhum caminho, falha de geometria.

### 3. Teste real

| Verificação | Resultado |
|---|---|
| Ler faca | `Faca desenhada: 106 caminhos · 17 faces · 75 ms` |
| Resumo | 106 caminhos · 84 cortes · 22 vincos · 128 segmentos (108 retos, 20 curvos) |
| Pixels | 3.117 de corte, 1.217 de vinco, ~46.800 de face |
| Zoom | 100% → 156% por botão; 143% pela roda |
| Pan | hash do canvas alterado |
| Ajustar | 100% |
| Toggles | todos alteram o desenho (faces, vincos, cortes, abertos, ambíguos) |
| Seleção vazia | mensagem clara, canvas removido |
| Retorno | faca redesenhada ao voltar para Documento |

### 4. Evidências

- `documentacao/evidencias/etapa2_5_visualizacao_2d.png`
- `documentacao/evidencias/etapa2_5_visualizacao_2d_zoom.png`

### 5. Defeitos corrigidos

1. Camada “Abertos” não desenhava: `contornos[].arestas` trazia objetos `{id, direcao}`; normalizado para ids na topologia (e o visualizador aceita as duas formas).
2. Halo laranja com saltos por ignorar a direção das arestas: passou a usar a polilinha real do contorno.
3. Área útil pequena no painel ancorado: 220 → 320 px (340 px no layout estreito).
4. Estado visual de erro de geometria.

### 6. Limitações

- 56 contornos abertos e 52 ambiguidades são **marcados**, não resolvidos por suposição.
- Sem seleção/edição de faces e sem dobras nesta etapa.
- O painel ancorado limita a janela a 640 px; `window.resizeTo` é ignorado.
- Não há 3D nesta entrega.

### 7. Conclusão

Marco obrigatório atingido: a faca real aparece no painel com cortes e vincos diferenciados, curvas preservadas, zoom, pan, ajuste e camadas. A reconstrução topológica também está visível sem inventar geometria. Próxima entrega: **primeira visualização 3D**.

---

## RELATÓRIO FACA 3D — ETAPA 3.0: MONTAGEM 3D

**Status:** Concluída e demonstrada no painel CEP real.

**Arquivo de validação:** exclusivamente `C:\Users\user\Desktop\faca teste.pdf`.

### 1. Objetivo

Transformar a faca em **3D dobrável**, com interface mínima: a faca na tela, **Dobrar**, ângulo, **Reiniciar vista** e **← Ferramentas** para voltar à home. O 2D saiu da interface.

### 2. Implementação

- `js/view/three3d.js` + Three.js r128 local.
- Árvore de dobradiças: 11 retas dobram; 1 ligação não reta (contorno em “U” 0–1) fica rígida; 13 de 17 faces montadas.
- Direção das dobras inferida (+Z do pai, com busca de inversões se houver autointersecção).
- Animação 0° → 90°, slider 0–180°, órbita por arrasto, zoom pela roda.
- Nota honesta: o que ficou fora e o que é inferido.
- Botão **← Ferramentas** no cabeçalho.

### 3. Resultado

| Métrica | Valor |
|---|---|
| Faces montadas | 13 de 17 |
| Dobradiças | 11 |
| Ligação rígida | 1 (U 0–1) |
| Fora | 4 recortes só com corte |
| Cruzamentos a 90° | 0 |
| Tempo | 115–134 ms |

### 4. Teste real

Animação inicial (29° em ~300 ms → 90°), Dobrar, slider 0°/180°, rotação, zoom, reiniciar vista, retorno ao grid e reabertura — todos OK. 58/58 testes unitários.

### 5. Evidências

- `evidencias/etapa3_3d_plano.png`
- `evidencias/etapa3_3d_dobrando.png`
- `evidencias/etapa3_3d_montada.png`

### 6. Limitações

- Direção das dobras inferida (sem montanha/vale na faca).
- Ângulo global; a caixa real pode exigir 90°/180° por dobradiça.
- Ligação em “U” rígida.
- 4 recortes sem vinco ficam fora.
- **Arte ainda não é material** — `faca teste.pdf` não tem arte.
- Painel ancorado limitado a 640 px.

### 7. Próxima entrega

Arte como textura/material das faces, dobrando faca e arte juntas; depois dobra por dobradiça.

---

## RELATÓRIO FACA 3D — ETAPA 3.1: AUDITORIA DAS DOBRADIÇAS

**Status:** Concluída. Arte suspensa até avaliação.

### 1. Objetivo

Investigar por que alguns vincos não se comportavam como dobra, auditar os 22 paths `Crease` e implementar continuidade estrutural (lacunas, desalinhamentos e pontas que não alcançam cortes).

### 2. Auditoria

| Situação | Qtd. | Paths |
|---|---|---|
| Dobram | 15 | V1, V3, V5–V9, V12–V17, V19, V21 |
| Rígidos (U 0–1) | 3 | V0, V2, V4 |
| Sem par (borda livre) | 4 | V10, V11, V18, V20 |

Inventário completo (anchors/handles, faces, linha, conexões, extensões, motivo): `evidencias/auditoria_vincos_22.json`.

### 3. Structural Line Resolver

- 22 segmentos → 18 linhas estruturais.
- 4 pontes virtuais de 60 mm (lacunas dos recortes em V5/6/7 e V13/14/15).
- 8 extensões virtuais; 22 conexões rejeitadas por ângulo, desalinhamento, lacuna ou cruzamento.
- Tolerâncias proporcionais: 2°, 0,356 mm de projeção, 7,13 mm de lacuna, 106,9 mm de lacuna com mesmo par de faces.
- Eixos de dobradiça derivados de UMA linha estrutural; mais de uma linha → rígido.
- Geometria original e PDF intactos.

### 4. Diagnóstico visual

Botão **Diagnóstico**: faces, vincos por status, pontes verdes, extensões, eixos/sentido e conexões rejeitadas (×). Clique mostra path, faces, status, motivo, linha, conexões e hierarquia.

### 5. Testes

- 58/58 geometria (existentes).
- 28/28 Structural Line Resolver.
- 26/26 painel: hierarquia, eixos fixos, sentido e 0/45/90/180°, com **0 cruzamentos**.
- 4/4 cliques no diagnóstico.

### 6. Correções

Paralelas a 3 mm não são mais fundidas; conexões redundantes eliminadas; pontes não cruzam cortes; extensões só com alvo válido; canvas do diagnóstico estável ao selecionar.

### 7. Limitações

- 4 vincos de borda livre não podem dobrar (uma só face).
- U 0–1 permanece rígido (três linhas, sem eixo único).
- Direção montanha/vale inferida; ângulo global.
- Arte ainda não aplicada.

### 8. Evidências

`auditoria_diagnostico.png`, `auditoria_vincos_22.json`, `etapa3_3d_plano.png`, `etapa3_3d_dobrando.png`, `etapa3_3d_montada.png`, backup `0.4.0/`.

---

## RELATÓRIO FACA 3D — ETAPA 3.2: REVISÃO CRÍTICA DO MOTOR DE DOBRAGEM

**Status:** correções aplicadas; dobragem **não** declarada concluída.

### 1. Defeitos encontrados

1. A otimização de cruzamentos invertia paredes/abas para baixo: z entre **−133 e +205 mm**.
2. Ângulo global 90° não representa a caixa: paredes/tampa 90°, abas/orelhas 180°.
3. A face 1 (“U”) é um aro com canto em bico; subdividir exigiria um corner slit inexistente.

### 2. Correções

- Sentido pelo interior da caixa (centro da raiz; nunca abaixo da base).
- Perfil por profundidade: 90° / 180°.
- Modo **Articulação** (uma dobradiça isolada, 0–180°, sentido ±).
- Diagnóstico com eixos, sentidos, pontes, extensões, rejeições e subdivisão.
- Módulo de subdivisão implementado; não cria corte sem evidência.

### 3. Resultado

| Item | 0.5.0 | 0.6.0 |
|---|---|---|
| Faixa z | −133…+205 | **0…+133** |
| Penetrações | 2 + contatos | **0** |
| Contatos de topo | 5 | **4** |
| Faces/dobradiças/rígidas | 13/11/1 | 13/11/1 |
| Articulações individuais | — | **44/44** |

15 vincos dobram; V0/V2/V4 são rígidos (U) e V10/V11/V18/V20 são de borda livre. Todos os funcionais se movem; nenhuma articulação em corte.

### 4. Testes

58/58 geometria + 28/28 estrutural + 26/26 painel + 44/44 articulações = **156**.

### 5. Evidências

`montagem_perfil.png`, `antes_0_5_0.png`, `perfil_abas180.png`, `art_*.png`, `auditoria_diagnostico.png`, `auditoria_vincos_22.json`.

### 6. Pendência

Decidir entre tampa rígida definitiva ou corner slit para V0/V2/V4; revisar na origem a classificação de V10/V11/V18/V20. Arte suspensa.

---

## RELATÓRIO FACA 3D — ETAPA 3.3: TODOS OS 22 VINCOS DOBRAM (0.7.0)

**Status:** correções aplicadas; 22/22 vincos dobram.

### 1. Correções

1. **Somente camada FACA** (e subcamadas); demais camadas ignoradas; sem FACA → erro claro.
2. **Tolerância de T** 1e-9 → 1e-6: as abas V10/V11/V18/V20 fecham e dobram.
3. **Anel em U** dividido nos bicos em 3 painéis (21/22/23): V0/V2/V4 dobram.
4. **Curvas** das orelhas preservadas (82 pontos).
5. **Perfil**: abas/saia 90°, somente orelhas 180° (aba 12 em 90°).
6. **Grade removida**, 4 câmeras (**Perspectiva, Frente, Topo, Lado**), **pan com botão direito**.

### 2. Resultado

| Item | Valor |
|---|---|
| Caminhos (FACA) | 106 |
| Faces / montadas | 23 / 19 |
| Dobradiças / rígidas | 18 / 0 |
| Vincos | **22/22 dobram** |
| Faixa z | −1,0 a +133 mm |
| Contatos | 4 (~1 mm) |
| Testes | 184 |

### 3. Testes

58/58 geometria + 28/28 estrutural + 26/26 painel + 72/72 articulações.

### 4. Evidências

`auditoria_diagnostico.png` (22 dobram), `vista_z_topo_0.png` (curvas), `vista_iso_sem_grade.png`, `vista_x.png`, `vista_z.png`, `art_*.png`, `auditoria_vincos_22.json`.

### 5. Limitações

Direção/perfil inferidos; 4 contatos de ~1 mm; 4 recortes sem vinco; ArtiosCAD ausente; arte suspensa.

---

## RELATÓRIO FACA 3D — ETAPA 3.4: 4 CÂMERAS COM ORBITCONTROLS (0.7.1)

**Status:** concluída.

### 1. Correção

- **OrbitControls** r128 local: órbita com damping, sem inversão e sem salto entre vistas.
- **4 câmeras:** Perspectiva (+Y), Frente (+Y), Topo (Z alinhado em Y) e Lado (+X). Z é altura; modelo não rotacionado.
- **Esquerdo orbita**, **direito faz pan**, **roda zoom**.
- Perspectiva voltou a mostrar a **frente** da caixa.

### 2. Resultado

Geometria inalterada: 19/23 faces, 18 dobradiças, 0 rígidas, **22/22 vincos dobram**, 4 contatos de ~1 mm.

### 3. Testes

58/58 geometria + 28/28 estrutural + 26/26 painel + 72/72 articulações = **184**.

### 4. Evidências

`camera_perspectiva.png`, `camera_frente.png`, `camera_topo.png`, `camera_lado.png`.

### 5. Pendências

Direção/perfil inferidos; 4 contatos de ~1 mm; 4 recortes sem vinco; ArtiosCAD ausente; arte suspensa.

---

## RELATÓRIO FACA 3D — ETAPA 3.5: 6 CÂMERAS (0.7.2)

**Status:** concluída.

### 1. Câmeras

- **Frente = face 8** (-Y) — corrigido: antes mostrava as costas.
- **Lado direito** (+X, face 5) e **Lado esquerdo** (-X, face 11).
- **Perspectiva frente-direita** (+X, -Y, +Z) e **frente-esquerda** (-X, -Y, +Z): ambas na frente, nunca atrás.
- **Topo** (+Z) alinhado em Y.
- OrbitControls com damping; esquerdo orbita, direito pan, roda zoom.

### 2. Dobra

Inalterada: 19/23 faces, 18 dobradiças, 0 rígidas, **22/22 vincos dobram**, 4 contatos de ~1 mm.

### 3. Testes

184 (58+28+26+72), 0 falhas.

### 4. Evidências

`camera_perspectiva_direita.png`, `camera_perspectiva_esquerda.png`, `camera_frente.png`, `camera_topo.png`, `camera_lado_direito.png`, `camera_lado_esquerdo.png`.

### 5. Observação

Fechada, a vista mostra o **externo**; aberta, o **interior**. A arte interna/externa fica para a fase de materiais; a dobra não muda.

---

## RELATÓRIO FACA 3D — ETAPA 3.6: DETENTE DE 90° (0.7.3)

**Status:** concluída.

### 1. Comportamento

- Arrastar a barra **Ângulo**: qualquer valor entre **85° e 95°** vira **90°**; o polegar e o rótulo pulam para 90.
- 84 → 84; 85 → **90**; 88 → **90**; 90 → 90; 93 → **90**; 95 → **90**; 96 → 96; 180 → 180.
- Vale para o ângulo global e para a articulação individual.
- **Dobrar**, perfil, animação e câmeras não mudam.

### 2. Testes

184 (58+28+26+72), 0 falhas; snap verificado em 0/84/85/88/90/93/95/96/180 e no modo articulação.

### 3. Versão

FACA 3D 0.7.3 · painel v0.11.3 · `index.html?v=28` · manifesto 0.11.3.

---

## RELATÓRIO FACA 3D — ETAPA 3.7: ARTICULAÇÃO POR CLIQUE (0.7.4)

**Status:** concluída.

### 1. Seleção da face

- O droplist de articulação foi **removido**. A face é escolhida **clicando no modelo** (raycast do Three.js sobre as malhas montadas).
- O clique é separado do arrasto: deslocamento de até **4 px** entre `pointerdown` e `pointerup`. Acima disso é órbita/pan do OrbitControls e nada é selecionado.
- A face selecionada recebe **material amarelo** e **contorno laranja** (linha sem teste de profundidade, sempre visível).
- **Clicar na mesma face** desmarca; **clicar fora da caixa** (raycast sem alvo) também desmarca. Sem seleção, o rótulo volta para **“todas as dobras”** e a barra volta ao modo global.
- O cursor vira “pointer” quando o ponteiro está sobre uma face articulável.

### 2. Ângulo por face

- `estado.angulos[face]` e `estado.sinaisOverride[face]` são persistentes. `definirArticulacao(face, graus, sinal)` altera **somente** a face indicada; as demais mantêm ângulo e sentido.
- O botão **Sentido +/−** vale só para a face selecionada e fica **desabilitado** quando não há seleção.
- O slider mostra o ângulo da face selecionada ao trocar de seleção e aplica o snap **85–95 → 90**.
- **Desdobrar** (novo) anima todas as faces até 0°, o inverso do **Dobrar** (reaplica o perfil). Os dois limpam a seleção.

### 3. Testes

| Suíte | Resultado |
|---|---|
| Geometria | 58/58 |
| Structural Line Resolver | 28/28 |
| Painel | 26/26 |
| Articulações (18 faces, persistência, sentido, snap) | 129/129 |
| Seleção por clique + Desdobrar/Dobrar | 27/27 |
| **Total** | **268** |

Destaques: 18/18 faces clicáveis na vista plana (topo), 60° move **somente** a subárvore da face, eixo fixo < 1e-6; face A em 40° continua em 40° depois de mexer na face B em 120°.

### 4. Versão

FACA 3D 0.7.4 · painel v0.11.4 · `index.html?v=29` · manifesto 0.11.4.

### 5. Evidências

`evidencias/selecao_face_0.png` (tampa) e `evidencias/selecao_face_22.png` (saia U), com destaque e rótulo da face.

---

## RELATÓRIO FACA 3D — ETAPA 3.8: SELEÇÃO MÚLTIPLA (0.7.5)

**Status:** concluída.

### 1. Modificadores de clique

- **Clique simples:** seleciona **só** aquela face; se ela já era a única selecionada, **desmarca**. Clicar fora da caixa limpa tudo.
- **Ctrl+clique** (ou ⌘ no macOS): **alterna** a face na seleção — soma se não estava, remove se estava.
- **Shift+clique:** **só soma** (não remove).
- O arrasto continua separado: acima de **4 px** entre `pointerdown` e `pointerup` é órbita/pan e não mexe na seleção.

### 2. Seleção múltipla

- `estado.facesSelecionadas` é um mapa `face -> true`; `listaSelecionadas()` devolve as faces em ordem crescente. `faceSelecionada()` continua sendo a **face de referência** (a última clicada, ou a primeira da lista após uma remoção).
- O destaque é aplicado a **todas** as selecionadas (material amarelo) e o contorno laranja é montado num único `LineSegments` com o contorno de cada face.
- **A barra move todas as selecionadas:** `definirArticulacoes(faces, graus, sinal)` grava `angulos[face]`/`sinaisOverride[face]` somente para as faces da lista; as demais mantêm o que já tinham.
- **Sentido +/-** (`definirSinais`) vale para todas as selecionadas; fica desabilitado sem seleção.
- **Rótulo:** `todas as dobras` (sem seleção) · `face N (de P)` (uma) · `N faces · a, b, c` (várias). A linha de info mostra `N faces selecionadas (a, b, c) · sentido ± · X°`.
- **Dobrar** e **Desdobrar** limpam a seleção inteira (e o estado do controlador acompanha).
- A dica no tooltip/rótulo passou a mencionar **Ctrl+clique soma faces**.

### 3. Testes

| Suíte | Resultado |
|---|---|
| Geometria | 58/58 |
| Structural Line Resolver | 28/28 |
| Painel | 26/26 |
| Articulações (18 faces, persistência, sentido, snap) | 129/129 |
| Seleção por clique, multi-seleção + Desdobrar/Dobrar | 39/39 |
| **Total** | **280** |

Destaques da suíte de seleção: Ctrl+clique soma 3 faces (0, 2, 3) e o slider a 120° move as duas selecionadas; remover uma face com Ctrl **não** altera o ângulo dela; somar outra face **não** altera o ângulo das já selecionadas; clique sem Ctrl reduz para uma; Shift+clique soma; Dobrar limpa a seleção e volta ao rótulo global.

### 4. Versão

FACA 3D 0.7.5 · painel v0.11.5 · `index.html?v=30` · manifesto 0.11.5.

### 5. Evidências

`evidencias/selecao_multipla.png` — faces **0, 2 e 3** selecionadas a **45°**, rótulo `3 faces · 0, 2, 3`.

---

## RELATÓRIO FACA 3D — ETAPA 3.9: DROPLIST DE FACES + DOBRAS A 90° (0.7.6)

**Status:** concluída.

### 1. Droplist de faces

- O **droplist Face** voltou, agora **junto** com a seleção por clique (nenhum dos dois foi removido).
- Opções: `todas as dobras` + as **18 faces articuláveis**, cada uma com o pai (`face 22 (de 0)`), montadas em `montarListaFaces()` a partir de `viewer.articulaveis()`/`viewer.articulacoes()`.
- Escolher na lista chama `selecionarFace(face, modo)`: **sem modificador** substitui a seleção; **Ctrl** (ou ⌘) **alterna**; **Shift** só **soma**. O estado do modificador vem de `keydown`/`keyup` no documento (`estado.teclasMod`).
- **Sincronização:** `atualizarFaceUI()` escreve o valor do droplist a cada mudança de seleção (clique, Ctrl+clique, Dobrar, Desdobrar) e, com **2+ faces**, o primeiro item passa a mostrar `N faces · a, b, c` com valor vazio.
- O rótulo de texto ao lado (`face N (de P)` / `N faces · …` / `todas as dobras`) continua igual, então os testes antigos seguem válidos.

### 2. Perfil de dobra em 90°

- `perfilPadrao()` agora devolve **90° para todas as dobras articuláveis**; antes usava `profundidade >= 4 → 180°`, o que mandava as **orelhas 2/3** para 180°.
- Em 180° a orelha ficava **coplanar ao painel vizinho**, aparecendo como uma aba "por entre a face" (contorno curvo atravessando o painel). Em 90° ela entra para dentro da caixa e a vista externa fica limpa.
- Nada foi perdido em flexibilidade: a barra **Ângulo** continua aceitando **0–180°** por face ou por conjunto selecionado.
- Textos atualizados para `montagem por perfil (todas as dobras 90°)` e `perfil: todas as dobras 90°` na nota.

### 3. Testes

| Suíte | Resultado |
|---|---|
| Geometria | 58/58 |
| Structural Line Resolver | 28/28 |
| Painel | 26/26 |
| Articulações (18 faces, persistência, sentido, snap) | 129/129 |
| Seleção (clique, droplist, multi-seleção) + Desdobrar/Dobrar | 51/51 |
| **Total** | **292** |

Novos casos: droplist existe e lista `18 + 1` opções, começa em `todas as dobras`, seleciona a face, troca (substitui), **Ctrl soma**, acompanha a seleção por clique, volta para `todas as dobras` limpando a seleção, e `perfilPadrao()` só tem 90°.

### 4. Versão

FACA 3D 0.7.6 · painel v0.11.6 · `index.html?v=31` · manifesto 0.11.6.

### 5. Evidências

`evidencias/selecao_droplist.png` (face 22 escolhida pelo droplist, vista topo a 0°) e `evidencias/perfil_90.png` (caixa fechada em 90°, sem aba sobre o painel).