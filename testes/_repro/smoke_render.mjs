/* Smoke test do caminho de renderização do 3D (sem WebGL).
 *
 * Reproduz, para cada face montada, as operações que o three3d faz com a
 * triangulação: normais, centroide, posições, índices, ponto interno e UV.
 * Pega erro de índice fora da lista / coordenada indefinida (o bug do
 * "Cannot read properties of undefined (reading 'x')").
 *
 * Uso: node testes/_repro/smoke_render.mjs <geo.txt> [costuraMm]
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
const threeModulo = await import("file:///" + path.join(raiz, "js/vendor/three.min.js").replaceAll("\\", "/"));
globalThis.THREE = threeModulo.default || threeModulo;
await import("file:///" + path.join(raiz, "js/view/three3d.js").replaceAll("\\", "/"));

const THREE = globalThis.THREE;
const F = globalThis.Faca3D;
const G = F.geometry;
const triangularFace = F.view.three3d.triangularFace;

const texto = fs.readFileSync(arquivo, "utf8");
const geo = G.parser.parse(texto, { normalizar: false });
G.parser.rebase(geo);
geo.meta.total = geo.caminhos.length;
geo.meta.bytes = texto.length;
geo.meta.tempoExtendScriptMs = 0;

const res = G.engine.analisarGeometria(geo, {
  tolerancias: { costuraMm: Number(process.argv[3] || 2.5) },
});
const sub = G.subdivisao ? G.subdivisao.subdividir(res) : res;
const montagem = G.hinge.construir(sub);
const faces = sub.faces.faces;
const porId = {};
for (const f of faces) porId[f.id] = f;

let erros = 0;
const problemas = [];

function falha(face, msg) {
  erros++;
  problemas.push("face " + face + ": " + msg);
}

const poligonos = {};
for (const id of montagem.facesMontadas) {
  const face = porId[id];
  if (!face) {
    falha(id, "face montada nao existe");
    continue;
  }
  let tri = null;
  try {
    tri = triangularFace(face);
  } catch (e) {
    falha(id, "triangularFace lancou: " + e.message);
    continue;
  }
  if (!tri) {
    falha(id, "triangularFace devolveu null");
    continue;
  }
  poligonos[id] = tri;

  // 1) índices dentro da lista e vértices válidos
  let maxIdx = -1;
  for (const t of tri.triangulos) {
    if (!t || t.length < 3) falha(id, "triangulo invalido " + JSON.stringify(t));
    for (const k of t) {
      if (typeof k !== "number" || k < 0 || k >= tri.pontos.length) {
        falha(id, "indice " + k + " fora de pontos(" + tri.pontos.length + ")");
      } else if (!isFinite(tri.pontos[k].x) || !isFinite(tri.pontos[k].y)) {
        falha(id, "vertice sem coordenada no indice " + k);
      }
      if (k > maxIdx) maxIdx = k;
    }
  }

  // 2) normal do primeiro triângulo (bloco ladoExterno)
  const tL = tri.triangulos[0];
  const va = tri.pontos[tL[0]];
  const vb = tri.pontos[tL[1]];
  const vc = tri.pontos[tL[2]];
  if (!va || !vb || !vc) {
    falha(id, "primeiro triangulo aponta para vertice ausente");
  } else {
    const u1 = new THREE.Vector3(vb.x - va.x, vb.y - va.y, 0);
    const u2 = new THREE.Vector3(vc.x - va.x, vc.y - va.y, 0);
    const n = new THREE.Vector3().crossVectors(u1, u2);
    if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) falha(id, "normal invalida");
  }

  // 3) centroide pelo contorno externo
  const contL = tri.contorno || tri.pontos;
  let cx = 0, cy = 0;
  for (const p of contL) {
    cx += p.x;
    cy += p.y;
  }
  cx /= contL.length;
  cy /= contL.length;
  if (!isFinite(cx) || !isFinite(cy)) falha(id, "centroide invalido");

  // 4) posições/índices como o BufferGeometry
  const posicoes = new Float32Array(tri.pontos.length * 3);
  for (let j = 0; j < tri.pontos.length; j++) {
    posicoes[j * 3] = tri.pontos[j].x;
    posicoes[j * 3 + 1] = tri.pontos[j].y;
    posicoes[j * 3 + 2] = 0;
  }
  const indices = [];
  for (const t of tri.triangulos) indices.push(t[0], t[1], t[2]);
  for (const v of posicoes) if (!isFinite(v)) falha(id, "posicao NaN");
  for (const k of indices) if (k * 3 + 2 >= posicoes.length) falha(id, "indice de posicao fora");

  // 5) ponto interno (centro do maior triângulo)
  let melhor = null;
  let melhorArea = -1;
  for (const t of tri.triangulos) {
    const a = tri.pontos[t[0]];
    const b = tri.pontos[t[1]];
    const c = tri.pontos[t[2]];
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
    if (area > melhorArea) {
      melhorArea = area;
      melhor = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    }
  }
  if (!melhor || !isFinite(melhor.x) || !isFinite(melhor.y)) falha(id, "ponto interno invalido");
}

// 6) faceCruzaFace com os polígonos (precisa de pontos + triangulos coerentes)
function compartilhaVertice2D(a, b, tol) {
  for (const p of a) for (const q of b) {
    const dx = p.x - q.x, dy = p.y - q.y;
    if (dx * dx + dy * dy <= tol * tol) return true;
  }
  return false;
}
let pares = 0;
const ids = montagem.facesMontadas.filter((id) => poligonos[id]);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const pa = poligonos[ids[i]], pb = poligonos[ids[j]];
    if (compartilhaVertice2D(pa.pontos, pb.pontos, 0.05)) continue;
    pares++;
  }
}

console.log(
  "faces montadas=" + montagem.facesMontadas.length +
  " poligonos=" + Object.keys(poligonos).length +
  " pares sem vertice comum=" + pares
);
if (erros) {
  console.log("PROBLEMAS (" + erros + "):");
  for (const p of problemas.slice(0, 20)) console.log("  " + p);
  process.exit(1);
}
console.log("OK: nenhum indice/coordenada invalida no caminho de renderizacao.");

// ---------------- base fixa: raiz automática x raiz manual ----------------
const T = F.view.three3d;

function matrizIdentidade(m) {
  if (!m) return false;
  const e = m.elements;
  return (
    Math.abs(e[0] - 1) < 1e-9 && Math.abs(e[5] - 1) < 1e-9 &&
    Math.abs(e[10] - 1) < 1e-9 && Math.abs(e[15] - 1) < 1e-9 &&
    Math.abs(e[12]) < 1e-9 && Math.abs(e[13]) < 1e-9 && Math.abs(e[14]) < 1e-9
  );
}

function erroDosEixos(mont, matrizes) {
  let pior = 0;
  for (let i = 1; i < mont.ordem.length; i++) {
    const s = mont.ordem[i];
    if (s.rigida) continue;
    for (const p of [s.p1, s.p2]) {
      const a = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(matrizes[s.pai]);
      const b = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(matrizes[s.face]);
      pior = Math.max(pior, a.distanceTo(b));
    }
  }
  return pior;
}

const raizManual = 22; // exemplo do pedido
const casos = [
  { nome: "automatica", mont: G.hinge.construir(res, { raiz: null }) },
  { nome: "manual 22", mont: G.hinge.construir(res, { raiz: raizManual }) },
];

let falhasBase = 0;
for (const caso of casos) {
  const mont = caso.mont;
  if (caso.nome !== "automatica" && !mont.baseManual) {
    console.log("BASE " + caso.nome + ": RECUSADA -> " + mont.motivoBase);
    falhasBase++;
    continue;
  }
  const faceRaiz = mont.raiz;
  const poligonoRaiz = porId[faceRaiz];
  const origemRaiz = (poligonoRaiz && poligonoRaiz.pontos) || [];
  const linhas = [];
  for (const ang of [0, 90, 180]) {
    const mats = T.matrizesDaMontagem(THREE, mont, {}, {}, ang, {});
    const ident = matrizIdentidade(mats[faceRaiz]);
    const eixo = erroDosEixos(mont, mats);
    let movRaiz = 0;
    for (const p of origemRaiz) {
      const v = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(mats[faceRaiz]);
      movRaiz = Math.max(movRaiz, Math.hypot(v.x - p.x, v.y - p.y, v.z));
    }
    if (!ident || movRaiz > 1e-9 || eixo > 1e-6) falhasBase++;
    linhas.push(
      "  " + String(ang).padStart(3) + "°: raiz identidade=" + ident +
        " deslocamento da base=" + movRaiz.toExponential(1) +
        " erro nos eixos=" + eixo.toExponential(1) +
        " | faces que saem do plano=" +
        Object.keys(mats).filter((id) => {
          const f = porId[id];
          if (!f || !f.pontos.length) return false;
          const v = new THREE.Vector3(f.pontos[0].x, f.pontos[0].y, 0).applyMatrix4(mats[id]);
          return Math.abs(v.z) > 1e-6;
        }).length
    );
  }
  console.log(
    "\nBASE " + caso.nome + " -> painel " + faceRaiz +
    " (manual=" + !!mont.baseManual + ", montadas=" + mont.facesMontadas.length + ")"
  );
  console.log(linhas.join("\n"));
}

if (falhasBase) {
  console.log("\nFALHAS NA BASE FIXA: " + falhasBase);
  process.exit(1);
}
console.log("\nOK: base fixa realmente muda a raiz da montagem (raiz imóvel em 0/90/180).");
