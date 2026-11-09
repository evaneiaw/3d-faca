/* FACA 3D — arte única (camada ARTE, limite = toda a lateral da faca).
 *
 * Pipeline do zero (sem artboard EXTERNO/INTERNO, sem offset, sem conteudo):
 *   - O PNG exportado da artboard 0 é recortado em JS para a bbox da faca.
 *   - A UV é planar na bbox normalizada: u = x / W, v = y / H (mm).
 *   - A UV fica no espaço do objeto (antes da matriz de dobra), então a
 *     dobra move vértice+UV juntos: a arte gruda na caixa.
 *
 * API:
 *   Faca3D.view.arteUnica.uvFaca(ponto, W, H) -> { u, v }
 *   Faca3D.view.arteUnica.recorteParaFaca(opts) -> { sx, sy, sw, sh } em px
 *   Faca3D.view.arteUnica.urlDeArquivo(caminho) -> string file:///
 *   Faca3D.view.arteUnica.carregarTexturaRecortada(caminho, opts) -> Promise<{texture, largura, altura}>
 *
 * Sem dependências de DOM para as funções puras (testáveis em Node).
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var V = (F.view = F.view || {});

  var COR_PAPEL = "#f2e8d5";

  var ACENTOS = {
    "Á": "A", "À": "A", "Â": "A", "Ã": "A", "Ä": "A",
    "É": "E", "È": "E", "Ê": "E", "Ë": "E",
    "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
    "Ó": "O", "Ò": "O", "Ô": "O", "Õ": "O", "Ö": "O",
    "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
    "Ç": "C", "Ñ": "N"
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

  function numero(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  /* UV planar na lateral inteira. x,y em mm normalizado (origem 0,0 no
   * canto inferior esquerdo da bbox da faca), W,H em mm. V=0 na base. */
  function uvFaca(ponto, W, H) {
    var w = Number(W);
    var h = Number(H);
    if (!(w > 0) || !(h > 0)) return { u: 0, v: 0 };
    var x = ponto && isFinite(ponto.x) ? Number(ponto.x) : 0;
    var y = ponto && isFinite(ponto.y) ? Number(ponto.y) : 0;
    return { u: x / w, v: y / h };
  }

  /* UV da arte INTERNAL quando a fonte é a artboard espelhada (artboard 1):
   * a faca espelhada inverte X, então u vem espelhado (1 - u). */
  function uvFacaInversa(ponto, W, H) {
    var uv = uvFaca(ponto, W, H);
    uv.u = 1 - uv.u;
    return uv;
  }

  /* Divide as artboards em externa/interna pelo nome (ou pela ordem).
   * artboards: [{ indice, nome, hasArte, rect }].
   * Devolve { extIdx, intIdx, avisos: [] } (índices da lista). */
  function decidirDupla(artboards) {
    var lista = artboards || [];
    var out = { extIdx: null, intIdx: null, avisos: [] };
    if (!lista.length) {
      out.avisos.push("Nenhuma artboard encontrada.");
      return out;
    }
    if (lista.length === 1) {
      out.extIdx = 0;
      out.avisos.push("Uma única artboard: usada como arte externa. A interna fica em branco.");
      return out;
    }
    if (lista.length === 2) {
      var p0 = papelDoNome(lista[0].nome);
      var p1 = papelDoNome(lista[1].nome);
      if (p0 === "externa" && p1 === "interna") {
        out.extIdx = 0; out.intIdx = 1;
        return out;
      }
      if (p0 === "interna" && p1 === "externa") {
        out.extIdx = 1; out.intIdx = 0;
        return out;
      }
      out.extIdx = 0; out.intIdx = 1;
      out.avisos.push("Duas artboards: 1ª usada como arte externa, 2ª usada como arte interna.");
      return out;
    }
    // 3+: usa as nomeadas; senão a ordem.
    var ext = null, int = null;
    for (var i = 0; i < lista.length; i++) {
      var p = papelDoNome(lista[i].nome);
      if (p === "externa" && ext === null) ext = i;
      if (p === "interna" && int === null) int = i;
    }
    if (ext !== null && int !== null && ext !== int) {
      out.extIdx = ext; out.intIdx = int;
      out.avisos.push("Usando \"" + lista[ext].nome + "\" (externa) e \"" + lista[int].nome + "\" (interna); demais ignoradas.");
      return out;
    }
    out.extIdx = 0; out.intIdx = 1;
    out.avisos.push("Nomes não reconhecidos: usando a 1ª como externa e a 2ª como interna.");
    return out;
  }

  /* Caixa da faca a partir da geometria normalizada.
   * geoCaixa = res.geometria.caixa ({ largura, altura }) ou fallback. */
  function caixaFacaDe(geoCaixa, pontos) {
    var W = 0, H = 0;
    if (geoCaixa && isFinite(geoCaixa.largura) && isFinite(geoCaixa.altura)) {
      W = Number(geoCaixa.largura);
      H = Number(geoCaixa.altura);
    }
    if (!(W > 0) || !(H > 0)) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var lista = pontos || [];
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].x < minX) minX = lista[i].x;
        if (lista[i].y < minY) minY = lista[i].y;
        if (lista[i].x > maxX) maxX = lista[i].x;
        if (lista[i].y > maxY) maxY = lista[i].y;
      }
      if (isFinite(minX) && isFinite(maxX)) {
        W = maxX - minX;
        H = maxY - minY;
      }
    }
    return { W: W, H: H };
  }

  /* Recorte em px do PNG da artboard para a bbox da faca.
   * rectArtboard / rectFaca em mm de documento (left,top,right,bottom,
   * Y para cima). pngW/pngH em px. PNG tem origem no topo à esquerda,
   * então sy inverte o Y.
   * Devolve { sx, sy, sw, sh } (inteiros, clampados) ou null se vazio. */
  function recorteParaFaca(pngW, pngH, rectArtboard, rectFaca) {
    var pw = numero(pngW);
    var ph = numero(pngH);
    if (!(pw > 0) || !(ph > 0)) return null;
    if (!rectArtboard || !rectFaca) return null;
    var abL = numero(rectArtboard.left), abR = numero(rectArtboard.right);
    var abB = numero(rectArtboard.bottom), abT = numero(rectArtboard.top);
    var abW = abR - abL;
    var abH = abT - abB;
    if (!(abW > 0) || !(abH > 0)) return null;
    var faL = numero(rectFaca.left), faR = numero(rectFaca.right);
    var faB = numero(rectFaca.bottom), faT = numero(rectFaca.top);
    var faW = faR - faL;
    var faH = faT - faB;
    if (!(faW > 0) || !(faH > 0)) return null;

    var sx = Math.round(((faL - abL) / abW) * pw);
    var sw = Math.round((faW / abW) * pw);
    // PNG: y=0 no topo (artboard top). sy = distância do topo.
    var sy = Math.round(((abT - faT) / abH) * ph);
    var sh = Math.round((faH / abH) * ph);

    // Clampa ao PNG (faca fora da artboard recorta em vez de falhar).
    if (sx < 0) { sw += sx; sx = 0; }
    if (sy < 0) { sh += sy; sy = 0; }
    if (sx + sw > pw) sw = pw - sx;
    if (sy + sh > ph) sh = ph - sy;
    if (!(sw > 0) || !(sh > 0)) return null;
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

  function urlDeArquivo(caminho) {
    var p = String(caminho || "").replace(/\\/g, "/");
    if (!p) return "";
    if (/^file:/i.test(p)) return p;
    if (!/^[a-zA-Z]:/.test(p)) p = "/" + p;
    return "file:///" + encodeURI(p).replace(/#/g, "%23").replace(/\?/g, "%3F");
  }

  function pot2(n) {
    var p = 1;
    while (p < n) p = p * 2;
    return p;
  }

  /* Cria canvas POT adicionando padding, SEM redimensionar o conteúdo original.
   * O canvas tem dimensão POT (padrão 4096 máx), mas a imagem mantém seu
   * tamanho original (sw×sh) posicionada com offset calculado.
   * Devolve { w, h, sw, sh, ox, oy } onde:
   *   w,h = dimensão do canvas POT
   *   sw,sh = dimensão original da imagem (preservada)
   *   ox,oy = offset no canvas para centralizar/posicionar a imagem */
  function tamanhoPot(rec, opt) {
    var maxD = Math.max(rec.sw, rec.sh);
    var teto = (opt && isFinite(opt.maxPx) && opt.maxPx > 0) ? opt.maxPx : 4096;
    // Canvas POT: menor potencia de 2 >= max dimensão
    var pw = pot2(maxD);
    var ph = pot2(maxD);
    // Offset para centralizar a imagem no canvas POT (ou posicionar conforme necessidade)
    var ox = (pw - rec.sw) / 2;
    var oy = (ph - rec.sh) / 2;
    return { w: pw, h: ph, sw: rec.sw, sh: rec.sh, ox: ox, oy: oy };
  }

  /* Carrega o PNG da artboard e recorta para a bbox da faca.
   * opts: { rectArtboard, rectFaca, papel, anisotropia }
   * Devolve { texture, largura, altura, recorte } (canvas = faca). */
  function carregarTexturaRecortada(caminho, opcoes) {
    var opt = opcoes || {};
    return new Promise(function (resolve, reject) {
      var url = urlDeArquivo(caminho);
      if (!url) {
        reject(new Error("Caminho de arte vazio."));
        return;
      }
      if (typeof document === "undefined" || typeof Image === "undefined") {
        reject(new Error("DOM indisponível para carregar a arte."));
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          var pngW = img.naturalWidth || img.width;
          var pngH = img.naturalHeight || img.height;
          if (!pngW || !pngH) {
            reject(new Error("Arte com dimensão zero: " + caminho));
            return;
          }
          var rec = recorteParaFaca(pngW, pngH, opt.rectArtboard, opt.rectFaca);
          if (!rec) {
            reject(new Error("A faca não intersecta a artboard (recorte vazio)."));
            return;
          }
          var tam = tamanhoPot(rec, opt);
          var canvas = document.createElement("canvas");
          canvas.width = tam.w;
          canvas.height = tam.h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = opt.papel || COR_PAPEL;
          ctx.fillRect(0, 0, tam.w, tam.h);
          ctx.imageSmoothingEnabled = true;
          // Desenha a imagem original no offset calculado (sem escalar)
          ctx.drawImage(img, rec.sx, rec.sy, rec.sw, rec.sh, tam.ox, tam.oy, rec.sw, rec.sh);
          if (!raiz.THREE || !raiz.THREE.CanvasTexture) {
            reject(new Error("THREE.CanvasTexture indisponível."));
            return;
          }
          var textura = new raiz.THREE.CanvasTexture(canvas);
          // Shimmer / moiré / riscos ao zoom: WebGL1 do CEP exige potência de 2
          // p/ mipmaps (NPOT + mipmap = faixa cinza). Agora o canvas já nasce em
          // POT via tamanhoPot() e o minFilter usa LinearMipmapLinear quando o
          // contexto suporta (fallback: Linear sem mipmap).
          textura.magFilter = raiz.THREE.LinearFilter;
          var supMip = !!(raiz.THREE && raiz.THREE.LinearMipmapLinearFilter);
          textura.minFilter = supMip ? raiz.THREE.LinearMipmapLinearFilter : raiz.THREE.LinearFilter;
          textura.generateMipmaps = supMip;
          textura.anisotropy = (opt && isFinite(opt.anisotropia) && opt.anisotropia > 0) ? opt.anisotropia : 1;
          textura.flipY = true;
          if (raiz.THREE.SRGBColorSpace !== undefined) {
            textura.colorSpace = raiz.THREE.SRGBColorSpace;
          } else if (raiz.THREE.sRGBEncoding !== undefined) {
            textura.encoding = raiz.THREE.sRGBEncoding;
          }
          textura.wrapS = raiz.THREE.ClampToEdgeWrapping;
          textura.wrapT = raiz.THREE.ClampToEdgeWrapping;
          textura.needsUpdate = true;
          resolve({
            texture: textura,
            largura: canvas.width,
            altura: canvas.height,
            recorte: rec
          });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () {
        reject(new Error("Falha ao carregar a arte: " + caminho + " (url=" + url + ")"));
      };
      // Cache-buster: o JSX sobrescreve o mesmo PNG; sem isso o CEF serve
      // a textura antiga e a edição no Illustrator não aparece.
      img.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();
    });
  }

  V.arteUnica = {
    uvFaca: uvFaca,
    uvFacaInversa: uvFacaInversa,
    caixaFacaDe: caixaFacaDe,
    recorteParaFaca: recorteParaFaca,
    urlDeArquivo: urlDeArquivo,
    carregarTexturaRecortada: carregarTexturaRecortada,
    normalizar: normalizar,
    papelDoNome: papelDoNome,
    decidirDupla: decidirDupla,
    COR_PAPEL: COR_PAPEL
  };
  // Alias para o pipeline dupla (mesmo módulo, mesma textura recortada).
  V.arteDupla = V.arteUnica;
})();