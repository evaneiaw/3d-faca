// faca3d.jsx — backend ExtendScript da ferramenta FACA 3D (Fase 1)
// Apenas inventaria o documento ativo. Nao interpreta geometria, nao cria
// faces, nao altera o documento.
//
// Protocolo textual (ver js/core/protocol.js):
//   F3D|1|DIAG
//   CHAVE=valor
//   END
// Listas repetidas: SPOT, TRACO, PREENCHIMENTO. O separador interno dessas
// listas e TAB (o nome do spot pode conter "|" e "=").
//
// ExtendScript e ES3: sem JSON, sem map/filter/forEach, sem String.trim.
// Colecoes do DOM em Illustrator 30.x: acesso por colchete 0-based.

var F3D_PROTOCOLO = 1;

function f3dTrim(s) {
    return String(s === null || s === undefined ? "" : s).replace(/^\s+|\s+$/g, "");
}

function f3dEsc(v) {
    var s = v === null || v === undefined ? "" : String(v);
    var out = "";
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (ch === "\\") out += "\\\\";
        else if (ch === "=") out += "\\e";
        else if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else out += ch;
    }
    return out;
}

function f3dCabecalho(tipo) {
    return "F3D|" + F3D_PROTOCOLO + "|" + tipo;
}

function f3dResposta(tipo, mensagem) {
    return f3dCabecalho(tipo) + "\nMENSAGEM=" + f3dEsc(mensagem) + "\nEND";
}

function f3dErro(codigo, mensagem) {
    return f3dCabecalho("ERRO") + "\nCODIGO=" + f3dEsc(codigo) +
        "\nMENSAGEM=" + f3dEsc(mensagem) + "\nEND";
}

function f3dGet(coll, i) {
    if (coll === null || coll === undefined) return null;
    try {
        var el = coll[i - 1];
        if (el) return el;
    } catch (e) {}
    try {
        return coll.item(i);
    } catch (e2) {}
    return null;
}

function f3dLen(coll) {
    if (coll === null || coll === undefined) return 0;
    try {
        var n = coll.length;
        return typeof n === "number" ? n : 0;
    } catch (e) {
        return 0;
    }
}

function f3dProp(obj, nome) {
    if (!obj) return null;
    try {
        return obj[nome];
    } catch (e) {
        return null;
    }
}

function f3dNovoCtx() {
    return {
        itens: 0,
        paths: 0,
        abertos: 0,
        fechados: 0,
        grupos: 0,
        compostos: 0,
        recortes: 0,
        guias: 0,
        ocultos: 0,
        travados: 0,
        comTraco: 0,
        comPreenchimento: 0,
        spotObjetos: 0,
        textos: 0,
        imagens: 0,
        spots: {},
        ordem: [],
        traco: {},
        preench: {}
    };
}

function f3dCategoria(cor) {
    if (!cor) return "NENHUMA";
    var tn = f3dProp(cor, "typename");
    if (!tn) return "DESCONHECIDA";
    if (tn === "NoColor") return "NENHUMA";
    if (tn === "SpotColor") return "SPOT";
    if (tn === "CMYKColor") return "CMYK";
    if (tn === "RGBColor") return "RGB";
    if (tn === "GrayColor") return "GRAY";
    if (tn === "LABColor") return "LAB";
    if (tn === "PatternColor") return "PATTERN";
    if (tn === "GradientColor") return "GRADIENT";
    return String(tn).toUpperCase();
}

function f3dNomeSpot(cor) {
    try {
        if (cor && cor.typename === "SpotColor" && cor.spot && cor.spot.name) {
            return String(cor.spot.name);
        }
    } catch (e) {}
    return "";
}

function f3dCMYKdeCor(cor) {
    var out = { c: "", m: "", y: "", k: "" };
    try {
        if (!cor) return out;
        var base = cor;
        if (cor.typename === "SpotColor" && cor.spot) base = cor.spot.color;
        if (!base) return out;
        var tn = base.typename;
        if (tn === "CMYKColor") {
            out.c = String(Math.round(base.cyan));
            out.m = String(Math.round(base.magenta));
            out.y = String(Math.round(base.yellow));
            out.k = String(Math.round(base.black));
        }
    } catch (e) {}
    return out;
}

function f3dRegistrarSpot(ctx, nome, cor, tipo) {
    if (!nome) return;
    var chave = String(nome).toLowerCase();
    if (!ctx.spots[chave]) {
        var cmyk = f3dCMYKdeCor(cor);
        ctx.spots[chave] = {
            nome: String(nome),
            objetos: 0,
            traco: 0,
            preench: 0,
            c: cmyk.c,
            m: cmyk.m,
            y: cmyk.y,
            k: cmyk.k
        };
        ctx.ordem.push(chave);
    }
    if (tipo === "traco") ctx.spots[chave].traco++;
    else ctx.spots[chave].preench++;
}

