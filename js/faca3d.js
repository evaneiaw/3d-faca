/* FACA 3D -" controlador da interface (3D).
 *
 * O hub carrega apenas este arquivo. Ele carrega os submódulos, o Three.js
 * local, lê a geometria real do documento e monta a dobra 3D.
 *
 * A interface é intencionalmente mínima: a faca ocupa a tela, "Dobrar" anima
 * a montagem e o controle de ângulo permite explorar a dobra.
 */
(function () {
  "use strict";

  var VERSAO = "0.8.2";

  /* Costura de micro-falhas do desenho (picotes nas bases das abas): a borda
   * de um painel fica com um vão pequeno e o painel deixa de ser face. Até
   * este limite a ponta solta é emendada por uma reta curta que não cruza
   * nenhuma linha existente. 0 desliga (o padrão do motor). */
  var COSTURA_MM = 2.5;
  /* Funciona dos dois jeitos: injetado pelo hub (raiz da extensão) ou aberto
   * como painel próprio. */
  var BASE = (function () {
    var href = String(location.href).replace(/[?#].*$/, "");
    var corte = href.lastIndexOf("/");
    return corte >= 0 ? href.slice(0, corte + 1) : "";
  })();
  var MODULOS = [
    "js/core/protocol.js",
    "js/core/units.js",
    "js/core/geometry-utils.js",
    "js/core/path-parser.js",
    "js/core/contour-builder.js",
    "js/core/face-detector.js",
    "js/core/topology.js",
    "js/core/geometry-engine.js",
    "js/core/structural-lines.js",
    "js/core/hinge-audit.js",
    "js/core/face-subdivision.js",
    "js/view/three3d.js",
    "js/view/artes.js",
    "js/view/diagnostico.js"
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
    angulo: 90,
    perfil: null,
    faceSelecionada: null,
    facesSelecionadas: [],
    sinalFace: 1,
    teclasMod: { ctrl: false, shift: false },
    modoArte: "ambas",
    espelharInterna: false,
    artesInfo: null,
    artesMapa: null,
    offsetArte: null,
    avisosArtes: [],
    carregandoArtes: null,
    diag: null,
    diagAberto: false,
    docNomeAtual: null,
    ultimaLeitura: 0,
    /* Base fixa escolhida manualmente (id da face) e assinatura da geometria
     * em que ela foi escolhida. Se a faca mudar, a base é descartada. */
    baseFixa: null,
    assinaturaGeo: "",
    modoBase: false,
    baseCandidata: null,
    dobrasSalvas: null
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
      csInterface.evalScript("faca3dLog(" + args + ")", function () {});
    } catch (e) {}
  }
  // Expõe o log para os módulos de visualização (three3d) diagnosticarem o
  // mapeamento de arte sem depender do console do CEP.
  F.log = registrarLog;

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

  /* Chama uma função do faca3d.jsx que ainda não tem wrapper no host.jsx
   * (faca3dArtes / faca3dExportarArte). Carrega o .jsx, executa e reinstala os
   * wrappers do host para a próxima chamada não cair na função da ferramenta. */
  function chamarArte(nomeFn, args) {
    return new Promise(function (resolve, reject) {
      if (!csInterface) {
        reject(new Error("CSInterface não inicializado."));
        return;
      }
      var raizExt = "";
      try {
        raizExt = csInterface.getSystemPath(SystemPath.EXTENSION) || "";
      } catch (e) {}
      var argStr = (args || [])
        .map(function (a) {
          return JSON.stringify(a);
        })
        .join(", ");
      var script =
        "(function(){ try { carregarFerramenta(" + JSON.stringify("faca3d") + ", " +
        JSON.stringify(raizExt) + "); $.evalFile(arquivoFerramenta(" +
        JSON.stringify(raizExt) + ")); return " +
        nomeFn + "(" + argStr + "); } catch (e) { return " +
        JSON.stringify("F3D|1|ERRO\nCODIGO=JS\nMENSAGEM=") + " + (e && e.message ? e.message : e);" +
        " } finally { try { instalarWrappers(); } catch (e2) {} } })()";
      csInterface.evalScript(script, function (result) {
        if (result === "EvalScript error.") reject(new Error("Erro no ExtendScript."));
        else resolve(result);
      });
    });
  }

  function desescapar(v) {
    var s = String(v === null || v === undefined ? "" : v);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch !== "\\") {
        out += ch;
        continue;
      }
      var prox = s.charAt(i + 1);
      if (prox === "\\") { out += "\\"; i++; }
      else if (prox === "e") { out += "="; i++; }
      else if (prox === "n") { out += "\n"; i++; }
      else if (prox === "r") { out += "\r"; i++; }
      else out += ch;
    }
    return out;
  }

  function lerLinhas(resposta) {
    var mapa = {};
    var listas = {};
    var linhas = String(resposta || "").split(/\r?\n/);
    for (var i = 0; i < linhas.length; i++) {
      var linha = linhas[i];
      if (!linha || linha.indexOf("F3D|") === 0 || linha === "END") continue;
      var pos = linha.indexOf("=");
      if (pos < 0) continue;
      var chave = linha.slice(0, pos);
      var valor = linha.slice(pos + 1);
      if (chave === "ARTBOARD" || chave === "CAMADA" || chave === "ARQUIVO" || chave === "ERRO" || chave === "ARTE_CAMADA") {
        if (!listas[chave]) listas[chave] = [];
        listas[chave].push(valor.split("\t"));
      } else {
        mapa[chave] = desescapar(valor);
      }
    }
    mapa.listas = listas;
    return mapa;
  }

  function numero(v) {
    var n = Number(v);
    return isFinite(n) ? n / 10000 : 0;
  }

  /* Caixa do DESENHO (itens de arte) dentro da artboard, normalizada em
   * [0,1] com v=0 na base — a mesma convencao da UV.
   * Se a arte cobre a artboard inteira (ou nao ha medida), devolve null e o
   * mapeamento continua usando o retangulo da artboard. */
  function caixaConteudo(arq, rect) {
    if (!arq || !arq.arte || !rect) return null;
    var larg = rect.right - rect.left;
    var alt = rect.top - rect.bottom;
    if (!(larg > 0) || !(alt > 0)) return null;
    var u0 = (arq.arte.left - rect.left) / larg;
    var u1 = (arq.arte.right - rect.left) / larg;
    var v0 = (arq.arte.bottom - rect.bottom) / alt;
    var v1 = (arq.arte.top - rect.bottom) / alt;
    if (u0 > u1) { var tu = u0; u0 = u1; u1 = tu; }
    if (v0 > v1) { var tv = v0; v0 = v1; v1 = tv; }
    if (u0 < 0) u0 = 0;
    if (v0 < 0) v0 = 0;
    if (u1 > 1) u1 = 1;
    if (v1 > 1) v1 = 1;
    if (!(u1 - u0 > 0.001) || !(v1 - v0 > 0.001)) return null;
    // Ja cobre praticamente tudo: nao precisa esticar.
    if (u0 < 0.02 && v0 < 0.02 && u1 > 0.98 && v1 > 0.98) return null;
    return { u0: u0, v0: v0, u1: u1, v1: v1 };
  }

  /* O ExtendScript devolve o artboard em pontos; os polígonos das faces vêm do
   * motor geométrico em milímetros. Converte o retângulo para mm. */
  function ptParaMm(v) {
    var fator = F.units && F.units.MM_POR_PT ? F.units.MM_POR_PT : 25.4 / 72;
    return Number(v) * fator;
  }

  function lerArtesDoDocumento() {
    return chamarArte("faca3dArtes", []).then(function (resposta) {
      registrarLog("faca3d", "artes: raw faca3dArtes=" + String(resposta).replace(/\r?\n/g, " | ").slice(0, 500));
      var dados = lerLinhas(resposta);
      var lista = dados.listas.ARTBOARD || [];
      var artboards = [];
      for (var i = 0; i < lista.length; i++) {
        var c = lista[i];
        artboards.push({
          indice: Number(c[0]),
          nome: desescapar(c[1] || ""),
          rect: {
            left: ptParaMm(numero(c[2])),
            top: ptParaMm(numero(c[3])),
            right: ptParaMm(numero(c[4])),
            bottom: ptParaMm(numero(c[5]))
          }
        });
      }
      var camadas = [];
      var listaCamadas = dados.listas.CAMADA || [];
      for (var j = 0; j < listaCamadas.length; j++) {
        camadas.push({
          nome: desescapar(listaCamadas[j][0] || ""),
          visivel: listaCamadas[j][1] === "1",
          itens: Number(listaCamadas[j][2] || 0),
          tecnica: listaCamadas[j][3] === "1"
        });
      }
      var camadasArte = [];
      var listaArte = dados.listas.ARTE_CAMADA || [];
      for (var k = 0; k < listaArte.length; k++) {
        var ca = listaArte[k];
        camadasArte.push({
          nome: desescapar(ca[1] || ""),
          visivel: ca[2] === "1",
          bloqueada: ca[3] === "1",
          itens: Number(ca[4] || 0),
          rect: ca.length >= 9 && ca[5] !== ""
            ? {
                left: ptParaMm(numero(ca[5])),
                top: ptParaMm(numero(ca[6])),
                right: ptParaMm(numero(ca[7])),
                bottom: ptParaMm(numero(ca[8]))
              }
            : null
        });
      }
      var faca = null;
      if (dados.FACA) {
        var cf = String(dados.FACA).split("\t");
        if (cf.length >= 4) {
          faca = {
            left: ptParaMm(numero(cf[0])),
            top: ptParaMm(numero(cf[1])),
            right: ptParaMm(numero(cf[2])),
            bottom: ptParaMm(numero(cf[3]))
          };
        }
      }
      return {
        doc: dados.DOC || "",
        temp: dados.TEMP || "",
        artboards: artboards,
        camadas: camadas,
        camadasArte: camadasArte,
        arteQtd: Number(dados.ARTE_QTD || 0),
        faca: faca
      };
    });
  }

  function pastaArte(dados) {
    var base = dados && dados.temp ? dados.temp : "";
    var chave = String((dados && dados.doc) || "doc")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(-40);
    return base + "/FACA3D/faca3d_arte/" + (chave || "doc");
  }

  function aplicarArtes(mapa, avisos, offset) {
    estado.artesMapa = mapa || null;
    estado.avisosArtes = avisos || [];
    if (offset) estado.offsetArte = offset;
    if (!estado.viewer3d) return;
    var dados = {
      externa: mapa ? mapa.externa || null : null,
      interna: mapa ? mapa.interna || null : null,
      offset: estado.offsetArte
    };
    estado.viewer3d.definirArtes(dados, {
      modo: estado.modoArte,
      espelharInterna: estado.espelharInterna
    });
    atualizarNotaArtes();
  }

  function atualizarNotaArtes() {
    var nota = el("faca3dNotaArtes");
    if (!nota) return;
    var mapa = estado.artesMapa;
    var info = estado.artesInfo;
    var linhas = [];
    if (mapa && (mapa.externa || mapa.interna)) {
      var nomes = [];
      if (mapa.externa) nomes.push("externa: \"" + mapa.externa.nome + "\"");
      if (mapa.interna) nomes.push("interna: \"" + mapa.interna.nome + "\"");
      linhas.push("Arte " + nomes.join(" · "));
    } else {
      linhas.push("Sem arte: exibindo somente a estrutura da faca.");
    }
    var avisos = estado.avisosArtes || [];
    for (var i = 0; i < avisos.length; i++) linhas.push(avisos[i]);
    nota.textContent = linhas.join(" ");
    var chk = el("faca3dEspelharInterna");
    if (chk) chk.disabled = !(mapa && mapa.interna);
  }

  function carregarArtes() {
    return Promise.resolve(null);
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
    if (window.THREE && window.THREE.OrbitControls) {
      cb(null);
      return;
    }
    function carregarControles(erro) {
      if (erro) {
        cb(erro);
        return;
      }
      if (window.THREE.OrbitControls) {
        cb(null);
        return;
      }
      carregarScript(BASE + "js/vendor/OrbitControls.js?v=" + F.build, cb);
    }
    if (window.THREE) {
      carregarControles(null);
      return;
    }
    carregarScript(BASE + "js/vendor/three.min.js?v=" + F.build, carregarControles);
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
    fecharDiagnostico();
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
        if (info) info.textContent = texto + " · esquerdo gira · direito move · roda zoom";
      },
      aoSelecionarFace: aoSelecionarFace
    });
    return estado.viewer3d;
  }

  function aoSelecionarFace(face) {
    if (estado.modoBase) {
      // Em modo de escolha da base, o clique no 3D define o painel candidato.
      if (face !== null && face !== undefined) escolherPainelBase(face, "3d");
      return;
    }
    estado.faceSelecionada = face === null || face === undefined ? null : Number(face);
    estado.facesSelecionadas = estado.viewer3d ? estado.viewer3d.facesSelecionadas() : [];
    if (estado.faceSelecionada !== null) cancelarAnimacao();
    if (estado.faceSelecionada !== null && estado.viewer3d) {
      estado.sinalFace = estado.viewer3d.sinalDaFace(estado.faceSelecionada);
      definirAnguloNaTela(estado.viewer3d.anguloDaFace(estado.faceSelecionada));
    } else if (estado.viewer3d) {
      estado.sinalFace = 1;
      definirAnguloNaTela(estado.viewer3d.anguloGlobal());
    }
    atualizarFaceUI();
  }

  function rotuloStatus(status) {
    return {
      dobra: "dobra",
      rigida: "rígido",
      "sem-par": "sem par de faces",
      "sem-face": "sem face",
      "sem-aresta": "sem aresta",
      multipla: "múltiplas faces",
      fora: "fora do componente"
    }[status] || status;
  }

  function resumoVincos(m) {
    var cont = { dobra: 0, rigida: 0, "sem-par": 0, "sem-face": 0, "sem-aresta": 0, multipla: 0, fora: 0 };
    var vincos = (m && m.vincos) || [];
    for (var i = 0; i < vincos.length; i++) {
      if (cont[vincos[i].status] !== undefined) cont[vincos[i].status]++;
    }
    return (
      vincos.length + " vincos: " + cont.dobra + " dobram · " + cont.rigida + " rígidos · " +
      (cont["sem-par"] + cont["sem-face"]) + " sem par · " + cont.multipla + " múltiplos · " +
      cont.fora + " fora"
    );
  }

  function mostrarDetalheVinco(rec) {
    var info = el("faca3dDiagInfo");
    if (!info) return;
    if (!rec) {
      info.textContent = "Clique em um vinco para ver o motivo da classificação.";
      return;
    }
    var linhas = [];
    linhas.push(
      "Vinco V" + rec.indice + " · " + rec.spot + " · " + rec.segmentos + " segmento(s) · " +
        rec.comprimentoMm + " mm · " + (rec.curvo ? "curvo" : "reto")
    );
    linhas.push(
      "Faces: " + (rec.faces.length ? rec.faces.join(", ") : "nenhuma") +
        " · status: " + rotuloStatus(rec.status).toUpperCase()
    );
    linhas.push("Motivo: " + rec.motivo);
    if (rec.parPrincipal) {
      linhas.push(
        "Par: faces " + rec.parPrincipal.replace(":", "–") +
          (rec.eixo ? " · eixo (" + rec.eixo.p1.x.toFixed(1) + ", " + rec.eixo.p1.y.toFixed(1) + ")→(" +
            rec.eixo.p2.x.toFixed(1) + ", " + rec.eixo.p2.y.toFixed(1) + ") · " +
            rec.eixo.comprimentoMm.toFixed(1) + " mm" : "") +
          (rec.status === "dobra" ? " · sentido " + (rec.sinal > 0 ? "+" : "−") : "")
      );
    }
    if (rec.facePai !== undefined && rec.facePai !== null) {
      linhas.push(
        "Hierarquia: face " + rec.facePai + " → " + rec.faceFilho +
          (rec.status === "dobra" ? " · sinal " + (rec.sinal > 0 ? "+" : "−") : "")
      );
    }
    if (rec.estrutural) {
      var e = rec.estrutural;
      var det =
        "Estrutural: L" + e.id + " · " + e.comprimentoMm + " mm (original " +
        e.comprimentoOriginalMm + " mm)";
      if (e.conexoes.length) {
        det += " · " + e.conexoes.length + " conexão(ões) virtual(is): " +
          e.conexoes.map(function (c) { return c.gapMm + " mm " + c.tipo; }).join(", ");
      }
      if (e.extensoes.length) {
        det += " · extensão: " +
          e.extensoes.map(function (x) {
            return x.gapMm + " mm até " + (x.alvoClasse === "cut" ? "corte " : "vinco ") + x.alvoId;
          }).join(", ");
      }
      if (e.rejeicoes.length) det += " · " + e.rejeicoes.length + " conexão(ões) rejeitada(s)";
      linhas.push(det);
    }
    info.textContent = linhas.join("\n");
  }

  function abrirDiagnostico() {
    if (!estado.res || !estado.viewer3d) {
      setStatus("Leia a faca antes de abrir o diagnóstico.", "err");
      return;
    }
    var m = estado.viewer3d.auditoria();
    if (!m) return;
    if (!estado.diag) {
      estado.diag = F.view.diagnostico.criar({
        host: el("faca3dDiagCanvas"),
        aoSelecionar: mostrarDetalheVinco,
        aoSelecionarFace: function (faceId) {
          escolherPainelBase(faceId, "diagnostico");
        }
      });
    }
    // Precisa estar visível ANTES de desenhar: o canvas oculto tem tamanho 0.
    el("faca3dDiag").hidden = false;
    estado.diagAberto = true;
    estado.diag.desenhar(estado.res, m);
    estado.diag.definirModoBase(estado.modoBase);
    estado.diag.definirCandidatoBase(estado.modoBase ? estado.baseCandidata : null);
    el("faca3dDiagResumo").textContent = resumoVincos(m);
    mostrarDetalheVinco(null);
    atualizarBaseUI();
    F.diagAtual = estado.diag;
    requestAnimationFrame(function () {
      if (estado.diag && estado.diagAberto && estado.res) {
        estado.diag.desenhar(estado.res, m);
      }
    });
  }

  function fecharDiagnostico() {
    var caixa = el("faca3dDiag");
    if (caixa) caixa.hidden = true;
    estado.diagAberto = false;
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
    if (estado.perfil) texto += " · perfil: todas as dobras 90°";
    var cruz = estado.viewer3d && estado.viewer3d.cruzamentosAtuais
      ? estado.viewer3d.cruzamentosAtuais()
      : 0;
    if (cruz) texto += " · " + cruz + " contato(s)/cruzamento(s) entre faces (ver diagnóstico)";
    texto += ".";
    texto += " Fonte: camada FACA.";
    var infoBase = baseInfoAtual();
    if (infoBase) {
      texto +=
        " Base fixa: painel " + infoBase.raiz +
        (infoBase.manual ? " (escolhida no diagnóstico)" : " (automática)") + ".";
    }
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

  /* Estado inicial e do botão Reset: embalagem planificada (0° em todas as faces). */
  function aplicarPlanificado() {
    if (!estado.viewer3d) return;
    var zero = {};
    var faces = estado.viewer3d.articulaveis();
    for (var i = 0; i < faces.length; i++) zero[faces[i]] = 0;
    estado.viewer3d.definirAngulos(zero, "planificado · faces a 0°");
    definirAnguloNaTela(0);
  }

  function cancelarAnimacao() {
    if (estado.animacao !== null) {
      cancelAnimationFrame(estado.animacao);
      estado.animacao = null;
    }
  }

  function animarDesdobramento(duracao) {
    cancelarAnimacao();
    if (!estado.viewer3d) return;
    var de = estado.viewer3d.angulosAtuais();
    var algum = false;
    for (var k in de) {
      if (de.hasOwnProperty(k) && de[k] > 0.5) {
        algum = true;
        break;
      }
    }
    estado.faceSelecionada = null;
    estado.facesSelecionadas = [];
    estado.sinalFace = 1;
    atualizarFaceUI();
    if (!algum) {
      estado.viewer3d.definirAngulos(de, "desdobrado · faces a 0°");
      definirAnguloNaTela(0);
      return;
    }
    var inicio = performance.now();
    function passo(agora) {
      var t = Math.min(1, (agora - inicio) / duracao);
      var e = t * t * (3 - 2 * t);
      var mapa = {};
      for (var k2 in de) {
        if (de.hasOwnProperty(k2)) mapa[k2] = de[k2] * (1 - e);
      }
      try {
        estado.viewer3d.definirAngulos(mapa, "desdobrando · faces a 0°");
      } catch (erro) {
        estado.animacao = null;
        return;
      }
      if (t < 1) {
        estado.animacao = requestAnimationFrame(passo);
      } else {
        estado.animacao = null;
        var zero = {};
        for (var k3 in de) {
          if (de.hasOwnProperty(k3)) zero[k3] = 0;
        }
        estado.viewer3d.definirAngulos(zero, "desdobrado · faces a 0°");
        definirAnguloNaTela(0);
      }
    }
    estado.animacao = requestAnimationFrame(passo);
  }

  function animarMontagem(duracao) {
    cancelarAnimacao();
    if (!estado.viewer3d || !estado.perfil) return;
    // Só sai da vista "baixo" (plano 0°) quando ela é a inicial; se o usuário
    // escolheu outra câmera, mantém a escolha durante a dobra.
    var selMontagem = el("faca3dVista");
    var vistaMontagem = selMontagem ? selMontagem.value : "";
    if (!vistaMontagem || vistaMontagem === "baixo") {
      estado.viewer3d.definirVista("perspectiva_direita");
      if (selMontagem) selMontagem.value = "perspectiva_direita";
    }
    var alvo = estado.perfil;
    var inicio = performance.now();
    function passo(agora) {
      var t = Math.min(1, (agora - inicio) / duracao);
      var e = t * t * (3 - 2 * t);
      var mapa = {};
      for (var k in alvo) {
        if (alvo.hasOwnProperty(k)) mapa[k] = alvo[k] * e;
      }
      try {
        estado.viewer3d.definirAngulos(mapa);
      } catch (erro) {
        estado.animacao = null;
        return;
      }
      if (t < 1) {
        estado.animacao = requestAnimationFrame(passo);
      } else {
        estado.animacao = null;
        estado.viewer3d.definirAngulos(alvo);
        definirAnguloNaTela(90);
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
    // Assinatura da geometria: a base fixa manual só vale para a mesma faca.
    var assinatura =
      F.geometry && F.geometry.engine && F.geometry.engine.assinatura
        ? F.geometry.engine.assinatura(res)
        : "";
    if (estado.baseFixa !== null && assinatura !== estado.assinaturaGeo) {
      estado.baseFixa = null;
      estado.modoBase = false;
      estado.baseCandidata = null;
      esconderBarraBase();
      setStatus("A geometria da faca mudou: base fixa anterior descartada (voltou à automática).", "err");
    }
    estado.assinaturaGeo = assinatura;
    if (estado.modoBase) {
      estado.modoBase = false;
      estado.baseCandidata = null;
      esconderBarraBase();
      if (estado.diag) estado.diag.definirModoBase(false);
    }
    viewer.desenhar(res, { raiz: estado.baseFixa });
    F.viewer3dAtual = viewer;
    var m = viewer.montagem();
    var caixaPt = res.geometria && res.geometria.caixaPt;
    if (caixaPt) {
      estado.offsetArte = { x: ptParaMm(caixaPt.minX), y: ptParaMm(caixaPt.minY) };
    }
    estado.perfil = viewer.perfilPadrao ? viewer.perfilPadrao() : null;
    estado.faceSelecionada = null;
    estado.facesSelecionadas = [];
    estado.sinalFace = 1;
    montarListaFaces(false);
    atualizarFaceUI();
    atualizarBaseUI();
    var vistaSel = el("faca3dVista");
    if (vistaSel) vistaSel.value = "baixo";

    // Aplica o perfil para medir contatos e mostrar a nota no estado final.
    if (estado.perfil) viewer.definirAngulos(estado.perfil);
    montarNota(m, total);
    aplicarPlanificado();
    viewer.definirVista("baixo");

    if (estado.diagAberto && estado.diag) {
      estado.diag.desenhar(res, m);
      el("faca3dDiagResumo").textContent = resumoVincos(m);
      mostrarDetalheVinco(null);
    }

    carregarArtes();

    // Restaura os ângulos que o usuário salvou para esta faca (se existirem).
    estado.dobrasSalvas = null;
    atualizarBotoesDobra();
    restaurarDobras(true);
  }

  function montarListaFaces(paraBase) {
    var sel = el("faca3dFaceLista");
    if (!sel || !estado.viewer3d) return;
    var faces;
    if (paraBase) {
      var m = estado.viewer3d.montagem();
      faces = m && m.facesMontadas ? m.facesMontadas.slice() : [];
    } else {
      faces = estado.viewer3d.articulaveis();
    }
    var arts = estado.viewer3d.articulacoes ? estado.viewer3d.articulacoes() : [];
    var pai = {};
    for (var i = 0; i < arts.length; i++) pai[arts[i].faceFilho] = arts[i].facePai;
    var info = baseInfoAtual();
    var html =
      '<option value="">' + (paraBase ? "escolha o painel base" : "todas as dobras") + "</option>";
    for (var j = 0; j < faces.length; j++) {
      var f = faces[j];
      var extra;
      if (paraBase) {
        extra = info && info.raiz === f
          ? " (base atual)"
          : pai[f] === undefined ? "" : " (de " + pai[f] + ")";
      } else {
        extra = pai[f] === undefined ? "" : " (de " + pai[f] + ")";
      }
      html +=
        '<option value="' + f + '">' + (paraBase ? "painel " : "face ") + f + extra + "</option>";
    }
    sel.innerHTML = html;
  }

  function atualizarFaceUI() {
    var rotulo = el("faca3dFaceAtual");
    var lista = estado.facesSelecionadas || [];
    var b = el("faca3dBtnSentido");
    if (rotulo) {
      if (!lista.length) {
        rotulo.textContent = "todas as dobras";
      } else if (lista.length === 1) {
        var face = lista[0];
        var pai = null;
        var arts = estado.viewer3d && estado.viewer3d.articulacoes ? estado.viewer3d.articulacoes() : [];
        for (var i = 0; i < arts.length; i++) {
          if (arts[i].faceFilho === face) {
            pai = arts[i].facePai;
            break;
          }
        }
        rotulo.textContent = pai === null ? "face " + face : "face " + face + " (de " + pai + ")";
      } else {
        rotulo.textContent = lista.length + " faces · " + lista.join(", ");
      }
    }
    var seletor = el("faca3dFaceLista");
    if (seletor && seletor.options.length && !estado.modoBase) {
      var primeira = seletor.options[0];
      primeira.textContent =
        lista.length > 1 ? lista.length + " faces · " + lista.join(", ") : "todas as dobras";
      seletor.value = lista.length === 1 ? String(lista[0]) : "";
    }
    if (b) {
      b.disabled = !lista.length;
      b.textContent = estado.sinalFace > 0 ? "Sentido +" : "Sentido -";
    }
  }

  /* ------------------------------------------------------ base fixa (3D) */

  function baseInfoAtual() {
    return estado.viewer3d && estado.viewer3d.base ? estado.viewer3d.base() : null;
  }

  function facesMontadasAtuais() {
    var m = estado.viewer3d && estado.viewer3d.montagem ? estado.viewer3d.montagem() : null;
    return m && m.facesMontadas ? m.facesMontadas.slice() : [];
  }

  function atualizarBaseUI() {
    var info = baseInfoAtual();
    var rotulo = el("faca3dDiagBase");
    if (rotulo) {
      if (!info) {
        rotulo.textContent = "Base fixa atual: —";
        rotulo.className = "faca3d-diag-base";
      } else if (info.manual) {
        rotulo.textContent = "Base fixa atual: Painel " + info.raiz + " (manual)";
        rotulo.className = "faca3d-diag-base is-manual";
      } else {
        rotulo.textContent = "Base fixa atual: Painel " + info.raiz + " (automática)";
        rotulo.className = "faca3d-diag-base";
      }
    }
    var auto = el("faca3dBtnBaseAuto");
    if (auto) auto.disabled = !info || !info.manual;
    if (estado.diag) {
      estado.diag.definirBaseAtual(info ? info.raiz : null);
      estado.diag.definirCandidatoBase(estado.modoBase ? estado.baseCandidata : null);
    }
  }

  function mostrarBarraBase(texto, comConfirmar) {
    var bar = el("faca3dBaseBar");
    var txt = el("faca3dBaseBarText");
    var ok = el("faca3dBaseBarOk");
    if (!bar || !txt) return;
    txt.textContent = texto;
    bar.hidden = false;
    if (ok) ok.disabled = !comConfirmar;
  }

  function esconderBarraBase() {
    var bar = el("faca3dBaseBar");
    if (bar) bar.hidden = true;
  }

  function entrarModoBase() {
    if (!estado.res || !estado.viewer3d) {
      setStatus("Leia a faca antes de escolher a base fixa.", "err");
      return;
    }
    if (estado.modoBase) return;
    estado.modoBase = true;
    estado.baseCandidata = null;
    montarListaFaces(true);
    if (estado.viewer3d.selecionarFace) estado.viewer3d.selecionarFace(null);
    if (estado.diag) {
      estado.diag.definirModoBase(true);
      estado.diag.definirCandidatoBase(null);
    }
    mostrarBarraBase(
      "Escolha o painel que ficará imóvel: clique no painel 3D, clique num painel no diagnóstico " +
        "ou use a lista Face. Depois confirme.",
      false
    );
    setStatus("Escolha da base fixa: clique no painel desejado.", "ok");
  }

  function escolherPainelBase(faceId, origem) {
    if (!estado.modoBase) return;
    var id = faceId === null || faceId === undefined ? null : Number(faceId);
    if (id === null || !isFinite(id)) return;
    if (facesMontadasAtuais().indexOf(id) < 0) {
      setStatus("O painel " + id + " não faz parte da montagem.", "err");
      return;
    }
    var jaEra = estado.baseCandidata === id;
    estado.baseCandidata = id;
    if (!jaEra && estado.viewer3d && estado.viewer3d.selecionarFace) {
      estado.viewer3d.selecionarFace(id);
    }
    if (estado.diag) estado.diag.definirCandidatoBase(id);
    if (origem !== "lista") {
      var sel = el("faca3dFaceLista");
      if (sel) sel.value = String(id);
    }
    mostrarBarraBase("Definir Painel " + id + " como base fixa?", true);
  }

  function confirmarBase() {
    if (!estado.modoBase || estado.baseCandidata === null) return;
    var id = estado.baseCandidata;
    if (!estado.viewer3d || !estado.viewer3d.definirBase) return;
    var r = estado.viewer3d.definirBase(id);
    if (!r || !r.ok) {
      var motivo = r && r.motivo ? r.motivo : "Não foi possível usar esse painel como base.";
      mostrarBarraBase(motivo + " Escolha outro painel ou cancele.", false);
      setStatus(motivo, "err");
      return;
    }
    estado.baseFixa = id;
    estado.modoBase = false;
    estado.baseCandidata = null;
    esconderBarraBase();
    if (estado.diag) {
      estado.diag.definirModoBase(false);
      estado.diag.definirCandidatoBase(null);
    }
    montarListaFaces(false);
    atualizarFaceUI();
    atualizarBaseUI();
    var faces = estado.res && estado.res.faces ? estado.res.faces.faces.length : 0;
    montarNota(estado.viewer3d.montagem(), faces);
    setStatus("Base fixa: Painel " + id + " (fica imóvel ao dobrar).", "ok");
    registrarLog("faca3d", "base fixa manual = painel " + id);
  }

  function cancelarBase() {
    estado.modoBase = false;
    estado.baseCandidata = null;
    esconderBarraBase();
    if (estado.diag) {
      estado.diag.definirModoBase(false);
      estado.diag.definirCandidatoBase(null);
    }
    if (estado.viewer3d && estado.viewer3d.selecionarFace) estado.viewer3d.selecionarFace(null);
    montarListaFaces(false);
    atualizarBaseUI();
    setStatus("Escolha da base fixa cancelada.", "ok");
  }

  function voltarBaseAutomatica() {
    if (!estado.viewer3d || !estado.viewer3d.definirBaseAutomatica) return;
    var r = estado.viewer3d.definirBaseAutomatica();
    if (!r || !r.ok) {
      setStatus("Não foi possível voltar à base automática.", "err");
      return;
    }
    estado.baseFixa = null;
    estado.modoBase = false;
    estado.baseCandidata = null;
    esconderBarraBase();
    if (estado.diag) {
      estado.diag.definirModoBase(false);
      estado.diag.definirCandidatoBase(null);
    }
    montarListaFaces(false);
    atualizarFaceUI();
    atualizarBaseUI();
    var faces = estado.res && estado.res.faces ? estado.res.faces.faces.length : 0;
    montarNota(estado.viewer3d.montagem(), faces);
    setStatus("Base automática: Painel " + r.raiz + ".", "ok");
    registrarLog("faca3d", "base fixa = automatica (painel " + r.raiz + ")");
  }

  /* ------------------------------------------- ângulos salvos (por faca) */

  function chaveDobrasAtual() {
    if (!estado.res || !F.geometry || !F.geometry.engine || !F.geometry.engine.chaveDobra) return "";
    var chave = F.geometry.engine.chaveDobra(estado.res);
    var doc = String(estado.docNomeAtual || "faca").replace(/[^A-Za-z0-9]+/g, "-");
    if (doc.length > 40) doc = doc.slice(0, 40);
    if (!doc) doc = "faca";
    return doc + "-" + chave;
  }

  function contarDobras(cfg) {
    var n = 0;
    if (!cfg || !cfg.angulos) return 0;
    for (var f in cfg.angulos) {
      if (cfg.angulos.hasOwnProperty(f)) n++;
    }
    return n;
  }

  function atualizarBotoesDobra() {
    var b = el("faca3dBtnRestaurarDobra");
    if (!b) return;
    if (estado.dobrasSalvas) {
      b.title = "Restaurar os ângulos salvos (" + contarDobras(estado.dobrasSalvas) + " dobra(s))";
    } else {
      b.title = "Restaurar os ângulos salvos desta faca";
    }
  }

  function coletarDobras() {
    if (!estado.viewer3d) return null;
    var cfg = {
      versao: 1,
      documento: estado.docNomeAtual || "",
      chave: chaveDobrasAtual(),
      anguloGlobal: estado.viewer3d.anguloGlobal ? estado.viewer3d.anguloGlobal() : 0,
      angulos: estado.viewer3d.angulosAtuais ? estado.viewer3d.angulosAtuais() : {},
      sinais: {},
      base: null,
      salvoEm: new Date().toISOString()
    };
    var faces = estado.viewer3d.articulaveis ? estado.viewer3d.articulaveis() : [];
    for (var i = 0; i < faces.length; i++) {
      var s = estado.viewer3d.sinalDaFace ? estado.viewer3d.sinalDaFace(faces[i]) : 1;
      if (s === -1) cfg.sinais[faces[i]] = -1;
    }
    var info = baseInfoAtual();
    if (info) cfg.base = { raiz: info.raiz, manual: !!info.manual };
    return cfg;
  }

  function aplicarConfigDobra(cfg) {
    if (!cfg || !estado.viewer3d || !estado.viewer3d.aplicarDobras) return false;
    // A base fixa salva é aplicada antes: os ângulos são relativos à árvore.
    if (cfg.base && cfg.base.manual && cfg.base.raiz !== null && cfg.base.raiz !== undefined) {
      var r = estado.viewer3d.definirBase(cfg.base.raiz);
      if (r && r.ok) estado.baseFixa = cfg.base.raiz;
    }
    if (!estado.viewer3d.aplicarDobras(cfg, "ângulos salvos desta faca")) return false;
    estado.modoBase = false;
    estado.baseCandidata = null;
    esconderBarraBase();
    atualizarBaseUI();
    definirAnguloNaTela(estado.viewer3d.anguloGlobal ? estado.viewer3d.anguloGlobal() : 0);
    return true;
  }

  function salvarDobras() {
    if (!estado.res || !estado.viewer3d) {
      setStatus("Leia a faca antes de salvar os ângulos.", "err");
      return;
    }
    var cfg = coletarDobras();
    var chave = cfg && cfg.chave;
    if (!chave) {
      setStatus("Não foi possível identificar esta faca para salvar.", "err");
      return;
    }
    var n = contarDobras(cfg);
    chamarArte("faca3dSalvarDobras", [chave, JSON.stringify(cfg)])
      .then(function (r) {
        if (String(r) === "ok") {
          estado.dobrasSalvas = cfg;
          atualizarBotoesDobra();
          setStatus("Ângulos salvos (" + n + " dobra(s) · " + chave + ").", "ok");
          registrarLog("faca3d", "angulos salvos chave=" + chave + " dobras=" + n);
        } else {
          setStatus("Não foi possível salvar os ângulos: " + r, "err");
        }
      })
      .catch(function (e) {
        setStatus("Erro ao salvar ângulos: " + (e && e.message ? e.message : e), "err");
      });
  }

  /* silencioso=true é a restauração automática ao ler a faca: não avisa
   * quando não há nada salvo. */
  function restaurarDobras(silencioso) {
    if (!estado.res || !estado.viewer3d) {
      if (!silencioso) setStatus("Leia a faca antes de restaurar os ângulos.", "err");
      return;
    }
    var chave = chaveDobrasAtual();
    if (!chave) return;
    chamarArte("faca3dLerDobras", [chave])
      .then(function (texto) {
        var cfg = null;
        if (texto) {
          try {
            cfg = JSON.parse(String(texto));
          } catch (e) {
            cfg = null;
          }
        }
        if (!cfg || !cfg.angulos) {
          estado.dobrasSalvas = null;
          atualizarBotoesDobra();
          if (!silencioso) setStatus("Nenhum ângulo salvo para esta faca.", "ok");
          return;
        }
        var ok = aplicarConfigDobra(cfg);
        estado.dobrasSalvas = cfg;
        atualizarBotoesDobra();
        if (ok) {
          var n = contarDobras(cfg);
          setStatus("Ângulos restaurados (" + n + " dobra(s)).", "ok");
          registrarLog("faca3d", "angulos restaurados chave=" + chave + " dobras=" + n);
        }
      })
      .catch(function (e) {
        if (!silencioso) {
          setStatus("Erro ao restaurar ângulos: " + (e && e.message ? e.message : e), "err");
        }
      });
  }

  function executarLeitura() {
    if (estado.ocupado) return;
    if (Date.now() - (estado.ultimaLeitura || 0) < 3000) return;
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
      .analisar({ escopo: "documento", lote: 200, tolerancias: { costuraMm: COSTURA_MM } })
      .then(function (res) {
        var sub = F.geometry.subdivisao ? F.geometry.subdivisao.subdividir(res) : res;
        estado.res = sub;
        var nome = sub.geometria.meta.documento || "-";
        el("faca3dDoc").textContent = nome;
		estado.docNomeAtual = nome;
        renderizar3D(sub);
        var m = estado.viewer3d && estado.viewer3d.montagem();
        var total = sub.faces.faces.length;
        var totalMs = new Date().getTime() - t0;
        var resumoTopo = sub.topologia && sub.topologia.resumo ? sub.topologia.resumo : {};
        var extraStatus =
          (resumoTopo.furos ? " · " + resumoTopo.furos + " furo(s)" : "") +
          (resumoTopo.costuras ? " · " + resumoTopo.costuras + " emenda(s)" : "");
        setStatus(
          "Faca lida: " + sub.geometria.caminhos.length + " caminhos · " +
            (m ? m.facesMontadas.length : 0) + " de " + total + " faces montadas" +
            extraStatus + " · " + totalMs + " ms",
          "ok"
        );
        registrarLog(
          "faca3d",
          "3d caminhos=" + res.geometria.caminhos.length +
            " faces=" + total +
            " montadas=" + (m ? m.facesMontadas.length : 0) +
            " furos=" + (resumoTopo.furos || 0) +
            " costuras=" + (resumoTopo.costuras || 0) +
            " tempo=" + totalMs + "ms"
        );
      })
      .catch(function (e) {
        var codigo = e && e.codigoProtocolo;
        var msg = e && e.message ? e.message : String(e);
        if (codigo === "SEM_DOC") {
          estado.res = null;
          el("faca3dDoc").textContent = "-";
          mostrarVazio(
            "Nenhum documento aberto",
            "Abra a faca no Illustrator e clique em Ler novamente."
          );
          setStatus("Nenhum documento aberto.", "err");
        } else if (codigo === "SEM_FACA") {
          estado.res = null;
          el("faca3dDoc").textContent = "-";
          mostrarVazio(
            "Camada FACA não encontrada",
            "A faca precisa estar na camada FACA. As demais camadas (arte, texto, anotações) não são interpretadas."
          );
          setStatus("Camada FACA não encontrada no documento.", "err");
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

  function verificarDocumento() {
    if (estado.ocupado) return;
    sendToHost("chamar", ["faca3dDocAtivo", []]).then(function (r) {
      var nome = String(r === null || r === undefined ? "" : r);
      if (!nome || nome === "EvalScript error." || nome === "undefined") {
        // Sem documento aberto: limpa a referência para reler ao reabrir.
        estado.docNomeAtual = null;
        return;
      }
      if (!estado.docNomeAtual) {
        estado.docNomeAtual = nome;
        if (!estado.res) executarLeitura();
        return;
      }
      if (nome === estado.docNomeAtual) return;
      estado.docNomeAtual = nome;
      executarLeitura();
    }).catch(function () {});
  }

  function travarBotoes(travar) {
    var ids = ["faca3dBtnLer", "faca3dBtnDobrar", "faca3dBtnDesdobrar", "faca3dBtnReset", "faca3dAngulo", "faca3dBtnDiag"];
    for (var i = 0; i < ids.length; i++) {
      var n = el(ids[i]);
      if (n) n.disabled = travar;
    }
    if (!travar) atualizarFaceUI();
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

  function fecharFerramenta() {
    cancelarAnimacao();
    if (estado.viewer3d) {
      try {
        estado.viewer3d.destruir();
      } catch (e) {}
      estado.viewer3d = null;
    }
    window.close();
  }

  function ligarEventos() {
    var btnFechar = el("faca3dBtnFechar");
    if (btnFechar) btnFechar.addEventListener("click", fecharFerramenta);
    var home = el("faca3dBtnHome");
    if (home) {
      home.addEventListener("click", fecharFerramenta);
    }
    el("faca3dBtnLer").addEventListener("click", executarLeitura);
    el("faca3dBtnDiag").addEventListener("click", function () {
      if (estado.diagAberto) fecharDiagnostico();
      else abrirDiagnostico();
    });
    var fecharDiag = el("faca3dDiagFechar");
    if (fecharDiag) fecharDiag.addEventListener("click", fecharDiagnostico);
    el("faca3dBtnDobrar").addEventListener("click", function () {
      if (!estado.viewer3d || !estado.perfil) return;
      estado.viewer3d.limparSelecao();
      estado.faceSelecionada = null;
      estado.facesSelecionadas = [];
      estado.sinalFace = 1;
      atualizarFaceUI();
      animarMontagem(1200);
    });
    el("faca3dBtnDesdobrar").addEventListener("click", function () {
      if (!estado.viewer3d) return;
      estado.viewer3d.limparSelecao();
      animarDesdobramento(1200);
    });
    el("faca3dBtnSentido").addEventListener("click", function () {
      if (!estado.facesSelecionadas.length || !estado.viewer3d) return;
      cancelarAnimacao();
      estado.sinalFace = estado.sinalFace > 0 ? -1 : 1;
      estado.viewer3d.definirSinais(estado.facesSelecionadas, estado.sinalFace);
      atualizarFaceUI();
    });
    el("faca3dAngulo").addEventListener("input", function () {
      cancelarAnimacao();
      var g = parseFloat(this.value) || 0;
      if (g >= 85 && g <= 95) g = 90;
      definirAnguloNaTela(g);
      if (!estado.viewer3d) return;
      if (estado.facesSelecionadas.length) {
        estado.viewer3d.definirArticulacoes(estado.facesSelecionadas, g, estado.sinalFace);
      } else {
        estado.viewer3d.definirAngulo(g);
      }
    });
    var espInput = el("faca3dEspessura");
    if (espInput) {
      espInput.addEventListener("input", function () {
        var v = parseFloat(this.value);
        if (isFinite(v) && v >= 0 && estado.viewer3d && estado.viewer3d.definirEspessura) {
          estado.viewer3d.definirEspessura(v);
        }
      });
    }
    el("faca3dBtnReset").addEventListener("click", function () {
      estado.viewer3d && estado.viewer3d.limparSelecao();
      estado.faceSelecionada = null;
      estado.facesSelecionadas = [];
      estado.sinalFace = 1;
      atualizarFaceUI();
      aplicarPlanificado();
      if (estado.viewer3d) estado.viewer3d.definirVista("baixo");
      var sel = el("faca3dVista");
      if (sel) sel.value = "baixo";
    });
    el("faca3dVista").addEventListener("change", function () {
      if (estado.viewer3d) estado.viewer3d.definirVista(this.value);
    });
    var arteModo = el("faca3dArteModo");
    if (arteModo) {
      arteModo.addEventListener("change", function () {
        estado.modoArte = this.value;
        if (estado.viewer3d) estado.viewer3d.definirArtes(null, { modo: estado.modoArte });
      });
    }
    var espelhar = el("faca3dEspelharInterna");
    if (espelhar) {
      espelhar.addEventListener("change", function () {
        estado.espelharInterna = this.checked;
        if (estado.viewer3d) {
          estado.viewer3d.definirArtes(null, { espelharInterna: estado.espelharInterna });
        }
      });
    }
    var btnArtes = el("faca3dBtnArtes");
    if (btnArtes) {
      btnArtes.addEventListener("click", function () {
        carregarArtes();
      });
    }
    document.addEventListener("keydown", function (e) {
      estado.teclasMod.ctrl = e.ctrlKey || e.metaKey;
      estado.teclasMod.shift = e.shiftKey;
    });
    document.addEventListener("keyup", function (e) {
      estado.teclasMod.ctrl = e.ctrlKey || e.metaKey;
      estado.teclasMod.shift = e.shiftKey;
    });
    el("faca3dFaceLista").addEventListener("change", function () {
      if (!estado.viewer3d) return;
      var valor = this.value;
      if (estado.modoBase) {
        if (valor !== "") escolherPainelBase(Number(valor), "lista");
        return;
      }
      var face = valor === "" ? null : Number(valor);
      var modo;
      if (estado.teclasMod.ctrl) modo = "alternar";
      else if (estado.teclasMod.shift) modo = "adicionar";
      cancelarAnimacao();
      estado.viewer3d.selecionarFace(face, modo);
    });

    var btnBaseDefinir = el("faca3dBtnBaseDefinir");
    if (btnBaseDefinir) btnBaseDefinir.addEventListener("click", entrarModoBase);
    var btnBaseAuto = el("faca3dBtnBaseAuto");
    if (btnBaseAuto) btnBaseAuto.addEventListener("click", voltarBaseAutomatica);
    var barraOk = el("faca3dBaseBarOk");
    if (barraOk) barraOk.addEventListener("click", confirmarBase);
    var barraCancelar = el("faca3dBaseBarCancel");
    if (barraCancelar) barraCancelar.addEventListener("click", cancelarBase);

    var btnSalvarDobra = el("faca3dBtnSalvarDobra");
    if (btnSalvarDobra) btnSalvarDobra.addEventListener("click", salvarDobras);
    var btnRestaurarDobra = el("faca3dBtnRestaurarDobra");
    if (btnRestaurarDobra) {
      btnRestaurarDobra.addEventListener("click", function () {
        restaurarDobras(false);
      });
    }
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

    // Painel independente: não reage a eventos de outras extensões.

    ligarEventos();
    // Rele o documento ativo quando ele mudar no Illustrator.
    try { window.addEventListener("focus", verificarDocumento); } catch (e) {}
    try { document.addEventListener("visibilitychange", function () {
      if (!document.hidden) verificarDocumento();
    }); } catch (e) {}
    try { setInterval(verificarDocumento, 5000); } catch (e) {}
    expandirPainel();
    definirAnguloNaTela(90);

    try {
      var vEl = document.getElementById("faca3dVersao");
      if (vEl) {
        var agora = new Date();
        var ts = agora.getFullYear() +
                 String(agora.getMonth() + 1).padStart(2, '0') +
                 String(agora.getDate()).padStart(2, '0') + "-" +
                 String(agora.getHours()).padStart(2, '0') +
                 String(agora.getMinutes()).padStart(2, '0');
        vEl.textContent = "v" + VERSAO + "-espessura-" + ts;
      }
    } catch (e) {}

    var extRoot = "";
    try {
      extRoot = csInterface.getSystemPath(SystemPath.EXTENSION) || "";
    } catch (e) {}

    // Como painel próprio não existe hub para registrar a ferramenta no host.
    function iniciarLeitura() {
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

    sendToHost("carregarFerramenta", ["faca3d", extRoot]).then(iniciarLeitura, iniciarLeitura);
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
