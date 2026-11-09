# FACA 3D — CORREÇÃO DEFINITIVA DA ORIENTAÇÃO ESPELHADA
## Referência visual: Screenshot_3.png — comparação com Screenshot_4.png e Screenshot_5.png

**Repositório:** https://github.com/evaneiaw/3d-faca  
**Branch:** master  
**Registrado em:** 2026-11-09 às aproximadamente 16:45 — task para a próxima sessão.

---

## 1. PROBLEMA REAL

Analise as três imagens em `documentacao/screenshots/`.

- `Screenshot_3.png`: referência correta, capturada no Illustrator. A faca planificada apresenta o EXTERNO à esquerda e o INTERNO à direita.
- `Screenshot_4.png`: no visualizador 3D, a própria disposição/orientação da faca está espelhada em relação à referência.
- `Screenshot_5.png`: além da orientação da faca, a própria arte também aparece espelhada.

**REGRA FUNDAMENTAL:** a montagem 3D deve preservar a orientação espacial da faca apresentada no Illustrator. A passagem de 2D para 3D não pode inverter esquerda e direita.

Não tente resolver isso simplesmente invertendo a textura. São dois problemas que precisam ser distinguidos:
1. Orientação espacial da geometria/montagem.
2. Orientação da imagem impressa nas superfícies.

## 2. INVESTIGAÇÃO OBRIGATÓRIA ANTES DE ALTERAR

Inspecione o fluxo completo de coordenadas, desde a leitura do Illustrator até a renderização:

- Coordenadas e limites da faca exportados pelo ExtendScript.
- Conversão de coordenadas Illustrator (origem, eixo Y e unidades) para coordenadas do motor geométrico.
- Ordenação dos vértices e winding das faces.
- Escolha da face raiz e matriz inicial da montagem.
- Matrizes de rotação das dobradiças e seus sinais.
- Transformações aplicadas ao grupo 3D.
- Cálculo e aplicação das coordenadas UV.
- Orientação das texturas externas e internas.
- `Texture.flipY`, inversões de U/V e eventuais escalas negativas.

Investigue especialmente:
- `js/view/three3d.js`
- `js/view/arteUnica.js`
- `js/view/artes.js`
- `js/faca3d.js`
- `jsx/faca3d.jsx`
- Os módulos do motor geométrico responsáveis por faces, vértices e montagem.

Verifique também se existe alguma matriz com determinante negativo, escala negativa ou troca de eixos que esteja espelhando a geometria.

## 3. CORRIGIR A ORIENTAÇÃO DA FACA

A referência de orientação deve ser o sistema de coordenadas original da faca no Illustrator.

A montagem 3D deve preservar a correspondência espacial:
- O que está à esquerda no Illustrator continua à esquerda na referência de montagem 3D.
- O que está à direita continua à direita.
- A face externa e a interna não podem trocar de posição.
- A dobra não pode introduzir reflexão involuntária.

Não use uma rotação arbitrária da câmera para esconder o erro. Não espelhe o grupo inteiro como correção visual improvisada.

Identifique se o erro nasce na conversão de coordenadas, na escolha da raiz, nas matrizes de montagem ou em outra etapa. Corrija a transformação responsável, preservando a geometria real e a lógica das dobradiças.

## 4. CORRIGIR A ORIENTAÇÃO DA ARTE SEPARADAMENTE

Depois de corrigir a geometria, valide o mapeamento da arte.

A arte precisa manter:
- Orientação correta de leitura.
- Correspondência entre a posição no Illustrator e a posição no papelão.
- Escala e proporção originais.
- Alinhamento com os painéis.
- Correspondência correta entre externo e interno.

Investigue especificamente a função `uvFacaInversa()` em `three3d.js`, que atualmente aplica `u = 1 - u`. Verifique onde ela é usada e se a inversão é realmente necessária. Não a remova ou altere sem rastrear os efeitos.

vamos usar isso amanhã so deixe registrado.....Não aplique uma inversão global de textura para corrigir apenas uma face. Se externo e interno exigirem orientações diferentes por causa da face física, calcule isso de maneira explícita e consistente com a orientação real de cada superfície.

Não altere o sistema de mipmaps, anisotropia ou resolução das texturas, salvo se houver evidência de relação direta com este defeito.

## 5. TESTE COM REFERÊNCIA ASSIMÉTRICA

Crie um teste técnico que permita detectar inequivocamente qualquer espelhamento.

Use uma referência assimétrica com:
- Texto legível.
- Seta apontando para cima.
- Identificação EXTERNO e INTERNO.
- Quatro quadrantes com cores diferentes.
- Marcas distintas nos cantos.

Compare a referência planificada com o resultado 3D:
1. Antes de dobrar.
2. Durante a dobra.
3. Com a faca totalmente dobrada.
4. Ao desdobrar novamente.

A orientação deve permanecer coerente em todas as etapas.

Não aceite como teste suficiente verificar apenas se a textura aparece.

## 6. RESTRIÇÕES

- Não alterar espessura, geometria, vincos ou topologia da faca sem necessidade comprovada.
- Não reconstruir a faca com geometria artificial.
- Não trocar a arquitetura atual.
- Não resolver o defeito apenas mudando a câmera.
- Não compensar um erro de geometria com uma inversão de textura.
- Não fazer correções independentes e contraditórias em diferentes arquivos.
- Preservar o funcionamento atual da arte, materiais e dobras.

## 7. ENTREGA E VALIDAÇÃO

Trabalhe até concluir a correção, não pare depois de apresentar um diagnóstico.

Após cada alteração:
- Execute os testes automatizados pertinentes.
- Compile/verifique a extensão e seus arquivos.
- Instale/atualize a extensão para teste.
- Valide no Illustrator real quando houver ambiente disponível.
- Não declare validação visual se não tiver executado o teste no Illustrator.

Compare o resultado final com `Screenshot_3.png` e documente objetivamente o que mudou.

Faça commit e push para `origin/master`.

Ao terminar, informe:
1. Causa raiz comprovada.
2. Correção aplicada.
3. Resultado dos testes.
4. Se houve validação visual real no Illustrator.
5. Hash do commit.
6. Relação completa de todos os arquivos criados, modificados ou removidos.

**CRITÉRIO DE ACEITAÇÃO:** a disposição externa à esquerda e interna à direita da referência Screenshot_3 deve ser preservada no modelo 3D, sem espelhamento da faca nem da arte.
