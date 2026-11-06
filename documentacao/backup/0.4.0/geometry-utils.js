/* FACA 3D — utilitários geométricos (Fase 2).
 *
 * Unidades: o Illustrator trabalha em pontos (1 pt = 25,4/72 mm). O backend
 * envia coordenadas em 1/10000 pt (inteiro) para não depender de locale.
 * Aqui convertemos para milímetros e montamos um sistema "normalizado":
 *   - milímetros;
 *   - eixo Y para cima (igual ao Illustrator);
 *   - origem no canto inferior esquerdo da caixa delimitadora do conjunto.
 * As coordenadas originais em pt são preservadas em todo o pipeline.
 *
 * Tolerâncias: todos os valores abaixo são explícitos, documentados e
 * configuráveis. Não há tolerância escondida em outro ponto do código.
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});

  var PT_MM = 25.4 / 72;
  var ESCALA_COORD = 10000;

  /* Tolerâncias padrão do motor (mm / graus / mm²). */
  var TOLERANCIAS = {
    juncaoMm: 0.05,      // endpoints a menos disso viram o mesmo vértice
    retaMm: 0.001,       // handle a menos disso do anchor = segmento reto
    curvaMm: 0.02,       // erro máximo ao achatar uma Bézier
    intersecaoMm: 0.01,  // folga para considerar interseção real
    areaMinMm2: 0.01,    // faces menores que isso são descartadas
    anguloMaxGraus: 35   // desvio máximo para continuar um contorno
  };

  function copiarTolerancias(extra) {
    var t = {};
    var k;
    for (k in TOLERANCIAS) {
      if (TOLERANCIAS.hasOwnProperty(k)) t[k] = TOLERANCIAS[k];
    }
    if (extra) {
      for (k in extra) {
        if (extra.hasOwnProperty(k) && typeof extra[k] === "number" && isFinite(extra[k])) {
          t[k] = extra[k];
        }
      }
    }
    return t;
  }

  function ponto(x, y) {
    return { x: x, y: y };
  }

  function clonarPonto(p) {
    return { x: p.x, y: p.y };
  }

  function soma(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  function escala(a, k) {
    return { x: a.x * k, y: a.y * k };
  }

  function produtoEscalar(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function produtoVetorial(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  function comprimento(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  function distancia(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distancia2(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function quaseIgual(a, b, tol) {
    return distancia2(a, b) <= tol * tol;
  }

  function normalizarVetor(v) {
    var c = comprimento(v);
    if (c === 0) return { x: 0, y: 0 };
    return { x: v.x / c, y: v.y / c };
  }

  function angulo(v) {
    return Math.atan2(v.y, v.x);
  }

  function diferencaAngular(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  function interpolar(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function caixaDelimitadora(pontos) {
    if (!pontos || !pontos.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, largura: 0, altura: 0 };
    var minX = pontos[0].x, maxX = pontos[0].x;
    var minY = pontos[0].y, maxY = pontos[0].y;
    for (var i = 1; i < pontos.length; i++) {
      var p = pontos[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, largura: maxX - minX, altura: maxY - minY };
  }

  /* Bézier cúbica. */
  function bezierPonto(p0, c1, c2, p3, t) {
    var u = 1 - t;
    var uu = u * u;
    var tt = t * t;
    var a = uu * u;
    var b = 3 * uu * t;
    var c = 3 * u * tt;
    var d = tt * t;
    return {
      x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
      y: a * p0.y + b * c1.y + c * c2.y + d * p3.y
    };
  }

  /* Distância de um ponto à reta que passa por a e b. */
  function distanciaPontoReta(p, a, b) {
    var ab = sub(b, a);
    var c = comprimento(ab);
    if (c === 0) return distancia(p, a);
    return Math.abs(produtoVetorial(sub(p, a), ab) / c);
  }

  /* Achata a Bézier por subdivisão recursiva até o erro <= tolMm. */
  function achatarBezier(p0, c1, c2, p3, tolMm, maxNivel) {
    var limite = typeof maxNivel === "number" ? maxNivel : 16;
    var saida = [clonarPonto(p0)];
    var contador = 0;

    function recursivo(a, b, c, d, nivel) {
      contador++;
      var plano = distanciaPontoReta(b, a, d) <= tolMm && distanciaPontoReta(c, a, d) <= tolMm;
      if (plano || nivel >= limite || contador > 20000) {
        saida.push(clonarPonto(d));
        return;
      }
      var ab = interpolar(a, b, 0.5);
      var bc = interpolar(b, c, 0.5);
      var cd = interpolar(c, d, 0.5);
      var abc = interpolar(ab, bc, 0.5);
      var bcd = interpolar(bc, cd, 0.5);
      var meio = interpolar(abc, bcd, 0.5);
      recursivo(a, ab, abc, meio, nivel + 1);
      recursivo(meio, bcd, cd, d, nivel + 1);
    }

    recursivo(p0, c1, c2, p3, 0);
    return saida;
  }

  /* Comprimento de uma polilinha. */
  function comprimentoPolilinha(pts) {
    var total = 0;
    for (var i = 1; i < pts.length; i++) total += distancia(pts[i - 1], pts[i]);
    return total;
  }

  /* Interseção entre dois segmentos retos.
   * Retorna { ponto, t, u, colinear } ou null.
   * Em caso colinear com sobreposição, devolve colinear=true e o trecho. */
  function intersecaoRetas(p1, p2, p3, p4, tol) {
    var r = sub(p2, p1);
    var s = sub(p4, p3);
    var den = produtoVetorial(r, s);
    var qp = sub(p3, p1);
    var tolUso = typeof tol === "number" ? tol : 1e-9;

    if (Math.abs(den) < 1e-12) {
      // Paralelos. Colineares se o vetor entre origens for paralelo a r.
      if (Math.abs(produtoVetorial(qp, r)) > tolUso * Math.max(1, comprimento(r))) return null;
      var rr = produtoEscalar(r, r);
      if (rr === 0) return null;
      var t0 = produtoEscalar(qp, r) / rr;
      var t1 = produtoEscalar(sub(p4, p1), r) / rr;
      var ini = Math.max(0, Math.min(t0, t1));
      var fim = Math.min(1, Math.max(t0, t1));
      if (fim < ini) return null;
      if (fim - ini <= 1e-9) {
        return { ponto: interpolar(p1, p2, ini), t: ini, u: 0, colinear: true, sobreposicao: null };
      }
      return {
        ponto: interpolar(p1, p2, ini),
        t: ini,
        u: 0,
        colinear: true,
        sobreposicao: { inicio: interpolar(p1, p2, ini), fim: interpolar(p1, p2, fim) }
      };
    }

    var t = produtoVetorial(qp, s) / den;
    var u = produtoVetorial(qp, r) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return { ponto: interpolar(p1, p2, t), t: t, u: u, colinear: false, sobreposicao: null };
  }

  function areaPoligono(pts) {
    var a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }

  function pontoEmPoligono(p, pts) {
    var dentro = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var pi = pts[i];
      var pj = pts[j];
      var cruza = pi.y > p.y !== pj.y > p.y;
      if (cruza) {
        var x = ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
        if (p.x < x) dentro = !dentro;
      }
    }
    return dentro;
  }

  function distanciaPontoSegmento(p, a, b) {
    var ab = sub(b, a);
    var c2 = produtoEscalar(ab, ab);
    if (c2 === 0) return distancia(p, a);
    var t = produtoEscalar(sub(p, a), ab) / c2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return distancia(p, interpolar(a, b, t));
  }

  /* Reduz a coordenada a uma grade para agrupar vértices próximos. */
  function chaveGrade(p, celula) {
    var c = celula > 0 ? celula : 1;
    return Math.round(p.x / c) + ":" + Math.round(p.y / c);
  }

  /* Normaliza um conjunto de pontos pt -> mm com origem na bbox. */
  function normalizar(pontosPt) {
    var caixa = caixaDelimitadora(pontosPt);
    var mm = [];
    for (var i = 0; i < pontosPt.length; i++) {
      mm.push({
        x: (pontosPt[i].x - caixa.minX) * PT_MM,
        y: (pontosPt[i].y - caixa.minY) * PT_MM
      });
    }
    return { mm: mm, caixaPt: caixa };
  }

  function arredondar(v, casas) {
    var f = Math.pow(10, casas === undefined ? 3 : casas);
    return Math.round(v * f) / f;
  }

  G.utils = {
    PT_MM: PT_MM,
    ESCALA_COORD: ESCALA_COORD,
    TOLERANCIAS: TOLERANCIAS,
    tolerancias: copiarTolerancias,
    ponto: ponto,
    clonarPonto: clonarPonto,
    soma: soma,
    sub: sub,
    escala: escala,
    produtoEscalar: produtoEscalar,
    produtoVetorial: produtoVetorial,
    comprimento: comprimento,
    distancia: distancia,
    distancia2: distancia2,
    quaseIgual: quaseIgual,
    normalizarVetor: normalizarVetor,
    angulo: angulo,
    diferencaAngular: diferencaAngular,
    interpolar: interpolar,
    caixaDelimitadora: caixaDelimitadora,
    bezierPonto: bezierPonto,
    distanciaPontoReta: distanciaPontoReta,
    achatarBezier: achatarBezier,
    comprimentoPolilinha: comprimentoPolilinha,
    intersecaoRetas: intersecaoRetas,
    areaPoligono: areaPoligono,
    pontoEmPoligono: pontoEmPoligono,
    distanciaPontoSegmento: distanciaPontoSegmento,
    chaveGrade: chaveGrade,
    normalizar: normalizar,
    arredondar: arredondar
  };
})();