function f3dProcessarCores(item, ctx) {
    var traco = f3dProp(item, "stroked") === true;
    var preench = f3dProp(item, "filled") === true;
    if (traco) ctx.comTraco++;
    if (preench) ctx.comPreenchimento++;

    var spotsDoItem = {};
    var listaSpots = [];

    function registrar(cor, tipo) {
        var cat = f3dCategoria(cor);
        var alvo = tipo === "traco" ? ctx.traco : ctx.preench;
        alvo[cat] = (alvo[cat] || 0) + 1;
        if (cat !== "SPOT") return;
        var nome = f3dNomeSpot(cor);
        if (!nome) return;
        f3dRegistrarSpot(ctx, nome, cor, tipo);
        var chave = String(nome).toLowerCase();
        if (!spotsDoItem[chave]) {
            spotsDoItem[chave] = true;
            listaSpots.push(chave);
        }
    }

    if (traco) registrar(f3dProp(item, "strokeColor"), "traco");
    if (preench) registrar(f3dProp(item, "fillColor"), "preench");

    if (listaSpots.length > 0) {
        ctx.spotObjetos++;
        for (var i = 0; i < listaSpots.length; i++) {
            ctx.spots[listaSpots[i]].objetos++;
        }
    }
}

function f3dVarrerCaminhosCompostos(comp, ctx) {
    var pi = f3dProp(comp, "pathItems");
    var n = f3dLen(pi);
    for (var i = 1; i <= n; i++) {
        var p = f3dGet(pi, i);
        if (!p) continue;
        ctx.itens++;
        ctx.paths++;
        if (f3dProp(p, "closed") === true) ctx.fechados++;
        else ctx.abertos++;
    }
}

function f3dProcessarItem(item, ctx) {
    if (!item) return;
    var tn = f3dProp(item, "typename");
    ctx.itens++;

    if (f3dProp(item, "hidden") === true) ctx.ocultos++;
    if (f3dProp(item, "locked") === true) ctx.travados++;
    if (f3dProp(item, "guides") === true) ctx.guias++;

    if (tn === "Layer") {
        f3dVarrer(item, ctx);
        var subs = f3dProp(item, "layers");
        f3dVarrerCamadas(subs, ctx);
        return;
    }

    if (tn === "GroupItem") {
        ctx.grupos++;
        f3dVarrer(item, ctx);
        return;
    }

    if (tn === "CompoundPathItem") {
        ctx.compostos++;
        if (f3dProp(item, "clipping") === true) ctx.recortes++;
        f3dProcessarCores(item, ctx);
        f3dVarrerCaminhosCompostos(item, ctx);
        return;
    }

    if (tn === "PathItem") {
        ctx.paths++;
        if (f3dProp(item, "closed") === true) ctx.fechados++;
        else ctx.abertos++;
        if (f3dProp(item, "clipping") === true) ctx.recortes++;
        f3dProcessarCores(item, ctx);
        return;
    }

    if (tn === "TextFrame") {
        ctx.textos++;
        f3dProcessarCores(item, ctx);
        return;
    }

    if (tn === "PlacedItem" || tn === "RasterItem") {
        ctx.imagens++;
        f3dProcessarCores(item, ctx);
        return;
    }

    f3dProcessarCores(item, ctx);
}

function f3dVarrer(container, ctx) {
    var items = f3dProp(container, "pageItems");
    var n = f3dLen(items);
    for (var i = 1; i <= n; i++) {
        f3dProcessarItem(f3dGet(items, i), ctx);
    }
}

function f3dVarrerCamadas(layers, ctx) {
    var n = f3dLen(layers);
    for (var i = 1; i <= n; i++) {
        var layer = f3dGet(layers, i);
        if (!layer) continue;
        f3dVarrer(layer, ctx);
        var subs = f3dProp(layer, "layers");
        f3dVarrerCamadas(subs, ctx);
    }
}

function f3dUnidades(doc) {
    try {
        switch (doc.rulerUnits) {
            case RulerUnits.Millimeters: return "mm";
            case RulerUnits.Centimeters: return "cm";
            case RulerUnits.Inches: return "in";
            case RulerUnits.Points: return "pt";
            case RulerUnits.Picas: return "pc";
            case RulerUnits.Pixels: return "px";
            default: return "?";
        }
    } catch (e) {
        return "?";
    }
}

function f3dCaminhoDoc(doc) {
    try {
        if (doc.fullName) return String(doc.fullName.fsName);
    } catch (e) {}
    return "";
}

function f3dNomeArtboard(doc, idx) {
    if (idx < 0) return "";
    try {
        var ab = doc.artboards[idx];
        if (ab && ab.name) return String(ab.name);
    } catch (e) {}
    return String(idx + 1);
}

