/* FACA 3D — auditoria de vincos e construção da árvore de dobra.
 *
 * Fonte única para o 3D e para o modo de diagnóstico: classifica CADA path
 * de vinco e monta a árvore de dobradiças a partir das faces reais.
 *
 * Não decide sozinho que todo vinco dobra: um vinco com uma só face adjacente
 * (borda livre) ou um contorno não reto (ex.: "U") não vira eixo de rotação.
 *
 * API:
 *   Faca3D.geometry.hinge.construir(resultadoDoMotor)
 *   Faca3D.geometry.hinge.anotarSinais(montagem, sinais)
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});

  var TOL_RETA_MM = 0.05;
  var TOL_PONTO_MM = 0.001;

  var MOTIVO = {
    dobra: "dobradiça reta; dois painéis giram em torno de um eixo único",
    rigida: "contorno não reto entre as faces; um painel rígido não gira em eixo único",
    "sem-par": "o vinco toca só uma face (borda livre do material); não há segunda face para dobrar",
    "sem-face": "nenhuma face usa este vinco como limite",
    "sem-aresta": "o vinco não gerou aresta na topologia (comprimento zero ou fora do grafo)",
    multipla: "o vinco separa mais de duas faces (junção); exige decisão manual",
    fora: "a dupla de faces não pertence ao componente principal montado"
  };

  function distancia(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  function desvioMax(pontos) {
    if (pontos.length < 3) return 0;
    var pior = 0;
    for (var i = 0; i < pontos.length; i++) {
      for (var j = i + 2; j < pontos.length; j++) {
        var ax = pontos[j].x - pontos[i].x;
        var ay = pontos[j].y - pontos[i].y;
        var L = Math.sqrt(ax * ax + ay * ay);
        if (L < TOL_PONTO_MM) continue;
        for (var k = i + 1; k < j; k++) {
          var d = Math.abs((pontos[k].x - pontos[i].x) * ay - (pontos[k].y - pontos[i].y) * ax) / L;
          if (d > pior) pior = d;
        }
      }
    }
    return pior;
  }

  function chavePar(a, b) {
    return Math.min(a, b) + ":" + Math.max(a, b);
  }

  function construir(res) {
    var faces = (res.faces && res.faces.faces) || [];
    var adj = (res.faces && res.faces.adjacencias) || [];
    var topo = res.topologia;
    var geo = res.geometria;

    var mapaFaces = {};
    var i, j;
    for (i = 0; i < faces.length; i++) mapaFaces[faces[i].id] = faces[i];

    function pontosAresta(id) {
      var a = topo.arestas[id];
      if (!a) return null;
      var va = topo.vertices[a.a];
      var vb = topo.vertices[a.b];
      if (!va || !vb) return null;
      return [{ x: va.x, y: va.y }, { x: vb.x, y: vb.y }];
    }

    // Faces que usam cada aresta.
    var arestaFaces = {};
    for (i = 0; i < faces.length; i++) {
      for (j = 0; j < faces[i].arestas.length; j++) {
        var aid = faces[i].arestas[j];
        (arestaFaces[aid] = arestaFaces[aid] || []).push(faces[i].id);
      }
    }

    // Arestas de cada path.
    var pathArestas = {};
    for (i = 0; i < topo.arestas.length; i++) {
      var ar = topo.arestas[i];
      (pathArestas[ar.caminho] = pathArestas[ar.caminho] || []).push(ar.id);
    }

    // --- Structural Line Resolver -------------------------------------
    // Faces de cada segmento (para saber se dois vincos compartilham o par).
    var segFaces = {};
    for (i = 0; i < topo.arestas.length; i++) {
      var arS = topo.arestas[i];
      var fsS = arestaFaces[arS.id] || [];
      var alvoS = (segFaces[arS.segmento] = segFaces[arS.segmento] || []);
      for (j = 0; j < fsS.length; j++) {
        if (alvoS.indexOf(fsS[j]) < 0) alvoS.push(fsS[j]);
      }
    }
    var pathCurvo = {};
    for (i = 0; i < geo.caminhos.length; i++) {
      var cc = geo.caminhos[i];
      for (j = 0; j < cc.segmentos.length; j++) {
        if (cc.segmentos[j].tipo === "curva") {
          pathCurvo[cc.indice] = true;
          break;
        }
      }
    }
    var segmentosEst = [];
    var cortesEst = [];
    for (i = 0; i < geo.segmentos.length; i++) {
      var sg = geo.segmentos[i];
      if (sg.tipo !== "reta") continue;
      var base = {
        id: sg.id,
        caminho: sg.caminho,
        classe: sg.classe,
        tipo: sg.tipo,
        p0: sg.p0,
        p1: sg.p3,
        comprimentoMm: sg.comprimentoMm,
        faces: (segFaces[sg.id] || []).slice()
      };
      if (sg.classe === "crease" && !pathCurvo[sg.caminho]) segmentosEst.push(base);
      else if (sg.classe === "cut") cortesEst.push(base);
    }
    var analise = G.structural
      ? G.structural.resolver({
          segmentos: segmentosEst,
          cortes: cortesEst,
          faces: faces.map(function (f) {
            return { id: f.id, areaMm2: f.areaMm2, pontos: f.pontos };
          }),
          escala: Math.max(geo.caixa.largura, geo.caixa.altura)
        })
      : { linhas: [], rejeicoes: [], resumo: {}, tolerancias: {} };

    // Ligações por vinco (pares de faces).
    var pares = {};
    for (i = 0; i < adj.length; i++) {
      var a = adj[i];
      if (!(a.classes && a.classes.crease)) continue;
      var unicos = [];
      for (j = 0; j < a.arestas.length; j++) {
        var par = pontosAresta(a.arestas[j]);
        if (!par) continue;
        for (var p = 0; p < 2; p++) {
          var achou = false;
          for (var u = 0; u < unicos.length; u++) {
            if (distancia(unicos[u], par[p]) <= TOL_PONTO_MM) {
              achou = true;
              break;
            }
          }
          if (!achou) unicos.push(par[p]);
        }
      }
      if (unicos.length < 2) continue;

      var desvio = desvioMax(unicos);
      var reta = desvio <= TOL_RETA_MM;
      var melhor = { d: -1, p1: unicos[0], p2: unicos[1] };
      if (reta) {
        for (j = 0; j < unicos.length; j++) {
          for (var k = j + 1; k < unicos.length; k++) {
            var d = distancia(unicos[j], unicos[k]);
            if (d > melhor.d) melhor = { d: d, p1: unicos[j], p2: unicos[k] };
          }
        }
        if (melhor.d < 1) reta = false;
      }

      var chave = chavePar(a.a, a.b);
      pares[chave] = {
        a: Math.min(a.a, a.b),
        b: Math.max(a.a, a.b),
        arestas: a.arestas.slice(),
        classes: a.classes,
        desvioMm: Math.round(desvio * 1000) / 1000,
        reta: reta,
        p1: reta ? melhor.p1 : null,
        p2: reta ? melhor.p2 : null,
        comprimentoMm: reta ? Math.round(melhor.d * 100) / 100 : 0,
        paths: [],
        facePai: null,
        faceFilho: null,
        sinal: 0,
        tipo: a.tipo || null
      };
    }

    // Vincula cada path aos pares que ele ajuda a formar.
    for (i = 0; i < topo.arestas.length; i++) {
      var ar2 = topo.arestas[i];
      var fs = arestaFaces[ar2.id] || [];
      for (j = 0; j < fs.length; j++) {
        for (var l = j + 1; l < fs.length; l++) {
          var pr = pares[chavePar(fs[j], fs[l])];
          if (!pr) continue;
          if (pr.paths.indexOf(ar2.caminho) < 0) pr.paths.push(ar2.caminho);
        }
      }
    }

    // A linha estrutural manda no eixo: 1 linha = dobradiça; >1 = rígida.
    for (var chv in pares) {
      if (!pares.hasOwnProperty(chv)) continue;
      var pp = pares[chv];
      var linhasPar = [];
      for (i = 0; i < analise.linhas.length; i++) {
        var ln = analise.linhas[i];
        if (ln.faces.length === 2 && ln.faces.indexOf(pp.a) >= 0 && ln.faces.indexOf(pp.b) >= 0) {
          linhasPar.push(ln);
        }
      }
      if (linhasPar.length === 1) {
        var l1 = linhasPar[0];
        pp.reta = true;
        pp.p1 = l1.p1;
        pp.p2 = l1.p2;
        pp.desvioMm = 0;
        pp.comprimentoMm = l1.comprimentoMm;
        pp.paths = l1.paths.slice();
        pp.linhaEstrutural = l1.id;
        pp.conexoes = l1.conexoes.slice();
        pp.extensoes = l1.extensoes.slice();
        pp.motivoRigidez = null;
      } else if (linhasPar.length > 1) {
        pp.reta = false;
        pp.p1 = null;
        pp.p2 = null;
        pp.comprimentoMm = 0;
        pp.paths = [];
        pp.linhasEstruturais = [];
        for (i = 0; i < linhasPar.length; i++) {
          pp.linhasEstruturais.push(linhasPar[i].id);
          for (j = 0; j < linhasPar[i].paths.length; j++) {
            if (pp.paths.indexOf(linhasPar[i].paths[j]) < 0) pp.paths.push(linhasPar[i].paths[j]);
          }
        }
        pp.linhaEstrutural = null;
        pp.conexoes = [];
        pp.extensoes = [];
        pp.motivoRigidez = "multiplos-eixos";
      } else {
        pp.linhaEstrutural = null;
        pp.conexoes = [];
        pp.extensoes = [];
        pp.motivoRigidez = pp.reta ? null : "sem-linha-estrutural";
      }
    }

    // Componente conexo por qualquer ligação de vinco.
    var pai = {};
    function achar(x) {
      while (pai[x] !== x) {
        pai[x] = pai[pai[x]];
        x = pai[x];
      }
      return x;
    }
    for (i = 0; i < faces.length; i++) pai[faces[i].id] = faces[i].id;
    var listaPares = [];
    for (var chaveParAtual in pares) {
      if (pares.hasOwnProperty(chaveParAtual)) listaPares.push(pares[chaveParAtual]);
    }
    for (i = 0; i < listaPares.length; i++) {
      var ra = achar(listaPares[i].a);
      var rb = achar(listaPares[i].b);
      if (ra !== rb) pai[ra] = rb;
    }
    var grupos = {};
    for (i = 0; i < faces.length; i++) {
      var r = achar(faces[i].id);
      (grupos[r] = grupos[r] || []).push(faces[i].id);
    }
    var melhorGrupo = null;
    for (var chaveGrupo in grupos) {
      if (!grupos.hasOwnProperty(chaveGrupo)) continue;
      if (!melhorGrupo || grupos[chaveGrupo].length > melhorGrupo.length) {
        melhorGrupo = grupos[chaveGrupo];
      }
    }
    melhorGrupo = melhorGrupo || [];

    // Raiz = face com mais dobradiças; empate pela área.
    var grau = {};
    for (i = 0; i < listaPares.length; i++) {
      grau[listaPares[i].a] = (grau[listaPares[i].a] || 0) + 1;
      grau[listaPares[i].b] = (grau[listaPares[i].b] || 0) + 1;
    }
    var raiz = null;
    for (i = 0; i < melhorGrupo.length; i++) {
      var f = mapaFaces[melhorGrupo[i]];
      if (!f) continue;
      if (!raiz) {
        raiz = f;
        continue;
      }
      var grauF = grau[f.id] || 0;
      var grauR = grau[raiz.id] || 0;
      if (grauF > grauR || (grauF === grauR && f.areaMm2 > raiz.areaMm2)) raiz = f;
    }

    var ordem = [];
    var visitados = {};
    var fora = [];
    if (raiz) {
      visitados[raiz.id] = true;
      ordem.push({ face: raiz.id, pai: null, p1: null, p2: null, rigida: false, par: null });
      var porFace = {};
      for (i = 0; i < listaPares.length; i++) {
        (porFace[listaPares[i].a] = porFace[listaPares[i].a] || []).push(listaPares[i]);
        (porFace[listaPares[i].b] = porFace[listaPares[i].b] || []).push(listaPares[i]);
      }
      var fila = 0;
      while (fila < ordem.length) {
        var atual = ordem[fila++];
        var ligacoes = porFace[atual.face] || [];
        for (i = 0; i < ligacoes.length; i++) {
          var lig = ligacoes[i];
          var outro = lig.a === atual.face ? lig.b : lig.a;
          if (visitados[outro]) continue;
          visitados[outro] = true;
          lig.facePai = atual.face;
          lig.faceFilho = outro;
          ordem.push({
            face: outro,
            pai: atual.face,
            p1: lig.p1,
            p2: lig.p2,
            rigida: !lig.reta,
            par: chavePar(lig.a, lig.b),
            tipo: lig.tipo || null
          });
        }
      }
      for (i = 0; i < faces.length; i++) {
        if (!visitados[faces[i].id]) fora.push(faces[i].id);
      }
    }

    var montadas = [];
    for (i = 0; i < ordem.length; i++) montadas.push(ordem[i].face);

    // Auditoria de cada vinco (path), com o motivo real.
    var vincos = [];
    var caminhos = geo.caminhos || [];
    for (i = 0; i < caminhos.length; i++) {
      var c = caminhos[i];
      if (c.classe !== "crease") continue;
      var segs = c.segmentos || [];
      var curvo = false;
      var comprimento = 0;
      for (j = 0; j < segs.length; j++) {
        if (segs[j].tipo === "curva") curvo = true;
        comprimento += segs[j].comprimentoMm;
      }
      var ids = pathArestas[c.indice] || [];
      var faceSet = {};
      var parKeys = {};
      for (j = 0; j < ids.length; j++) {
        var fs2 = arestaFaces[ids[j]] || [];
        for (var m = 0; m < fs2.length; m++) faceSet[fs2[m]] = true;
        for (var n = 0; n < fs2.length; n++) {
          for (var o = n + 1; o < fs2.length; o++) {
            var kk = chavePar(fs2[n], fs2[o]);
            if (pares[kk]) parKeys[kk] = true;
          }
        }
      }
      var listaParesPath = [];
      for (var pk in parKeys) {
        if (parKeys.hasOwnProperty(pk)) listaParesPath.push(pares[pk]);
      }

      var linhaEstrutural = null;
      for (j = 0; j < analise.linhas.length; j++) {
        if (analise.linhas[j].paths.indexOf(c.indice) >= 0) {
          linhaEstrutural = analise.linhas[j];
          break;
        }
      }

      var status;
      var motivo;
      var parPrincipal = null;
      var montada = false;

      if (!ids.length) {
        status = "sem-aresta";
        motivo = MOTIVO["sem-aresta"];
      } else if (!listaParesPath.length) {
        var facesPath = [];
        for (var fp in faceSet) {
          if (faceSet.hasOwnProperty(fp)) facesPath.push(Number(fp));
        }
        if (!facesPath.length) {
          status = "sem-face";
          motivo = MOTIVO["sem-face"];
        } else {
          status = "sem-par";
          motivo = MOTIVO["sem-par"];
        }
      } else if (listaParesPath.length > 1) {
        status = "multipla";
        motivo = MOTIVO.multipla;
      } else {
        parPrincipal = listaParesPath[0];
        montada = visitados[parPrincipal.a] === true && visitados[parPrincipal.b] === true;
        if (!montada) {
          status = "fora";
          motivo = MOTIVO.fora;
        } else if (curvo) {
          status = "rigida";
          motivo = "vinco curvo; não existe eixo reto único";
        } else if (!parPrincipal.reta) {
          status = "rigida";
          motivo = MOTIVO.rigida;
        } else {
          status = "dobra";
          motivo = MOTIVO.dobra;
        }
      }

      if (status === "dobra" && linhaEstrutural) {
        motivo =
          "linha estrutural L" + linhaEstrutural.id + " contínua; eixo único" +
          (linhaEstrutural.conexoes.length
            ? " · " + linhaEstrutural.conexoes.length + " conexão(ões) virtual(is)"
            : "");
      } else if (status === "rigida") {
        if (parPrincipal && parPrincipal.motivoRigidez === "multiplos-eixos") {
          motivo =
            (parPrincipal.linhasEstruturais ? parPrincipal.linhasEstruturais.length : 0) +
            " linhas estruturais entre as faces " + parPrincipal.a + "–" + parPrincipal.b +
            " (contorno não reto); sem eixo único";
        } else if (linhaEstrutural && linhaEstrutural.conexoes.length) {
          motivo =
            "vinco composto (L" + linhaEstrutural.id + "), mas sem eixo reto único";
        }
      } else if (status === "sem-par" && linhaEstrutural) {
        if (linhaEstrutural.extensoes.length) {
          var ex0 = linhaEstrutural.extensoes[0];
          motivo +=
            " · ponta estendida " + ex0.gapMm + " mm até " +
            (ex0.alvoClasse === "cut" ? "corte" : "outro vinco");
        } else {
          motivo += " · sem extensão válida";
        }
      }

      var ini = c.pontos.length ? c.pontos[0].mm : { x: 0, y: 0 };
      var fim = c.pontos.length ? c.pontos[c.pontos.length - 1].mm : { x: 0, y: 0 };

      var registro = {
        indice: c.indice,
        spot: c.spot,
        camada: c.camada,
        pai: c.pai,
        fechado: !!c.fechado,
        nPontos: c.pontos.length,
        segmentos: segs.length,
        curvo: curvo,
        comprimentoMm: Math.round(comprimento * 100) / 100,
        inicio: { x: Math.round(ini.x * 100) / 100, y: Math.round(ini.y * 100) / 100 },
        fim: { x: Math.round(fim.x * 100) / 100, y: Math.round(fim.y * 100) / 100 },
        arestas: ids,
        faces: (function () {
          var arr = [];
          for (var q in faceSet) {
            if (faceSet.hasOwnProperty(q)) arr.push(Number(q));
          }
          arr.sort(function (x, y) { return x - y; });
          return arr;
        })(),
        pares: listaParesPath.map(function (pp) {
          return {
            a: pp.a,
            b: pp.b,
            reta: pp.reta,
            desvioMm: pp.desvioMm,
            arestas: pp.arestas.length,
            paths: pp.paths.slice()
          };
        }),
        status: status,
        motivo: motivo,
        parPrincipal: parPrincipal ? chavePar(parPrincipal.a, parPrincipal.b) : null,
        linhaEstrutural: linhaEstrutural ? linhaEstrutural.id : null,
        estrutural: linhaEstrutural
          ? {
              id: linhaEstrutural.id,
              comprimentoMm: linhaEstrutural.comprimentoMm,
              comprimentoOriginalMm: linhaEstrutural.comprimentoOriginalMm,
              faces: linhaEstrutural.faces.slice(),
              paths: linhaEstrutural.paths.slice(),
              conexoes: linhaEstrutural.conexoes.slice(),
              extensoes: linhaEstrutural.extensoes.slice(),
              rejeicoes: linhaEstrutural.rejeicoes.slice()
            }
          : null,
        eixo: parPrincipal && parPrincipal.p1 && parPrincipal.reta
          ? {
              p1: { x: parPrincipal.p1.x, y: parPrincipal.p1.y },
              p2: { x: parPrincipal.p2.x, y: parPrincipal.p2.y },
              comprimentoMm: parPrincipal.comprimentoMm
            }
          : null,
        montada: montada,
        sinal: 0,
        pontos: c.pontos.map(function (p) {
          return {
            pt: p.pt,
            esqPt: p.esqPt,
            dirPt: p.dirPt,
            mm: p.mm,
            esqMm: p.esqMm,
            dirMm: p.dirMm
          };
        })
      };
      vincos.push(registro);
    }

    var retas = 0;
    var rigidas = 0;
    for (i = 0; i < listaPares.length; i++) {
      if (listaPares[i].reta) retas++;
      else rigidas++;
    }

    return {
      raiz: raiz ? raiz.id : null,
      ordem: ordem,
      facesMontadas: montadas,
      fora: fora,
      retas: retas,
      rigidas: rigidas,
      grupoTamanho: melhorGrupo.length,
      semConexaoVinco: fora.length,
      pares: pares,
      vincos: vincos,
      estrutural: analise,
      resumoEstrutural: analise.resumo,
      toleranciasEstruturais: analise.tolerancias
    };
  }

  /* Propaganda o sinal escolhido para cada vinco (para o diagnóstico). */
  function anotarSinais(montagem, sinais) {
    if (!montagem) return;
    var i;
    for (var chave in montagem.pares) {
      if (!montagem.pares.hasOwnProperty(chave)) continue;
      var p = montagem.pares[chave];
      p.sinal = p.faceFilho !== null && sinais ? (sinais[p.faceFilho] || 1) : 0;
      if (!p.reta) p.sinal = 0;
    }
    for (i = 0; i < montagem.vincos.length; i++) {
      var v = montagem.vincos[i];
      if (!v.parPrincipal) continue;
      var par = montagem.pares[v.parPrincipal];
      if (par) {
        v.sinal = par.sinal;
        v.facePai = par.facePai;
        v.faceFilho = par.faceFilho;
      }
    }
  }

  G.hinge = {
    construir: construir,
    anotarSinais: anotarSinais,
    TOL_RETA_MM: TOL_RETA_MM,
    MOTIVO: MOTIVO
  };
})();
