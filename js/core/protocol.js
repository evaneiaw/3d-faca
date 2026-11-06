/* FACA 3D — protocolo textual entre ExtendScript e o painel.
 *
 * Formato (UTF-8, uma instrução por linha):
 *
 *   F3D|<versao>|<tipo>
 *   CHAVE=valor
 *   CHAVE=valor
 *   END
 *
 * Tipos previstos nesta fase: DIAG, SEM_DOC, SEM_SELECAO, ERRO.
 * Escapes usados nos valores: \\ | \p (=) \e (\n) \n (\r) \r
 * A escolha por texto (e não JSON) é obrigatória: o ExtendScript é ES3.
 */
(function () {
  var F = (window.Faca3D = window.Faca3D || {});

  var P = (F.protocol = {});
  P.VERSION = 1;
  P.MAGIC = "F3D";
  P.TERMINADOR = "END";

  function erroProtocolo(codigo, mensagem) {
    var e = new Error(mensagem);
    e.codigoProtocolo = codigo;
    return e;
  }
  P.erroProtocolo = erroProtocolo;

  P.escapeValor = function (valor) {
    var s = valor === null || valor === undefined ? "" : String(valor);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === "\\") out += "\\\\";
      else if (ch === "|") out += "\\p";
      else if (ch === "=") out += "\\e";
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else out += ch;
    }
    return out;
  };

  P.unescapeValor = function (valor) {
    var s = String(valor === null || valor === undefined ? "" : valor);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch !== "\\") {
        out += ch;
        continue;
      }
      i++;
      if (i >= s.length) {
        out += "\\";
        break;
      }
      var esc = s.charAt(i);
      if (esc === "p") out += "|";
      else if (esc === "e") out += "=";
      else if (esc === "n") out += "\n";
      else if (esc === "r") out += "\r";
      else out += esc;
    }
    return out;
  };

  P.decode = function (texto) {
    if (texto === null || texto === undefined || String(texto) === "") {
      throw erroProtocolo("VAZIO", "Resposta vazia do ExtendScript.");
    }
    var bruto = String(texto);
    var linhas = bruto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var cabecalho = linhas[0].replace(/^\s+|\s+$/g, "");
    var partes = cabecalho.split("|");

    if (partes[0] !== P.MAGIC) {
      throw erroProtocolo("FORMATO", "Resposta não reconhecida: " + cabecalho.substring(0, 80));
    }
    if (String(partes[1]) !== String(P.VERSION)) {
      throw erroProtocolo(
        "VERSAO",
        "Versão de protocolo incompatível (recebida " + partes[1] + ", esperada " + P.VERSION + ")."
      );
    }

    var tipo = partes[2] || "";
    var campos = {};
    var listas = {};
    var ordem = [];

    for (var i = 1; i < linhas.length; i++) {
      var linha = linhas[i];
      if (linha === null) continue;
      linha = linha.replace(/^\s+|\s+$/g, "");
      if (!linha) continue;
      if (linha === P.TERMINADOR) break;

      var pos = linha.indexOf("=");
      if (pos <= 0) {
        throw erroProtocolo("LINHA", "Linha inválida no protocolo: " + linha.substring(0, 80));
      }
      var chave = linha.substring(0, pos).replace(/^\s+|\s+$/g, "");
      var valor = P.unescapeValor(linha.substring(pos + 1));

      if (!campos.hasOwnProperty(chave)) {
        campos[chave] = valor;
        ordem.push(chave);
      }
      if (!listas[chave]) listas[chave] = [];
      listas[chave].push(valor);
    }

    return {
      versao: P.VERSION,
      tipo: tipo,
      campos: campos,
      listas: listas,
      ordem: ordem,
      bytes: bruto.length,
      bruto: bruto
    };
  };

  P.encode = function (tipo, pares) {
    var out = [P.MAGIC + "|" + P.VERSION + "|" + tipo];
    var lista = pares || [];
    for (var i = 0; i < lista.length; i++) {
      out.push(lista[i][0] + "=" + P.escapeValor(lista[i][1]));
    }
    out.push(P.TERMINADOR);
    return out.join("\n");
  };
})();