function f3dDiagnostico(escopo) {
    var interacao = null;
    try {
        interacao = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    } catch (e0) {}

    try {
        if (f3dLen(app.documents) === 0) {
            return f3dResposta("SEM_DOC", "Nenhum documento aberto.");
        }

        var doc = app.activeDocument;
        if (!doc) return f3dResposta("SEM_DOC", "Nenhum documento aberto.");

        var usarSelecao = String(escopo) === "selecao";
        var ctx = f3dNovoCtx();
        var nSel = 0;
        var t0 = new Date().getTime();

        if (usarSelecao) {
            var sel = null;
            try {
                sel = doc.selection;
            } catch (eSel) {
                sel = null;
            }
            nSel = sel ? sel.length : 0;
            if (nSel === 0) {
                return f3dResposta("SEM_SELECAO", "Nenhum objeto selecionado.");
            }
            for (var i = 0; i < nSel; i++) {
                f3dProcessarItem(sel[i], ctx);
            }
        } else {
            f3dVarrerCamadas(doc.layers, ctx);
        }

        var tempo = new Date().getTime() - t0;
        var idxAb = -1;
        try {
            idxAb = doc.artboards.getActiveArtboardIndex();
        } catch (eAb) {}

        var out = [];
        out.push(f3dCabecalho("DIAG"));
        out.push("APP_NOME=" + f3dEsc(app.name));
        out.push("APP_VERSAO=" + f3dEsc(app.version));
        out.push("DOC_ABERTO=sim");
        out.push("DOC_NOME=" + f3dEsc(doc.name));
        out.push("DOC_CAMINHO=" + f3dEsc(f3dCaminhoDoc(doc)));
        out.push("DOC_SALVO=" + (f3dProp(doc, "saved") === true ? "sim" : "nao"));
        out.push("UNIDADES=" + f3dEsc(f3dUnidades(doc)));
        out.push("ARTBOARDS=" + f3dLen(doc.artboards));
        out.push("ARTBOARD_ATIVA=" + f3dEsc(f3dNomeArtboard(doc, idxAb)));
        out.push("CAMADAS=" + f3dLen(doc.layers));
        out.push("SPOT_DEFINIDOS=" + f3dLen(doc.spots));
        out.push("ESCOPO=" + (usarSelecao ? "selecao" : "documento"));
        out.push("SELECAO_ITENS=" + nSel);
        out.push("ITENS=" + ctx.itens);
        out.push("PATHS=" + ctx.paths);
        out.push("PATHS_ABERTOS=" + ctx.abertos);
        out.push("PATHS_FECHADOS=" + ctx.fechados);
        out.push("GRUPOS=" + ctx.grupos);
        out.push("COMPOSTOS=" + ctx.compostos);
        out.push("RECORTES=" + ctx.recortes);
        out.push("GUIAS=" + ctx.guias);
        out.push("OCULTOS=" + ctx.ocultos);
        out.push("TRAVADOS=" + ctx.travados);
        out.push("COM_TRACO=" + ctx.comTraco);
        out.push("COM_PREENCHIMENTO=" + ctx.comPreenchimento);
        out.push("SPOT_OBJETOS=" + ctx.spotObjetos);
        out.push("TEXTOS=" + ctx.textos);
        out.push("IMAGENS=" + ctx.imagens);
        out.push("TEMPO_MS=" + tempo);

        for (var s = 0; s < ctx.ordem.length; s++) {
            var sp = ctx.spots[ctx.ordem[s]];
            out.push("SPOT=" + f3dEsc(sp.nome) + "\t" + sp.objetos + "\t" + sp.traco +
                "\t" + sp.preench + "\t" + sp.c + "\t" + sp.m + "\t" + sp.y + "\t" + sp.k);
        }

        var k;
        for (k in ctx.traco) {
            if (!ctx.traco.hasOwnProperty(k)) continue;
            out.push("TRACO=" + f3dEsc(k) + "\t" + ctx.traco[k]);
        }
        for (k in ctx.preench) {
            if (!ctx.preench.hasOwnProperty(k)) continue;
            out.push("PREENCHIMENTO=" + f3dEsc(k) + "\t" + ctx.preench[k]);
        }

        out.push("END");
        return out.join("\n");
    } catch (e) {
        var linha = e && e.line ? " (linha " + e.line + ")" : "";
        return f3dErro("EXCECAO", (e && e.message ? e.message : String(e)) + linha);
    } finally {
        try {
            if (interacao !== null) app.userInteractionLevel = interacao;
        } catch (e1) {}
    }
}

// Nome exposto ao host.jsx: precisa ser identico ao wrapper de instalarWrappers().
// Sem este alias, faca3dDiagnostico resolveria para o proprio wrapper e entraria
// em recursao (Stack overrun).
function faca3dDiagnostico(escopo) {
    return f3dDiagnostico(escopo);
}

