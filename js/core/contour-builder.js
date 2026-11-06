/* FACA 3D — reconstrução de contornos (Fase 2).
 *
 * Recebe os segmentos do parser e devolve um grafo planar:
 *   - vértices (agrupamento de endpoints dentro da tolerância de junção);
 *   - arestas (segmentos divididos nas interseções);
 *   - contornos (cadeias percorridas; fechadas só quando voltam ao início);
 *   - duplicados, sobrepostos, interseções, ambiguidades e inválidos.
 *
 * Regras deliberadas:
 *   - Só se continua um contorno em vértice de grau 2 (decisão inequívoca).
 *   - Em vértice de grau > 2 o contorno PARA e a ambiguidade é registrada:
 *     nunca se escolhe um ramo "no chute".
 *   - A geometria nunca é alterada: as arestas guardam o trecho original
 *     (segmento de origem + intervalo t0..t1).
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});
  var U = G.utils;

  function achatarSegmento(seg, tolCurvaMm) {
    if (seg.tipo === "reta") return [U.clonarPonto(seg.p0), U.clonarPonto(seg.p3)];
    return U.achatarBezier(seg.p0, seg.c1, seg.c2, seg.p3, tolCurvaMm);
  }

  function distanciasAcumuladas(pts) {
    var acc = [0];
    for (var i = 1; i < pts.length; i++) acc.push(acc[i - 1] + U.distancia(pts[i - 1], pts[i]));
    return acc;
  }

  function pontoEmDistancia(pts, acc, d) {
    if (d <= 0) return U.clonarPonto(pts[0]);
    var total = acc[acc.length - 1];
    if (d >= total) return U.clonarPonto(pts[pts.length - 1]);
    for (var i = 1; i < pts.length; i++) {
      if (acc[i] >= d) {
        var span = acc[i] - acc[i - 1];
        var t = span > 0 ? (d - acc[i - 1]) / span : 0;
        return U.interpolar(pts[i - 1], pts[i], t);
      }
    }
    return U.clonarPonto(pts[pts.length - 1]);
  }

  /* Fatia a polilinha nos valores de distância informados. */
  function fatiar(pts, acc, cortes) {
    var total = acc[acc.length - 1];
    var lista = [0];
    var i;
    for (i = 0; i < cortes.length; i++) {
      var c = cortes[i];
      if (c > 1e-9 && c < total - 1e-9) lista.push(c);
    }
    lista.push(total);
    lista.sort(function (a, b) {
      return a - b;
    });

    var partes = [];
    for (i = 1; i < lista.length; i++) {
      var d0 = lista[i - 1];
      var d1 = lista[i];
      if (d1 - d0 <= 1e-9) continue;
      var trecho = [pontoEmDistancia(pts, acc, d0)];
      for (var k = 1; k < pts.length; k++) {
        if (acc[k] > d0 + 1e-9 && acc[k] < d1 - 1e-9) trecho.push(U.clonarPonto(pts[k]));
      }
      trecho.push(pontoEmDistancia(pts, acc, d1));
      partes.push({ pontos: trecho, d0: d0, d1: d1 });
    }
    return partes;
  }

  /* Célula adaptativa para o índice espacial. */
  function tamanhoCelula(caixa, nArestas) {
    var area = Math.max(caixa.largura * caixa.altura, 1);
    var c = Math.sqrt(area / Math.max(nArestas, 1)) * 2;
    return Math.max(c, 0.5);
  }

  function construir(segmentos, opcoes) {
    var opt = opcoes || {};
    var tol = U.tolerancias(opt.tolerancias);
    var t0 = Date.now();
    var invalidos = [];
    var achatados = [];
    var achatadosPorSegmento = {};
    var i, j;

    // 1) Achata e acumula distâncias.
    for (i = 0; i < segmentos.length; i++) {
      var seg = segmentos[i];
      var pts = achatarSegmento(seg, tol.curvaMm);
      if (pts.length < 2) {
        invalidos.push({ tipo: "segmento-vazio", segmento: seg.id });
        continue;
      }
      var acc = distanciasAcumuladas(pts);
      if (acc[acc.length - 1] <= tol.juncaoMm * 0.01) {
        invalidos.push({ tipo: "comprimento-zero", segmento: seg.id, comprimento: acc[acc.length - 1] });
        continue;
      }
      achatados.push({ seg: seg, pontos: pts, acc: acc, total: acc[acc.length - 1], cortes: [] });
      achatadosPorSegmento[seg.id] = achatados[achatados.length - 1];
    }

    // 2) Caixa geral e índice espacial das arestas achatadas.
    var todos = [];
    for (i = 0; i < achatados.length; i++) {
      for (j = 0; j < achatados[i].pontos.length; j++) todos.push(achatados[i].pontos[j]);
    }
    var caixa = U.caixaDelimitadora(todos);
    var celula = tamanhoCelula(caixa, achatados.length);

    var celulas = {};
    function indexar(chave, item) {
      if (!celulas[chave]) celulas[chave] = [];
      celulas[chave].push(item);
    }
    for (i = 0; i < achatados.length; i++) {
      var a = achatados[i];
      for (j = 1; j < a.pontos.length; j++) {
        var p = a.pontos[j - 1];
        var q = a.pontos[j];
        var minX = Math.min(p.x, q.x) - tol.intersecaoMm;
        var maxX = Math.max(p.x, q.x) + tol.intersecaoMm;
        var minY = Math.min(p.y, q.y) - tol.intersecaoMm;
        var maxY = Math.max(p.y, q.y) + tol.intersecaoMm;
        var cx0 = Math.floor(minX / celula), cx1 = Math.floor(maxX / celula);
        var cy0 = Math.floor(minY / celula), cy1 = Math.floor(maxY / celula);
        for (var cx = cx0; cx <= cx1; cx++) {
          for (var cy = cy0; cy <= cy1; cy++) {
            indexar(cx + ":" + cy, { a: i, k: j - 1 });
          }
        }
      }
    }

    // 3) Interseções entre arestas de segmentos diferentes (ou do mesmo,
    //    desde que não sejam vizinhas — evita falso positivo no joint).
    var vistos = {};
    var interseccoes = [];
    var candidatos = [];
    function chavePar(i1, k1, i2, k2) {
      return i1 < i2 ? i1 + ":" + k1 + "|" + i2 + ":" + k2 : i2 + ":" + k2 + "|" + i1 + ":" + k1;
    }

    for (var chave in celulas) {
      if (!celulas.hasOwnProperty(chave)) continue;
      var lista = celulas[chave];
      for (var m = 0; m < lista.length; m++) {
        for (var n = m + 1; n < lista.length; n++) {
          var e1 = lista[m];
          var e2 = lista[n];
          if (e1.a === e2.a && Math.abs(e1.k - e2.k) <= 1) continue;
          var par = chavePar(e1.a, e1.k, e2.a, e2.k);
          if (vistos[par]) continue;
          vistos[par] = true;

          var A1 = achatados[e1.a];
          var A2 = achatados[e2.a];
          var r = U.intersecaoRetas(A1.pontos[e1.k], A1.pontos[e1.k + 1], A2.pontos[e2.k], A2.pontos[e2.k + 1], tol.intersecaoMm);
          if (!r) continue;

          var d1 = A1.acc[e1.k] + U.distancia(A1.pontos[e1.k], r.ponto);
          var d2 = A2.acc[e2.k] + U.distancia(A2.pontos[e2.k], r.ponto);

          // Candidatos; o agrupamento por par de segmentos elimina as
          // repetições causadas pelo achatamento das curvas.
          candidatos.push({
            a: A1.seg.id,
            b: A2.seg.id,
            ponto: r.ponto,
            d1: d1,
            d2: d2,
            colinear: !!r.colinear,
            sobreposicao: r.sobreposicao,
            totalA: A1.total,
            totalB: A2.total
          });
        }
      }
    }

    // 3b) Agrupa candidatos por par de segmentos e proximidade.
    var porParSeg = {};
    for (i = 0; i < candidatos.length; i++) {
      var cand = candidatos[i];
      var chaveSeg = cand.a + ":" + cand.b;
      if (!porParSeg[chaveSeg]) porParSeg[chaveSeg] = [];
      var grupo = porParSeg[chaveSeg];
      var achou = null;
      for (j = 0; j < grupo.length; j++) {
        if (U.distancia(grupo[j].ponto, cand.ponto) <= tol.intersecaoMm) {
          achou = grupo[j];
          break;
        }
      }
      if (achou) {
        if (cand.d1 < achou.dMin) achou.dMin = cand.d1;
        if (cand.d1 > achou.dMax) achou.dMax = cand.d1;
        if (cand.d2 < achou.eMin) achou.eMin = cand.d2;
        if (cand.d2 > achou.eMax) achou.eMax = cand.d2;
        achou.colinear = achou.colinear || cand.colinear;
        achou.ocorrencias++;
      } else {
        grupo.push({
          ponto: cand.ponto,
          a: cand.a,
          b: cand.b,
          dMin: cand.d1,
          dMax: cand.d1,
          eMin: cand.d2,
          eMax: cand.d2,
          totalA: cand.totalA,
          totalB: cand.totalB,
          colinear: cand.colinear,
          sobreposicao: cand.sobreposicao,
          ocorrencias: 1
        });
      }
    }

    for (var chaveSeg2 in porParSeg) {
      if (!porParSeg.hasOwnProperty(chaveSeg2)) continue;
      var grupo2 = porParSeg[chaveSeg2];
      for (i = 0; i < grupo2.length; i++) {
        var g2 = grupo2[i];
        var dist1 = Math.min(g2.dMin, g2.totalA - g2.dMax);
        var dist2 = Math.min(g2.eMin, g2.totalB - g2.eMax);
        var ponta1 = dist1 <= tol.juncaoMm;
        var ponta2 = dist2 <= tol.juncaoMm;
        var tipo;
        if (g2.colinear) tipo = "sobreposicao";
        else if (ponta1 && ponta2) tipo = "toque";
        else if (ponta1 || ponta2) tipo = "juncao";
        else tipo = "cruzamento";

        interseccoes.push({
          ponto: g2.ponto,
          segmentoA: g2.a,
          segmentoB: g2.b,
          tipo: tipo,
          colinear: g2.colinear,
          sobreposicao: g2.sobreposicao,
          ocorrencias: g2.ocorrencias
        });

        // Um único corte por ponto em cada segmento.
        if (achatadosPorSegmento[g2.a]) achatadosPorSegmento[g2.a].cortes.push(g2.dMin);
        if (achatadosPorSegmento[g2.b]) achatadosPorSegmento[g2.b].cortes.push(g2.eMin);
      }
    }

    // 4) Fatia os segmentos e cria arestas.
    var arestas = [];
    for (i = 0; i < achatados.length; i++) {
      var A = achatados[i];
      var partes = fatiar(A.pontos, A.acc, A.cortes);
      for (j = 0; j < partes.length; j++) {
        var parte = partes[j];
        arestas.push({
          id: arestas.length,
          origem: A.seg.id,
          caminho: A.seg.caminho,
          classe: A.seg.classe,
          spot: A.seg.spot,
          tipoOriginal: A.seg.tipo,
          fechadoOriginal: A.seg.fechado,
          indiceNoCaminho: A.seg.indiceNoCaminho,
          pontos: parte.pontos,
          comprimentoMm: parte.d1 - parte.d0,
          t0: A.total > 0 ? parte.d0 / A.total : 0,
          t1: A.total > 0 ? parte.d1 / A.total : 1,
          a: -1,
          b: -1
        });
      }
    }

    // 5) Agrupa endpoints em vértices (tolerância de junção).
    var nos = [];
    var grade = {};
    var celulaNo = Math.max(tol.juncaoMm, 1e-6);

    function acharOuCriarNo(p) {
      var gx = Math.floor(p.x / celulaNo);
      var gy = Math.floor(p.y / celulaNo);
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          var lista = grade[(gx + dx) + ":" + (gy + dy)];
          if (!lista) continue;
          for (var k = 0; k < lista.length; k++) {
            var id = lista[k];
            if (U.distancia(nos[id], p) <= tol.juncaoMm) return id;
          }
        }
      }
      var novo = nos.length;
      nos.push({ id: novo, x: p.x, y: p.y, arestas: [] });
      var chave = gx + ":" + gy;
      if (!grade[chave]) grade[chave] = [];
      grade[chave].push(novo);
      return novo;
    }

    for (i = 0; i < arestas.length; i++) {
      var ar = arestas[i];
      ar.a = acharOuCriarNo(ar.pontos[0]);
      ar.b = acharOuCriarNo(ar.pontos[ar.pontos.length - 1]);
      if (ar.a === ar.b) {
        invalidos.push({ tipo: "laco-ou-zero", aresta: ar.id, comprimento: ar.comprimentoMm });
      } else {
        nos[ar.a].arestas.push(ar.id);
        nos[ar.b].arestas.push(ar.id);
      }
    }

    // 5b) Costura de pontas soltas: micro-falhas do desenho (picotes nas bases
    //     das abas) deixam a borda de um painel aberta e o painel deixa de ser
    //     face. Só liga ponta de grau 1 a um vértice a até costuraMm, em linha
    //     reta que não cruza nenhuma aresta existente. costuraMm = 0 desliga.
    var costuras = [];
    if (tol.costuraMm > 0) {
      function cruzaAlgumaAresta(p, q, noA, noB) {
        for (var e = 0; e < arestas.length; e++) {
          var ae = arestas[e];
          if (ae.a === noA || ae.b === noA || ae.a === noB || ae.b === noB) continue;
          for (var k = 1; k < ae.pontos.length; k++) {
            var r = U.intersecaoRetas(p, q, ae.pontos[k - 1], ae.pontos[k], tol.intersecaoMm);
            if (!r) continue;
            if (r.colinear && r.sobreposicao) return true;
            if (r.t > 0.001 && r.t < 0.999 && r.u > 0.001 && r.u < 0.999) return true;
          }
        }
        return false;
      }

      var pontas = [];
      for (i = 0; i < nos.length; i++) {
        if (nos[i].arestas.length === 1) pontas.push(i);
      }
      var paresCostura = [];
      for (i = 0; i < pontas.length; i++) {
        var noPonta = pontas[i];
        var arestaPonta = arestas[nos[noPonta].arestas[0]];
        for (j = 0; j < nos.length; j++) {
          if (j === noPonta) continue;
          if (arestaPonta && (arestaPonta.a === j || arestaPonta.b === j)) continue;
          var dCostura = U.distancia(nos[noPonta], nos[j]);
          if (dCostura <= tol.juncaoMm || dCostura > tol.costuraMm) continue;
          paresCostura.push({ a: noPonta, b: j, d: dCostura });
        }
      }
      paresCostura.sort(function (x, y) {
        return x.d - y.d;
      });
      var nosUsadosCostura = {};
      for (i = 0; i < paresCostura.length; i++) {
        var pc = paresCostura[i];
        if (nosUsadosCostura[pc.a] || nosUsadosCostura[pc.b]) continue;
        var pA = { x: nos[pc.a].x, y: nos[pc.a].y };
        var pB = { x: nos[pc.b].x, y: nos[pc.b].y };
        if (cruzaAlgumaAresta(pA, pB, pc.a, pc.b)) continue;
        var ponte = {
          id: arestas.length,
          origem: -1,
          caminho: -1,
          classe: "cut",
          spot: "Costura",
          tipoOriginal: "reta",
          fechadoOriginal: false,
          indiceNoCaminho: 0,
          pontos: [pA, pB],
          comprimentoMm: pc.d,
          t0: 0,
          t1: 1,
          a: pc.a,
          b: pc.b,
          ponte: true
        };
        arestas.push(ponte);
        nos[pc.a].arestas.push(ponte.id);
        nos[pc.b].arestas.push(ponte.id);
        nosUsadosCostura[pc.a] = true;
        nosUsadosCostura[pc.b] = true;
        costuras.push({ a: pc.a, b: pc.b, comprimentoMm: U.arredondar(pc.d, 3) });
      }
    }

    // 6) Duplicados e sobrepostos.
    var duplicados = [];
    var sobrepostos = [];
    var porPar = {};
    for (i = 0; i < arestas.length; i++) {
      var ar1 = arestas[i];
      if (ar1.a === ar1.b) continue;
      var chaveParNo = Math.min(ar1.a, ar1.b) + "|" + Math.max(ar1.a, ar1.b);
      if (!porPar[chaveParNo]) {
        porPar[chaveParNo] = [];
      } else {
        for (j = 0; j < porPar[chaveParNo].length; j++) {
          var outro = arestas[porPar[chaveParNo][j]];
          if (outro.classe !== ar1.classe) continue;
          var meio1 = ar1.pontos[Math.floor(ar1.pontos.length / 2)];
          var meio2 = outro.pontos[Math.floor(outro.pontos.length / 2)];
          if (U.distancia(meio1, meio2) <= tol.juncaoMm) {
            duplicados.push({ aresta: ar1.id, de: outro.id });
            // A aresta duplicada sai do grafo: mantê-la cria ciclos degenerados
            // e impede a face (inclusive o furo) de ser detectada.
            ar1.duplicada = true;
            break;
          }
        }
      }
      porPar[chaveParNo].push(i);
    }

    // Tira as arestas duplicadas das listas de adjacência dos vértices.
    for (i = 0; i < arestas.length; i++) {
      var arDup = arestas[i];
      if (!arDup.duplicada) continue;
      var limparNo = function (no) {
        if (!no) return;
        var listaNo = nos[no].arestas;
        for (var kk = listaNo.length - 1; kk >= 0; kk--) {
          if (listaNo[kk] === arDup.id) listaNo.splice(kk, 1);
        }
      };
      limparNo(arDup.a);
      limparNo(arDup.b);
    }

    // Sobreposição: trechos colineares do mesmo caminho que se cobrem.
    for (i = 0; i < interseccoes.length; i++) {
      var it = interseccoes[i];
      if (!it.colinear || !it.sobreposicao) continue;
      sobrepostos.push({
        segmentoA: it.segmentoA,
        segmentoB: it.segmentoB,
        inicio: it.sobreposicao.inicio,
        fim: it.sobreposicao.fim
      });
    }

    // 7) Contornos: caminhada por vértices de grau 2.
    var usadas = {};
    var contornos = [];
    var ambiguidades = [];

    function direcaoNaAresta(ar, no) {
      return ar.a === no ? 1 : -1;
    }

    function pontosNaDirecao(ar, dir) {
      var pts = ar.pontos;
      if (dir > 0) return pts;
      var out = [];
      for (var k = pts.length - 1; k >= 0; k--) out.push(pts[k]);
      return out;
    }

    function caminhar(inicioAresta, inicioNo) {
      var cadeia = [];
      var atual = inicioAresta;
      var noAtual = inicioNo;
      var guarda = 0;
      while (atual !== null && guarda++ < 100000) {
        if (usadas[atual]) break;
        usadas[atual] = true;
        var ar = arestas[atual];
        var dir = direcaoNaAresta(ar, noAtual);
        cadeia.push({ id: ar.id, direcao: dir });
        var proximoNo = dir > 0 ? ar.b : ar.a;
        if (proximoNo === inicioNo) {
          return { cadeia: cadeia, fechado: true, ambiguo: false };
        }
        var vizinhas = nos[proximoNo].arestas;
        if (vizinhas.length !== 2) {
          return {
            cadeia: cadeia,
            fechado: false,
            ambiguo: vizinhas.length > 2,
            noFim: proximoNo,
            grau: vizinhas.length
          };
        }
        var prox = vizinhas[0] === atual ? vizinhas[1] : vizinhas[0];
        if (usadas[prox]) {
          return { cadeia: cadeia, fechado: false, ambiguo: false, noFim: proximoNo, grau: 2 };
        }
        atual = prox;
        noAtual = proximoNo;
      }
      return { cadeia: cadeia, fechado: false, ambiguo: false };
    }

    // Começa por extremidades e junções (grau != 2), depois pelos ciclos.
    var ordem = [];
    for (i = 0; i < nos.length; i++) {
      if (nos[i].arestas.length !== 2) {
        for (j = 0; j < nos[i].arestas.length; j++) ordem.push({ aresta: nos[i].arestas[j], no: nos[i].id });
      }
    }
    for (i = 0; i < arestas.length; i++) ordem.push({ aresta: i, no: arestas[i].a });

    for (i = 0; i < ordem.length; i++) {
      var item = ordem[i];
      if (usadas[item.aresta]) continue;
      var res = caminhar(item.aresta, item.no);
      if (!res.cadeia.length) continue;

      var pontos = [];
      for (j = 0; j < res.cadeia.length; j++) {
        var trecho = pontosNaDirecao(arestas[res.cadeia[j].id], res.cadeia[j].direcao);
        for (var kk = 0; kk < trecho.length; kk++) {
          if (j > 0 && kk === 0) continue;
          pontos.push(trecho[kk]);
        }
      }
      var classes = {};
      for (j = 0; j < res.cadeia.length; j++) {
        var cls = arestas[res.cadeia[j].id].classe;
        classes[cls] = (classes[cls] || 0) + 1;
      }

      var contorno = {
        id: contornos.length,
        fechado: res.fechado,
        ambiguo: res.ambiguo,
        arestas: res.cadeia,
        pontos: pontos,
        classes: classes,
        areaMm2: res.fechado ? Math.abs(U.areaPoligono(pontos)) : 0,
        perimetroMm: U.comprimentoPolilinha(pontos)
      };
      contornos.push(contorno);

      if (res.ambiguo) {
        ambiguidades.push({
          tipo: "grau-maior-2",
          no: res.noFim,
          grau: res.grau,
          arestas: nos[res.noFim] ? nos[res.noFim].arestas.slice() : [],
          contorno: contorno.id
        });
      }
    }

    // 8) Auto-interseções dos contornos fechados (diagnóstico, sem alterar).
    for (i = 0; i < contornos.length; i++) {
      var c = contornos[i];
      if (!c.fechado || c.pontos.length < 4) continue;
      var auto = 0;
      for (var x = 0; x < c.pontos.length; x++) {
        var x2 = (x + 1) % c.pontos.length;
        for (var y = x + 2; y < c.pontos.length; y++) {
          var y2 = (y + 1) % c.pontos.length;
          if (x === y || x2 === y || y2 === x) continue;
          if (x === 0 && y2 === c.pontos.length - 1) continue;
          var ri = U.intersecaoRetas(c.pontos[x], c.pontos[x2], c.pontos[y], c.pontos[y2], tol.intersecaoMm);
          if (ri) auto++;
        }
      }
      if (auto > 0) {
        c.autoInterseccoes = auto;
        invalidos.push({ tipo: "auto-interseccao", contorno: c.id, ocorrencias: auto });
      }
    }

    return {
      tempoMs: Date.now() - t0,
      caixa: caixa,
      celula: celula,
      tolerancias: tol,
      nos: nos,
      arestas: arestas,
      contornos: contornos,
      duplicados: duplicados,
      sobrepostos: sobrepostos,
      interseccoes: interseccoes,
      ambiguidades: ambiguidades,
      invalidos: invalidos,
      costuras: costuras
    };
  }

  G.contour = {
    construir: construir,
    achatarSegmento: achatarSegmento
  };
})();
