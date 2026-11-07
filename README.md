# FACA 3D

Extensão CEP independente para o Adobe Illustrator. Lê a faca de uma embalagem (camada `FACA`) e a monta em 3D, com dobra por articulações, arte externa e interna mapeadas e diagnóstico de vincos.

- Bundle CEP: `com.faca3d`
- Menu no Illustrator: **Janela > Extensões > 3D Faca**
- Versão: 0.8.0
- Compatibilidade: Adobe Illustrator 2024+ (host `ILST [29.0,99.9]`)

## Requisitos

- Adobe Illustrator 2024 ou superior.
- `PlayerDebugMode = 1` em `HKCU\Software\Adobe\CSXS.<n>` (necessário para extensão não assinada).

## Instalação

1. Copie o conteúdo do repositório (exceto `.git`) para `%APPDATA%\Adobe\CEP\extensions\com.faca3d`.
2. Reinicie o Illustrator.
3. Abra o painel em **Janela > Extensões > 3D Faca**.

Alterações no `manifest.xml` exigem reinício; demais arquivos bastam fechar/reabrir a aba. Cache antigo: `%TEMP%\cep_cache\ILST_*_com.faca3d`.

## Estrutura

```
com.faca3d/
  CSXS/manifest.xml
  faca3d.html
  css/
  js/ (core/, view/, vendor/, CSInterface.js, faca3d.js)
  jsx/ (host.jsx, faca3d.jsx)
  testes/
  documentacao/
  icons/
```

## Testes

Suites Node (geometria pura, sem Illustrator):

```
node testes/testes-geometria.mjs      # 126/126
node testes/testes-estruturais.mjs    # 28/28
```

Suites do painel (`testes/*.js`) rodam dentro do painel aberto via CDP na porta 7778. Sensíveis ao estado: recarregue o painel entre suítes.

## Dependências

- Adobe CSInterface.js (incluído).
- Three.js + OrbitControls (vendored em `js/vendor/`).
- ExtendScript (JSX) no Illustrator.

## Armazenamento local

- Dobras salvas: `%APPDATA%\FACA3D\dobras\<doc>-<chave>.json`.
- Logs: `%APPDATA%\FACA3D\logs\faca3d.log`.

## Licença

Uso interno.