/* =====================================================================
 * FASE 2 — extracao de geometria bruta (somente leitura)
 * =====================================================================
 * Protocolo F3D|1|GEO:
 *   P=indice \t classe \t spot \t fechado \t nPontos \t camada \t pai
 *   A=indice \t ponto \t AX \t AY \t LX \t LY \t RX \t RY
 *
 * Coordenadas em 1/10000 de ponto (inteiro), sem separador decimal: evita
 * diferenca de locale no ExtendScript e nao perde precisao (0,0001 pt).
 * O consumidor divide por ESCALA_COORD e converte para mm.
 *
 * A extracao e paginada (inicio/fim, 0-based, fim exclusivo) para nao
 * estourar o tamanho do evalScript em documentos grandes.
 */

function f3dGeoClasse(cor) {
    var nome = f3dNomeSpot(cor);
    if (!nome) return { classe: "unknown", spot: "" };
    var n = String(nome).toLowerCase();
    // Substrings para classificação de vinco/crease - padrões expandidos para incluir nomes comuns
    var vincoPattern = /crease|vinco|vincos|dobra|dobradiça|hinge|valley|mountain/i;
    // Substrings para classificação de corte/cut - padrões expandidos
    var cutPattern = /cut|corte|cortar|cortadura|cutline|outline/i;
    if (vincoPattern.test(n)) {
        return { classe: "crease", spot: nome };
    }
    if (cutPattern.test(n)) {
        return { classe: "cut", spot: nome };
    }
    // Fallback: se o nome do Spot Color não corresponder aos padrões acima,
    // classificar como "other". Caminhos "other" não são utilizados na montagem 3D
    // que prioriza vincos, mas esta função mantém a portabilidade para documentos
    // com nomes de Spot Color variados.
    return { classe: "other", spot: nome };
}

function f3dGeoLimparNome(v) {
    return String(v === null || v === undefined ? "" : v).replace(/\t/g, " ");
}

// Coordenada em 1/10000 pt. Math.round evita notacao cientifica e casas
// decimais dependentes de locale.
function f3dGeoCoord(v) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    return String(Math.round(n * 10000));
}

function f3dGeoColetar(container, camada, pai, lista) {
    var items = f3dProp(container, "pageItems");
    var n = f3dLen(items);
    for (var i = 1; i <= n; i++) {
        var it = f3dGet(items, i);
        if (!it) continue;
        var tn = f3dProp(it, "typename");

        if (tn === "PathItem") {
            lista.push({ item: it, camada: camada, pai: pai });
        } else if (tn === "CompoundPathItem") {
            var pis = f3dProp(it, "pathItems");
            var m = f3dLen(pis);
            for (var k = 1; k <= m; k++) {
                var p = f3dGet(pis, k);
                if (p) lista.push({ item: p, camada: camada, pai: "CompoundPathItem" });
            }
        } else if (tn === "GroupItem") {
            f3dGeoColetar(it, camada, "GroupItem", lista);
        }
    }
}

function f3dGeoColetarCamadas(layers, lista) {
    var n = f3dLen(layers);
    for (var i = 1; i <= n; i++) {
        var layer = f3dGet(layers, i);
        if (!layer) continue;
        var nome = "";
        try {
            nome = layer.name ? String(layer.name) : "";
        } catch (eNome) {}
        f3dGeoColetar(layer, nome, "Layer", lista);
        var subs = f3dProp(layer, "layers");
        f3dGeoColetarCamadas(subs, lista);
    }
}

function f3dNomeCamada(layer) {
    var nome = "";
    try {
        nome = layer && layer.name ? String(layer.name) : "";
    } catch (e) {}
    return nome.replace(/^\s+|\s+$/g, "");
}

function f3dCamadaFaca(doc) {
    var n = f3dLen(doc.layers);
    for (var i = 1; i <= n; i++) {
        var layer = f3dGet(doc.layers, i);
        if (!layer) continue;
        var nome = f3dNomeCamada(layer).toUpperCase();
        if (nome === "FACA" || nome === "FACAS" || nome === "FACA DE CORTE") return layer;
    }
    return null;
}

function f3dGeoColetarCamadaFaca(layer, lista) {
    if (!layer) return;
    f3dGeoColetar(layer, f3dNomeCamada(layer), "Layer", lista);
    var subs = f3dProp(layer, "layers");
    var n = f3dLen(subs);
    for (var i = 1; i <= n; i++) {
        var sub = f3dGet(subs, i);
        if (sub) f3dGeoColetarCamadaFaca(sub, lista);
    }
}

