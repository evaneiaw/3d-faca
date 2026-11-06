# 3D Faca — Base fixa manual no diagnóstico

## Objetivo

Permitir escolher no diagnóstico qual painel fica imóvel (base fixa) na
montagem 3D, substituindo a escolha automática. A troca é **real**: muda a
raiz da árvore de dobradiças usada para calcular as matrizes de dobra.

## Como era antes

`hinge-audit.construir(res)` escolhia a raiz automaticamente: a face com mais
dobradiças do maior componente ligado por vinco (empate pela área). O 3D usa
`estado.montagem.raiz` como identidade em `recriarMalhas()`, então a raiz é o
único painel que não recebe transformação.

## O que foi implementado

### Núcleo

- **`js/core/hinge-audit.js`**
  - `construir(res, { raiz })`: a raiz pedida vira a raiz real da árvore.
  - Só aceita painel que existe, pertence ao componente principal (ligado por
    vinco) e tem pelo menos uma dobradiça. Caso contrário mantém a automática
    e devolve `motivoBase` (texto para o usuário) sem alterar nada.
  - O retorno ganhou `raizAutomatica`, `raizSolicitada`, `baseManual` e
    `motivoBase`; o campo `raiz` continua sendo a raiz aplicada.
- **`js/core/geometry-engine.js`**
  - `assinatura(resultado)`: identifica a geometria (documento, caminhos,
    faces, caixa e soma das áreas). A base manual só continua valendo enquanto
    a assinatura for a mesma; ao trocar a faca ela é descartada.
- **`js/view/three3d.js`**
  - `desenhar(resultado, { raiz })` — a raiz inicial vem do painel.
  - `definirBase(id)` / `definirBaseAutomatica()` / `base()` — trocam a raiz,
    recalculam sinais de dobra, matrizes e malhas **sem** reposicionar a
    câmera e mantendo ângulos e sentidos já escolhidos pelo usuário.
  - `matrizDobra3`, `matrizesDaMontagem` e `escolherSinaisCom` passaram para o
    escopo do módulo (e são exportados) para poderem ser testados no Node sem
    WebGL; o comportamento do painel é o mesmo.
  - `inspecionar()` passou a devolver `base`.
- **`js/view/diagnostico.js`**
  - Modo de escolha de base: clique num painel devolve a face
    (`aoSelecionarFace`), painel candidato destacado e base atual destacada.
  - `definirModoBase`, `definirBaseAtual`, `definirCandidatoBase`.

### Interface

- No diagnóstico: rótulo **Base fixa atual: Painel N**, botão **Definir base
  fixa** e botão **Base automática** (desabilitado quando a base é automática).
- Ao entrar no modo, aparece a barra **“Escolha o painel que ficará imóvel…”**.
  O painel pode ser escolhido:
  - clicando nele no próprio diagnóstico (canvas 2D),
  - clicando nele na vista 3D (o modo continua ativo se o diagnóstico fechar),
  - pela lista **Face** já existente (em modo base ela lista todos os painéis
    montados; não foi criada uma lista paralela).
- Depois da escolha: **“Definir Painel 22 como base fixa?”** com
  **Confirmar** e **Cancelar**.
- Confirmação aplica a base; recusa mostra o motivo e mantém a base anterior.
- A nota da montagem e o rótulo mostram a base usada; a escolha fica na sessão
  e é reaplicada enquanto a geometria não mudar.

## Regras respeitadas

- Não muda leitura da faca, triangulação, furos nem arte.
- Não mexe nas coordenadas das faces: só a hierarquia/matrizes.
- A raiz não recebe transformação (matriz identidade) em 0°, 90° e 180°.
- Hierarquia, dobradiças, eixos, ângulos e sentidos são recalculados a partir
  da nova base; conexões não são perdidas (a árvore cobre o mesmo componente).
- Sem animação automática nova; ciclo de vida do render inalterado
  (redesenho sob demanda).

## Evidências

- `documentacao/evidencias/0_8_0_base_fixa.png` — 6 quadros da transformação
  real (raiz automática = painel 8 x base manual = painel 22, em 0°/90°/180°),
  gerados com o mesmo `matrizesDaMontagem` do painel a partir do documento
  real (`faaaaccaaaa.pdf`, 248 caminhos, 30 faces montadas).
- Saída do smoke test no documento real:

```
BASE automatica -> painel 8 (manual=false, montadas=30)
    0°: raiz identidade=true deslocamento da base=0.0e+0 erro nos eixos=0.0e+0 | faces que saem do plano=0
   90°: raiz identidade=true deslocamento da base=0.0e+0 erro nos eixos=3.3e-13 | faces que saem do plano=29
  180°: raiz identidade=true deslocamento da base=0.0e+0 erro nos eixos=2.8e-13 | faces que saem do plano=0

BASE manual 22 -> painel 22 (manual=true, montadas=30)
    0°: raiz identidade=true deslocamento da base=0.0e+0 erro nos eixos=0.0e+0 | faces que saem do plano=0
   90°: raiz identidade=true deslocamento da base=0.0e+0 erro nos eixos=5.1e-13 | faces que saem do plano=28
  180°: raiz identidade=true deslocamento da base=0.0e+0 erro nos eixos=2.5e-13 | faces que saem do plano=0
```

## Testes

Node (`testes/testes-geometria.mjs`, 114/114):

- raiz automática, base manual 0/2, hierarquia recalculada, 3 painéis montados;
- painel inexistente e painel fora do componente: recusa com motivo e base
  anterior preservada;
- assinatura estável/mutável conforme a geometria;
- matrizes reais: raiz identidade em 0/90/180, erros de eixo < 1e-6, painel
  filho sai do plano a 90° e a raiz continua em z=0.

Painel (executar com o Illustrator aberto, `testes/testes-base-fixa.js`):

1. base automática;
2. trocar para um painel manual (usa o 22 quando existe) pela lista e pela
   confirmação;
3. painel fixo em 0/90/180 (matriz identidade e eixos);
4. demais faces giram;
5. câmera muda sem alterar a base;
6. voltar à automática;
7. painel inexistente é recusado sem mudar a base.

O item 7 do pedido (trocar de faca e não aplicar seleção antiga) é garantido
pela `assinatura` e coberto no Node; no painel, basta reler outro documento e
conferir que o rótulo volta a “automática”.

## Limitações

- A base precisa fazer parte do componente principal ligado por vinco. Painéis
  que ficam fora da montagem (ligados só por corte) são recusados com motivo.
- Painéis com furo são aceitos como base (a triangulação não muda).
