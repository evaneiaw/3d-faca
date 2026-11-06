/* FACA 3D — motor geométrico (Fase 2).
 *
 * Orquestra: transporte com o ExtendScript -> parser -> contornos -> faces ->
 * topologia. O transporte é injetado pelo controlador do painel; assim o
 * mesmo motor roda em Node nos testes unitários (sem Illustrator).
 *
 * API:
 *   Faca3D.geometry.engine.definirTransporte(fn)
 *   Faca3D.geometry.engine.carregarGeometria({escopo, lote, tolerancias})
 *   Faca3D.geometry.engine.analisar({...})           // assíncrono
 *   Faca3D.geometry.engine.analisarGeometria(geo)    // síncrono (testes)
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});
  var U = G.utils;

  var transporte = null;
  var LOTE_PADRAO = 200;

  function definirTransporte(fn) {
    transporte = typeof fn === "function" ? fn : null;
  }

  function exigirTransporte() {
    if (!transporte) {
      var e = new Error("Transporte com o ExtendScript não configurado.");
      e.codigoProtocolo = "TRANSPORTE";
      throw e;
    }
  }

  /* Junta os lotes em uma única geometria (mm absolutos) e rebaseia. */
  async function carregarGeometria(opcoes) {
    exigirTransporte();
    var opt = opcoes || {};
    var escopo = opt.escopo === "selecao" ? "selecao" : "documento";
    var lote = Math.max(1, Math.min(1000, parseInt(opt.lote, 10) || LOTE_PADRAO));
    var tolerancias = U.tolerancias(opt.tolerancias);

    var acumulado = {
      meta: null,
      caixa: { minX: 0, minY: 0, maxX: 0, maxY: 0, largura: 0, altura: 0 },
      caixaPt: null,
      caminhos: [],
      segmentos: []
    };

    var inicio = 0;
    var total = null;
    var iteracoes = 0;
    var bytes = 0;
    var tempoExtendScript = 0;
    var caixaPt = null;

    while (total === null || inicio < total) {
      if (iteracoes++ > 5000) {
        throw new Error("Laço de leitura excessivo (mais de 5000 lotes).");
      }
      var resposta = await transporte("faca3dGeometria", [escopo, inicio, inicio + lote]);
      var parcial = G.parser.parse(resposta, { normalizar: false, tolerancias: tolerancias });

      if (parcial.caixaPt) {
        if (!caixaPt) {
          caixaPt = {
            minX: parcial.caixaPt.minX, minY: parcial.caixaPt.minY,
            maxX: parcial.caixaPt.maxX, maxY: parcial.caixaPt.maxY
          };
        } else {
          if (parcial.caixaPt.minX < caixaPt.minX) caixaPt.minX = parcial.caixaPt.minX;
          if (parcial.caixaPt.minY < caixaPt.minY) caixaPt.minY = parcial.caixaPt.minY;
          if (parcial.caixaPt.maxX > caixaPt.maxX) caixaPt.maxX = parcial.caixaPt.maxX;
          if (parcial.caixaPt.maxY > caixaPt.maxY) caixaPt.maxY = parcial.caixaPt.maxY;
        }
      }

      if (acumulado.meta === null) {
        acumulado.meta = parcial.meta;
        total = parcial.meta.total;
      }
      bytes += parcial.meta.bytes;
      tempoExtendScript += parcial.meta.tempoExtendScriptMs;

      for (var i = 0; i < parcial.caminhos.length; i++) acumulado.caminhos.push(parcial.caminhos[i]);
      for (var j = 0; j < parcial.segmentos.length; j++) {
        var seg = parcial.segmentos[j];
        seg.id = acumulado.segmentos.length;
        acumulado.segmentos.push(seg);
      }

      var fim = parcial.meta.fim;
      if (fim <= inicio) break; // proteção contra resposta vazia
      inicio = fim;
      if (opt.aoProgresso) {
        try {
          opt.aoProgresso({ lidos: inicio, total: total, bytes: bytes });
        } catch (eProg) {}
      }
    }

    acumulado.meta.total = total;
    acumulado.meta.bytes = bytes;
    acumulado.meta.tempoExtendScriptMs = tempoExtendScript;
    acumulado.meta.lotes = iteracoes;

    G.parser.rebase(acumulado);
    acumulado.caixaPt = caixaPt;
    return acumulado;
  }

  /* Processa uma geometria já carregada (usado nos testes unitários). */
  function analisarGeometria(geometria, opcoes) {
    var opt = opcoes || {};
    var tolerancias = U.tolerancias(opt.tolerancias || (geometria.meta && geometria.meta.tolerancias));
    var t0 = Date.now();

    var grafo = G.contour.construir(geometria.segmentos, { tolerancias: tolerancias });
    var faces = G.faces.detectar(grafo, { tolerancias: tolerancias });
    var topologia = G.topology.montar(
      { geometria: geometria, grafo: grafo, faces: faces },
      { tolerancias: tolerancias }
    );

    return {
      tempoTotalMs: Date.now() - t0,
      tempoContornosMs: grafo.tempoMs,
      tempoFacesMs: faces.tempoMs,
      geometria: geometria,
      grafo: grafo,
      faces: faces,
      topologia: topologia
    };
  }

  async function analisar(opcoes) {
    var t0 = Date.now();
    var geometria = await carregarGeometria(opcoes);
    var resultado = analisarGeometria(geometria, opcoes);
    resultado.tempoCarregamentoMs = resultado.tempoTotalMs;
    resultado.tempoTotalMs = Date.now() - t0;
    return resultado;
  }

  /* Assinatura da geometria analisada. A base fixa escolhida só vale enquanto
   * a faca tiver a mesma geometria (mesmo documento, mesmas faces e caixa). */
  function assinatura(resultado) {
    if (!resultado) return "";
    var g = resultado.geometria || {};
    var meta = g.meta || {};
    var caixa = g.caixa || {};
    var topo = resultado.topologia && resultado.topologia.resumo ? resultado.topologia.resumo : {};
    var faces = resultado.faces && resultado.faces.faces ? resultado.faces.faces : [];
    var somaAreas = 0;
    for (var i = 0; i < faces.length; i++) somaAreas += faces[i].areaMm2 || 0;
    function centesimos(n) {
      return Math.round((n || 0) * 100);
    }
    return [
      meta.documento || "",
      (g.caminhos || []).length,
      topo.faces || faces.length,
      centesimos(caixa.largura),
      centesimos(caixa.altura),
      Math.round(somaAreas)
    ].join("|");
  }

  /* Chave curta e estável da faca, usada para guardar/restaurar os ângulos
   * definidos à mão (documento + geometria). 8 caracteres hexadecimais. */
  function chaveDobra(resultado) {
    var texto = typeof resultado === "string" ? resultado : assinatura(resultado);
    var h = 5381;
    for (var i = 0; i < texto.length; i++) {
      h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function resumoTexto(resultado) {
    var t = resultado.topologia;
    if (!t) return "Sem topologia.";
    var r = t.resumo;
    var linhas = [];
    linhas.push("Documento: " + (r.documento || "?") + " (" + r.escopo + ")");
    linhas.push("Caminhos: " + r.caminhos + " · Segmentos: " + r.segmentos);
    linhas.push("Vértices: " + r.vertices + " · Arestas: " + r.arestas);
    linhas.push("Contornos: " + r.contornos + " (" + r.contornosFechados + " fechados, " + r.contornosAbertos + " abertos)");
    linhas.push("Faces: " + r.faces + " · Adjacências: " + r.adjacencias);
    linhas.push("Interseções: " + r.interseccoes + " (" + r.cruzamentos + " cruzamentos, " + r.juncoes + " junções, " + r.toques + " toques)" +
      " · Duplicados: " + r.duplicados + " · Sobrepostos: " + r.sobrepostos);
    linhas.push("Ambiguidades: " + r.ambiguidades + " · Inválidos: " + r.invalidos);
    linhas.push("Área das faces: " + r.areaFacesMm2 + " mm²");
    linhas.push(
      "Cut: " + t.linhas.cut.arestas + " arestas · Crease: " + t.linhas.crease.arestas +
        " · Other: " + t.linhas.other.arestas + " · Unknown: " + t.linhas.unknown.arestas
    );
    linhas.push("Tempo: " + resultado.tempoTotalMs + " ms");
    return linhas.join("\n");
  }

  G.engine = {
    definirTransporte: definirTransporte,
    temTransporte: function () {
      return !!transporte;
    },
    carregarGeometria: carregarGeometria,
    analisar: analisar,
    analisarGeometria: analisarGeometria,
    assinatura: assinatura,
    chaveDobra: chaveDobra,
    resumoTexto: resumoTexto,
    LOTE_PADRAO: LOTE_PADRAO
  };
})();