function f3dGeometria(escopo, inicio, fim) {
    var interacao = null;
    try {
        interacao = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    } catch (e0) {}

    try {
        if (f3dLen(app.documents) === 0) {
            return f3dResposta("SEM_DOC", "Nenhum documento aberto.");
        }
        var doc = app.activeDocument;
        if (!doc) return f3dResposta("SEM_DOC", "Nenhum documento aberto.");

        var t0 = new Date().getTime();
        var usarSelecao = String(escopo) === "selecao";
        var lista = [];

        if (usarSelecao) {
            var sel = null;
            try {
                sel = doc.selection;
            } catch (eSel) {
                sel = null;
            }
            var nSel = sel ? sel.length : 0;
            if (nSel === 0) {
                return f3dResposta("SEM_SELECAO", "Nenhum objeto selecionado.");
            }
            for (var s = 0; s < nSel; s++) {
                var itemSel = sel[s];
                if (!itemSel) continue;
                var tnSel = f3dProp(itemSel, "typename");
                if (tnSel === "PathItem") {
                    lista.push({ item: itemSel, camada: "", pai: "Selection" });
                } else if (tnSel === "CompoundPathItem") {
                    var pisSel = f3dProp(itemSel, "pathItems");
                    var mSel = f3dLen(pisSel);
                    for (var kSel = 1; kSel <= mSel; kSel++) {
                        var pSel = f3dGet(pisSel, kSel);
                        if (pSel) lista.push({ item: pSel, camada: "", pai: "CompoundPathItem" });
                    }
                } else if (tnSel === "GroupItem") {
                    f3dGeoColetar(itemSel, "", "GroupItem", lista);
                }
            }
        } else {
            var camadaFaca = f3dCamadaFaca(doc);
            if (!camadaFaca) {
                return f3dResposta("SEM_FACA", "Camada FACA não encontrada. A faca deve estar na camada FACA.");
            }
            f3dGeoColetarCamadaFaca(camadaFaca, lista);
            lista = f3dFiltrarPorArtboard(lista, doc, 0);
        }

        var total = lista.length;
        var ini = parseInt(inicio, 10);
        var f = parseInt(fim, 10);
        if (!isFinite(ini) || ini < 0) ini = 0;
        if (!isFinite(f) || f > total) f = total;
        if (ini > total) ini = total;
        if (f < ini) f = ini;

        var out = [];
        out.push(f3dCabecalho("GEO"));
        out.push("ESCOPO=" + (usarSelecao ? "selecao" : "documento"));
        out.push("TOTAL=" + total);
        out.push("INICIO=" + ini);
        out.push("FIM=" + f);
        out.push("ESCALA_COORD=10000");
        out.push("DOC_NOME=" + f3dEsc(doc.name));
        out.push("DOC_CAMINHO=" + f3dEsc(f3dCaminhoDoc(doc)));
        out.push("DOC_SALVO=" + (f3dProp(doc, "saved") === true ? "sim" : "nao"));

        for (var idx = ini; idx < f; idx++) {
            var reg = lista[idx];
            var path = reg.item;
            var cor = null;
            try {
                if (f3dProp(path, "stroked") === true) cor = f3dProp(path, "strokeColor");
                else if (f3dProp(path, "filled") === true) cor = f3dProp(path, "fillColor");
            } catch (eCor) {}
            var cls = f3dGeoClasse(cor);
            var fechado = f3dProp(path, "closed") === true ? "1" : "0";
            var pts = f3dProp(path, "pathPoints");
            var np = f3dLen(pts);

            out.push("P=" + idx + "\t" + cls.classe + "\t" + f3dEsc(f3dGeoLimparNome(cls.spot)) +
                "\t" + fechado + "\t" + np + "\t" + f3dEsc(f3dGeoLimparNome(reg.camada)) +
                "\t" + f3dEsc(reg.pai));

            for (var pi = 1; pi <= np; pi++) {
                var pp = f3dGet(pts, pi);
                if (!pp) continue;
                var a = f3dProp(pp, "anchor");
                var l = f3dProp(pp, "leftDirection");
                var r = f3dProp(pp, "rightDirection");
                if (!a) a = [0, 0];
                if (!l) l = a;
                if (!r) r = a;
                out.push("A=" + idx + "\t" + (pi - 1) + "\t" +
                    f3dGeoCoord(a[0]) + "\t" + f3dGeoCoord(a[1]) + "\t" +
                    f3dGeoCoord(l[0]) + "\t" + f3dGeoCoord(l[1]) + "\t" +
                    f3dGeoCoord(r[0]) + "\t" + f3dGeoCoord(r[1]));
            }
        }

        out.push("TEMPO_MS=" + (new Date().getTime() - t0));
        out.push("END");
        return out.join("\n");
    } catch (e) {
        var linha = e && e.line ? " (linha " + e.line + ")" : "";
        return f3dErro("EXCECAO", (e && e.message ? e.message : String(e)) + linha);
    } finally {
        try {
            if (interacao !== null) app.userInteractionLevel = interacao;
        } catch (e1) {}
    }
}

// Alias chamado pelo painel via chamar("faca3dGeometria", [...]).
function faca3dGeometria(escopo, inicio, fim) {
    return f3dGeometria(escopo, inicio, fim);
}

/* ------------------------------------------------ arte externa e interna */

