/* FACA 3D — arte externa e interna (0.8.0).
 *
 * Interpreta as artboards do documento (nomes ou ordem), decide qual e a arte
 * externa e qual e a interna e transforma cada PNG exportado pelo ExtendScript
 * em textura do Three.js. O mapeamento por face (UV) fica no three3d.js.
 *
 * API:
 *   Faca3D.view.artes.decidir(artboards)
 *   Faca3D.view.artes.carregarTextura(url, { papel })
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var V = (F.view = F.view || {});

  var COR_PAPEL = "#f2e8d5";

  var ACENTOS = {
    "\u00c1": "A", "\u00c0": "A", "\u00c2": "A", "\u00c3": "A", "\u00c4": "A",
    "\u00c9": "E", "\u00c8": "E", "\u00ca": "E", "\u00cb": "E",
    "\u00cd": "I", "\u00cc": "I", "\u00ce": "I", "\u00cf": "I",
    "\u00d3": "O", "\u00d2": "O", "\u00d4": "O", "\u00d5": "O", "\u00d6": "O",
    "\u00da": "U", "\u00d9": "U", "\u00db": "U", "\u00dc": "U",
    "\u00c7": "C", "\u00d1": "N"
  };

  function normalizar(valor) {
    var s = String(valor === null || valor === undefined ? "" : valor).toUpperCase();
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      out += ACENTOS[ch] || ch;
    }
    return out.replace(/[^A-Z0-9]+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  var RE_EXTERNA = /(^| )(EXTERNO|EXTERNA|EXTERIOR|FRENTE|FORA|OUTSIDE|EXTERNAL|OUT)( |$)/;
  var RE_INTERNA = /(^| )(INTERNO|INTERNA|INTERIOR|VERSO|DENTRO|INSIDE|INNER|INTERNAL)( |$)/;

  function papelDoNome(nome) {
    var n = normalizar(nome);
    if (!n) return null;
    var externa = RE_EXTERNA.test(n);
    var interna = RE_INTERNA.test(n);
    if (externa && interna) return "ambigua";
    if (externa) return "externa";
    if (interna) return "interna";
    return null;
  }

  /* artboards: [{ indice, nome, rect }]
   * devolve: { externa, interna, avisos: [] } (externa/interna = item da lista) */
  function decidir(artboards) {
    var lista = artboards || [];
    var out = { externa: null, interna: null, avisos: [] };
    if (!lista.length) {
      out.avisos.push("Nenhuma artboard encontrada.");
      return out;
    }

    // Com exatamente 2 artboards, os nomes reconhecidos (EXTERNO/INTERNO,
    // FRENTE/VERSO) mandam; se não houver um par claro, usa a ordem.
    if (lista.length === 2) {
      var p0 = papelDoNome(lista[0].nome);
      var p1 = papelDoNome(lista[1].nome);
      if (p0 === "externa" && p1 === "interna") {
        out.externa = lista[0];
        out.interna = lista[1];
        return out;
      }
      if (p0 === "interna" && p1 === "externa") {
        out.externa = lista[1];
        out.interna = lista[0];
        return out;
      }
      out.externa = lista[0];
      out.interna = lista[1];
      out.avisos.push(
        "Duas artboards: 1ª usada como arte externa, 2ª usada como arte interna."
      );
      return out;
    }

    // Para documentos com mais de 2 artboards, classifica por nomes reconhecidos
    var porPapel = { externa: [], interna: [], ambigua: [] };
    for (var i = 0; i < lista.length; i++) {
      var p = papelDoNome(lista[i].nome);
      if (p) porPapel[p].push(lista[i]);
    }

    if (lista.length === 1) {
      out.externa = lista[0];
      out.avisos.push(
        "Uma única artboard: usada como arte externa. A interna fica em branco."
      );
      return out;
    }

    if (porPapel.externa.length === 1 && porPapel.interna.length === 1) {
      out.externa = porPapel.externa[0];
      out.interna = porPapel.interna[0];
      if (lista.length > 2) {
        out.avisos.push(
          "O documento tem " + lista.length + " artboards; usando \"" +
            out.externa.nome + "\" (externa) e \"" + out.interna.nome + "\" (interna)."
        );
      }
      if (porPapel.ambigua.length) {
        out.avisos.push(
          porPapel.ambigua.length + " artboard(s) com nome ambíguo ignorada(s)."
        );
      }
      return out;
    }

    if (porPapel.ambigua.length) {
      out.avisos.push(
        "Nome de artboard ambíguo (mistura externo e interno). Usando a ordem do documento."
      );
    } else if (porPapel.externa.length > 1 || porPapel.interna.length > 1) {
      out.avisos.push(
        "Mais de uma artboard com o mesmo papel. Usando a ordem do documento."
      );
    } else if (porPapel.externa.length === 1 && !porPapel.interna.length) {
      out.externa = porPapel.externa[0];
      out.interna = lista[0] === out.externa ? lista[1] : lista[0];
      out.avisos.push(
        "Só uma artboard reconhecida como externa: a outra foi usada como interna."
      );
      return out;
    } else if (porPapel.interna.length === 1 && !porPapel.externa.length) {
      out.interna = porPapel.interna[0];
      out.externa = lista[0] === out.interna ? lista[1] : lista[0];
      out.avisos.push(
        "Só uma artboard reconhecida como interna: a outra foi usada como externa."
      );
      return out;
    } else {
      // Fallback: usa a ordem do documento (1ª = externa, 2ª = interna)
      out.avisos.push(
        "Nomes de artboard não reconhecidos: usando a 1ª como externa e a 2ª como interna."
      );
    }

    out.externa = lista[0];
    out.interna = lista[1] || null;
    if (lista.length > 2) {
      out.avisos.push(
        "O documento tem " + lista.length + " artboards; as demais foram ignoradas."
      );
    }
    return out;
  }

  function urlDeArquivo(caminho) {
    var p = String(caminho || "").replace(/\\/g, "/");
    if (!p) return "";
    if (/^file:/i.test(p)) return p;
    if (!/^[a-zA-Z]:/.test(p)) p = "/" + p;
    return "file:///" + encodeURI(p).replace(/#/g, "%23").replace(/\?/g, "%3F");
  }

  /* Carrega o PNG exportado e devolve uma textura pronta (fundo de papel).
   * Usa Image diretamente (src = file:///...), evitando fetch() que e bloqueado
   * pelo Chromium do CEP para arquivos locais. */
  function carregarTextura(caminho, opcoes) {
    var opt = opcoes || {};
    return new Promise(function (resolve, reject) {
      var url = urlDeArquivo(caminho);
      if (!url) {
        reject(new Error("Caminho de arte vazio."));
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          if (!img.naturalWidth || !img.naturalHeight) {
            reject(new Error("Arte com dimensao zero: " + caminho));
            return;
          }
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = opt.papel || COR_PAPEL;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          var textura = new THREE.CanvasTexture(canvas);
          textura.anisotropy = opt.anisotropia || 4;
          textura.needsUpdate = true;
          resolve({ texture: textura, largura: canvas.width, altura: canvas.height });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () {
        reject(new Error("Falha ao carregar a arte: " + caminho + " (url=" + url + ")"));
      };
      img.src = url;
    });
  }

  V.artes = {
    normalizar: normalizar,
    papelDoNome: papelDoNome,
    decidir: decidir,
    urlDeArquivo: urlDeArquivo,
    carregarTextura: carregarTextura
  };
})();