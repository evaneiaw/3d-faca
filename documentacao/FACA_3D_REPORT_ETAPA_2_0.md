# RELATÓRIO FACA 3D — ETAPA 2.0: VERIFICAÇÃO DE SEGURANÇA E BASELINE

**Status:** Concluída — nenhuma perda ou inconsistência documental atribuível à automação.

**Data:** 05/11/2026

---

## 1. Ocorrência investigada

Na ETAPA 1.3, o documento `FT 208792_CASINHA DE GATO - ARCO IRIS_REV00.pdf` saiu da lista de documentos abertos durante a execução, e o relatório registrou a ocorrência como não explicada. Esta etapa investigou o caso antes de qualquer alteração de código.

## 2. Verificação do arquivo em disco

| Item | Valor |
|---|---|
| Caminho | `\\192.168.22.250\desenvolvimento\Desenvolvimento\01_Produtos\NINHO DE GATO\FT 208972\FT 208792_CASINHA DE GATO - ARCO IRIS_REV00.pdf` |
| Situação | **Existe** |
| Tamanho | 1.711.306 bytes |
| Última modificação | 05/11/2026 10:36:20 (anterior à sessão de testes) |
| SHA-256 | `A6D5E7CE12404D4AF0AB155DEE9683C49339990D9C06BBAA6E46EC6D96FEDC4E` |

**Não houve perda do arquivo nem alteração de conteúdo.**

## 3. Causa provável e evidências

O fechamento **não foi executado pela automação**. Evidências:

1. **Operações de documento realizadas pela automação:** `Open` do `faca teste.pdf`, ativação de documentos e **um único** `Close(2)` (não salvar) no próprio `faca teste.pdf`. Nenhuma chamada de fechamento foi feita sobre o ARCO IRIS.
2. **Sem crash:** o processo `Illustrator.exe` (PID 3916) permaneceu vivo e respondendo desde 10:47:13; o Event Log de Aplicação não registrou falha do Illustrator na janela analisada.
3. **Erro de coleção durante a enumeração:** o comando de restauração registrou `No such element` ao percorrer `Documents.Item(i)`. Isso ocorre quando a coleção muda **durante** a iteração — assinatura de fechamento externo concorrente, não de fechamento feito pelo próprio laço.
4. **Usuário ativo na sessão:** títulos com `*` (alterações não salvas), criação de arquivos `AIDBTemp*.aid` em 11:16, 11:21 e 11:32, e troca do documento ativo várias vezes durante os testes.
5. **Salvamento do documento do usuário:** `FT 208792_CASINHA DE GATO - MELANCIA.pdf` foi **salvo às 11:42:46** (tamanho e data alterados), comprovando edição e salvamento pelo usuário em paralelo.
6. **Fechamento de outros documentos:** ao final desta etapa, o Illustrator estava com **0 documentos** — `TORTA` e `QUEIJO` também saíram da lista sem qualquer comando de fechamento da automação.

**Conclusão:** o ARCO IRIS foi fechado por ação externa (interação do usuário), em paralelo à automação. O arquivo permanece íntegro e salvo no servidor.

## 4. Divergência sobre o documento ativo

| Momento | Documento ativo |
|---|---|
| Início da ETAPA 1.3 | `MELANCIA_REV00.pdf` |
| Antes de abrir o arquivo de teste | `MELANCIA_REV00.pdf` |
| Durante o teste oficial | `faca teste.pdf` |
| Após a restauração da 1.3 | `MELANCIA_REV00.pdf` |
| Durante a ETAPA 2 (medições) | alternou entre `MELANCIA.pdf`, `MELANCIA_REV00.pdf`, `QUEIJO.pdf`, `TORTA_REV00.pdf` — sempre por ação do usuário |
| Ao final da ETAPA 2 | nenhum documento aberto (usuário salvou `MELANCIA.pdf` às 11:42:46 e fechou os demais) |

A automação sempre registrou o ativo antes e restaurou o mesmo documento depois. As trocas posteriores foram feitas pelo usuário.

## 5. Operações de documento usadas nesta fase

- `Open` do `faca teste.pdf` (somente leitura).
- Ativação do `faca teste.pdf` para a medição.
- `Close(2)` do `faca teste.pdf` (sem salvar).
- Reativação do documento anterior.
- Nenhum `Save`, nenhum `Save As`, nenhuma alteração de conteúdo.

## 6. Integridade do arquivo oficial

| Item | Antes | Depois |
|---|---|---|
| Tamanho | 75.135 bytes | 75.135 bytes |
| mtime | 05/11/2026 10:21:42 | 05/11/2026 10:21:42 |
| SHA-256 | `03BC09CE…DEB41B` | `03BC09CE…DEB41B` |

## 7. Avaliação de risco

- Não há risco de perda documental atribuível ao FACA 3D: o motor é **somente leitura** no Illustrator.
- O único efeito colateral possível é a troca de documento ativo, sempre restaurada.
- Recomendação operacional: não executar os testes enquanto o usuário estiver editando documentos com alterações não salvas; a automação não fecha nem salva documentos do usuário.

**Decisão:** prosseguir com a FASE 2, mantendo o padrão de abrir/ativar/fechar o arquivo oficial somente quando necessário.