// Nomes normalizados (sem acento, maiusculas) das camadas tecnicas que NAO
// entram na arte 3D. A camada so e OCULTADA durante a exportacao e a
// visibilidade original e restaurada no finally.
var F3D_CAMADAS_TECNICAS = [
    "FACA", "FACAS", "FACA DE CORTE", "FACA DE VINCO",
    "MIRA", "MIRAS", "CL", "INFO", "INFORMACAO", "INFORMACOES",
    "LOTE", "COTAS", "COTA", "DIMENSAO", "DIMENSOES", "DIMENSAO GERAL"
];

function f3dSemAcento(s) {
    var mapa = {
        "\u00c1": "A", "\u00c0": "A", "\u00c2": "A", "\u00c3": "A", "\u00c4": "A",
        "\u00c9": "E", "\u00c8": "E", "\u00ca": "E", "\u00cb": "E",
        "\u00cd": "I", "\u00cc": "I", "\u00ce": "I", "\u00cf": "I",
        "\u00d3": "O", "\u00d2": "O", "\u00d4": "O", "\u00d5": "O", "\u00d6": "O",
        "\u00da": "U", "\u00d9": "U", "\u00db": "U", "\u00dc": "U",
        "\u00c7": "C", "\u00d1": "N"
    };
    var s = String(s === null || s === undefined ? "" : s).toUpperCase();
    var out = "";
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        out += mapa[ch] || ch;
    }
    return out.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function f3dCamadaTecnica(nome) {
    var n = f3dSemAcento(nome);
    for (var i = 0; i < F3D_CAMADAS_TECNICAS.length; i++) {
        if (n === F3D_CAMADAS_TECNICAS[i]) return true;
    }
    return false;
}

function f3dListarCamadasArte(layers, prefixo, out) {
    var n = f3dLen(layers);
    for (var i = 1; i <= n; i++) {
        var l = f3dGet(layers, i);
        if (!l) continue;
        var nome = f3dNomeCamada(l);
        var visivel = "1";
        try {
            visivel = l.visible ? "1" : "0";
        } catch (eV) {}
        out.push(
            "CAMADA=" + f3dEsc(prefixo + nome) + "\t" + visivel + "\t" +
            f3dLen(f3dProp(l, "pageItems")) + "\t" +
            (f3dCamadaTecnica(nome) ? "1" : "0")
        );
        var subs = f3dProp(l, "layers");
        if (f3dLen(subs)) f3dListarCamadasArte(subs, prefixo + nome + "/", out);
    }
}

function f3dColetarCamadasTecnicas(layers, lista) {
    var n = f3dLen(layers);
    for (var i = 1; i <= n; i++) {
        var l = f3dGet(layers, i);
        if (!l) continue;
        if (f3dCamadaTecnica(f3dNomeCamada(l))) lista.push(l);
        var subs = f3dProp(l, "layers");
        if (f3dLen(subs)) f3dColetarCamadasTecnicas(subs, lista);
    }
}

function f3dRetArtboard(doc, indice) {
    try {
        var ab = doc.artboards[indice];
        if (ab) return ab.artboardRect;
    } catch (e) {}
    return null;
}

// Interseção de um item com um retângulo de artboard (pt).
function f3dItemIntersectaRet(item, rect) {
    if (!rect) return true;
    var b = null;
    try {
        b = item.geometricBounds;
    } catch (e) {
        b = null;
    }
    if (!b || b.length < 4) return false;
    var l = Math.min(b[0], b[2]), r = Math.max(b[0], b[2]);
    var t = Math.max(b[1], b[3]), bf = Math.min(b[1], b[3]);
    var al = Math.min(rect[0], rect[2]), ar = Math.max(rect[0], rect[2]);
    var at = Math.max(rect[1], rect[3]), abf = Math.min(rect[1], rect[3]);
    return r >= al && l <= ar && t >= abf && bf <= at;
}

// A faca da PRIMEIRA artboard é a única fonte de geometria. Uma segunda
// faca (espelhada) pode existir na segunda artboard; ela é ignorada aqui.
function f3dFiltrarPorArtboard(lista, doc, indice) {
    var rect = f3dRetArtboard(doc, indice);
    if (!rect) return lista;
    var out = [];
    for (var i = 0; i < lista.length; i++) {
        if (f3dItemIntersectaRet(lista[i].item, rect)) out.push(lista[i]);
    }
    return out;
}

