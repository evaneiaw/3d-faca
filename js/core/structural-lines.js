/* FACA 3D — Structural Line Resolver.
 *
 * Reconhece a INTENÇÃO estrutural de vincos interrompidos, desalinhados ou que
 * não alcançam o limite de um corte, sem alterar a geometria original.
 *
 * Três representações separadas:
 *   1. original  — segmentos extraídos do Illustrator (nunca alterados);
 *   2. estrutural — linhas contínuas virtuais (fusões + extensões);
 *   3. dobradiça — eixo efetivamente usado pelo motor 3D (montado em hinge-audit).
 *
 * Regras de segurança: só conecta com evidência de colinearidade, projeção,
 * lacuna limitada e, em lacunas grandes, mesmo par de faces. Conexões
 * ambíguas ou que cruzariam outra linha são rejeitadas e registradas.
 *
 * API:
 *   Faca3D.geometry.structural.tolerancias(escala, extra)
 *   Faca3D.geometry.structural.resolver(entrada)
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});

  function vec(p, q) {
    return { x: q.x - p.x, y: q.y - p.y };
  }

  function comprimento(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  function normalizar(v) {
    var L = comprimento(v);
    if (L < 1e-9) return { x: 0, y: 0, L: 0 };
    return { x: v.x / L, y: v.y / L, L: L };
  }

  function produtoEscalar(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function produtoVetorial(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  function distancia(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  /* Ângulo entre duas retas, 0..90 graus. */
  function anguloLinhas(a, b) {
    var da = normalizar(vec(a.p0, a.p1));
    var db = normalizar(vec(b.p0, b.p1));
    if (!da.L || !db.L) return 90;
    var c = Math.abs(produtoEscalar(da, db));
    if (c > 1) c = 1;
    return (Math.acos(c) * 180) / Math.PI;
  }

  function direcao(a) {
    return normalizar(vec(a.p0, a.p1));
  }

  /* Distância perpendicular de um ponto à reta infinita do segmento. */
  function distanciaReta(p, s) {
    var d = direcao(s);
    if (!d.L) return distancia(p, s.p0);
    var v = vec(s.p0, p);
    return Math.abs(produtoVetorial(d, v));
  }

  /* Interseção das retas infinitas; devolve parâmetros t (em a) e u (em b). */
  function interseccaoRetas(a, b) {
    var da = vec(a.p0, a.p1);
    var db = vec(b.p0, b.p1);
    var den = produtoVetorial(da, db);
    if (Math.abs(den) < 1e-9) return null;
    var v = vec(a.p0, b.p0);
    var t = produtoVetorial(v, db) / den;
    var u = produtoVetorial(v, da) / den;
    return {
      ponto: { x: a.p0.x + da.x * t, y: a.p0.y + da.y * t },
      t: t,
      u: u
    };
  }

  /* Cruzamento próprio entre dois segmentos (extremidades não contam). */
  function cruzaSegmentos(a, b, c, d) {
    var r = vec(a, b);
    var s = vec(c, d);
    var den = produtoVetorial(r, s);
    if (Math.abs(den) < 1e-9) return false;
    var t = produtoVetorial(vec(a, c), s) / den;
    var u = produtoVetorial(vec(a, c), r) / den;
    return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
  }

  function mesmoPonto(a, b, tol) {
    return distancia(a, b) <= tol;
  }

  function facesDoSegmento(s) {
    return (s.faces || []).slice().sort(function (a, b) { return a - b; });
  }

  function mesmoParDeFaces(a, b) {
    var fa = facesDoSegmento(a);
    var fb = facesDoSegmento(b);
    if (fa.length < 2 || fb.length < 2) return false;
    var comuns = 0;
    for (var i = 0; i < fa.length; i++) {
      if (fb.indexOf(fa[i]) >= 0) comuns++;
    }
    return comuns >= 2;
  }

  function tolerancias(escala, extra) {
    var e = Math.max(1, Number(escala) || 1);
    var t = {
      anguloGraus: 2.0,
      anguloExtensaoGraus: 6.0,
      gapMm: Math.max(1.5, e * 0.008),
      gapSlotMm: Math.max(8, e * 0.12),
      projecaoMm: Math.max(0.15, e * 0.0004),
      areaRecorteMaxMm2: Math.max(1000, e * e * 0.02),
      cruzamentoTolMm: Math.max(0.2, e * 0.002)
    };
    if (extra) {
      for (var k in extra) {
        if (extra.hasOwnProperty(k) && typeof extra[k] === "number" && isFinite(extra[k])) {
          t[k] = extra[k];
        }
      }
    }
    return t;
  }

  /* Pontos extremos mais próximos entre dois segmentos. */
  function extremosMaisProximos(a, b) {
    var mel = null;
    var pontosA = [a.p0, a.p1];
    var pontosB = [b.p0, b.p1];
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 2; j++) {
        var d = distancia(pontosA[i], pontosB[j]);
        if (!mel || d < mel.d) {
          mel = { d: d, ia: i, ib: j, pa: pontosA[i], pb: pontosB[j] };
        }
      }
    }
    return mel;
  }

  function resolver(entrada) {
    var opt = entrada || {};
    var todos = opt.segmentos || [];
    var cortes = opt.cortes || [];
    var faces = opt.faces || [];
    var escala = opt.escala || 1000;
    var tol = tolerancias(escala, opt.tolerancias);

    // 1) Segmentos de vinco retos (curvas não entram na continuidade).
    var segmentos = [];
    for (var i = 0; i < todos.length; i++) {
      var s = todos[i];
      if (s.classe !== "crease" || s.tipo !== "reta") continue;
      if (distancia(s.p0, s.p1) < 0.05) continue;
      segmentos.push(s);
    }

    var links = [];
    var rejeicoes = [];
    var n = segmentos.length;
    var i, j;

    function registrarRejeicao(a, b, motivo, extra) {
      var r = {
        segmentoA: a.id,
        segmentoB: b.id,
        caminhos: [a.caminho, b.caminho],
        motivo: motivo,
        ponto: extra && extra.ponto ? extra.ponto : null
      };
      if (extra) {
        for (var k in extra) {
          if (extra.hasOwnProperty(k) && k !== "ponto") r[k] = extra[k];
        }
      }
      rejeicoes.push(r);
    }

    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var a = segmentos[i];
        var b = segmentos[j];
        var ang = anguloLinhas(a, b);
        var perto = extremosMaisProximos(a, b);

        if (ang > tol.anguloGraus) {
          if (perto.d <= tol.gapMm) {
            registrarRejeicao(a, b, "angular", {
              anguloGraus: Math.round(ang * 100) / 100,
              gapMm: Math.round(perto.d * 100) / 100,
              ponto: { x: (perto.pa.x + perto.pb.x) / 2, y: (perto.pa.y + perto.pb.y) / 2 }
            });
          }
          continue;
        }

        var proj = Math.max(distanciaReta(perto.pa, b), distanciaReta(perto.pb, a));
        if (proj > tol.projecaoMm) {
          if (perto.d <= tol.gapMm) {
            registrarRejeicao(a, b, "desalinhado", {
              projecaoMm: Math.round(proj * 100) / 100,
              gapMm: Math.round(perto.d * 100) / 100,
              ponto: { x: (perto.pa.x + perto.pb.x) / 2, y: (perto.pa.y + perto.pb.y) / 2 }
            });
          }
          continue;
        }

        var mesmo = mesmoParDeFaces(a, b);
        var tipo = null;
        if (perto.d <= tol.gapMm) tipo = "lacuna";
        else if (perto.d <= tol.gapSlotMm && mesmo) tipo = "recorte";

        if (!tipo) {
          if (perto.d <= tol.gapSlotMm) {
            registrarRejeicao(a, b, "lacuna-grande", {
              gapMm: Math.round(perto.d * 100) / 100,
              ponto: { x: (perto.pa.x + perto.pb.x) / 2, y: (perto.pa.y + perto.pb.y) / 2 }
            });
          }
          continue;
        }

        // A ponte virtual não pode atravessar um corte (material separado)
        // nem outra linha de vinco.
        if (perto.d > 0.05) {
          var bloqueio = null;
          for (var c = 0; c < cortes.length; c++) {
            if (cruzaSegmentos(perto.pa, perto.pb, cortes[c].p0, cortes[c].p1)) {
              bloqueio = "corte";
              break;
            }
          }
          if (!bloqueio) {
            for (var o = 0; o < segmentos.length; o++) {
              if (o === i || o === j) continue;
              if (cruzaSegmentos(perto.pa, perto.pb, segmentos[o].p0, segmentos[o].p1)) {
                bloqueio = "vinco";
                break;
              }
            }
          }
          if (bloqueio) {
            registrarRejeicao(a, b, "cruzamento-" + bloqueio, {
              gapMm: Math.round(perto.d * 100) / 100,
              ponto: { x: (perto.pa.x + perto.pb.x) / 2, y: (perto.pa.y + perto.pb.y) / 2 }
            });
            continue;
          }
        }

        links.push({
          a: i,
          b: j,
          gapMm: Math.round(perto.d * 1000) / 1000,
          anguloGraus: Math.round(ang * 1000) / 1000,
          projecaoMm: Math.round(proj * 1000) / 1000,
          tipo: tipo,
          mesmoParDeFaces: mesmo,
          ponto: { x: (perto.pa.x + perto.pb.x) / 2, y: (perto.pa.y + perto.pb.y) / 2 },
          pA: perto.pa,
          pB: perto.pb
        });
      }
    }

    // 2) Ambiguidade: dois destinos plausíveis e equivalentes na mesma ponta.
    for (i = 0; i < segmentos.length; i++) {
      var ligados = [];
      for (j = 0; j < links.length; j++) {
        if (links[j].a === i || links[j].b === i) ligados.push(links[j]);
      }
      if (ligados.length < 2) continue;
      var ordenados = ligados.slice().sort(function (x, y) { return x.gapMm - y.gapMm; });
      if (Math.abs(ordenados[0].gapMm - ordenados[1].gapMm) <= Math.max(0.5, ordenados[0].gapMm * 0.1)) {
        var alvo0 = ordenados[0].a === i ? segmentos[ordenados[0].b] : segmentos[ordenados[0].a];
        var alvo1 = ordenados[1].a === i ? segmentos[ordenados[1].b] : segmentos[ordenados[1].a];
        if (anguloLinhas(alvo0, alvo1) > tol.anguloGraus) {
          for (var q = 0; q < ligados.length; q++) {
            if (ligados[q] === ordenados[0] || ligados[q] === ordenados[1]) {
              ligados[q].ambiguo = true;
              registrarRejeicao(
                segu(segmentos, ligados[q].a),
                segu(segmentos, ligados[q].b),
                "ambiguidade",
                { gapMm: ligados[q].gapMm, ponto: ligados[q].ponto }
              );
            }
          }
        }
      }
    }
    links = links.filter(function (l) {
      return !l.ambiguo;
    });

    // Liga apenas o necessário (evita pontes redundantes entre o mesmo par).
    links.sort(function (x, y) {
      return x.gapMm - y.gapMm;
    });
    var paiLink = {};
    function acharLink(x) {
      while (paiLink[x] !== x) {
        paiLink[x] = paiLink[paiLink[x]];
        x = paiLink[x];
      }
      return x;
    }
    for (i = 0; i < segmentos.length; i++) paiLink[i] = i;
    var linksValidos = [];
    for (i = 0; i < links.length; i++) {
      var la = acharLink(links[i].a);
      var lb = acharLink(links[i].b);
      if (la === lb) continue;
      paiLink[la] = lb;
      linksValidos.push(links[i]);
    }
    links = linksValidos;

    // 3) Componentes = linhas estruturais.
    var pai = {};
    function achar(x) {
      while (pai[x] !== x) {
        pai[x] = pai[pai[x]];
        x = pai[x];
      }
      return x;
    }
    for (i = 0; i < segmentos.length; i++) pai[i] = i;
    for (i = 0; i < links.length; i++) {
      var ra = achar(links[i].a);
      var rb = achar(links[i].b);
      if (ra !== rb) pai[ra] = rb;
    }
    var grupos = {};
    for (i = 0; i < segmentos.length; i++) {
      var r = achar(i);
      (grupos[r] = grupos[r] || []).push(i);
    }

    var linhas = [];
    var linhaPorSegmento = {};
    for (var chave in grupos) {
      if (!grupos.hasOwnProperty(chave)) continue;
      var indices = grupos[chave];
      var pontos = [];
      var paths = [];
      var faceSet = {};
      var compOriginal = 0;
      for (i = 0; i < indices.length; i++) {
        var sg = segmentos[indices[i]];
        pontos.push(sg.p0, sg.p1);
        if (paths.indexOf(sg.caminho) < 0) paths.push(sg.caminho);
        var fs = sg.faces || [];
        for (j = 0; j < fs.length; j++) faceSet[fs[j]] = true;
        compOriginal += sg.comprimentoMm || distancia(sg.p0, sg.p1);
      }
      // Extremos mais distantes = eixo da linha estrutural.
      var melhor = { d: -1, p1: pontos[0], p2: pontos[0] };
      for (i = 0; i < pontos.length; i++) {
        for (j = i + 1; j < pontos.length; j++) {
          var dd = distancia(pontos[i], pontos[j]);
          if (dd > melhor.d) melhor = { d: dd, p1: pontos[i], p2: pontos[j] };
        }
      }
      var conexoesLinha = [];
      for (i = 0; i < links.length; i++) {
        if (indices.indexOf(links[i].a) < 0 || indices.indexOf(links[i].b) < 0) continue;
        conexoesLinha.push({
          segmentoA: segmentos[links[i].a].id,
          segmentoB: segmentos[links[i].b].id,
          gapMm: links[i].gapMm,
          anguloGraus: links[i].anguloGraus,
          projecaoMm: links[i].projecaoMm,
          tipo: links[i].tipo,
          ponto: links[i].ponto,
          pA: links[i].pA,
          pB: links[i].pB
        });
      }
      var facesLinha = [];
      for (var fk in faceSet) {
        if (faceSet.hasOwnProperty(fk)) facesLinha.push(Number(fk));
      }
      var linha = {
        id: linhas.length,
        segmentos: indices.map(function (k) { return segmentos[k].id; }),
        paths: paths,
        faces: facesLinha,
        p1: melhor.p1,
        p2: melhor.p2,
        comprimentoMm: Math.round(melhor.d * 100) / 100,
        comprimentoOriginalMm: Math.round(compOriginal * 100) / 100,
        conexoes: conexoesLinha,
        extensoes: [],
        rejeicoes: []
      };
      for (i = 0; i < indices.length; i++) linhaPorSegmento[segmentos[indices[i]].id] = linha.id;
      linhas.push(linha);
    }

    // 4) Extensões virtuais até corte ou outro vinco próximo da ponta.
    var alvos = [];
    for (i = 0; i < cortes.length; i++) {
      if (cortes[i].tipo && cortes[i].tipo !== "reta") continue;
      alvos.push({ s: cortes[i], classe: "cut" });
    }
    for (i = 0; i < segmentos.length; i++) alvos.push({ s: segmentos[i], classe: "crease" });

    for (i = 0; i < linhas.length; i++) {
      var linha = linhas[i];
      var pontas = [linha.p1, linha.p2];
      for (var pe = 0; pe < 2; pe++) {
        var ponta = pontas[pe];
        var melhorExt = null;
        for (var al = 0; al < alvos.length; al++) {
          var alvo = alvos[al];
          if (linha.segmentos.indexOf(alvo.s.id) >= 0) continue;
          var inter = interseccaoRetas(
            { p0: linha.p1, p1: linha.p2 },
            { p0: alvo.s.p0, p1: alvo.s.p1 }
          );
          if (!inter) continue;
          if (inter.u < -0.001 || inter.u > 1.001) continue;
          var dist = distancia(ponta, inter.ponto);
          if (dist > tol.gapMm || dist < 0.05) continue;
          var angAlvo = anguloLinhas(
            { p0: linha.p1, p1: linha.p2 },
            { p0: alvo.s.p0, p1: alvo.s.p1 }
          );
          if (angAlvo < 10) continue; // alvo paralelo não fecha a ponta
          // A extensão não pode cruzar outra linha estrutural antes do alvo.
          var bloqueado = false;
          for (var ol = 0; ol < linhas.length; ol++) {
            if (ol === i) continue;
            var oi = interseccaoRetas(
              { p0: ponta, p1: inter.ponto },
              { p0: linhas[ol].p1, p1: linhas[ol].p2 }
            );
            if (oi && oi.t > 0.01 && oi.t < 0.99 && oi.u > 0 && oi.u < 1) {
              bloqueado = true;
              break;
            }
          }
          if (bloqueado) continue;
          for (var c2 = 0; c2 < cortes.length; c2++) {
            if (alvo.classe === "cut" && cortes[c2].id === alvo.s.id) continue;
            if (cruzaSegmentos(ponta, inter.ponto, cortes[c2].p0, cortes[c2].p1)) {
              bloqueado = true;
              break;
            }
          }
          if (bloqueado) continue;
          if (!melhorExt || dist < melhorExt.gapMm) {
            melhorExt = {
              de: { x: ponta.x, y: ponta.y },
              ponto: inter.ponto,
              alvoClasse: alvo.classe,
              alvoId: alvo.s.id,
              alvoCaminho: alvo.s.caminho,
              gapMm: Math.round(dist * 1000) / 1000,
              anguloGraus: Math.round(angAlvo * 100) / 100,
              motivo: "ponta a " + (Math.round(dist * 100) / 100) + " mm de " +
                (alvo.classe === "cut" ? "corte" : "outro vinco") + "; extensão virtual"
            };
          }
        }
        if (melhorExt) linha.extensoes.push(melhorExt);
      }
    }

    // Guarda as rejeições relacionadas a cada linha.
    for (i = 0; i < rejeicoes.length; i++) {
      var rj = rejeicoes[i];
      var linhaA = linhaPorSegmento[rj.segmentoA];
      if (linhaA !== undefined && linhas[linhaA]) linhas[linhaA].rejeicoes.push(rj);
    }

    var totalConexoes = 0;
    var totalExtensoes = 0;
    for (i = 0; i < linhas.length; i++) {
      totalConexoes += linhas[i].conexoes.length;
      totalExtensoes += linhas[i].extensoes.length;
    }

    return {
      tolerancias: tol,
      linhas: linhas,
      rejeicoes: rejeicoes,
      linhaPorSegmento: linhaPorSegmento,
      resumo: {
        segmentosVinco: segmentos.length,
        linhas: linhas.length,
        conexoes: totalConexoes,
        extensoes: totalExtensoes,
        rejeitadas: rejeicoes.length
      }
    };
  }

  // pequeno auxiliar para o relatório de ambiguidade
  function segu(lista, k) {
    return lista[k];
  }

  G.structural = {
    resolver: resolver,
    tolerancias: tolerancias,
    // expostos para testes
    anguloLinhas: anguloLinhas,
    interseccaoRetas: interseccaoRetas,
    distanciaReta: distanciaReta,
    cruzaSegmentos: cruzaSegmentos
  };
})();
