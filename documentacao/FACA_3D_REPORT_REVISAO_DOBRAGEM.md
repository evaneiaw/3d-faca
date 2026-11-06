# FACA 3D — RELATÓRIO FINAL DA REVISÃO DE DOBRAGEM (0.7.2)

**Arquivo:** `C:\Users\user\Desktop\faca teste.pdf` — intacto (75.135 bytes, SHA-256 `03BC09CE…DEB41B`)
**Camada lida:** somente **FACA**. Arte, textos, anotações e demais camadas são ignorados.
**Backups:** `documentacao/backup/0.4.0/`, `0.5.0/`
**Versão:** FACA 3D **0.7.4** · painel **v0.11.4**

---

## 1. Resultado atual

| Métrica | Valor |
|---|---|
| Caminhos lidos (camada FACA) | **106** |
| Faces detectadas | **23** |
| Faces montadas | **19** |
| Faces fora | **4** recortes de 480 mm² ligados só por corte |
| Dobradiças funcionais | **18** |
| Ligações rígidas | **0** |
| Vincos | **22 / 22 dobram** |
| Faixa z na montagem | −1,0 a +133 mm |
| Contatos no perfil | 4 (tampa/abas contra a base, ~1 mm) |
| Testes | 58 + 28 + 26 + 72 = **184** |

O diagnóstico mostra: **“22 vincos: 22 dobram · 0 rígidos · 0 sem par”**.

## 2. O que foi corrigido nesta rodada

### 2.1 Somente a camada FACA

`faca3d.jsx` passou a procurar a camada **FACA** (aceita `FACA`, `FACAS`, `FACA DE CORTE`, sem diferenciar maiúsculas) e a ler **somente ela e suas subcamadas**. Se a camada não existir, a ferramenta mostra “Camada FACA não encontrada” em vez de interpretar arte. A nota da montagem exibe **“Fonte: camada FACA.”**

### 2.2 Abas V10/V11/V18/V20 (as que “não dobravam”)

A causa era um **erro de ponto flutuante** na interseção em “T”: a ponta do corte vertical caía no meio do corte horizontal com `u` excedendo 1 em ~2,5e-8 e era rejeitada. A tolerância paramétrica passou de 1e-9 para **1e-6**.

Resultado: as quatro abas fecham e viram faces reais (~15.600 mm² cada). **V10, V11, V18 e V20 agora são dobradiças**:

| Vinco | Faces | Eixo |
|---|---|---|
| V10 | 8 → 9 | (610,2) → (610,133) |
| V11 | 8 → 10 | (281,133) → (281,2) |
| V18 | 14 → 15 | (278,507) → (278,376) |
| V20 | 14 → 16 | (613,376) → (613,507) |

### 2.3 Anel em “U” V0/V2/V4 (a tampa)

A face 1 era um **anel** em volta da face 0, e o contorno externo encontra o U em dois **bicos**; no polígono cada bico aparece duas vezes. O anel foi dividido nesses dois bicos em **três painéis reais**: saia esquerda (face 21), topo (22) e direita (23). Não foi criado corte: a separação é topológica no ponto de bico.

Resultado: **V0, V2 e V4 agora dobram** (0→21, 0→22, 0→23), e as orelhas 2/3 passam a ser filhas do painel de topo (22).

### 2.4 Curvas das orelhas 2/3

O detector de faces usava apenas as **pontas das arestas**, descartando os pontos do achatamento da Bézier; por isso a curva virava reta no 3D. Agora ele percorre a **polilinha real** de cada aresta. As orelhas passaram de 6 para **82 pontos** e a curva aparece correta na vista de topo (Z).

### 2.5 Aba 12 em 180° no botão Dobrar

O perfil antigo usava “profundidade ≥ 3 = 180°”, então a aba 12 ia a 180° no **Dobrar**, enquanto o slider manual (90° global) ficava certo. O perfil passou a ser:

- paredes, tampa, **abas** e saia do U: **90°**;
- somente **orelhas** (4ª dobra): **180°**.

A aba 12 agora fica em **90°** no botão Dobrar e no slider.

### 2.6 Grade e câmeras

