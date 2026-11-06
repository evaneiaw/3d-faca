/* FACA 3D — diagnóstico 2D dos vincos (modo temporário).
 *
 * Desenha a geometria REAL lida do Illustrator e colore cada path de vinco
 * pelo resultado da auditoria: dobra, rígido, sem par de faces, múltiplo ou
 * fora do componente. Mostra também o eixo de cada dobradiça e o lado do
 * painel filho.
 *
 * API:
 *   Faca3D.view.diagnostico.criar({ host, aoSelecionar })
 *   diag.desenhar(resultado, montagem)
 *   diag.selecionar(indice)
 *   diag.destruir()
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var V = (F.view = F.view || {});

  var COR = {
    dobra: "#1473e6",
    rigida: "#e07b18",
    "sem-par": "#d7373f",
    "sem-face": "#d7373f",
    "sem-aresta": "#9ca3af",
    multipla: "#8b3fd0",
    fora: "#6b7280",
    face: "rgba(20, 115, 230, 0.06)",
    faceBorda: "rgba(120, 130, 145, 0.45)",
    corte: "rgba(215, 55, 63, 0.35)",
    eixo: "#111827",
    selecao: "#111827",
    estrutural: "#12805c",
    rejeicao: "#d7373f"
  };

  function criar(opcoes) {
    var opt = opcoes || {};
    var host = opt.host;
    if (!host) throw new Error("Diagnóstico sem container.");

    var canvas = document.createElement("canvas");
    canvas.className = "faca3d-diag-canvas-el";
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var estado = {
      res: null,
      montagem: null,
      k: 1,
      tx: 0,
      ty: 0,
      selecionado: null,
      segmentos: []
    };

    function dimensoes() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width));
      var h = Math.max(1, Math.round(r.height));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      return { w: w, h: h, dpr: dpr };
    }

    function X(x) {
      return x * estado.k + estado.tx;
    }

    function Y(y) {
      return estado.ty - y * estado.k;
    }

    function ajustar(w, h) {
      if (!estado.res) return;
      var c = estado.res.geometria.caixa;
      var pad = 28;
      var k = Math.min((w - pad * 2) / Math.max(c.largura, 1), (h - pad * 2) / Math.max(c.altura, 1));
      if (!isFinite(k) || k <= 0) k = 1;
      estado.k = k;
      estado.tx = (w - c.largura * k) / 2 - c.minX * k;
      estado.ty = (h + c.altura * k) / 2 + c.minY * k;
    }

    function caminhoPath(c) {
      ctx.beginPath();
      if (!c.pontos.length) return false;
      ctx.moveTo(X(c.pontos[0].mm.x), Y(c.pontos[0].mm.y));
      var segs = c.segmentos || [];
      var i;
      if (segs.length) {
        for (i = 0; i < segs.length; i++) {
          var s = segs[i];
          if (s.tipo === "reta") ctx.lineTo(X(s.p3.x), Y(s.p3.y));
          else ctx.bezierCurveTo(X(s.c1.x), Y(s.c1.y), X(s.c2.x), Y(s.c2.y), X(s.p3.x), Y(s.p3.y));
        }
      } else {
        for (i = 1; i < c.pontos.length; i++) ctx.lineTo(X(c.pontos[i].mm.x), Y(c.pontos[i].mm.y));
      }
      return true;
    }

    function desenharFaces() {
      var faces = estado.res.faces && estado.res.faces.faces ? estado.res.faces.faces : [];
      for (var i = 0; i < faces.length; i++) {
        var f = faces[i];
        if (!f.pontos.length) continue;
        ctx.beginPath();
        ctx.moveTo(X(f.pontos[0].x), Y(f.pontos[0].y));
        for (var j = 1; j < f.pontos.length; j++) ctx.lineTo(X(f.pontos[j].x), Y(f.pontos[j].y));
        ctx.closePath();
        ctx.fillStyle = COR.face;
        ctx.fill();
        ctx.strokeStyle = COR.faceBorda;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([]);
        ctx.stroke();
      }
      ctx.font = "bold 11px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (var k = 0; k < faces.length; k++) {
        var ff = faces[k];
        ctx.fillStyle = "rgba(60, 70, 85, 0.75)";
        ctx.fillText(String(ff.id), X(ff.centro.x), Y(ff.centro.y));
      }
    }

    function desenharCortes() {
      var caminhos = estado.res.geometria.caminhos || [];
      ctx.setLineDash([]);
      ctx.strokeStyle = COR.corte;
      ctx.lineWidth = 0.8;
      for (var i = 0; i < caminhos.length; i++) {
        if (caminhos[i].classe !== "cut") continue;
        if (caminhoPath(caminhos[i])) ctx.stroke();
      }
    }

    function desenharEixos() {
      var pares = estado.montagem && estado.montagem.pares ? estado.montagem.pares : {};
      var faces = estado.res.faces.faces;
      var mapa = {};
      for (var f = 0; f < faces.length; f++) mapa[faces[f].id] = faces[f];
      for (var chave in pares) {
        if (!pares.hasOwnProperty(chave)) continue;
        var p = pares[chave];
        if (!p.reta || p.faceFilho === null || !p.p1 || !p.p2) continue;
        var x1 = X(p.p1.x), y1 = Y(p.p1.y);
        var x2 = X(p.p2.x), y2 = Y(p.p2.y);
        ctx.setLineDash([7, 4]);
        ctx.strokeStyle = COR.eixo;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        var filho = mapa[p.faceFilho];
        if (!filho) continue;
        var mx = (x1 + x2) / 2;
        var my = (y1 + y2) / 2;
        var dx = X(filho.centro.x) - mx;
        var dy = Y(filho.centro.y) - my;
        var L = Math.sqrt(dx * dx + dy * dy);
        if (L < 1) continue;
        dx /= L;
        dy /= L;
        var ax = mx + dx * 16;
        var ay = my + dy * 16;
        ctx.strokeStyle = COR.eixo;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ax, ay, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = COR.eixo;
        ctx.fill();
        ctx.font = "bold 9px Segoe UI";
        ctx.fillStyle = COR.eixo;
        ctx.fillText(p.sinal > 0 ? "+" : "−", ax + dx * 8, ay + dy * 8);
      }
    }

    function desenharVincos() {
      var vincos = estado.montagem && estado.montagem.vincos ? estado.montagem.vincos : [];
      var caminhos = estado.res.geometria.caminhos || [];
      var porIndice = {};
      for (var i = 0; i < caminhos.length; i++) porIndice[caminhos[i].indice] = caminhos[i];

      estado.segmentos = [];

      for (var v = 0; v < vincos.length; v++) {
        var rec = vincos[v];
        var c = porIndice[rec.indice];
        if (!c) continue;
        var cor = COR[rec.status] || COR.fora;
        ctx.strokeStyle = cor;
        ctx.lineWidth = rec.indice === estado.selecionado ? 3.2 : 1.9;
        if (rec.status === "rigida") ctx.setLineDash([6, 3]);
        else if (rec.status === "sem-par" || rec.status === "sem-face") ctx.setLineDash([2, 3]);
        else if (rec.status === "multipla") ctx.setLineDash([1, 2]);
        else ctx.setLineDash([]);
        if (!caminhoPath(c)) continue;
        ctx.stroke();
        ctx.setLineDash([]);

        if (rec.indice === estado.selecionado) {
          ctx.strokeStyle = "rgba(17, 24, 39, 0.55)";
          ctx.lineWidth = 1;
          if (caminhoPath(c)) ctx.stroke();
        }

        // Guarda os segmentos para o teste de clique.
        var segs = c.segmentos || [];
        for (var s = 0; s < segs.length; s++) {
          estado.segmentos.push({
            indice: rec.indice,
            a: { x: X(segs[s].p0.x), y: Y(segs[s].p0.y) },
            b: { x: X(segs[s].p3.x), y: Y(segs[s].p3.y) }
          });
        }

        // Rótulo do vinco, no segmento mais longo.
        var melhor = null;
        var melhorL = -1;
        for (var t = 0; t < segs.length; t++) {
          var L = Math.hypot(X(segs[t].p3.x) - X(segs[t].p0.x), Y(segs[t].p3.y) - Y(segs[t].p0.y));
          if (L > melhorL) {
            melhorL = L;
            melhor = segs[t];
          }
        }
        if (melhor) {
          var mx = (X(melhor.p0.x) + X(melhor.p3.x)) / 2;
          var my = (Y(melhor.p0.y) + Y(melhor.p3.y)) / 2;
          var rotulo = "V" + rec.indice;
          ctx.font = "bold 9px Segoe UI";
          var w = ctx.measureText(rotulo).width + 6;
          ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
          ctx.fillRect(mx - w / 2, my - 7, w, 13);
          ctx.fillStyle = cor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(rotulo, mx, my);
        }
      }
    }

    function desenharEstrutural() {
      var est = estado.montagem && estado.montagem.estrutural;
      if (!est || !est.linhas) return;
      var i, j;
      // Halo das linhas estruturais (por baixo dos status).
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(18, 128, 92, 0.18)";
      ctx.lineWidth = 6;
      for (i = 0; i < est.linhas.length; i++) {
        var l = est.linhas[i];
        ctx.beginPath();
        ctx.moveTo(X(l.p1.x), Y(l.p1.y));
        ctx.lineTo(X(l.p2.x), Y(l.p2.y));
        ctx.stroke();
      }
      // Conexões virtuais (lacunas vencidas).
      ctx.strokeStyle = COR.estrutural;
      ctx.lineWidth = 1.6;
      for (i = 0; i < est.linhas.length; i++) {
        var c = est.linhas[i].conexoes || [];
        for (j = 0; j < c.length; j++) {
          if (!c[j].pA || !c[j].pB) continue;
          ctx.beginPath();
          ctx.moveTo(X(c[j].pA.x), Y(c[j].pA.y));
          ctx.lineTo(X(c[j].pB.x), Y(c[j].pB.y));
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(X(c[j].ponto.x), Y(c[j].ponto.y), 2.4, 0, Math.PI * 2);
          ctx.fillStyle = COR.estrutural;
          ctx.fill();
        }
      }
      // Extensões virtuais até corte/vinco.
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1.4;
      for (i = 0; i < est.linhas.length; i++) {
        var es = est.linhas[i].extensoes || [];
        for (j = 0; j < es.length; j++) {
          if (!es[j].de) continue;
          ctx.beginPath();
          ctx.moveTo(X(es[j].de.x), Y(es[j].de.y));
          ctx.lineTo(X(es[j].ponto.x), Y(es[j].ponto.y));
          ctx.stroke();
          ctx.strokeRect(X(es[j].ponto.x) - 2.5, Y(es[j].ponto.y) - 2.5, 5, 5);
        }
      }
      ctx.setLineDash([]);
    }

    function desenharRejeicoes() {
      var est = estado.montagem && estado.montagem.estrutural;
      if (!est || !est.rejeicoes) return;
      ctx.strokeStyle = COR.rejeicao;
      ctx.lineWidth = 1.4;
      for (var i = 0; i < est.rejeicoes.length; i++) {
        var r = est.rejeicoes[i];
        if (!r.ponto) continue;
        var x = X(r.ponto.x);
        var y = Y(r.ponto.y);
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 3);
        ctx.lineTo(x + 3, y + 3);
        ctx.moveTo(x + 3, y - 3);
        ctx.lineTo(x - 3, y + 3);
        ctx.stroke();
      }
    }

    function desenharSubdivisao() {
      var segmentos = (estado.res.geometria && estado.res.geometria.segmentos) || [];
      ctx.setLineDash([4, 2]);
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.2;
      for (var i = 0; i < segmentos.length; i++) {
        var s = segmentos[i];
        if (!s.virtual) continue;
        ctx.beginPath();
        ctx.moveTo(X(s.p0.x), Y(s.p0.y));
        ctx.lineTo(X(s.p3.x), Y(s.p3.y));
        ctx.stroke();
        ctx.strokeRect(X(s.p0.x) - 2, Y(s.p0.y) - 2, 4, 4);
        ctx.strokeRect(X(s.p3.x) - 2, Y(s.p3.y) - 2, 4, 4);
      }
      ctx.setLineDash([]);
    }

    function desenhar() {
      var d = dimensoes();
      ctx.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
      ctx.clearRect(0, 0, d.w, d.h);
      if (!estado.res) return;
      ajustar(d.w, d.h);
      desenharFaces();
      desenharCortes();
      desenharSubdivisao();
      desenharEstrutural();
      desenharEixos();
      desenharVincos();
      desenharRejeicoes();
    }

    function pontoSegmento(px, py, a, b) {
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var L2 = dx * dx + dy * dy;
      if (!L2) return Math.hypot(px - a.x, py - a.y);
      var t = ((px - a.x) * dx + (py - a.y) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    }

    function aoClicar(e) {
      var r = canvas.getBoundingClientRect();
      var px = e.clientX - r.left;
      var py = e.clientY - r.top;
      var melhor = null;
      var melhorD = 8;
      for (var i = 0; i < estado.segmentos.length; i++) {
        var s = estado.segmentos[i];
        var d = pontoSegmento(px, py, s.a, s.b);
        if (d < melhorD) {
          melhorD = d;
          melhor = s.indice;
        }
      }
      if (melhor !== null) selecionar(melhor);
    }

    function selecionar(indice) {
      estado.selecionado = indice;
      desenhar();
      if (typeof opt.aoSelecionar === "function") {
        var rec = null;
        var vincos = estado.montagem && estado.montagem.vincos ? estado.montagem.vincos : [];
        for (var i = 0; i < vincos.length; i++) {
          if (vincos[i].indice === indice) {
            rec = vincos[i];
            break;
          }
        }
        opt.aoSelecionar(rec);
      }
    }

    function desenharResultado(res, montagem) {
      estado.res = res;
      estado.montagem = montagem;
      estado.selecionado = null;
      desenhar();
    }

    function destruir() {
      canvas.removeEventListener("click", aoClicar);
      if (observador) {
        try {
          observador.disconnect();
        } catch (e) {}
        observador = null;
      }
      raiz.removeEventListener("resize", desenhar);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    canvas.addEventListener("click", aoClicar);
    var observador = null;
    if (typeof raiz.ResizeObserver === "function") {
      observador = new raiz.ResizeObserver(function () {
        desenhar();
      });
      observador.observe(host);
    } else {
      raiz.addEventListener("resize", desenhar);
    }

    return {
      desenhar: desenharResultado,
      selecionar: selecionar,
      redesenhar: desenhar,
      vista: function () {
        var r = canvas.getBoundingClientRect();
        return { k: estado.k, tx: estado.tx, ty: estado.ty, cssW: r.width, cssH: r.height };
      },
      destruir: destruir
    };
  }

  V.diagnostico = {
    criar: criar,
    COR: COR
  };
})();