// Bounds da camada FACA em pt (1/10000). Layer.visibleBounds devolve nulo no
// Illustrator 30.x, entao a uniao e feita item a item.
function f3dBoundsFaca(doc) {
    var camada = f3dCamadaFaca(doc);
    if (!camada) return null;
    var caixa = null;
    var rect = f3dRetArtboard(doc, 0);
    function unir(container) {
        var n = f3dLen(f3dProp(container, "pageItems"));
        for (var i = 1; i <= n; i++) {
            var item = f3dGet(f3dProp(container, "pageItems"), i);
            if (!item) continue;
            if (rect && !f3dItemIntersectaRet(item, rect)) continue;
            var b = null;
            try {
                b = item.geometricBounds;
            } catch (e) {
                b = null;
            }
            if (!b || b.length < 4) continue;
            if (!caixa) {
                caixa = [b[0], b[1], b[2], b[3]];
            } else {
                if (b[0] < caixa[0]) caixa[0] = b[0];
                if (b[1] > caixa[1]) caixa[1] = b[1];
                if (b[2] > caixa[2]) caixa[2] = b[2];
                if (b[3] < caixa[3]) caixa[3] = b[3];
            }
        }
        var subs = f3dProp(container, "layers");
        var ns = f3dLen(subs);
        for (var k = 1; k <= ns; k++) unir(f3dGet(subs, k));
    }
    unir(camada);
    return caixa;
}

// Inventario de artboards e camadas para o mapeamento da arte.
function f3dArtes() {
    var interacao = null;
    try {
        interacao = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    } catch (e0) {}

    try {
        if (f3dLen(app.documents) === 0) return f3dResposta("SEM_DOC", "Nenhum documento aberto.");
        var doc = app.activeDocument;
        if (!doc) return f3dResposta("SEM_DOC", "Nenhum documento aberto.");

        var out = [];
        out.push(f3dCabecalho("ARTES"));
        out.push("DOC=" + f3dEsc(f3dCaminhoDoc(doc)));
        try {
            out.push("TEMP=" + f3dEsc(Folder.temp.fsName));
        } catch (eTemp) {
            out.push("TEMP=");
        }
        var nAb = f3dLen(doc.artboards);
        out.push("QTD_ARTBOARDS=" + nAb);
        for (var i = 0; i < nAb; i++) {
            var ab = f3dGet(doc.artboards, i + 1);
            if (!ab) continue;
            var r = ab.artboardRect;
            out.push(
                "ARTBOARD=" + i + "\t" + f3dEsc(ab.name) + "\t" +
                f3dGeoCoord(r[0]) + "\t" + f3dGeoCoord(r[1]) + "\t" +
                f3dGeoCoord(r[2]) + "\t" + f3dGeoCoord(r[3])
            );
        }
        f3dListarCamadasArte(doc.layers, "", out);
        var caixaFaca = f3dBoundsFaca(doc);
        if (caixaFaca) {
            out.push(
                "FACA=" + f3dGeoCoord(caixaFaca[0]) + "\t" + f3dGeoCoord(caixaFaca[1]) + "\t" +
                f3dGeoCoord(caixaFaca[2]) + "\t" + f3dGeoCoord(caixaFaca[3])
            );
        }
        out.push("END");
        return out.join("\n");
    } catch (e) {
        var linha = e && e.line ? " (linha " + e.line + ")" : "";
        return f3dErro("EXCECAO", (e && e.message ? e.message : String(e)) + linha);
    } finally {
        try {
            if (interacao !== null) app.userInteractionLevel = interacao;
        } catch (e1) {}
    }
}