- A **grade 3D foi removida** (GridHelper e fundo quadriculado).
- Novo seletor **Vista: Perspectiva frente-direita / Perspectiva frente-esquerda / Frente (face 8) / Topo / Lado direito / Lado esquerdo**. A **frente** é a **face 8** (lado -Y); as duas perspectivas ficam sempre na frente (nunca atrás da caixa); os dois lados são +X (direito, face 5) e -X (esquerdo, face 11); topo em +Z alinhado em Y. A câmera muda de posição, o modelo não é rotacionado.
- A movimentação usa **OrbitControls** do Three.js: órbita com **damping** (suave), **botão esquerdo gira**, **botão direito move (pan)** e **roda dá zoom**. Não há inversão de sentido nem salto ao sair de uma vista.
- **Leitura externa/interna:** com a caixa dobrada, a vista mostra o **lado externo**; com a faca aberta (0°), mostra o **interior**. A dobra não muda. As texturas de arte **externa e interna** ficam para a fase de materiais.
- O rodapé informa “esquerdo gira · direito move · roda zoom”.

## 3. Testes

| Suíte | Resultado |
|---|---|
| Geometria (Fase 2) | **58/58** |
| Structural Line Resolver | **28/28** |
| Painel (hierarquia, eixos, câmeras, 0/45/90/180°) | **26/26** |
| Articulações individuais (18 × 0/90/180 + sentido) | **72/72** |

As 18 articulações movem a subárvore correta, mantêm o eixo fixo (< 1e-6) e não movem as outras faces.

## 4. Evidências

- `evidencias/auditoria_diagnostico.png` — faca numerada V0–V21, faces, eixos, sentido e rejeições; resumo **22 dobram**.
- `evidencias/vista_z_topo_0.png` — topo em 0°, mostrando as **curvas das orelhas** e as abas.
- `evidencias/camera_perspectiva_direita.png`, `camera_perspectiva_esquerda.png`, `camera_frente.png`, `camera_topo.png`, `camera_lado_direito.png`, `camera_lado_esquerdo.png` — as 6 câmeras.
- `evidencias/vista_iso_sem_grade.png` — montagem iso sem grade.
- `evidencias/camera_perspectiva_direita.png`, `camera_perspectiva_esquerda.png`, `camera_frente.png`, `camera_topo.png`, `camera_lado_direito.png`, `camera_lado_esquerdo.png` — as 6 câmeras.
- `evidencias/montagem_final_0_7_0.png`, `vista_iso_sem_grade.png` — montagem sem grade.
- `evidencias/art_*.png` — articulações individuais.
- `evidencias/auditoria_vincos_22.json` — inventário completo, agora com a subdivisão do U e todos os 22 vincos como DOBRA.

## 5. Limitações

1. **Direção montanha/vale é inferida** (a faca não traz essa informação). O perfil 90/180 é inferido pela profundidade da árvore.
2. No perfil, restam **4 contatos de ~1 mm** entre abas/tampa e a base (pares 4–7, 4–12, 8–21, 8–23). Não são grandes penetrações; são ajustes de material. Se necessário, um relevo de 1° elimina.
3. Os **4 recortes de 480 mm²** (faces 17–20) não têm vinco e ficam fora.
4. **ArtiosCAD não está disponível** neste ambiente; não houve comparação direta.
5. A arte como material continua **suspensa**.

## 6. Conclusão

Os problemas relatados foram corrigidos:

- as abas **V10/V11/V18/V20** agora existem como faces e dobram;
- os vincos do **U V0/V2/V4** agora dobram em três painéis reais;
- as **curvas das orelhas 2/3** são preservadas;
- a **aba 12** fica em 90° no Dobrar;
- a leitura usa **somente a camada FACA**;
- a **grade** saiu, há **6 câmeras** (2 perspectivas na frente, frente face 8, topo, 2 lados) e **pan com botão direito**.

**Todos os 22 vincos dobram.** A montagem tem 19 de 23 faces, 18 dobradiças, 0 ligações rígidas e 4 contatos de ~1 mm. A arte permanece suspensa até avaliação.
