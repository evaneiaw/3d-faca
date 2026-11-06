/* FACA 3D — subdivisão estrutural de faces.
 *
 * Dois casos reais do desenho:
 *
 * 1. ABAS DE BORDA (V10/V11/V18/V20): já resolvidas no grafo com a correção
 *    da tolerância paramétrica em intersecaoRetas; o detector cria as faces.
 *
 * 2. ANEL EM "U" (V0/V2/V4): a face externa é um anel em volta da face 0 e o
 *    contorno externo encontra o U em dois BICOS. No polígono, cada bico
 *    aparece DUAS vezes (lado do U e lado externo). O anel pode ser dividido
 *    nesses bicos em três painéis reais (esquerda, topo, direita), sem criar
 *    corte: a separação é topológica no ponto de bico.
 *
 * A geometria original e o PDF não são alterados; só a cópia usada pela
 * análise 3D.
 *
 * API: Faca3D.geometry.subdivisao.subdividir(resultadoDoMotor)
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});

  function distancia(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  function chave(p) {
    return Math.round(p.x * 100) / 100 + ":" + Math.round(p.y * 100) / 100;
  }

  function centroide(pontos) {
    var x = 0, y = 0;
    for (var i = 0; i < pontos.length; i++) {
      x += pontos[i].x;
      y += pontos[i].y;
    }
    return pontos.length ? { x: x / pontos.length, y: y / pontos.length } : { x: 0, y: 0 };
  }

  function areaAbs(pontos) {
    return Math.abs(G.utils.areaPoligono(pontos));
  }

  function indicesPerto(poly, p, tol) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      if (distancia(poly[i], p) <= tol) out.push(i);
    }
    return out;
  }

  function arestasDaLinha(res, linha) {
    var out = [];
    for (var i = 0; i < res.topologia.arestas.length; i++) {
      var a = res.topologia.arestas[i];
      if (linha.segmentos.indexOf(a.segmento) >= 0 && linha.paths.indexOf(a.caminho) >= 0) {
        out.push(a.id);
      }
    }
    return out;
  }

  function novaFace(pontos, id, arestas, extra) {
    var limpos = [];
    for (var i = 0; i < pontos.length; i++) {
      if (!limpos.length || distancia(limpos[limpos.length - 1], pontos[i]) > 0.01) {
        limpos.push({ x: pontos[i].x, y: pontos[i].y });
      }
    }
    if (limpos.length > 2 && distancia(limpos[0], limpos[limpos.length - 1]) <= 0.01) limpos.pop();
    var face = {
      id: id,
      pontos: limpos,
      areaMm2: areaAbs(limpos),
      centro: centroide(limpos),
      arestas: arestas || [],
      classes: {},
      lados: limpos.length
    };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) face[k] = extra[k];
    return face;
  }

  function subdividirAnel(res, montagem, par) {
    var analise = montagem.estrutural;
    var linhas = [];
    for (var li = 0; li < par.linhasEstruturais.length; li++) {
      var l = null;
      for (var k = 0; k < analise.linhas.length; k++) {
        if (analise.linhas[k].id === par.linhasEstruturais[li]) {
          l = analise.linhas[k];
          break;
        }
      }
      if (l) linhas.push(l);
    }
    if (linhas.length !== 3) return null;

    var faces = res.faces.faces;
    var fA = null, fB = null;
    for (var i = 0; i < faces.length; i++) {
      if (faces[i].id === par.a) fA = faces[i];
      if (faces[i].id === par.b) fB = faces[i];
    }
    if (!fA || !fB) return null;
    var interna = fA.areaMm2 <= fB.areaMm2 ? fA : fB;
    var externa = interna === fA ? fB : fA;
    // A subdivisão recria a face externa em três painéis; se ela tem furos
    // (janelas/recortes), os furos se perderiam. Nesse caso não subdivide.
    if (externa.furos && externa.furos.length) return null;
    var poly = externa.pontos;
    if (poly.length < 8) return null;

    // Linha do meio: as duas pontas são compartilhadas com as outras duas.
    var cont = {};
    for (i = 0; i < linhas.length; i++) {
      cont[chave(linhas[i].p1)] = (cont[chave(linhas[i].p1)] || 0) + 1;
      cont[chave(linhas[i].p2)] = (cont[chave(linhas[i].p2)] || 0) + 1;
    }
    var meio = null;
    for (i = 0; i < linhas.length; i++) {
      if (cont[chave(linhas[i].p1)] >= 2 && cont[chave(linhas[i].p2)] >= 2) {
        meio = linhas[i];
        break;
      }
    }
    if (!meio) return null;

    var laterais = linhas.filter(function (x) { return x !== meio; });
    var centroInterno = centroide(interna.pontos);
    var esq = laterais.filter(function (x) {
      return (x.p1.x + x.p2.x) / 2 < centroInterno.x;
    })[0];
    var dir = laterais.filter(function (x) { return x !== esq; })[0];
    if (!esq || !dir) return null;

    // Cada bico aparece duas vezes no polígono do anel.
    var lp = indicesPerto(poly, meio.p1, 0.5);
    var rp = indicesPerto(poly, meio.p2, 0.5);
    if (lp.length < 2 || rp.length < 2) return null;

    function exato(lista, p) {
      for (var q = 0; q < lista.length; q++) {
        if (distancia(poly[lista[q]], p) < 0.02) return lista[q];
      }
      return null;
    }
    var lu = exato(lp, meio.p1);
    var ru = exato(rp, meio.p2);
    var lo = lp.filter(function (x) { return x !== lu; })[0];
    var ro = rp.filter(function (x) { return x !== ru; })[0];
    if (lu === null || ru === null || lo === undefined || ro === undefined) return null;

    var n = poly.length;
    function faixa(de, ate) {
      var out = [];
      var i = de;
      for (var guarda = 0; guarda <= n; guarda++) {
        out.push(poly[i]);
        if (i === ate) break;
        i = (i + 1) % n;
      }
      return out;
    }

    function ajustarLoop(loop) {
      var out = [];
      for (var q = 0; q < loop.length; q++) {
        var p = { x: loop[q].x, y: loop[q].y };
        // Bico: usa sempre o ponto exato do U (os dois lados distam ~0,09 mm).
        if (distancia(p, meio.p1) < 0.3) p = { x: meio.p1.x, y: meio.p1.y };
        else if (distancia(p, meio.p2) < 0.3) p = { x: meio.p2.x, y: meio.p2.y };
        if (!out.length || distancia(out[out.length - 1], p) > 0.01) out.push(p);
      }
      if (out.length > 2 && distancia(out[0], out[out.length - 1]) <= 0.01) out.pop();
      return out;
    }

    var loopEsq = ajustarLoop(faixa(lo, lu));
    var loopDir = ajustarLoop(faixa(ru, ro));
    var loopTopo = ajustarLoop(faixa(ro, lo).concat([poly[lu], poly[ru]]));

    var aEsq = arestasDaLinha(res, esq);
    var aMeio = arestasDaLinha(res, meio);
    var aDir = arestasDaLinha(res, dir);

    // As orelhas (2/3) ficavam na face externa; passam para o painel de topo.
    var aOrelhas = [];
    for (var chv in montagem.pares) {
      if (!montagem.pares.hasOwnProperty(chv)) continue;
      var p = montagem.pares[chv];
      var outro = p.a === externa.id ? p.b : p.b === externa.id ? p.a : null;
      if (outro !== null && outro !== interna.id) {
        for (var q2 = 0; q2 < p.arestas.length; q2++) {
          if (aOrelhas.indexOf(p.arestas[q2]) < 0) aOrelhas.push(p.arestas[q2]);
        }
      }
    }

    var maxId = 0;
    for (i = 0; i < faces.length; i++) if (faces[i].id >= maxId) maxId = faces[i].id + 1;
    var idEsq = maxId++;
    var idTopo = maxId++;
    var idDir = maxId++;

    var faceEsq = novaFace(loopEsq, idEsq, aEsq, { origem: externa.id, regiao: "saia-esquerda" });
    var faceTopo = novaFace(loopTopo, idTopo, aMeio.concat(aOrelhas), { origem: externa.id, regiao: "saia-topo" });
    var faceDir = novaFace(loopDir, idDir, aDir, { origem: externa.id, regiao: "saia-direita" });

    // Atualiza adjacências: remove 0:1 e 1:2/1:3; cria 0:esq/topo/dir e topo:2/3.
    var novasAdj = [];
    var adj = res.faces.adjacencias;
    for (i = 0; i < adj.length; i++) {
      var a = adj[i];
      if (a.a === externa.id || a.b === externa.id) {
        var outroFace = a.a === externa.id ? a.b : a.a;
        if (outroFace === interna.id) continue; // par do U
        if (outroFace === 2 || outroFace === 3) {
          novasAdj.push({
            a: idTopo,
            b: outroFace,
            arestas: a.arestas.slice(),
            classes: a.classes
          });
        }
        continue;
      }
      novasAdj.push(a);
    }
    novasAdj.push({ a: interna.id, b: idEsq, arestas: aEsq.slice(), classes: { crease: aEsq.length }, tipo: "saia" });
    novasAdj.push({ a: interna.id, b: idTopo, arestas: aMeio.slice(), classes: { crease: aMeio.length }, tipo: "saia" });
    novasAdj.push({ a: interna.id, b: idDir, arestas: aDir.slice(), classes: { crease: aDir.length }, tipo: "saia" });

    var novasFaces = [];
    for (i = 0; i < faces.length; i++) if (faces[i].id !== externa.id) novasFaces.push(faces[i]);
    novasFaces.push(faceEsq, faceTopo, faceDir);
    res.faces.faces = novasFaces;
    res.faces.adjacencias = novasAdj;
    if (res.topologia && res.topologia.resumo) res.topologia.resumo.faces = novasFaces.length;

    return {
      tipo: "anel-u",
      faceOriginal: externa.id,
      faceInterna: interna.id,
      novasFaces: [idEsq, idTopo, idDir],
      areas: [faceEsq.areaMm2, faceTopo.areaMm2, faceDir.areaMm2],
      motivo: "anel em U dividido nos dois bicos; três painéis reais (sem corte inventado)"
    };
  }

  function subdividir(res) {
    if (!res || !res.faces || !G.hinge) return res;
    var montagem = G.hinge.construir(res);
    var par = null;
    for (var k in montagem.pares) {
      if (!montagem.pares.hasOwnProperty(k)) continue;
      if (montagem.pares[k].linhasEstruturais && montagem.pares[k].linhasEstruturais.length === 3) {
        par = montagem.pares[k];
        break;
      }
    }
    if (!par) return res;
    var info = subdividirAnel(res, montagem, par);
    if (!info) return res;
    res.subdivisao = info;
    return res;
  }

  G.subdivisao = {
    subdividir: subdividir
  };
})();
