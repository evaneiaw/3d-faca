# FACA 3D — Status

Última atualização: 2026-11-06 (versão 0.8.0 — arte externa/interna + estado inicial em 0°)

## Etapa atual

**REVISÃO DE DOBRAGEM CONCLUÍDA NO ESCOPO GEOMÉTRICO + ARTE DUAL (EXTERNO/INTERNO) NA MESMA CAIXA.** A faca lida da camada **FACA** (somente a da primeira artboard) monta com **19 de 23 faces**, **18 dobradiças** e **0 ligações rígidas**. **Os 22 vincos classificados como Crease dobram**, incluindo as abas V10/V11/V18/V20 e o “U” V0/V2/V4. Na mesma caixa, **arte da artboard externa nas faces externas** e **arte da artboard interna nas faces internas**.

## Resultado

| Métrica | Valor |
|---|---|
| Caminhos (camada FACA) | 106 |
| Faces | 23 |
| Faces montadas | 19 |
| Fora | 4 recortes de 480 mm² (só corte) |
| Dobradiças | 18 |
| Ligações rígidas | 0 |
| Vincos | **22/22 dobram** |
| Faixa z no perfil | −1,0 a +133 mm |
| Contatos | 4 (~1 mm, abas/tampa × base) |

## Correções da 0.7.x

1. **Somente camada FACA:** arte, textos e anotações não são interpretados; sem FACA → mensagem clara.
2. **Abas V10/V11/V18/V20:** a interseção em “T” era rejeitada por erro de ponto flutuante (u > 1 em ~2,5e-8). Folga paramétrica 1e-9 → **1e-6**; as abas passaram a ser faces e dobram.
3. **U V0/V2/V4:** a face 1 era um anel com dois bicos. Foi dividida nos bicos em **3 painéis reais** (saia esquerda/topo/direita) sem corte inventado; os três vincos dobram.
4. **Curvas das orelhas 2/3:** o detector usava só as pontas das arestas; agora percorre a polilinha da Bézier. As orelhas têm **82 pontos** e a curva aparece no 3D.
5. **Aba 12:** o perfil antigo mandava profundidade ≥3 para 180°. Agora **abas e saia 90°** e, na 0.7.6, **todas as dobras em 90°** — a orelha em 180° ficava deitada sobre o painel vizinho e parecia atravessar a face.
6. **Grade removida** e **6 câmeras** (2 perspectivas na frente, **Frente = face 8**, Topo, **Lado direito**, **Lado esquerdo**), com **OrbitControls** (damping); **botão direito move (pan)**, esquerdo gira, roda zoom.
7. **Detente de 90°:** ao arrastar a barra, qualquer valor entre **85° e 95°** vira **90°**; abaixo de 85 e acima de 95 segue normal.
8. **Articulação por clique ou droplist:** a face pode ser escolhida **clicando no modelo** ou no **droplist Face** (lista as 18 faces articuláveis com o pai), com **destaque amarelo e contorno laranja**. Cada face guarda **o próprio ângulo e o próprio sentido** — mudar de face não zera as outras. Clicar na mesma face ou fora da caixa **desmarca**. Arrastar (>4 px) continua sendo órbita/pan.
9. **Desdobrar animado:** leva todas as faces a **0°** com a mesma suavidade do **Dobrar** (que reaplica o perfil 90°) e limpa a seleção.
10. **Seleção múltipla:** **Ctrl+clique** soma/remove faces (Shift+clique só soma) e a barra move **todas as selecionadas** de uma vez; cada face continua guardando o próprio ângulo. Clique sem modificador volta a selecionar só uma; clicar fora limpa tudo.
11. **Droplist sincronizado:** escolher no droplist seleciona (Ctrl/Shift ao escolher soma/remove), clicar no modelo atualiza o droplist e, com várias faces, o primeiro item mostra `N faces · a, b, c`.
12. **Estado inicial em 0° (planificado):** abrir a ferramenta mostra a faca deitada; o botão **Reset** planifica de novo; **Dobrar** aplica o perfil 90°.
13. **Arte externa e interna (0.8.0):** cada artboard é lida como arte independente; **Externo/Frente** → faces externas, **Interno/Verso** → faces internas. Duas malhas por face (`FrontSide`/`BackSide`), UV próprio por lado. Camadas técnicas (`FACA`, `MIRA`, `CL`, `INFO`, `LOTE`, `COTAS`, `DIMENSÃO`) ignoradas na extração (ocultadas só durante o export e restauradas no `finally`). Controles: **Arte** (ambas/externa/interna/nenhuma), **Espelhar interna**, **Atualizar artes**, **Vista interior**.

## Testes

| Suíte | Resultado |
|---|---|
| Geometria | 58/58 |
| Structural Line Resolver | 28/28 |
| Painel (hierarquia, eixos, câmeras, ângulos) | 26/26 |
| Articulações individuais (18 faces, persistência, sentido, snap) | 129/129 |
| Seleção (clique, droplist, multi-seleção) + Desdobrar/Dobrar | 51/51 |
| Arte externa/interna (classificação, UV, materiais, modos, espelhar, câmera interior) | 27/27 |
| **Total** | **319** |

## Evidências

- `evidencias/auditoria_diagnostico.png` — 22 vincos, todos DOBRA.
- `evidencias/vista_z_topo_0.png` — topo em 0°, curvas das orelhas.
- `evidencias/vista_iso_sem_grade.png`, `vista_x.png`, `vista_z.png`.
- `evidencias/art_*.png`.
- `evidencias/selecao_face_0.png` — face 0 (tampa) selecionada, destaque amarelo e contorno.
- `evidencias/selecao_face_22.png` — face 22 (saia U) selecionada.
- `evidencias/selecao_multipla.png` — 3 faces selecionadas (0, 2, 3) a 45°.
- `evidencias/selecao_droplist.png` — face 22 escolhida pelo droplist (vista topo, 0°).
- `evidencias/perfil_90.png` — perfil 90° (todas as dobras).
- `evidencias/planificada.png` — estado inicial em 0°.
- `evidencias/dobrada_frente.png` — dobrada, vista frontal.
- `evidencias/dobrada.png` — dobrada, perspectiva.
- `evidencias/interior_verso.png` — interno (verso) com arte interna.
- `evidencias/arte_*.png` — capturas de arte externa/interna (fixture EXTERNO/INTERNO).
- `evidencias/auditoria_vincos_22.json`.
- backups `0.4.0/` e `0.5.0/`.

## Pendências

1. Direção montanha/vale e o perfil de **90°** são **inferidos** (a faca não traz a informação); a orelha pode ser levada a 180° na mão, pela barra.
2. 4 contatos de ~1 mm no perfil (4–7, 4–12, 8–21, 8–23); um relevo de 1° eliminaria, se desejado.
3. 4 recortes de 480 mm² ficam fora (sem vinco).
4. **ArtiosCAD não disponível** para comparação.
5. **Arte real (pixel/imagem) ainda não testada** — a arte do arquivo de teste é um rótulo único (`Frente`/`Verso`).
6. Planificado (0°): mantém a orientação física de cada face (decisão registrada); algumas faces mostram o lado interno para cima.


## Correcao de arte (0.8.0)

- Causa provavel: carregarTextura usava fetch() em URLs file:///, bloqueado pelo Chromium do CEP. Substituido por carregamento direto via Image.src.
- Adicionado --allow-file-access-from-files ao manifest.
- Instrumentacao de log em js/faca3d.js (artboards, arquivos exportados, texturas, erros).
- Validacao real pendente: abrir painel no Illustrator e verificar arte externa/interna em 0 e 90 graus.
