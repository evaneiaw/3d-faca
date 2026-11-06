/* FACA 3D — controlador da interface (3D).
 *
 * O hub carrega apenas este arquivo. Ele carrega os submódulos, o Three.js
 * local, lê a geometria real do documento e monta a dobra 3D.
 *
 * A interface é intencionalmente mínima: a faca ocupa a tela, "Dobrar" anima
 * a montagem e o controle de ângulo permite explorar a dobra.
 */
(function () {
  "use strict";

  var VERSAO = "0.4.0";
  var BASE = "convertidos/faca3d/";
  var MODULOS = [
    "js/core/protocol.js",
    "js/core/units.js",
    "js/core/geometry-utils.js",
    "js/core/path-parser.js",
    "js/core/contour-builder.js",
    "js/core/face-detector.js",
    "js/core/topology.js",
    "js/core/geometry-engine.js",
    "js/view/three3d.js"
  ];

  var F = (window.Faca3D = {});
  F.versao = VERSAO;
  F.build = String(new Date().getTime());

  var csInterface = null;
  var estado = {
    ocupado: false,
    res: null,
    viewer3d: null,
    animacao: null,
    jaAnimou: false,
    angulo: 90
  };

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(mensagem, tipo) {
    var caixa = el("faca3dStatus");
    var texto = el("faca3dStatusText");
    if (!texto) return;
    caixa.className = "faca3d-status" + (tipo ? " faca3d-" + tipo : "");
    texto.textContent = mensagem;
  }

  function registrarLog(origem, mensagem) {
    try {
      if (!csInterface) return;
      var args =
        JSON.stringify(String(origem || "faca3d")) + ", " +
        JSON.stringify(String(mensagem || ""));
      csInterface.evalScript("mazurkyLog(" + args + ")", function () {});
    } catch (e) {}
  }

  function sendToHost(funcName, args) {
    return new Promise(function (resolve, reject) {
      if (!csInterface) {
        reject(new Error("CSInterface não inicializado."));
        return;
      }
      var argStr = (args || [])
        .map(function (a) {
          return JSON.stringify(a);
        })
        .join(", ");
      var script = funcName + "(" + argStr + ")";
      csInterface.evalScript(script, function (result) {
        if (result === "EvalScript error.") {
          reject(new Error("Erro no ExtendScript."));
        } else {
          resolve(result);
        }
      });
    });
  }

  function carregarScript(src, cb) {
    var pronto = false;
    var elScript = document.createElement("script");
    elScript.src = src;
    elScript.async = false;
    elScript.onload = function () {
      if (pronto) return;
      pronto = true;
      if (elScript.parentNode) elScript.parentNode.removeChild(elScript);
      cb(null);
    };
    elScript.onerror = function () {
      if (pronto) return;
      pronto = true;
      if (elScript.parentNode) elScript.parentNode.removeChild(elScript);
      cb(new Error("Falha ao carregar " + src));
    };
    document.head.appendChild(elScript);
  }

  function carregarLoader(cb) {
    carregarScript(BASE + "js/core/loader.js?v=" + F.build, cb);
  }

  function carregarModulos(cb) {
    if (!F.loader) {
      cb(new Error("Carregador de módulos indisponível."));
      return;
    }
    F.loader.base = BASE;
    // Recarrega os módulos a cada abertura da ferramenta (o painel é uma
    // página só; sem isso, uma atualização ficaria presa no cache em memória).
    F.loader.carregados = {};
    F.loader.carregar(MODULOS, cb);
  }

  function carregarThree(cb) {
    if (window.THREE) {
      cb(null);
      return;
    }
    carregarScript(BASE + "js/vendor/three.min.js?v=" + F.build, cb);
  }

  /* ------------------------------------------------------------------ UI */

  function limpar(no) {
    while (no.firstChild) no.removeChild(no.firstChild);
  }

  function criar(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }

  function destruirViewer3D() {
    cancelarAnimacao();
    if (estado.viewer3d) {
      try {
        estado.viewer3d.destruir();
      } catch (e) {}
      estado.viewer3d = null;
    }
    estado.jaAnimou = false;
  }

  function mostrarVazio(titulo, texto) {
    destruirViewer3D();
    var host = el("faca3dViewer3D");
    limpar(host);
    var caixa = criar("div", "faca3d-empty");
    caixa.appendChild(criar("div", "faca3d-empty-title", titulo));
    caixa.appendChild(criar("div", "faca3d-empty-text", texto));
    host.appendChild(caixa);
    el("faca3dInfo3D").textContent = "Aguardando leitura da faca.";
    el("faca3dNota3D").textContent = "";
  }

  function mostrarErro(titulo, mensagem, dica) {
    destruirViewer3D();
    var host = el("faca3dViewer3D");
    limpar(host);
    var caixa = criar("div", "faca3d-empty is-error");
    caixa.appendChild(criar("div", "faca3d-empty-title", titulo));
    caixa.appendChild(criar("div", "faca3d-empty-text", mensagem));
    if (dica) {
      var d = criar("div", "faca3d-empty-text", dica);
      d.style.marginTop = "6px";
      caixa.appendChild(d);
    }
    host.appendChild(caixa);
    el("faca3dInfo3D").textContent = "Falha na montagem.";
    el("faca3dNota3D").textContent = "";
  }

  function garantirViewer3D() {
    if (estado.viewer3d && el("faca3dViewer3D").querySelector(".faca3d-canvas3d")) {
      return estado.viewer3d;
    }
    destruirViewer3D();
    var host = el("faca3dViewer3D");
    limpar(host);
    estado.viewer3d = F.view.three3d.criar({
      host: host,
      aoInfo: function (texto) {
        var info = el("faca3dInfo3D");
        if (info) info.textContent = texto + " · arraste para girar · roda para zoom";
      }
    });
    return estado.viewer3d;
  }

  function montarNota(m, totalFaces) {
    var nota = el("faca3dNota3D");
    if (!nota) return;
    if (!m || !m.facesMontadas.length) {
      nota.textContent = "";
      return;
    }
    var texto = "Montagem: " + m.facesMontadas.length + " de " + totalFaces + " faces.";
    var detalhes = [];
    if (m.rigidas) {
      detalhes.push(m.rigidas + " ligação não reta mantida rígida (não dobrada)");
    }
    if (m.semConexaoVinco) {
      detalhes.push(m.semConexaoVinco + " recorte(s) ligados só por corte ficaram fora");
    }
    if (detalhes.length) texto += " " + detalhes.join("; ") + ".";
    texto += " Direção das dobras inferida (a faca não traz montanha/vale)";
    var cruz = estado.viewer3d && estado.viewer3d.cruzamentos ? estado.viewer3d.cruzamentos() : 0;
    if (cruz) texto += " · " + cruz + " cruzamento(s) entre faces";
    texto += ".";
    nota.textContent = texto;
  }

  function definirAnguloNaTela(graus) {
    var slider = el("faca3dAngulo");
    var valor = el("faca3dAnguloValor");
    var g = Math.round(graus);
    if (slider) slider.value = String(g);
    if (valor) valor.textContent = g + "°";
    estado.angulo = g;
  }

  function cancelarAnimacao() {
    if (estado.animacao !== null) {
      cancelAnimationFrame(estado.animacao);
      estado.animacao = null;
    }
  }

  function animarDobra(de, para, duracao) {
    cancelarAnimacao();
    if (!estado.viewer3d) return;
    var inicio = performance.now();
    function passo(agora) {
      var t = Math.min(1, (agora - inicio) / duracao);
      var e = t * t * (3 - 2 * t);
      var a = de + (para - de) * e;
      try {
        estado.viewer3d.definirAngulo(a);
      } catch (erro) {
        estado.animacao = null;
        return;
      }
      definirAnguloNaTela(a);
      if (t < 1) {
        estado.animacao = requestAnimationFrame(passo);
      } else {
        estado.animacao = null;
        definirAnguloNaTela(para);
      }
    }
    estado.animacao = requestAnimationFrame(passo);
  }

  function renderizar3D(res) {
    var faces = res.faces && res.faces.faces ? res.faces.faces : [];
    var total = faces.length;

    if (!total) {
      mostrarVazio(
        "Nenhuma face fechada",
        "A faca foi lida (" + res.geometria.caminhos.length +
          " caminhos), mas não há regiões fechadas para dobrar."
      );
      return;
    }

    var viewer = garantirViewer3D();
    viewer.desenhar(res);
    var m = viewer.montagem();
    montarNota(m, total);

    if (!estado.jaAnimou) {
      estado.jaAnimou = true;
      animarDobra(0, 90, 950);
    } else {
      viewer.definirAngulo(estado.angulo);
      definirAnguloNaTela(estado.angulo);
    }
  }

  function executarLeitura() {
    if (estado.ocupado) return;
    estado.ocupado = true;
    travarBotoes(true);
    setStatus("Lendo a faca...");
    var t0 = new Date().getTime();

    if (!F.geometry || !F.geometry.engine) {
      estado.ocupado = false;
      travarBotoes(false);
      mostrarErro("Motor geométrico indisponível", "Os módulos da Fase 2 não carregaram.");
      return;
    }

    F.geometry.engine
      .analisar({ escopo: "documento", lote: 200 })
      .then(function (res) {
        estado.res = res;
        var nome = res.geometria.meta.documento || "—";
        el("faca3dDoc").textContent = nome;
        renderizar3D(res);
        var m = estado.viewer3d && estado.viewer3d.montagem();
        var total = res.faces.faces.length;
        var totalMs = new Date().getTime() - t0;
        setStatus(
          "Faca lida: " + res.geometria.caminhos.length + " caminhos · " +
            (m ? m.facesMontadas.length : 0) + " de " + total + " faces montadas · " +
            totalMs + " ms",
          "ok"
        );
        registrarLog(
          "faca3d",
          "3d caminhos=" + res.geometria.caminhos.length +
            " faces=" + total +
            " montadas=" + (m ? m.facesMontadas.length : 0) +
            " tempo=" + totalMs + "ms"
        );
      })
      .catch(function (e) {
        var codigo = e && e.codigoProtocolo;
        var msg = e && e.message ? e.message : String(e);
        if (codigo === "SEM_DOC") {
          estado.res = null;
          el("faca3dDoc").textContent = "—";
          mostrarVazio(
            "Nenhum documento aberto",
            "Abra a faca no Illustrator e clique em Ler novamente."
          );
          setStatus("Nenhum documento aberto.", "err");
        } else {
          mostrarErro(
            "Não foi possível montar a faca",
            msg,
            "Verifique se o documento tem caminhos de faca e tente Ler novamente."
          );
          setStatus("Erro ao ler a faca: " + msg, "err");
        }
        registrarLog("faca3d", "erro 3d: " + msg);
      })
      .then(function () {
        estado.ocupado = false;
        travarBotoes(false);
      });
  }

  function travarBotoes(travar) {
    var ids = ["faca3dBtnLer", "faca3dBtnDobrar", "faca3dBtnVista", "faca3dAngulo"];
    for (var i = 0; i < ids.length; i++) {
      var n = el(ids[i]);
      if (n) n.disabled = travar;
    }
  }

  function expandirPainel() {
    try {
      var aw = (window.screen && window.screen.availWidth) || 1280;
      var ah = (window.screen && window.screen.availHeight) || 800;
      var w = Math.min(1180, Math.max(760, Math.round(aw * 0.9)));
      var h = Math.min(860, Math.max(560, Math.round(ah * 0.9)));
      window.resizeTo(w, h);
      window.moveTo(Math.round((aw - w) / 2), Math.round((ah - h) / 2));
    } catch (e) {}
  }

  function ligarEventos() {
    el("faca3dBtnFechar").addEventListener("click", function () {
      window.close();
    });
    var home = el("faca3dBtnHome");
    if (home) {
      home.addEventListener("click", function () {
        window.close();
      });
    }
    el("faca3dBtnLer").addEventListener("click", executarLeitura);
    el("faca3dBtnDobrar").addEventListener("click", function () {
      if (!estado.viewer3d) return;
      animarDobra(0, 90, 950);
    });
    el("faca3dBtnVista").addEventListener("click", function () {
      if (estado.viewer3d) estado.viewer3d.resetarVista();
    });
    el("faca3dAngulo").addEventListener("input", function () {
      cancelarAnimacao();
      var g = parseFloat(this.value) || 0;
      definirAnguloNaTela(g);
      if (estado.viewer3d) estado.viewer3d.definirAngulo(g);
    });
  }

  function iniciar() {
    try {
      csInterface = new CSInterface();
    } catch (e) {
      csInterface = null;
    }

    if (!csInterface) {
      setStatus("CSInterface não disponível. Abra a ferramenta pelo painel do Illustrator.", "err");
      return;
    }

    if (F.geometry && F.geometry.engine) {
      F.geometry.engine.definirTransporte(function (nomeFn, args) {
        return sendToHost("chamar", [nomeFn, args]);
      });
    }

    try {
      csInterface.addEventListener("com.mazurky.tools.activate", function (event) {
        if (event && event.data && event.data !== "com.mazurky.tools.faca3d") {
          window.close();
        }
      });
    } catch (e) {}

    ligarEventos();
    expandirPainel();
    definirAnguloNaTela(90);

    carregarThree(function (erro) {
      if (erro) {
        mostrarErro(
          "Three.js não carregou",
          erro.message,
          "O arquivo js/vendor/three.min.js precisa estar presente na extensão."
        );
        setStatus("Erro ao carregar o Three.js.", "err");
        return;
      }
      executarLeitura();
    });
  }

  carregarLoader(function (erroLoader) {
    if (erroLoader) {
      setStatus("Erro ao carregar o módulo: " + erroLoader.message, "err");
      return;
    }
    carregarModulos(function (erroMods) {
      if (erroMods) {
        setStatus("Erro ao carregar submódulos: " + erroMods.message, "err");
        registrarLog("faca3d", "erro modulos: " + erroMods.message);
        return;
      }
      iniciar();
    });
  });
})();
