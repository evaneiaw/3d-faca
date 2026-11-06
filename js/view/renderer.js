/* FACA 3D — contrato do renderizador e diagnóstico gráfico.
 *
 * Nenhum renderizador definitivo é implementado nesta fase. O contrato abaixo
 * fixa o que os renderizadores (WebGL/three.js e Canvas 2D) deverão cumprir na
 * FASE 4. O teste de WebGL é real: cria contexto, limpa o buffer e lê o pixel.
 */
(function () {
  var F = (window.Faca3D = window.Faca3D || {});

  var R = (F.renderer = {});
  R.CONTRATO = ["init", "resize", "setCena", "render", "dispose"];

  /* Renderizador nulo: mantém a área reservada sem simular geometria. */
  R.criarNulo = function (motivo) {
    var estado = { motivo: motivo || "Renderer não implementado.", pronto: false };
    return {
      tipo: "nulo",
      init: function () {
        return { ok: false, motivo: estado.motivo };
      },
      resize: function () {},
      setCena: function () {},
      render: function () {},
      dispose: function () {},
      estado: function () {
        return estado;
      }
    };
  };

  function dimensoesTela() {
    try {
      return {
        largura: window.screen ? window.screen.width : null,
        altura: window.screen ? window.screen.height : null,
        dpr: window.devicePixelRatio || 1
      };
    } catch (e) {
      return { largura: null, altura: null, dpr: 1 };
    }
  }

  function infoContexto(gl) {
    var info = {
      ok: true,
      versao: "",
      fornecedor: "",
      renderizador: "",
      glsl: "",
      maxTextura: 0,
      maxViewport: "",
      extensoes: 0,
      debugRenderer: false,
      perdaDeContexto: false,
      pixelOk: false,
      erroPixel: ""
    };

    function ler(fn, padrao) {
      try {
        var v = fn();
        return v === undefined || v === null ? padrao : v;
      } catch (e) {
        return padrao;
      }
    }

    info.versao = ler(function () { return gl.getParameter(gl.VERSION); }, "");
    info.fornecedor = ler(function () { return gl.getParameter(gl.VENDOR); }, "");
    info.renderizador = ler(function () { return gl.getParameter(gl.RENDERER); }, "");
    info.glsl = ler(function () { return gl.getParameter(gl.SHADING_LANGUAGE_VERSION); }, "");
    info.maxTextura = ler(function () { return gl.getParameter(gl.MAX_TEXTURE_SIZE); }, 0);

    var dims = ler(function () { return gl.getParameter(gl.MAX_VIEWPORT_DIMS); }, null);
    if (dims && dims.length >= 2) {
      info.maxViewport = String(dims[0]) + "x" + String(dims[1]);
    }

    var exts = ler(function () { return gl.getSupportedExtensions(); }, null);
    info.extensoes = exts && exts.length ? exts.length : 0;

    try {
      var dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        info.debugRenderer = true;
        var uv = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
        var ur = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        if (uv) info.fornecedor = String(uv);
        if (ur) info.renderizador = String(ur);
      }
    } catch (eDbg) {}

    info.perdaDeContexto = ler(function () { return gl.isContextLost(); }, false);

    try {
      gl.clearColor(1, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      var px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      info.pixelOk = px[0] > 200 && px[1] < 60 && px[2] < 60 && px[3] > 200;
      if (!info.pixelOk) {
        info.erroPixel = "readPixels inesperado: [" + px[0] + "," + px[1] + "," + px[2] + "," + px[3] + "]";
      }
    } catch (ePix) {
      info.erroPixel = ePix && ePix.message ? ePix.message : String(ePix);
    }

    return info;
  }

  function tentarContexto(tipo) {
    var res = { tipo: tipo, ok: false, erro: "", contexto: null };
    var canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    var detalheEvento = "";

    if (canvas.addEventListener) {
      canvas.addEventListener(
        "webglcontextcreationerror",
        function (ev) {
          detalheEvento = ev && ev.statusMessage ? String(ev.statusMessage) : "";
        },
        false
      );
    }

    try {
      var gl = canvas.getContext(tipo, {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
      });
      if (!gl) {
        res.erro = detalheEvento || "getContext('" + tipo + "') retornou null.";
        return res;
      }
      res.ok = true;
      res.contexto = infoContexto(gl);
      return res;
    } catch (e) {
      res.erro = (e && e.message ? e.message : String(e)) + (detalheEvento ? " | " + detalheEvento : "");
      return res;
    }
  }

  /* Executa o spike completo. Retorna dados crus (sem inventar suporte). */
  R.probeWebGL = function () {
    var t0 = new Date().getTime();
    var tela = dimensoesTela();
    var rel = {
      userAgent: (navigator && navigator.userAgent) || "",
      plataforma: (navigator && navigator.platform) || "",
      idioma: (navigator && navigator.language) || "",
      temWebGLRenderingContext: typeof WebGLRenderingContext !== "undefined",
      temWebGL2RenderingContext: typeof WebGL2RenderingContext !== "undefined",
      temCanvas: !!document.createElement("canvas").getContext,
      offscreenCanvas: typeof OffscreenCanvas !== "undefined",
      tela: tela,
      webgl1: null,
      webgl2: null,
      tempoMs: 0
    };

    rel.webgl1 = tentarContexto("webgl");
    rel.webgl2 = tentarContexto("webgl2");
    rel.tempoMs = new Date().getTime() - t0;
    return rel;
  };

  R.formatarRelatorio = function (rel) {
    var linhas = [];
    function linha(k, v) {
      linhas.push(k + ": " + v);
    }

    linha("User agent", rel.userAgent || "(vazio)");
    linha("Plataforma", (rel.plataforma || "?") + " | DPR " + rel.tela.dpr);
    linha("Tela", (rel.tela.largura || "?") + "x" + (rel.tela.altura || "?"));
    linha("WebGLRenderingContext exposto", rel.temWebGLRenderingContext ? "sim" : "NÃO");
    linha("WebGL2RenderingContext exposto", rel.temWebGL2RenderingContext ? "sim" : "NÃO");
    linha("OffscreenCanvas", rel.offscreenCanvas ? "sim" : "não");

    function bloco(nome, res) {
      linhas.push("");
      linhas.push("[" + nome + "]");
      if (!res.ok) {
        linha("Resultado", "INDISPONÍVEL");
        linha("Erro", res.erro || "(sem detalhe)");
        return;
      }
      var c = res.contexto;
      linha("Resultado", "contexto criado");
      linha("Versão", c.versao);
      linha("Fornecedor", c.fornecedor);
      linha("Renderizador", c.renderizador);
      linha("GLSL", c.glsl);
      linha("Máx. textura", c.maxTextura);
      linha("Máx. viewport", c.maxViewport);
      linha("Extensões", c.extensoes);
      linha("Debug renderer", c.debugRenderer ? "sim" : "não");
      linha("Contexto perdido", c.perdaDeContexto ? "SIM" : "não");
      linha("Desenho/leitura de pixel", c.pixelOk ? "OK" : "FALHOU" + (c.erroPixel ? " (" + c.erroPixel + ")" : ""));
    }

    bloco("WebGL 1", rel.webgl1);
    bloco("WebGL 2", rel.webgl2);
    linhas.push("");
    linha("Tempo do teste", rel.tempoMs + " ms");
    return linhas.join("\n");
  };
})();
