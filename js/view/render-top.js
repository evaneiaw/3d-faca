/* FACA 3D - Render Top (snapshot HD).
 *
 * Antes este módulo montava uma cena própria, com escala e eixo diferentes do
 * visualizador (a geometria da faca está em mm com Z para cima) e caía sempre
 * numa caixa de referência. Por isso o "render" saía igual/errado.
 *
 * Agora ele apenas delega para o snapshot do visualizador real
 * (F.estado.viewer3d.snapshot), que re-renderiza a MESMA cena montada - com a
 * faca real, a arte e as dobras - numa resolução bem maior, com fundo de
 * estúdio, sombra de contato e vinheta.
 *
 * API: window.faca3dRenderTop({ maiorLado, sombras, vinheta })
 *      -> { success, dataURL, largura, altura } | { success:false, error }
 */

(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});

  var DEFAULTS = {
    maiorLado: 3840,
    sombras: true,
    vinheta: true
  };

  function viewerAtual() {
    try {
      var estado = F.estado || (raiz.estado || null);
      if (estado && estado.viewer3d) return estado.viewer3d;
    } catch (e) {}
    return null;
  }

  function renderTop(opts) {
    var cfg = Object.assign({}, DEFAULTS, opts || {});
    var viewer = viewerAtual();

    if (!viewer || typeof viewer.snapshot !== "function") {
      return {
        success: false,
        dataURL: null,
        error: "Nenhuma faca montada no painel. Leia a faca antes de renderizar."
      };
    }

    try {
      var snap = viewer.snapshot({
        maiorLado: cfg.maiorLado,
        sombras: cfg.sombras !== false,
        vinheta: cfg.vinheta !== false
      });
      if (!snap || !snap.dataURL) {
        throw new Error("O snapshot não gerou imagem.");
      }
      return {
        success: true,
        dataURL: snap.dataURL,
        largura: snap.largura,
        altura: snap.altura,
        message: "Render Top " + snap.largura + "x" + snap.altura
      };
    } catch (e) {
      return {
        success: false,
        dataURL: null,
        error: e && e.message ? e.message : String(e)
      };
    }
  }

  window.faca3dRenderTop = renderTop;
  F.renderTop = { render: renderTop, DEFAULTS: DEFAULTS };
})();
