// host.jsx — despachante ExtendScript do painel Mazurky Tools
// Carrega o .jsx de cada ferramenta sob demanda e repassa as chamadas.
// IMPORTANTE: $.evalFile define as funções no escopo GLOBAL e sobrescreve os
// wrappers deste arquivo (executar, preview, listarDocumentos...). Por isso
// chamar() re-avalia o .jsx e reinstala os wrappers no finally, para a próxima
// chamada não executar a função da ferramenta anterior.

var MAZURKY_TOOLS = {
    caixamaleta: "caixa-maleta",
    centerline: "centerline",
    mira: "mira",
    info: "info",
    lote: "lote",
    simplefaca: "simplefaca",
    frenteverso: "frenteverso",
    salvarpdf: "salvarpdf",
    cotas: "cotas",
    resolucao: "resolucao",
    marcasdecorte: "marcasdecorte",
    removerlinhas: "removerlinhas",
    facaplotter: "facaplotter",
    tamanhoartboard: "tamanhoartboard",
    fecharobjetos: "fecharobjetos",
    tiler: "tiler",
    tracejarpicote: "tracejarpicote",
    qrcode: "qrcode",
    barcode: "barcode",
    gerarLayout: "gerarLayout",
    caixamaletaft: "caixa-maleta-ft",
    gerarLayoutft: "gerarLayout-ft",
    faca3d: "faca3d"
};

var __mazurkyTool = "";
var __mazurkyRaiz = "";