// Exporta cada artboard pedido em PNG, SEM as camadas tecnicas.
// indicesCsv: "0,1" | pasta: destino | alvoPx: maior lado em pixels
function f3dExportarArte(indicesCsv, pasta, alvoPx) {
    var interacao = null;
    try {
        interacao = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    } catch (e0) {}

    var doc = null;
    var artboardAnterior = 0;
    var ocultadas = [];

    try {
        if (f3dLen(app.documents) === 0) return f3dResposta("SEM_DOC", "Nenhum documento aberto.");
        doc = app.activeDocument;
        if (!doc) return f3dResposta("SEM_DOC", "Nenhum documento aberto.");

        try {
            artboardAnterior = doc.artboards.getActiveArtboardIndex();
        } catch (eAb) {
            artboardAnterior = 0;
        }

        f3dColetarCamadasTecnicas(doc.layers, ocultadas);
        var visibilidadeOriginal = [];
        for (var t = 0; t < ocultadas.length; t++) {
            var antes = true;
            try {
                antes = ocultadas[t].visible ? true : false;
            } catch (eV) {}
            visibilidadeOriginal.push(antes);
            try {
                ocultadas[t].visible = false;
            } catch (eOc) {}
        }

        var dir = new Folder(String(pasta));
        if (!dir.exists) dir.create();

        var ids = String(indicesCsv).split(",");
        var alvo = Number(alvoPx);
        if (!(alvo > 0)) alvo = 2048;

        var out = [];
        out.push(f3dCabecalho("ARTE"));
        for (var i = 0; i < ids.length; i++) {
            var texto = f3dTrim(ids[i]);
            if (!texto) continue;
            var idx = parseInt(texto, 10);
            if (isNaN(idx)) continue;
            var ab = f3dGet(doc.artboards, idx + 1);
            if (!ab) {
                out.push("ERRO=" + idx + "\tartboard inexistente");
                continue;
            }
            var r = ab.artboardRect;
            var larg = Math.abs(r[2] - r[0]);
            var alt = Math.abs(r[1] - r[3]);
            var maior = Math.max(larg, alt, 1);
            var escala = (alvo / maior) * 100;
            if (escala < 10) escala = 10;
            if (escala > 1600) escala = 1600;

            try {
                doc.artboards.setActiveArtboardIndex(idx);
            } catch (eSet) {}

            var nomeArq = dir.fsName + "/arte_" + idx + ".png";
            var arq = new File(nomeArq);
            if (arq.exists) {
                try {
                    arq.remove();
                } catch (eRm) {}
            }
            var opts = new ExportOptionsPNG24();
            opts.artBoardClipping = true;
            opts.antiAliasing = true;
            opts.transparency = true;
            opts.horizontalScale = escala;
            opts.verticalScale = escala;
            doc.exportFile(arq, ExportType.PNG24, opts);
            if (!arq.exists) {
                out.push("ERRO=" + idx + "\tnao gerou o PNG");
                continue;
            }
            out.push(
                "ARQUIVO=" + idx + "\t" + f3dEsc(arq.fsName) + "\t" +
                Math.round((larg * escala) / 100) + "\t" + Math.round((alt * escala) / 100)
            );
        }
        out.push("END");
        return out.join("\n");
    } catch (e) {
        var linha = e && e.line ? " (linha " + e.line + ")" : "";
        return f3dErro("EXCECAO", (e && e.message ? e.message : String(e)) + linha);
    } finally {
        for (var k = 0; k < ocultadas.length; k++) {
            try {
                ocultadas[k].visible = visibilidadeOriginal[k];
            } catch (eRes) {}
        }
        try {
            if (doc) doc.artboards.setActiveArtboardIndex(artboardAnterior);
        } catch (eAb2) {}
        try {
            if (interacao !== null) app.userInteractionLevel = interacao;
        } catch (e1) {}
    }
}

// Aliases chamados pelo painel (sem wrapper no host.jsx).
function faca3dArtes() {
    return f3dArtes();
}

function faca3dExportarArte(indicesCsv, pasta, alvoPx) {
    return f3dExportarArte(indicesCsv, pasta, alvoPx);
}

/* ------------------------------------------------- dobras salvas (ângulos)
 *
 * O painel guarda no disco os ângulos/sentidos que o usuário definiu à mão,
 * por faca (chave = documento + assinatura da geometria). Fica em
 * %APPDATA%\FACA3D\dobras\<chave>.json - sobrevive a reiniciar
 * o Illustrator. O ExtendScript só grava/lê texto; o JSON é montado no painel.
 */
function f3dPastaDobras() {
    var pasta = String(Folder.userData.fsName) + "/FACA3D/dobras";
    // Cria nível a nível: Folder.create() não garante os pais no ES3.
    var partes = pasta.split("/");
    var atual = partes[0];
    for (var i = 1; i < partes.length; i++) {
        if (!partes[i]) continue;
        atual += "/" + partes[i];
        var f = new Folder(atual);
        if (!f.exists) {
            try { f.create(); } catch (e) {}
        }
    }
    return new Folder(pasta);
}

function f3dArquivoDobras(chave) {
    var nome = String(chave === null || chave === undefined ? "" : chave)
        .replace(/[^A-Za-z0-9_-]/g, "");
    if (!nome) return null;
    var dir = f3dPastaDobras();
    return new File(dir.fsName + "/" + nome + ".json");
}

function faca3dSalvarDobras(chave, texto) {
    try {
        var f = f3dArquivoDobras(chave);
        if (!f) return "ERRO:chave vazia";
        f.encoding = "UTF-8";
        if (!f.open("w")) return "ERRO:nao foi possivel abrir para escrita";
        f.write(String(texto === null || texto === undefined ? "" : texto));
        f.close();
        return "ok";
    } catch (e) {
        return "ERRO:" + (e && e.message ? e.message : String(e));
    }
}

function faca3dLerDobras(chave) {
    try {
        var f = f3dArquivoDobras(chave);
        if (!f || !f.exists) return "";
        f.encoding = "UTF-8";
        if (!f.open("r")) return "";
        var t = f.read();
        f.close();
        return String(t === null || t === undefined ? "" : t);
    } catch (e) {
        return "";
    }
}

function faca3dApagarDobras(chave) {
    try {
        var f = f3dArquivoDobras(chave);
        if (f && f.exists) f.remove();
        return "ok";
    } catch (e) {
        return "ERRO:" + (e && e.message ? e.message : String(e));
    }
}

function faca3dDocAtivo() {
    try {
        if (f3dLen(app.documents) === 0) return "";
        var d = app.activeDocument;
        if (!d) return "";
        return f3dEsc(d.name);
    } catch (e) {
        return "";
    }
}
