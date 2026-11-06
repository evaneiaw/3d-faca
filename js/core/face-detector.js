/* FACA 3D — detecção de faces (Fase 2).
 *
 * Constrói meias-arestas sobre o grafo planar e percorre faces pelo método
 * angular clássico: em cada vértice, a próxima meia-aresta é a imediatamente
 * horária em relação à meia-aresta de retorno. Faces fechadas têm área
 * positiva (sentido anti-horário); a face externa tem área negativa.
 *
 * O resultado é independente de renderer e não pressupõe caixas retangulares.
 * Arestas soltas ("penduradas") produzem face degenerada e vão para
 * `regioesAbertas` em vez de virarem face.
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});
  var U = G.utils;

  function detectar(grafo, opcoes) {
    var opt = opcoes || {};
    var tol = U.tolerancias(opt.tolerancias || (grafo && grafo.tolerancias));
    var t0 = Date.now();
    var nos = grafo.nos;
    var arestas = grafo.arestas;

    if (!nos.length || !arestas.length) {
      return {
        tempoMs: 0,
        faces: [],
        faceExterna: null,
        adjacencias: [],
        regioesAbertas: [],
        meiasArestas: 0
      };
    }

    // Meias-arestas: id = aresta*2 (a->b) ou aresta*2+1 (b->a).
    var meias = [];
    var saidaPorNo = {};
    var i;

    function criarMeia(id, aresta, de, para) {
      var p = { x: nos[de].x, y: nos[de].y };
      var q = { x: nos[para].x, y: nos[para].y };
      var m = {
        id: id,
        aresta: aresta.id,
        de: de,
        para: para,
        angulo: U.angulo({ x: q.x - p.x, y: q.y - p.y }),
        face: -1,
        oposta: -1
      };
      meias[id] = m;
      if (!saidaPorNo[de]) saidaPorNo[de] = [];
      saidaPorNo[de].push(id);
      return m;
    }

    for (i = 0; i < arestas.length; i++) {
      var ar = arestas[i];
      if (ar.a === ar.b) continue;
      criarMeia(ar.id * 2, ar, ar.a, ar.b);
      criarMeia(ar.id * 2 + 1, ar, ar.b, ar.a);
    }
    for (i = 0; i < meias.length; i++) {
      if (!meias[i]) continue;
      meias[i].oposta = meias[i].id % 2 === 0 ? meias[i].id + 1 : meias[i].id - 1;
    }

    // Ordena as saídas de cada vértice por ângulo (anti-horário).
    var posicao = {};
    for (var no in saidaPorNo) {
      if (!saidaPorNo.hasOwnProperty(no)) continue;
      var lista = saidaPorNo[no];
      lista.sort(function (a, b) {
        return meias[a].angulo - meias[b].angulo;
      });
      for (var k = 0; k < lista.length; k++) posicao[lista[k]] = k;
    }

    function proximaMeia(h) {
      var m = meias[h];
      var lista = saidaPorNo[m.para];
      if (!lista || !lista.length) return null;
      var op = meias[m.oposta];
      var pos = posicao[op.id];
      var ant = (pos - 1 + lista.length) % lista.length;
      return lista[ant];
    }

    // Percorre as faces.
    var faces = [];
    var regioesAbertas = [];
    var visitadas = {};

    for (i = 0; i < meias.length; i++) {
      if (!meias[i] || visitadas[i]) continue;
      var cadeia = [];
      var atual = i;
      var guarda = 0;
      var fechou = false;

      while (atual !== null && guarda++ < 200000) {
        if (visitadas[atual]) {
          fechou = atual === i;
          break;
        }
        visitadas[atual] = true;
        cadeia.push(atual);
        atual = proximaMeia(atual);
        if (atual === i) {
          fechou = true;
          break;
        }
      }

      if (!cadeia.length) continue;

      // Pontos do polígono: percorre a polilinha REAL de cada aresta
      // (inclui os pontos do achatamento das curvas Bézier).
      var pontos = [];
      var arestasFace = [];
      var classes = {};
      for (var c = 0; c < cadeia.length; c++) {
        var mm = meias[cadeia[c]];
        var arFace = arestas[mm.aresta];
        var ptsFace = arFace && arFace.pontos
          ? arFace.pontos
          : [{ x: nos[mm.de].x, y: nos[mm.de].y }, { x: nos[mm.para].x, y: nos[mm.para].y }];
        if (arFace && arFace.a !== mm.de) ptsFace = ptsFace.slice().reverse();
        for (var pf = 0; pf < ptsFace.length; pf++) {
          if (pontos.length && U.distancia(pontos[pontos.length - 1], ptsFace[pf]) < 1e-6) continue;
          pontos.push({ x: ptsFace[pf].x, y: ptsFace[pf].y });
        }
        arestasFace.push(mm.aresta);
        var cls = arestas[mm.aresta].classe;
        classes[cls] = (classes[cls] || 0) + 1;
        mm.face = faces.length;
      }
      if (pontos.length > 1 && U.distancia(pontos[0], pontos[pontos.length - 1]) < 1e-6) {
        pontos.pop();
      }

      var area = U.areaPoligono(pontos);
      var perimetro = U.comprimentoPolilinha(pontos);

      if (!fechou || pontos.length < 3 || Math.abs(area) < tol.areaMinMm2) {
        regioesAbertas.push({
          meiasArestas: cadeia.length,
          arestas: arestasFace,
          areaMm2: area,
          perimetroMm: perimetro,
          motivo: !fechou ? "nao-fechou" : "area-degenerada"
        });
        continue;
      }

      var face = {
        id: faces.length,
        pontos: pontos,
        areaMm2: Math.abs(area),
        areaAssinada: area,
        perimetroMm: perimetro,
        arestas: arestasFace,
        classes: classes,
        centro: centroide(pontos),
        externa: area < 0
      };
      faces.push(face);
    }

    // Separa face externa (a de maior área negativa) das internas.
    var externa = null;
    var internas = [];
    for (i = 0; i < faces.length; i++) {
      if (faces[i].externa) {
        if (!externa || faces[i].areaMm2 > externa.areaMm2) externa = faces[i];
        else internas.push(faces[i]);
      } else {
        internas.push(faces[i]);
      }
    }
    // Reindexa as faces internas.
    for (i = 0; i < internas.length; i++) internas[i].id = i;

    // Adjacência: aresta compartilhada por duas faces internas.
    var dono = {};
    for (i = 0; i < internas.length; i++) {
      for (var a = 0; a < internas[i].arestas.length; a++) {
        var idA = internas[i].arestas[a];
        if (dono[idA] === undefined) dono[idA] = i;
        else if (dono[idA] !== i) {
          var par = dono[idA] < i ? dono[idA] + "|" + i : i + "|" + dono[idA];
          if (!dono["adj:" + par]) {
            dono["adj:" + par] = {
              a: Math.min(dono[idA], i),
              b: Math.max(dono[idA], i),
              arestas: [],
              classes: {}
            };
          }
          var adj = dono["adj:" + par];
          adj.arestas.push(idA);
          var clsA = arestas[idA].classe;
          adj.classes[clsA] = (adj.classes[clsA] || 0) + 1;
        }
      }
    }
    var adjacencias = [];
    for (var chave in dono) {
      if (chave.indexOf("adj:") === 0) adjacencias.push(dono[chave]);
    }

    return {
      tempoMs: Date.now() - t0,
      faces: internas,
      faceExterna: externa,
      adjacencias: adjacencias,
      regioesAbertas: regioesAbertas,
      meiasArestas: meias.length
    };
  }

  function centroide(pontos) {
    var x = 0, y = 0;
    for (var i = 0; i < pontos.length; i++) {
      x += pontos[i].x;
      y += pontos[i].y;
    }
    return { x: x / pontos.length, y: y / pontos.length };
  }

  G.faces = {
    detectar: detectar
  };
})();
