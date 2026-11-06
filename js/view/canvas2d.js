/* FACA 3D — visualizador 2D (Fase 2).
 *
 * Desenha a geometria real lida do Illustrator em um <canvas>, preservando as
 * curvas Bézier (usa os handles originais, não a polilinha achatada).
 *
 * Sistema de coordenadas do modelo: milímetros, Y para cima, origem no canto
 * inferior esquerdo da caixa delimitadora. A tela usa Y para baixo, então a
 * transformação é:  xTela = x*k + tx   ·   yTela = ty - y*k.
 *
 * O módulo não depende de renderer 3D nem do DOM do painel além do container.
 * API:
 *   Faca3D.view.canvas2d.criar({ host, aoInfo, aoZoom })
 *   viewer.desenhar(resultadoDoMotor)
 *   viewer.ajustar() / viewer.zoom(fator) / viewer.definirVista({...})
 *   viewer.destruir()
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var V = (F.view = F.view || {});

  var CORES = {
    cut: "#d7373f",
    crease: "#1473e6",
    other: "#6b7280",
    unknown: "#9ca3af"
  };
  var COR_FACE = "rgba(20, 115, 230, 0.075)";
  var COR_FACE_BORDA = "rgba(20, 115, 230, 0.22)";
  var COR_ABERTO = "rgba(240, 138, 42, 0.30)";
  var COR_AMBIG = "#e07b18";
  var LARGURA = { cut: 1.5, crease: 1.3, other: 1, unknown: 1 };
  var PADRAO_VINCO = [5, 3];
  var ZOOM_MIN_REL = 0.05;
  var ZOOM_MAX_REL = 400;

  function criar(opcoes) {
    var opt = opcoes || {};
    var host = opt.host;
    if (!host) throw new Error("Visualizador 2D sem container.");

    var canvas = document.createElement("canvas");
    canvas.className = "faca3d-canvas";
    host.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var estado = {
      res: null,
      k: 1,
      kFit: 1,
      tx: 0,
      ty: 0,
      autoAjuste: true,
      ajustePendente: true,
      opcoes: {
        cortes: true,
        vincos: true,
        faces: true,
        abertos: true,
        ambiguidades: true
      },
      arrastando: false,
      ultimoX: 0,
      ultimoY: 0,
      cursorMm: null
    };
    var quadro = null;
    var observador = null;

    /* ------------------------------------------------------------ dimensões */

    function dimensoes() {
      var r = canvas.getBoundingClientRect();
      var largura = Math.max(1, Math.round(r.width));
      var altura = Math.max(1, Math.round(r.height));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var px = Math.round(largura * dpr);
      var py = Math.round(altura * dpr);
      if (canvas.width !== px || canvas.height !== py) {
        canvas.width = px;
        canvas.height = py;
      }
      return { w: largura, h: altura, dpr: dpr };
    }

    function X(x) {
      return x * estado.k + estado.tx;
    }

    function Y(y) {
      return estado.ty - y * estado.k;
    }

    function mmDoCursor(cx, cy) {
      return { x: (cx - estado.tx) / estado.k, y: (estado.ty - cy) / estado.k };
    }

    /* -------------------------------------------------------------- ajuste */

    function aplicarAjuste(r) {
      if (!estado.res) {
        estado.ajustePendente = false;
        return;
      }
      var c = estado.res.geometria.caixa;
      var w = Math.max(c.largura, 0.001);
      var h = Math.max(c.altura, 0.001);
      var pad = 24;
      var k = Math.min((r.w - pad * 2) / w, (r.h - pad * 2) / h);
      if (!isFinite(k) || k <= 0) k = 1;
      estado.k = k;
      estado.kFit = k;
      estado.tx = (r.w - w * k) / 2 - c.minX * k;
      estado.ty = (r.h + h * k) / 2 + c.minY * k;
      estado.autoAjuste = true;
      estado.ajustePendente = false;
    }

    function ajustar() {
      var r = dimensoes();
      aplicarAjuste(r);
      redesenhar();
      avisarZoom();
    }

    function zoom(fator) {
      if (!estado.res) return;
      var r = dimensoes();
      var cx = r.w / 2;
      var cy = r.h / 2;
      zoomEm(fator, cx, cy);
    }

    function zoomEm(fator, cx, cy) {
      if (!estado.res) return;
      var minimo = estado.kFit * ZOOM_MIN_REL;
      var maximo = estado.kFit * ZOOM_MAX_REL;
      var novo = Math.max(minimo, Math.min(maximo, estado.k * fator));
      if (!isFinite(novo) || novo <= 0) return;
      var wx = (cx - estado.tx) / estado.k;
      var wy = (estado.ty - cy) / estado.k;
      estado.k = novo;
      estado.tx = cx - wx * novo;
      estado.ty = cy + wy * novo;
      estado.autoAjuste = false;
      redesenhar();
      avisarZoom();
    }

    function avisarZoom() {
      if (typeof opt.aoZoom !== "function") return;
      var rel = estado.kFit > 0 ? estado.k / estado.kFit : 1;
      try {
        opt.aoZoom(Math.round(rel * 100));
      } catch (e) {}
    }

    function avisarInfo() {
      if (typeof opt.aoInfo !== "function") return;
      var zoomPct = estado.kFit > 0 ? Math.round((estado.k / estado.kFit) * 100) : 100;
      var partes = [];
      if (estado.cursorMm) {
        partes.push(estado.cursorMm.x.toFixed(1) + ", " + estado.cursorMm.y.toFixed(1) + " mm");
      }
      partes.push("zoom " + zoomPct + "%");
      try {
        opt.aoInfo(partes.join(" · "));
      } catch (e) {}
    }

    /* ------------------------------------------------------------- desenho */

    function agendar() {
      if (quadro !== null) return;
      quadro = raiz.requestAnimationFrame(function () {
        quadro = null;
        desenhar();
      });
    }

    function redesenhar() {
      agendar();
    }

    function caminhoNoContexto(c) {
      var pts = c.pontos || [];
      if (pts.length < 2) return false;
      ctx.beginPath();
      ctx.moveTo(X(pts[0].mm.x), Y(pts[0].mm.y));
      var segs = c.segmentos || [];
      var i;
      if (segs.length) {
        for (i = 0; i < segs.length; i++) {
          var s = segs[i];
          if (s.tipo === "reta") {
            ctx.lineTo(X(s.p3.x), Y(s.p3.y));
          } else {
            ctx.bezierCurveTo(X(s.c1.x), Y(s.c1.y), X(s.c2.x), Y(s.c2.y), X(s.p3.x), Y(s.p3.y));
          }
        }
      } else {
        for (i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i].mm.x), Y(pts[i].mm.y));
      }
      return true;
    }

    function desenharFaces() {
      var faces = estado.res.faces && estado.res.faces.faces;
      if (!estado.opcoes.faces || !faces || !faces.length) return;
      var i, j;
      for (i = 0; i < faces.length; i++) {
        var pontos = faces[i].pontos || [];
        if (pontos.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(X(pontos[0].x), Y(pontos[0].y));
        for (j = 1; j < pontos.length; j++) ctx.lineTo(X(pontos[j].x), Y(pontos[j].y));
        ctx.closePath();
        ctx.fillStyle = COR_FACE;
        ctx.fill();
        ctx.strokeStyle = COR_FACE_BORDA;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
      }
    }

    function desenharAbertos() {
      if (!estado.opcoes.abertos) return;
      var grafo = estado.res.grafo;
      var contornos = (grafo && grafo.contornos) || (estado.res.topologia && estado.res.topologia.contornos) || [];
      ctx.strokeStyle = COR_ABERTO;
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash([]);
      for (var i = 0; i < contornos.length; i++) {
        var ct = contornos[i];
        if (ct.fechado) continue;
        var pontos = ct.pontos || [];
        if (pontos.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(X(pontos[0].x), Y(pontos[0].y));
        for (var j = 1; j < pontos.length; j++) ctx.lineTo(X(pontos[j].x), Y(pontos[j].y));
        ctx.stroke();
      }
    }

    function desenharCaminhos() {
      var caminhos = estado.res.geometria.caminhos || [];
      var i;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (i = 0; i < caminhos.length; i++) {
        var c = caminhos[i];
        var classe = c.classe || "unknown";
        if (classe === "cut" && !estado.opcoes.cortes) continue;
        if (classe === "crease" && !estado.opcoes.vincos) continue;
        if (!caminhoNoContexto(c)) continue;
        ctx.strokeStyle = CORES[classe] || CORES.unknown;
        ctx.lineWidth = LARGURA[classe] || 1;
        ctx.setLineDash(classe === "crease" ? PADRAO_VINCO : []);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    function desenharAmbiguidades() {
      if (!estado.opcoes.ambiguidades) return;
      var topo = estado.res.topologia;
      if (!topo) return;
      var vertices = topo.vertices || [];
      ctx.setLineDash([]);
      for (var i = 0; i < vertices.length; i++) {
        var v = vertices[i];
        if (v.grau <= 2) continue;
        var x = X(v.x);
        var y = Y(v.y);
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fill();
        ctx.strokeStyle = COR_AMBIG;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    function desenhar() {
      var r = dimensoes();
      ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
      ctx.clearRect(0, 0, r.w, r.h);
      if (!estado.res) return;
      if (estado.ajustePendente) {
        aplicarAjuste(r);
        avisarZoom();
      }
      desenharFaces();
      desenharAbertos();
      desenharCaminhos();
      desenharAmbiguidades();
      avisarInfo();
    }

    /* ------------------------------------------------------------- eventos */

    function aoMover(e) {
      var rect = canvas.getBoundingClientRect();
      var cx = e.clientX - rect.left;
      var cy = e.clientY - rect.top;
      if (estado.arrastando) {
        estado.tx += cx - estado.ultimoX;
        estado.ty += cy - estado.ultimoY;
        estado.ultimoX = cx;
        estado.ultimoY = cy;
        estado.autoAjuste = false;
        redesenhar();
        return;
      }
      estado.cursorMm = mmDoCursor(cx, cy);
      avisarInfo();
    }

    function aoPressionar(e) {
      if (e.button !== 0) return;
      estado.arrastando = true;
      estado.ultimoX = e.clientX - canvas.getBoundingClientRect().left;
      estado.ultimoY = e.clientY - canvas.getBoundingClientRect().top;
      canvas.classList.add("is-dragging");
      e.preventDefault();
    }

    function aoSoltar() {
      if (!estado.arrastando) return;
      estado.arrastando = false;
      canvas.classList.remove("is-dragging");
    }

    function aoSair() {
      aoSoltar();
      estado.cursorMm = null;
      avisarInfo();
    }

    function aoRolar(e) {
      if (!estado.res) return;
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var cx = e.clientX - rect.left;
      var cy = e.clientY - rect.top;
      var fator = Math.exp(-e.deltaY * 0.0015);
      zoomEm(fator, cx, cy);
    }

    function aoDuploClique(e) {
      e.preventDefault();
      ajustar();
    }

    canvas.addEventListener("mousedown", aoPressionar);
    canvas.addEventListener("mousemove", aoMover);
    canvas.addEventListener("wheel", aoRolar, { passive: false });
    canvas.addEventListener("dblclick", aoDuploClique);
    canvas.addEventListener("mouseleave", aoSair);
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    window.addEventListener("mouseup", aoSoltar);

    if (typeof raiz.ResizeObserver === "function") {
      observador = new raiz.ResizeObserver(function () {
        if (estado.ajustePendente || estado.autoAjuste) ajustar();
        else redesenhar();
      });
      observador.observe(host);
    } else {
      raiz.addEventListener("resize", function () {
        if (estado.ajustePendente || estado.autoAjuste) ajustar();
        else redesenhar();
      });
    }

    /* ---------------------------------------------------------------- API */

    function desenharResultado(res) {
      estado.res = res;
      estado.ajustePendente = true;
      estado.autoAjuste = true;
      redesenhar();
    }

    function definirVista(opcoes) {
      var o = opcoes || {};
      var k;
      for (k in estado.opcoes) {
        if (estado.opcoes.hasOwnProperty(k) && o.hasOwnProperty(k)) {
          estado.opcoes[k] = !!o[k];
        }
      }
      redesenhar();
    }

    function destruir() {
      if (observador) {
        try {
          observador.disconnect();
        } catch (e) {}
        observador = null;
      }
      window.removeEventListener("mouseup", aoSoltar);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return {
      desenhar: desenharResultado,
      redesenhar: redesenhar,
      ajustar: ajustar,
      zoom: zoom,
      definirVista: definirVista,
      destruir: destruir,
      temDados: function () {
        return !!estado.res;
      }
    };
  }

  V.canvas2d = {
    criar: criar,
    CORES: CORES
  };
})();
