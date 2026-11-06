/* FACA 3D — representação topológica (Fase 2).
 *
 * Consolida vértices, arestas, contornos e faces em uma estrutura única,
 * independente do renderer. Guarda também erros, ambiguidades e regiões
 * abertas/fechadas. Nenhuma geometria é recalculada aqui: apenas agregada.
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});
  var U = G.utils;

  function contarClasses(arestas) {
    var linhas = {
      cut: { arestas: 0, comprimentoMm: 0 },
      crease: { arestas: 0, comprimentoMm: 0 },
      other: { arestas: 0, comprimentoMm: 0 },
      unknown: { arestas: 0, comprimentoMm: 0 }
    };
    for (var i = 0; i < arestas.length; i++) {
      var a = arestas[i];
      var alvo = linhas[a.classe] || linhas.unknown;
      alvo.arestas++;
      alvo.comprimentoMm += a.comprimentoMm;
    }
    for (var k in linhas) {
      if (linhas.hasOwnProperty(k)) linhas[k].comprimentoMm = U.arredondar(linhas[k].comprimentoMm, 3);
    }
    return linhas;
  }

  function montar(entrada, opcoes) {
    var opt = opcoes || {};
    var geometria = entrada.geometria;
    var grafo = entrada.grafo;
    var faces = entrada.faces;

    var vertices = [];
    for (var i = 0; i < grafo.nos.length; i++) {
      var no = grafo.nos[i];
      vertices.push({
        id: no.id,
        x: U.arredondar(no.x, 4),
        y: U.arredondar(no.y, 4),
        grau: no.arestas.length,
        arestas: no.arestas.slice()
      });
    }

    var arestas = [];
    for (var a = 0; a < grafo.arestas.length; a++) {
      var ar = grafo.arestas[a];
      arestas.push({
        id: ar.id,
        a: ar.a,
        b: ar.b,
        classe: ar.classe,
        spot: ar.spot,
        caminho: ar.caminho,
        segmento: ar.origem,
        indiceNoCaminho: ar.indiceNoCaminho,
        comprimentoMm: U.arredondar(ar.comprimentoMm, 4),
        tipoOriginal: ar.tipoOriginal,
        fechadoOriginal: ar.fechadoOriginal,
        t0: U.arredondar(ar.t0, 5),
        t1: U.arredondar(ar.t1, 5)
      });
    }

    var contornos = [];
    for (var c = 0; c < grafo.contornos.length; c++) {
      var ct = grafo.contornos[c];
      var idsArestas = [];
      for (var ca = 0; ca < ct.arestas.length; ca++) {
        var ref = ct.arestas[ca];
        idsArestas.push(ref && typeof ref === "object" ? ref.id : ref);
      }
      contornos.push({
        id: ct.id,
        fechado: ct.fechado,
        ambiguo: ct.ambiguo,
        arestas: idsArestas,
        areaMm2: U.arredondar(ct.areaMm2, 3),
        perimetroMm: U.arredondar(ct.perimetroMm, 3),
        classes: ct.classes,
        autoInterseccoes: ct.autoInterseccoes || 0
      });
    }

    var facesSaida = [];
    for (var f = 0; f < faces.faces.length; f++) {
      var fc = faces.faces[f];
      facesSaida.push({
        id: fc.id,
        areaMm2: U.arredondar(fc.areaMm2, 3),
        perimetroMm: U.arredondar(fc.perimetroMm, 3),
        centro: { x: U.arredondar(fc.centro.x, 3), y: U.arredondar(fc.centro.y, 3) },
        arestas: fc.arestas.slice(),
        classes: fc.classes,
        lados: fc.pontos.length
      });
    }

    var areaTotal = 0;
    for (var f2 = 0; f2 < facesSaida.length; f2++) areaTotal += facesSaida[f2].areaMm2;

    var cruzamentos = 0;
    var toques = 0;
    var juncoes = 0;
    for (var it = 0; it < grafo.interseccoes.length; it++) {
      if (grafo.interseccoes[it].tipo === "cruzamento") cruzamentos++;
      else if (grafo.interseccoes[it].tipo === "toque") toques++;
      else if (grafo.interseccoes[it].tipo === "juncao") juncoes++;
    }

    var fechados = 0;
    for (var c2 = 0; c2 < contornos.length; c2++) if (contornos[c2].fechado) fechados++;

    return {
      resumo: {
        documento: geometria.meta.documento,
        escopo: geometria.meta.escopo,
        caminhos: geometria.caminhos.length,
        segmentos: geometria.segmentos.length,
        vertices: vertices.length,
        arestas: arestas.length,
        contornos: contornos.length,
        contornosFechados: fechados,
        contornosAbertos: contornos.length - fechados,
        faces: facesSaida.length,
        adjacencias: faces.adjacencias.length,
        interseccoes: grafo.interseccoes.length,
        cruzamentos: cruzamentos,
        toques: toques,
        juncoes: juncoes,
        duplicados: grafo.duplicados.length,
        sobrepostos: grafo.sobrepostos.length,
        ambiguidades: grafo.ambiguidades.length,
        invalidos: grafo.invalidos.length,
        regioesAbertas: faces.regioesAbertas.length,
        areaFacesMm2: U.arredondar(areaTotal, 3),
        caixa: geometria.caixa,
        tolerancias: grafo.tolerancias
      },
      linhas: contarClasses(arestas),
      vertices: vertices,
      arestas: arestas,
      contornos: contornos,
      faces: facesSaida,
      adjacencias: faces.adjacencias,
      faceExterna: faces.faceExterna
        ? { areaMm2: U.arredondar(faces.faceExterna.areaMm2, 3), arestas: faces.faceExterna.arestas }
        : null,
      regioesAbertas: faces.regioesAbertas,
      ambiguidades: grafo.ambiguidades,
      erros: grafo.invalidos
    };
  }

  G.topology = {
    montar: montar,
    contarClasses: contarClasses
  };
})();
