# 3D Faca — Salvar/restaurar os ângulos definidos à mão

## Objetivo

Guardar os ângulos (e sentidos) que o usuário ajusta manualmente, por faca, para
que voltem ao reler o documento ou depois de reiniciar o Illustrator.

## Onde fica

`%APPDATA%\MazurkyTools\faca3d\dobras\<documento>-<chave>.json`

- `<documento>`: nome do arquivo sanitizado.
- `<chave>`: `engine.chaveDobra(res)` — hash (8 hex) da assinatura da geometria
  (documento, caminhos, faces, caixa e soma das áreas).
- Faca diferente (ou geometria alterada) gera outra chave: o arquivo antigo não
  é aplicado por engano.

## Conteúdo salvo

```json
{
  "versao": 1,
  "documento": "faca teste.pdf",
  "chave": "faca-teste-pdf-1a2b3c4d",
  "anguloGlobal": 90,
  "angulos": { "0": 90, "1": 45, "2": 120, "3": 90 },
  "sinais": { "2": -1 },
  "base": { "raiz": 22, "manual": true },
  "salvoEm": "2026-11-06T19:00:00.000Z"
}
```

## Interface

Na barra de ferramentas, grupo **Dobra salva**:

- **Salvar ângulos** — grava a configuração atual (ângulos por face, ângulo
  global, sentidos invertidos e a base fixa usada). Status: “Ângulos salvos
  (N dobra(s) · chave)”.
- **Restaurar** — lê o arquivo da faca e reaplica. Sem arquivo: “Nenhum ângulo
  salvo para esta faca.”

Ao **ler a faca** o painel tenta restaurar sozinho (silencioso): se existir
arquivo para aquela chave, a montagem abre já com os ângulos salvos. A base
fixa salva é aplicada antes dos ângulos (os ângulos são relativos à árvore);
a câmera não é reposicionada.

## Núcleo

- **`jsx/faca3d.jsx`**: `faca3dSalvarDobras(chave, texto)`,
  `faca3dLerDobras(chave)`, `faca3dApagarDobras(chave)` (ES3, `File`/`Folder`
  em `Folder.userData`; o painel monta/lê o JSON).
- **`js/core/geometry-engine.js`**: `chaveDobra(resultado)` (djb2 da assinatura).
- **`js/view/three3d.js`**: `normalizarDobras(config, montagem, articulaveis)`
  (0–180 por face, reserva pelo ângulo global, sentidos só em articuláveis;
  exportada para teste) e `aplicarDobras(config, rotulo)` no viewer.
- **`js/faca3d.js`**: coletar/aplicar/salvar/restaurar, restauração automática
  na leitura e os botões.

## O que NÃO muda

- Leitura da faca, triangulação/furos, arte externa/interna, animação e ciclo de
  renderização continuam iguais. A versão do plugin **não** foi alterada (0.8.0).

## Testes

Node (`testes/testes-geometria.mjs`, 126/126):

- `chaveDobra`: 8 hex, estável para a mesma geometria, muda quando a faca muda,
  aceita assinatura em texto.
- `normalizarDobras`: ângulo próprio preservado, face sem valor usa o global,
  rígidas/raiz não recebem dobra, clamp 0..180, sentido −1 só nas articuláveis,
  configuração vazia zera.

Painel (`testes/testes-dobras.js`):

1. salvar 90° em todas as dobras (grava arquivo real);
2. zerar e restaurar → volta 90° e o slider acompanha;
3. **Ler novamente** → restauração automática;
4. ângulo e sentido por face (45° / 120° com sentido −1) volta após salvar e
   restaurar.

## Limitações

- O arquivo é por geometria: editar a faca (novos caminhos/faces) exige salvar
  de novo; a chave antiga não é aplicada.
- Não há gerenciador de arquivos salvos na interface (o `Apagar` existe só no
  backend). Se precisar, dá para expor um botão “Limpar salvos”.
