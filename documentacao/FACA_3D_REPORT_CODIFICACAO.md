# FACA 3D — Correção de Codificação (UTF‑8 × Windows‑1252)

**Escopo:** extensão Mazurky Tools como um todo (hub + ferramentas + FACA 3D).
**Data:** 2026-11-06 · **Versão:** FACA 3D 0.8.0 · painel v0.11.7
**Tipo:** diagnóstico e correção de texto corrompido (mojibake). Nenhuma regra de negócio foi alterada.

---

## 1. Objetivo

Localizar a causa dos acentos exibidos como sequências tipo `Ã£`, `Ã§`, `Ã©` na extensão e corrigir tudo de forma **cirúrgica**, sem conversão em massa de arquivos.

## 2. Diagnóstico (o que estava errado)

Auditoria de **731 arquivos** (`.html .js .jsx .css .json .md .txt .cfg .xml .mjs`) com decodificador UTF‑8 estrito (`TextDecoder("utf-8", { fatal: true })`) e heurística de mojibake.

**Somente `js/main.js`** estava com duplo código de caracteres (UTF‑8 reinterpretado como cp1252/latin1 e gravado de novo como UTF‑8). 29 linhas de manifesto, todos os `.html` têm `<meta charset="utf-8">` — a estrutura estava correta; o hub é que estava corrompido.

### 2.1 Corrompidos em `js/main.js`

| Linha | Antes | Depois |
|---|---|---|
| 1 | `main.js â€” hub do painel` | `main.js — hub do painel` |
| 2 | `extensÃ£o Ãºnica` | `extensão única` |
| 3 | `mÃºltiplas entradas` | `múltiplas entradas` |
| 16 | `Diminuir ResoluÃ§Ã£o` | `Diminuir Resolução` |
| 23 | `CÃ³digo de Barras` | `Código de Barras` |
| 12 | `\`nome: "FACA ARD (â†') VETOR"\`` | `(→) VETOR` |
| 125 | `CSInterface nÃ£o inicializado` | `CSInterface não inicializado` |

Backup pré‑correção: `%TEMP%\opencode\main.js.bak`.

## 3. O que está correto (confirmado, sem alterações)

- **Todos os `.html`** têm `<meta charset="utf-8">`.
- Todos os `.js/.jsx/.css/.json/.xml/.cfg` decodificam como UTF‑8 válido.
- **host.jsx** já grava/lê seus arquivos com `f.encoding = "UTF-8"`.
- **localStorage**, **evalScript** (ida e volta), **restauração/gravação do cache de FT** usam e devolvem UTF‑8 corretamente.
- Comunicação CEP ↔ ExtendScript: teste ida‑e‑volta com as frases completas e com todo o alfabeto (`á à â ã é ê í ó ô õ ú ç Á Ã É Ó Õ Ú Ç`) — **sem perdas**.
- **Nomes anteriores dos painéis/bundles** e `<Menu>` ("Mazurky Tools") não tinham mojibake.

## 4. Testex executados (Illustrator via harness CDP 7777)

| Onde | Verificação | Resultado |
|---|---|---|
| hub (grid) | 19 cartões — nomes e acentos | ✅ exibem corretos |
| 19 ferramentas | leitura de `innerText` + inputs/placeholders/titles/aria‑label | ✅ nenhum mojibake |
| evalScript | alfabeto completo ida‑e‑volta | ✅ idêntico |
| URLs amigáveis (`file:///`) | `fetch()` de PNG | ✅ carrega corretamente |
| localStorage | acento + reload | ✅ íntegro |
| Cache de FT (arquivo) | grava+lê JSON com acentos | ✅ íntegro |
| Nome de camada com acento | `Dimensão ção` lida via ExtendScript | ✅ exibida corretamente |
| Arquivo `faca3d_arte_teste.ai` (fixture) | imprint de acentos | ✅ íntegro |

**Texto completo de verificação:**
`á à â ã é ê í ó ô õ ú ç Á Ã É Ó Õ Ú Ç` + frases:
`Configuração da ferramenta. Dimensão da embalagem. Seleção de objetos. Informações do documento. Cotas e medidas. Concluído com sucesso.`

## 5. Regras observadas

- Nenhum arquivo foi convertido "no atacado"; apenas o bloco de texto real que decodifica para UTF‑8 válido foi reparado.
- Backup de `js/main.js` \`ANTES\` da correção em `%TEMP%\opencode\main.js.bak`.
- Nenhum PDF foi modificado; a integridade de `Faca teste.pdf` foi verificada (abaixo).

## 6. Estado atual dos arquivos

```
js\main.js                              UTF‑8, crlf, 7312 linhas → corrigido
CSS/HTML/JSX                            sem alteração
convertidos\frenteverso\js\frenteverso.js   linha removida: csInterface.setWindowTitle(...)
convertidos\caixa-maleta\js\caixa-maleta.js        (idem)
convertidos\caixa-maleta-ft\js\caixa-maleta-ft.js  (idem)
```

Os três `setWindowTitle(...)` foram removidos porque forçavam um nome antigo
e não eram restaurados pelo hub; o painel passou a definir **"Mazurky Tools"**
em `init()` e em `voltar()` (`definirTituloPainel`), sem alterar o ID interno da
extensão, o `manifest.xml` (já correto: `<Menu>` já era `Mazurky Tools`) ou o
`.debug`.

## 7. Integridade dos documentos originais

| Arquivo | Tama‑nho | SHA‑256 |
|---|---|---|
| `C:\Users\user\Desktop\faca teste.pdf` | 100 928 B | `99C5338B4C76980761AED5CD1F9E841F2B99239212D36A469735073470A03174` |

O documento **não foi aberto, salvo ou modificado** durante os testes da
codificação. A ferramenta FACA 3D apenas o **lê**.

## 8. Limitações conhecidas

- Não foi possível testar visualmente em outras máquinas/sistemas; os testes foram feitos na UNIÃO deste ambiente (Windows + Illustrator 2026 + CEP 12).
- Se algum `.html` com `<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">` for criado futuramente, os textos serão lidos como cp1252 nesse arquivo; a regra é: **sempre UTF‑8**.
