/* FACA 3D — parser do protocolo de geometria (Fase 2).
 *
 * Recebe a resposta textual F3D|1|GEO do ExtendScript e devolve uma estrutura
 * com caminhos, pontos e segmentos. Nenhuma informação é descartada: cada
 * ponto guarda coordenadas em ponto (pt) e em milímetros normalizados, e cada
 * segmento guarda referência ao caminho de origem e à sua classificação.
 *
 * Formato das linhas (ver faca3d.jsx):
 *   P=indice \t classe \t spot \t fechado \t nPontos \t camada \t pai
 *   A=indice \t ponto \t AX \t AY \t LX \t LY \t RX \t RY
 * Coordenadas em 1/ESCALA_COORD pt.
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var G = (F.geometry = F.geometry || {});
  var U = G.utils;

  function numero(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function dividir(valor) {
    return String(valor === null || valor === undefined ? "" : valor).split("\t");
  }

  /* Converte coordenadas inteiras (1/10000 pt) em pt. */
  function coordPt(valor, escala) {
    return numero(valor) / (escala || U.ESCALA_COORD);
  }

  function segmentoReta(p0, p1, tolMm) {
    // Reto quando os dois handles coincidem com os respectivos anchors.
    var d1 = U.distancia(p0.dirMm, p0.mm);
    var d2 = U.distancia(p1.esqMm, p1.mm);
    return d1 <= tolMm && d2 <= tolMm;
  }

  function comprimentoSegmento(seg, tolCurvaMm) {
    if (seg.tipo === "reta") return U.distancia(seg.p0, seg.p3);
    var pts = U.achatarBezier(seg.p0, seg.c1, seg.c2, seg.p3, tolCurvaMm);
    return U.comprimentoPolilinha(pts);
  }

  /* Decodifica a resposta GEO. */
  function parse(resposta, opcoes) {
    var opt = opcoes || {};
    var tol = U.tolerancias(opt.tolerancias);
    var diag = F.protocol.decode(resposta);

    if (diag.tipo === "ERRO") {
      throw F.protocol.erroProtocolo(diag.campos.CODIGO || "ERRO", diag.campos.MENSAGEM || "Erro no ExtendScript.");
    }
    if (diag.tipo === "SEM_DOC" || diag.tipo === "SEM_SELECAO") {
      throw F.protocol.erroProtocolo(diag.tipo, diag.campos.MENSAGEM || diag.tipo);
    }
    if (diag.tipo !== "GEO") {
      throw F.protocol.erroProtocolo("TIPO", "Resposta inesperada: " + diag.tipo);
    }

    var escala = numero(diag.campos.ESCALA_COORD) || U.ESCALA_COORD;
    var linhasP = diag.listas.P || [];
    var linhasA = diag.listas.A || [];

    var porIndice = {};
    var caminhos = [];
    var i;

    for (i = 0; i < linhasP.length; i++) {
      var campos = dividir(linhasP[i]);
      if (campos.length < 7) continue;
      var caminho = {
        indice: parseInt(campos[0], 10),
        classe: campos[1] || "unknown",
        spot: campos[2] || "",
        fechado: campos[3] === "1",
        nPontos: parseInt(campos[4], 10) || 0,
        camada: campos[5] || "",
        pai: campos[6] || "",
        pontos: [],
        segmentos: []
      };
      caminhos.push(caminho);
      porIndice[caminho.indice] = caminho;
    }

    for (i = 0; i < linhasA.length; i++) {
      var a = dividir(linhasA[i]);
      if (a.length < 8) continue;
      var idx = parseInt(a[0], 10);
      var caminhoA = porIndice[idx];
      if (!caminhoA) continue;
      caminhoA.pontos.push({
        indice: parseInt(a[1], 10),
        pt: { x: coordPt(a[2], escala), y: coordPt(a[3], escala) },
        esqPt: { x: coordPt(a[4], escala), y: coordPt(a[5], escala) },
        dirPt: { x: coordPt(a[6], escala), y: coordPt(a[7], escala) },
        mm: { x: 0, y: 0 },
        esqMm: { x: 0, y: 0 },
        dirMm: { x: 0, y: 0 }
      });
    }

    // Normalização: mm, Y para cima, origem na bbox de todos os anchors.
    // Com { normalizar: false } as coordenadas ficam em mm absolutos (ainda
    // em pt convertido); o motor faz o rebase após juntar todos os lotes.
    var normalizar = opt.normalizar !== false;
    var todosPt = [];
    for (i = 0; i < caminhos.length; i++) {
      var c = caminhos[i];
      c.pontos.sort(function (x, y) {
        return x.indice - y.indice;
      });
      for (var j = 0; j < c.pontos.length; j++) todosPt.push(c.pontos[j].pt);
    }
    var norm = U.normalizar(todosPt);
    var origemX = normalizar ? norm.caixaPt.minX : 0;
    var origemY = normalizar ? norm.caixaPt.minY : 0;

    var k = 0;
    for (i = 0; i < caminhos.length; i++) {
      var cam = caminhos[i];
      var caixaPt = U.caixaDelimitadora(
        cam.pontos.map(function (p) {
          return p.pt;
        })
      );
      cam.caixaPt = caixaPt;
      cam.caixaMm = {
        minX: (caixaPt.minX - origemX) * U.PT_MM,
        minY: (caixaPt.minY - origemY) * U.PT_MM,
        maxX: (caixaPt.maxX - origemX) * U.PT_MM,
        maxY: (caixaPt.maxY - origemY) * U.PT_MM,
        largura: caixaPt.largura * U.PT_MM,
        altura: caixaPt.altura * U.PT_MM
      };
      for (var p = 0; p < cam.pontos.length; p++) {
        var ponto = cam.pontos[p];
        ponto.mm = {
          x: (ponto.pt.x - origemX) * U.PT_MM,
          y: (ponto.pt.y - origemY) * U.PT_MM
        };
        ponto.esqMm = {
          x: (ponto.esqPt.x - origemX) * U.PT_MM,
          y: (ponto.esqPt.y - origemY) * U.PT_MM
        };
        ponto.dirMm = {
          x: (ponto.dirPt.x - origemX) * U.PT_MM,
          y: (ponto.dirPt.y - origemY) * U.PT_MM
        };
        ponto.legenda = (k++) + "";
      }
    }

    // Segmentos (preservando a direção original do caminho).
    var segmentos = [];
    for (i = 0; i < caminhos.length; i++) {
      var cc = caminhos[i];
      var n = cc.pontos.length;
      if (n < 2) continue;
      var limite = cc.fechado ? n : n - 1;
      for (var s = 0; s < limite; s++) {
        var p0 = cc.pontos[s];
        var p1 = cc.pontos[(s + 1) % n];
        var seg = {
          id: segmentos.length,
          caminho: cc.indice,
          classe: cc.classe,
          spot: cc.spot,
          indiceNoCaminho: s,
          p0: p0.mm,
          c1: p0.dirMm,
          c2: p1.esqMm,
          p3: p1.mm,
          tipo: "reta",
          fechado: cc.fechado,
          comprimentoMm: 0,
          pontoInicial: p0,
          pontoFinal: p1
        };
        seg.tipo = segmentoReta(p0, p1, tol.retaMm) ? "reta" : "curva";
        seg.comprimentoMm = comprimentoSegmento(seg, tol.curvaMm);
        cc.segmentos.push(seg);
        segmentos.push(seg);
      }
    }

    return {
      meta: {
        escopo: diag.campos.ESCOPO || "documento",
        documento: diag.campos.DOC_NOME || "",
        caminhoDocumento: diag.campos.DOC_CAMINHO || "",
        salvo: diag.campos.DOC_SALVO === "sim",
        total: parseInt(diag.campos.TOTAL, 10) || caminhos.length,
        inicio: parseInt(diag.campos.INICIO, 10) || 0,
        fim: parseInt(diag.campos.FIM, 10) || caminhos.length,
        escala: escala,
        tempoExtendScriptMs: parseInt(diag.campos.TEMPO_MS, 10) || 0,
        bytes: diag.bytes,
        normalizado: normalizar,
        tolerancias: tol
      },
      caixa: {
        minX: normalizar ? 0 : norm.caixaPt.minX * U.PT_MM,
        minY: normalizar ? 0 : norm.caixaPt.minY * U.PT_MM,
        maxX: (normalizar ? norm.caixaPt.largura : norm.caixaPt.maxX) * U.PT_MM,
        maxY: (normalizar ? norm.caixaPt.altura : norm.caixaPt.maxY) * U.PT_MM,
        largura: norm.caixaPt.largura * U.PT_MM,
        altura: norm.caixaPt.altura * U.PT_MM
      },
      caixaPt: norm.caixaPt,
      caminhos: caminhos,
      segmentos: segmentos
    };
  }

  /* Recalcula a origem após juntar vários lotes (mm absolutos -> bbox zero). */
  function rebase(geometria) {
    var pontos = [];
    var i, j;
    for (i = 0; i < geometria.caminhos.length; i++) {
      for (j = 0; j < geometria.caminhos[i].pontos.length; j++) {
        pontos.push(geometria.caminhos[i].pontos[j].mm);
      }
    }
    var caixa = U.caixaDelimitadora(pontos);
    var dx = caixa.minX;
    var dy = caixa.minY;
    if (dx === 0 && dy === 0) {
      geometria.caixa = {
        minX: 0, minY: 0, maxX: caixa.maxX, maxY: caixa.maxY,
        largura: caixa.largura, altura: caixa.altura
      };
      return geometria;
    }
    for (i = 0; i < geometria.caminhos.length; i++) {
      var cam = geometria.caminhos[i];
      for (j = 0; j < cam.pontos.length; j++) {
        var p = cam.pontos[j];
        p.mm.x -= dx;
        p.mm.y -= dy;
        p.esqMm.x -= dx;
        p.esqMm.y -= dy;
        p.dirMm.x -= dx;
        p.dirMm.y -= dy;
      }
      cam.caixaMm.minX -= dx;
      cam.caixaMm.minY -= dy;
      cam.caixaMm.maxX -= dx;
      cam.caixaMm.maxY -= dy;
    }
    // Os segmentos referenciam os MESMOS objetos p.mm/esqMm/dirMm; não mexer
    // neles aqui (seria subtração dupla).
    geometria.caixa = {
      minX: 0, minY: 0,
      maxX: caixa.maxX - dx, maxY: caixa.maxY - dy,
      largura: caixa.largura, altura: caixa.altura
    };
    return geometria;
  }

  G.parser = {
    parse: parse,
    rebase: rebase,
    segmentoReta: segmentoReta
  };
})();
