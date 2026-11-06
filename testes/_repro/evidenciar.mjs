/* Evidência da base fixa: gera os polígonos já transformados em 3D para a
 * raiz automática e para a raiz manual (painel 22), em 0°, 90° e 180°.
 *
 * Uso: node testes/_repro/evidenciar.mjs <geo.txt> <saida.json> [raizManual]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.window = globalThis;

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizDir = path.resolve(aqui, "..", "..");
const arquivo = process.argv[2] || path.join(aqui, "geo.txt");
const saida = process.argv[3] || path.join(aqui, "base3d.json");
const raizManual = Number(process.argv[4] || 22);

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
  await import("file:///" + path.join(raizDir, mod).replaceAll("\\", "/"));
}
const threeModulo = await import("file:///" + path.join(raizDir, "js/vendor/three.min.js").replaceAll("\\", "/"));
globalThis.THREE = threeModulo.default || threeModulo;
await import("file:///" + path.join(raizDir, "js/view/three3d.js").replaceAll("\\", "/"));

const THREE = globalThis.THREE;
const F = globalThis.Faca3D;
const G = F.geometry;
const T = F.view.three3d;

const texto = fs.readFileSync(arquivo, "utf8");
const geo = G.parser.parse(texto, { normalizar: false });
G.parser.rebase(geo);
geo.meta.total = geo.caminhos.length;
geo.meta.bytes = texto.length;
geo.meta.tempoExtendScriptMs = 0;

const res = G.engine.analisarGeometria(geo, { tolerancias: { costuraMm: 2.5 } });
const sub = G.subdivisao ? G.subdivisao.subdividir(res) : res;
const faces = sub.faces.faces;
const porId = {};
for (const f of faces) porId[f.id] = f;

const casos = [
  { nome: "Base automática", raiz: null },
  { nome: "Base manual " + raizManual, raiz: raizManual },
];

const saidaCasos = [];
for (const caso of casos) {
  const mont = G.hinge.construir(sub, { raiz: caso.raiz });
  if (caso.raiz !== null && !mont.baseManual) {
    console.error("base " + caso.raiz + " recusada: " + mont.motivoBase);
    process.exit(1);
  }
  const poligonos = {};
  for (const id of mont.facesMontadas) {
    if (porId[id]) poligonos[id] = T.triangularFace(porId[id]);
  }
  const sinais = T.escolherSinaisCom(THREE, mont, poligonos).sinais;
  for (const ang of [0, 90, 180]) {
    const mats = T.matrizesDaMontagem(THREE, mont, sinais, {}, ang, {});
    const facesSaida = [];
    for (const id of mont.facesMontadas) {
      const f = porId[id];
      const m = mats[id];
      if (!f || !m) continue;
      const contorno = (poligonos[id] && poligonos[id].contorno) || f.pontos;
      const pts = contorno.map((p) => {
        const v = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(m);
        return [v.x, v.y, v.z];
      });
      facesSaida.push({ id: id, base: id === mont.raiz, pts: pts });
    }
    saidaCasos.push({
      caso: caso.nome,
      angulo: ang,
      raiz: mont.raiz,
      manual: !!mont.baseManual,
      montadas: mont.facesMontadas.length,
      faces: facesSaida,
    });
  }
}

fs.writeFileSync(saida, JSON.stringify({ casos: saidaCasos }));
console.log("gerado " + saida + " (" + saidaCasos.length + " quadros)");
for (const c of saidaCasos) {
  console.log(
    "  " + c.caso + " @" + c.angulo + "° raiz=" + c.raiz +
      " manual=" + c.manual + " faces=" + c.faces.length
  );
}
