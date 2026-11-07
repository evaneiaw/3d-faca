// host.jsx — despachante ExtendScript do painel FACA 3D
// Carrega o .jsx da ferramenta sob demanda e repassa as chamadas.
// IMPORTANTE: $.evalFile define as funções no escopo GLOBAL e sobrescreve os
// wrappers deste arquivo. Por isso chamar() re-avalia o .jsx e reinstala os
// wrappers no finally, para a proxima chamada não executar a função da
// ferramenta anterior.

var __faca3dTool = "";
var __faca3dRaiz = "";

function normalizarRaiz(raiz) {
    return String(raiz || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function arquivoFerramenta(raiz) {
    var base = normalizarRaiz(raiz);
    if (!base) {
        try {
            base = normalizarRaiz(new File($.fileName).parent.parent.fsName);
        } catch (e) {}
    }
    if (!base) return null;
    return new File(base + "/jsx/faca3d.jsx");
}

function carregarFerramenta(key, raiz) {
    if (String(key || "") !== "faca3d") return "Ferramenta desconhecida: " + key;
    var arq = arquivoFerramenta(raiz);
    if (!arq) return "Ferramenta desconhecida: " + key;
    if (!arq.exists) return "Arquivo .jsx não encontrado: " + arq.fsName;
    __faca3dTool = "faca3d";
    __faca3dRaiz = normalizarRaiz(raiz);
    return "ok";
}

// ---------------------------------------------------------------------------
// Log central de erros: %APPDATA%/FACA3D/logs/faca3d.log
// ---------------------------------------------------------------------------
function faca3dDoisDigitos(n) {
    return n < 10 ? "0" + n : "" + n;
}

function faca3dAgora() {
    var d = new Date();
    return d.getFullYear() + "-" + faca3dDoisDigitos(d.getMonth() + 1) + "-" +
        faca3dDoisDigitos(d.getDate()) + " " + faca3dDoisDigitos(d.getHours()) + ":" +
        faca3dDoisDigitos(d.getMinutes()) + ":" + faca3dDoisDigitos(d.getSeconds());
}

function faca3dPastaLog() {
    var base = new Folder(Folder.userData.fsName + "/FACA3D");
    if (!base.exists) base.create();
    var dir = new Folder(base.fsName + "/logs");
    if (!dir.exists) dir.create();
    return dir;
}

function faca3dLogArquivo() {
    var dir = faca3dPastaLog();
    var f = new File(dir.fsName + "/faca3d.log");
    try {
        if (f.exists && f.length > 2 * 1024 * 1024) {
            var antigo = new File(dir.fsName + "/faca3d.old.log");
            if (antigo.exists) antigo.remove();
            f.rename("faca3d.old.log");
            f = new File(dir.fsName + "/faca3d.log");
        }
    } catch (eRot) {}
    return f;
}

function faca3dLog(origem, mensagem) {
    try {
        var f = faca3dLogArquivo();
        f.encoding = "UTF-8";
        if (!f.open("a")) return "erro";
        f.writeln(faca3dAgora() + " | " + String(origem || "-") + " | " + String(mensagem || ""));
        f.close();
        return "ok";
    } catch (e) {
        return "erro";
    }
}

function caminhoLog() {
    try {
        return faca3dLogArquivo().fsName;
    } catch (e) {
        return "";
    }
}

function abrirLog() {
    try {
        var f = faca3dLogArquivo();
        if (!f.exists) {
            f.open("w");
            f.close();
        }
        f.execute();
        return "ok";
    } catch (e) {
        return "erro";
    }
}

function chamar(nomeFn, argsObj) {
    var args = [];
    for (var i = 0; i < argsObj.length; i++) args.push(argsObj[i]);
    var arq = arquivoFerramenta(__faca3dRaiz);
    if (!arq) return "Ferramenta não identificada.";
    if (!arq.exists) {
        faca3dLog("faca3d | jsx:" + nomeFn, "arquivo .jsx não encontrado: " + arq.fsName);
        return "Arquivo .jsx não encontrado: " + arq.fsName;
    }
    try {
        $.evalFile(arq);
        var fn = eval(nomeFn);
        if (typeof fn === "function") {
            try {
                return fn.apply(null, args);
            } catch (eFn) {
                var msgFn = (eFn && eFn.message ? eFn.message : String(eFn)) +
                    (eFn && eFn.line ? " | linha " + eFn.line : "");
                faca3dLog("faca3d | jsx:" + nomeFn, msgFn);
                return "Erro ao executar o script: " + msgFn;
            }
        }
        faca3dLog("faca3d | jsx:" + nomeFn, "função não encontrada");
        return "Função '" + nomeFn + "' não encontrada na ferramenta.";
    } catch (eCar) {
        var msgCar = (eCar && eCar.message ? eCar.message : String(eCar)) +
            (eCar && eCar.line ? " | linha " + eCar.line : "");
        faca3dLog("faca3d | jsx:" + nomeFn + " (carregar)", msgCar);
        return "Erro ao carregar a ferramenta: " + msgCar;
    } finally {
        instalarWrappers();
    }
}

// Wrappers globais chamados pelos painéis via evalScript. Reinstalados após
// cada chamada para não serem sobrescritos pelas funções dos .jsx.
function instalarWrappers() {
    // FACA 3D não depende de wrappers de outras ferramentas.
}

instalarWrappers();

// Lê um arquivo texto da extensão (relativo à raiz) e devolve o conteúdo.
// Fallback para hosts cujo Chromium bloqueia fetch() em arquivos locais.
function lerArquivo(rel) {
    var r = String(rel || "").replace(/\\/g, "/").replace(/\.\./g, "").replace(/^\/+/, "");
    var base = "";
    try {
        if (__faca3dRaiz) base = normalizarRaiz(__faca3dRaiz);
    } catch (e1) {}
    if (!base) {
        try {
            base = normalizarRaiz(new File($.fileName).parent.parent.fsName);
        } catch (e2) {}
    }
    if (!base) return "ERRO:sem raiz da extensão";
    var f = new File(base + "/" + r);
    if (!f.exists) return "ERRO:arquivo não encontrado";
    var txt = null;
    try {
        f.encoding = "UTF-8";
        if (!f.open("r")) return "ERRO:falha ao abrir arquivo";
        txt = f.read();
        f.close();
    } catch (e3) {
        try { f.close(); } catch (e4) {}
        return "ERRO:falha de leitura";
    }
    return txt;
}

function getDocInfo() {
    try {
        var doc = app.activeDocument;
        if (!doc) return "Nenhum documento aberto.";
        var ab = doc.artboards;
        return "Documento: " + doc.name + " | Artboards: " + ab.length;
    } catch (e) {
        return "Nenhum documento aberto.";
    }
}