function normalizarRaiz(raiz) {
    return String(raiz || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function arquivoFerramenta(key, raiz) {
    var dir = MAZURKY_TOOLS[key];
    if (!dir) return null;
    var base = normalizarRaiz(raiz);
    if (!base) {
        try {
            base = normalizarRaiz(new File($.fileName).parent.parent.fsName);
        } catch (e) {}
    }
    if (!base) return null;
    return new File(base + "/jsx/" + dir + ".jsx");
}

function carregarFerramenta(key, raiz) {
    if (!MAZURKY_TOOLS[key]) return "Ferramenta desconhecida: " + key;
    var arq = arquivoFerramenta(key, raiz);
    if (!arq) return "Ferramenta desconhecida: " + key;
    if (!arq.exists) return "Arquivo .jsx não encontrado: " + arq.fsName;
    __mazurkyTool = key;
    __mazurkyRaiz = normalizarRaiz(raiz);
    return "ok";
}

// ---------------------------------------------------------------------------
// Log central de erros: %APPDATA%\MazurkyTools\logs\mazurky.log
// ---------------------------------------------------------------------------
function mazurkyDoisDigitos(n) {
    return n < 10 ? "0" + n : "" + n;
}

function mazurkyAgora() {
    var d = new Date();
    return d.getFullYear() + "-" + mazurkyDoisDigitos(d.getMonth() + 1) + "-" +
        mazurkyDoisDigitos(d.getDate()) + " " + mazurkyDoisDigitos(d.getHours()) + ":" +
        mazurkyDoisDigitos(d.getMinutes()) + ":" + mazurkyDoisDigitos(d.getSeconds());
}

function mazurkyPastaLog() {
    var base = new Folder(Folder.userData.fsName + "/MazurkyTools");
    if (!base.exists) base.create();
    var dir = new Folder(base.fsName + "/logs");
    if (!dir.exists) dir.create();
    return dir;
}

function mazurkyLogArquivo() {
    var dir = mazurkyPastaLog();
    var f = new File(dir.fsName + "/mazurky.log");
    try {
        if (f.exists && f.length > 2 * 1024 * 1024) {
            var antigo = new File(dir.fsName + "/mazurky.old.log");
            if (antigo.exists) antigo.remove();
            f.rename("mazurky.old.log");
            f = new File(dir.fsName + "/mazurky.log");
        }
    } catch (eRot) {}
    return f;
}

function mazurkyLog(origem, mensagem) {
    try {
        var f = mazurkyLogArquivo();
        f.encoding = "UTF-8";
        if (!f.open("a")) return "erro";
        f.writeln(mazurkyAgora() + " | " + String(origem || "-") + " | " + String(mensagem || ""));
        f.close();
        return "ok";
    } catch (e) {
        return "erro";
    }
}

function caminhoLog() {
    try {
        return mazurkyLogArquivo().fsName;
    } catch (e) {
        return "";
    }
}

function abrirLog() {
    try {
        var f = mazurkyLogArquivo();
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
    var arq = arquivoFerramenta(__mazurkyTool, __mazurkyRaiz);
    if (!arq) return "Ferramenta não identificada.";
    if (!arq.exists) {
        mazurkyLog(__mazurkyTool + " | jsx:" + nomeFn, "arquivo .jsx não encontrado: " + arq.fsName);
        return "Arquivo .jsx não encontrado: " + arq.fsName;
    }
    try {
        $.evalFile(arq);
        // O .jsx define funções globais com os MESMOS nomes dos wrappers abaixo
        // (executar, preview, listarDocumentos...). Sem restaurar os wrappers, a
        // próxima ferramenta chamada executaria a função da ferramenta anterior.
        var fn = eval(nomeFn);
        if (typeof fn === "function") {
            try {
                return fn.apply(null, args);
            } catch (eFn) {
                var msgFn = (eFn && eFn.message ? eFn.message : String(eFn)) +
                    (eFn && eFn.line ? " | linha " + eFn.line : "");
                mazurkyLog(__mazurkyTool + " | jsx:" + nomeFn, msgFn);
                return "Erro ao executar o script: " + msgFn;
            }
        }
        mazurkyLog(__mazurkyTool + " | jsx:" + nomeFn, "função não encontrada");
        return "Função '" + nomeFn + "' não encontrada na ferramenta.";
    } catch (eCar) {
        var msgCar = (eCar && eCar.message ? eCar.message : String(eCar)) +
            (eCar && eCar.line ? " | linha " + eCar.line : "");
        mazurkyLog(__mazurkyTool + " | jsx:" + nomeFn + " (carregar)", msgCar);
        return "Erro ao carregar a ferramenta: " + msgCar;
    } finally {
        instalarWrappers();
    }
}

// Wrappers globais chamados pelos painéis via evalScript. Reinstalados após
// cada chamada para não serem sobrescritos pelas funções dos .jsx.
function instalarWrappers() {
    executar = function () { return chamar("executar", arguments); };
    preview = function () { return chamar("preview", arguments); };
    cancelar = function () { return chamar("cancelar", arguments); };
    assinaturaSelecao = function () { return chamar("assinaturaSelecao", arguments); };
    cotaSelecionada = function () { return chamar("cotaSelecionada", arguments); };
    setCotaEdicao = function () { return chamar("setCotaEdicao", arguments); };
    cotaEdicaoInfo = function () { return chamar("cotaEdicaoInfo", arguments); };
    prepararRetangulo = function () { return chamar("prepararRetangulo", arguments); };
    nomearRetangulo = function () { return chamar("nomearRetangulo", arguments); };
    getUltimoLote = function () { return chamar("getUltimoLote", arguments); };
    caixaMaleta = function () { return chamar("caixaMaleta", arguments); };
    salvarCaixaMaletaPrefs = function () { return chamar("salvarCaixaMaletaPrefs", arguments); };
    getCaixaMaletaPrefs = function () { return chamar("getCaixaMaletaPrefs", arguments); };
    lerJsonCaixaMaleta = function () { return chamar("lerJsonCaixaMaleta", arguments); };
    listarDocumentos = function () { return chamar("listarDocumentos", arguments); };
    listarArtboards = function () { return chamar("listarArtboards", arguments); };
    getConfig = function () { return chamar("getConfig", arguments); };
    listarPresets = function () { return chamar("listarPresets", arguments); };
    listarCores = function () { return chamar("listarCores", arguments); };
    listarCamadas = function () { return chamar("listarCamadas", arguments); };
    getMarcasPrefs = function () { return chamar("getMarcasPrefs", arguments); };
    getInfoPrefs = function () { return chamar("getInfoPrefs", arguments); };
    lerRaster = function () { return chamar("lerRaster", arguments); };
    diagnosticar = function () { return chamar("diagnosticar", arguments); };
    gerarQr = function () { return chamar("gerarQr", arguments); };
    gerarCodigoBarras = function () { return chamar("gerarCodigoBarras", arguments); };
    exportarImagemParaDetectar = function () { return chamar("exportarImagemParaDetectar", arguments); };
    analisarDuplicadas = function () { return chamar("analisarDuplicadas", arguments); };
    faca3dDiagnostico = function () { return chamar("faca3dDiagnostico", arguments); };
}

instalarWrappers();

// Numero da FT (Ficha Tecnica) em foco, compartilhado entre o hub e as ferramentas.
function salvarFT(valor) {
    try {
        app.preferences.setStringPreference("MazurkyFT/Numero", String(valor || ""));
        return "ok";
    } catch (e) {
        return "erro";
    }
}

function getFT() {
    try {
        return app.preferences.getStringPreference("MazurkyFT/Numero") || "";
    } catch (e) {
        return "";
    }
}

// Cache por FT em %TEMP%\MazurkyTools (apagado na proxima abertura do Illustrator).
function mazurkyCacheDirFT() {
    return new Folder(Folder.temp + "/MazurkyTools");
}

function mazurkyCacheArquivoFT(numero) {
    return new File(mazurkyCacheDirFT().fsName + "/FT_" + String(numero) + ".json");
}

function salvarCacheFT(numero, json) {
    try {
        var dir = mazurkyCacheDirFT();
        if (!dir.exists) dir.create();
        var f = mazurkyCacheArquivoFT(numero);
        f.encoding = "UTF-8";
        if (!f.open("w")) return "erro";
        f.write(json);
        f.close();
        return "ok";
    } catch (e) {
        return "erro";
    }
}

function getCacheFT(numero) {
    try {
        var f = mazurkyCacheArquivoFT(numero);
        if (!f.exists) return "";
        f.encoding = "UTF-8";
        if (!f.open("r")) return "";
        var t = f.read();
        f.close();
        return t;
    } catch (e) {
        return "";
    }
}

function limparCacheFT(numero) {
    try {
        var f = mazurkyCacheArquivoFT(numero);
        if (f.exists) f.remove();
        return "ok";
    } catch (e) {
        return "erro";
    }
}

function limparTodoCacheFT() {
    try {
        var dir = mazurkyCacheDirFT();
        if (!dir.exists) return "ok";
        var itens = dir.getFiles();
        for (var i = 0; i < itens.length; i++) {
            try {
                if (itens[i] instanceof File) itens[i].remove();
            } catch (e1) {}
        }
        try { dir.remove(); } catch (e2) {}
        return "ok";
    } catch (e) {
        return "erro";
    }
}

// Lê um arquivo texto da extensão (relativo à raiz) e devolve o conteúdo.
// Fallback para hosts cujo Chromium bloqueia fetch() em arquivos locais
// (ex: Illustrator 2024). Retorna "ERRO:<motivo>" em caso de falha.
function lerArquivo(rel) {
    var r = String(rel || "").replace(/\\/g, "/").replace(/\.\./g, "").replace(/^\/+/, "");
    var base = "";
    try {
        if (__mazurkyRaiz) base = normalizarRaiz(__mazurkyRaiz);
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
        try {
            f.close();
        } catch (e4) {}
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
