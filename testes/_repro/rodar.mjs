/* Reprodução offline do pipeline do painel 3D Faca a partir do protocolo
 * F3D|1|GEO extraído do PDF da faca (testes/_repro/extrair_pdf.py).
 *
 * Uso: node testes/_repro/rodar.mjs testes/_repro/geo.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.window = globalThis;

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..", "..");
const arquivo = process.argv[2] || path.join(aqui, "geo.txt");

for (const mod of [
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
]) {
  await import("file:///" + path.join(raiz, mod).replaceAll("\\", "/"));
}

const F = globalThis.Faca3D;
const G = F.geometry;

const texto = fs.readFileSync(arquivo, "utf8");
const geo = G.parser.parse(texto, { normalizar: false });
G.parser.rebase(geo);
geo.meta.total = geo.caminhos.length;
geo.meta.bytes = texto.length;
geo.meta.tempoExtendScriptMs = 0;
geo.meta.lotes = 1;

const res = G.engine.analisarGeometria(geo, {
  tolerancias: { costuraMm: Number(process.argv[3] || 2.5) },
});
const sub = G.subdivisao ? G.subdivisao.subdividir(res) : res;
const montagem = G.hinge.construir(sub);

const faces = sub.faces.faces;
const topo = sub.topologia;

function pct(a) {
  return Array.isArray(a) ? a : [];
}

// ---------- resumo no formato do log do painel ----------
const linhas = [];
linhas.push("=== RESUMO (comparar com o log) ===");
linhas.push(
  "3d caminhos=" + sub.geometria.caminhos.length +
    " faces=" + faces.length +
    " montadas=" + montagem.facesMontadas.length +
    " tempo=offline"
);
linhas.push(
  "segmentos=" + sub.geometria.segmentos.length +
    " vertices=" + topo.resumo.vertices +
    " arestas=" + topo.resumo.arestas +
    " contornos=" + topo.resumo.contornos +
    " (fechados=" + topo.resumo.contornosFechados + ")" +
    " adjacencias=" + topo.resumo.adjacencias +
    " regioesAbertas=" + topo.resumo.regioesAbertas
);
linhas.push("classes: cut=" + topo.linhas.cut.arestas + " crease=" + topo.linhas.crease.arestas +
  " other=" + topo.linhas.other.arestas + " unknown=" + topo.linhas.unknown.arestas);
linhas.push("costuras=" + topo.resumo.costuras + " furos=" + topo.resumo.furos +
  " facesDuplicadas=" + topo.resumo.facesDuplicadas);
linhas.push("lista furos: " + JSON.stringify((sub.faces.furos || []).map((f) => ({
  face: f.face, pai: f.pai, area: +f.areaMm2.toFixed(1)
}))));
linhas.push("lista duplicadas: " + JSON.stringify(sub.faces.duplicadas || []));
linhas.push("faces com furo: " + JSON.stringify(faces.filter((f) => f.furos && f.furos.length)
  .map((f) => ({ face: f.id, furos: f.furos.length }))));
linhas.push("facesBrutas=" + sub.faces.facesBrutas + " restantes=" + sub.faces.faces.length +
  " removidas=" + (sub.faces.facesBrutas - sub.faces.faces.length));
if (sub.subdivisao) {
  linhas.push("subdivisao: " + sub.subdivisao.tipo + " faces=" + sub.subdivisao.novasFaces.join(","));
}

// ---------- faces ----------
linhas.push("");
linhas.push("=== FACES (" + faces.length + ") ===");
const montadasSet = new Set(montagem.facesMontadas);
for (const f of faces.slice().sort((a, b) => a.id - b.id)) {
  const cls = Object.entries(f.classes || {}).map(([k, v]) => k + ":" + v).join(" ");
  const pai = (montagem.ordem || []).find((o) => o.face === f.id) || null;
  linhas.push(
    "face " + f.id +
      (montadasSet.has(f.id) ? " [MONTADA]" : " [FORA]") +
      " area=" + f.areaMm2.toFixed(1) +
      " centro=(" + f.centro.x.toFixed(1) + "," + f.centro.y.toFixed(1) + ")" +
      " lados=" + f.lados +
      " " + cls +
      (pai && pai.rigida ? " RIGIDA" : "")
  );
}

// ---------- vinco audit ----------
const porStatus = {};
for (const v of montagem.vincos) porStatus[v.status] = (porStatus[v.status] || 0) + 1;
linhas.push("");
linhas.push("=== VINCOS (" + montagem.vincos.length + ") ===");
linhas.push("status: " + JSON.stringify(porStatus));
const naoDobra = montagem.vincos.filter((v) => v.status !== "dobra");
if (naoDobra.length) {
  linhas.push("-- vincos nao utilizados como dobra --");
  for (const v of naoDobra) {
    linhas.push(
      "  V" + v.indice + " status=" + v.status +
        " faces=" + JSON.stringify(v.faces) +
        " len=" + v.comprimentoMm + "mm" +
        " inicio=(" + v.inicio.x + "," + v.inicio.y + ")" +
        " fim=(" + v.fim.x + "," + v.fim.y + ")" +
        (v.motivo ? " :: " + v.motivo : "")
    );
  }
}

// ---------- adjacencias por classe ----------
const adjCls = {};
for (const a of sub.faces.adjacencias) {
  const k = Object.entries(a.classes || {}).map(([c, n]) => c + ":" + n).join("+");
  adjCls[k] = (adjCls[k] || 0) + 1;
}
linhas.push("");
linhas.push("=== ADJACENCIAS (" + sub.faces.adjacencias.length + ") ===");
linhas.push(JSON.stringify(adjCls));
const parDeFaces = new Set(montagem.pares ? Object.keys(montagem.pares) : []);
const adjSemPar = sub.faces.adjacencias.filter(
  (a) => !parDeFaces.has(Math.min(a.a, a.b) + ":" + Math.max(a.a, a.b))
);
linhas.push("adjacencias sem vinco (so corte) = " + adjSemPar.length);

// ---------- hipotese: faces aninhadas (furos) ----------
function pontoEmPoligono(p, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersecta = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}
const aninhadas = [];
for (const f of faces) {
  for (const o of faces) {
    if (f.id === o.id) continue;
    if (f.areaMm2 >= o.areaMm2) continue;
    if (pontoEmPoligono(f.centro, o.pontos)) {
      aninhadas.push({ interna: f.id, externa: o.id, areaInterna: +f.areaMm2.toFixed(1) });
    }
  }
}
linhas.push("");
linhas.push("=== FACES ANINHADAS (candidatas a FURO) ===");
linhas.push(aninhadas.length ? JSON.stringify(aninhadas, null, 1) : "nenhuma");

// ---------- faces fora do componente ----------
const fora = faces.filter((f) => !montadasSet.has(f.id));
linhas.push("");
linhas.push("=== FACES FORA DA MONTAGEM (" + fora.length + ") ===");
for (const f of fora) {
  const adj = sub.faces.adjacencias.filter((a) => a.a === f.id || a.b === f.id);
  linhas.push(
    "face " + f.id + " area=" + f.areaMm2.toFixed(1) +
      " centro=(" + f.centro.x.toFixed(1) + "," + f.centro.y.toFixed(1) + ")" +
      " vizinhas=" + adj.map((a) => (a.a === f.id ? a.b : a.a) + "[" + Object.keys(a.classes).join("+") + "]").join(" ")
  );
}

console.log(linhas.join("\n"));

// ---------- dump para desenho ----------
const U = G.utils;
const desenho = {
  caixa: sub.geometria.caixa,
  faces: faces.map((f) => ({
    id: f.id,
    area: f.areaMm2,
    pontos: f.pontos,
    furos: f.furos || [],
    montada: montadasSet.has(f.id),
    classes: f.classes,
  })),
  segmentos: sub.geometria.segmentos.map((s) => ({
    classe: s.classe,
    tipo: s.tipo,
    pts:
      s.tipo === "reta"
        ? [s.p0, s.p3]
        : U.achatarBezier(s.p0, s.c1, s.c2, s.p3, 0.2),
  })),
  vincos: montagem.vincos.map((v) => ({
    indice: v.indice,
    status: v.status,
    faces: v.faces,
    comprimentoMm: v.comprimentoMm,
  })),
};
fs.writeFileSync(path.join(aqui, "repro.json"), JSON.stringify(desenho));
console.log("\nrepro.json gravado.");

