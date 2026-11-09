/* FACA 3D — arte dupla (2 artboards EXTERNO/INTERNO, lateral inteira).
 * Cobre: textura ext+int, UV 0..1 por face (decals frente/verso),
 * toggle arte/papel, UV estável ao dobrar (0°/90°), vista interior.
 * Geometria SEMPRE da artboard 0 (espelhada da 1 ignorada).
 * Roda no painel com a faca lida. Sem camada ARTE, o bloco de arte é pulado.
 */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function txt(id) { const e = document.getElementById(id); return e ? (e.textContent || "").trim() : ""; }

if (!document.getElementById("faca3dApp")) return "ABRA_A_FERRAMENTA";
const v = Faca3D.viewer3dAtual;
if (!v) return "LEIA_A_FACA";
const AU = Faca3D.view.arteUnica || Faca3D.view.arteDupla;
v.selecionarFace(null);

const linhas = [];
let total = 0, falhas = 0;
function ok(nome, cond, det) {
  total++;
  if (!cond) falhas++;
  linhas.push("  " + (cond ? "ok   " : "FALHA ") + nome + (det ? " -> " + det : ""));
}

/* ------------------------------------------ módulo puro (unitário) */
ok("arteUnica carregado", !!AU && typeof AU.uvFaca === "function" && typeof AU.recorteParaFaca === "function");
let uv = AU.uvFaca({ x: 0, y: 0 }, 200, 100);
ok("uvFaca origem 0,0", uv.u === 0 && uv.v === 0, JSON.stringify(uv));
uv = AU.uvFaca({ x: 200, y: 100 }, 200, 100);
ok("uvFaca canto 1,1", Math.abs(uv.u - 1) < 1e-9 && Math.abs(uv.v - 1) < 1e-9, JSON.stringify(uv));
ok("uvFacaInversa existe", typeof AU.uvFacaInversa === "function");
if (typeof AU.uvFacaInversa === "function") {
  const uvi = AU.uvFacaInversa({ x: 50, y: 25 }, 200, 100);
  ok("uv inversa 0.75,0.25", Math.abs(uvi.u - 0.75) < 1e-9 && Math.abs(uvi.v - 0.25) < 1e-9, JSON.stringify(uvi));
}

/* --------------------------------------------- estado real do documento */
const ins = v.inspecionar();
const nFaces = ins.montagem.facesMontadas.length;
const dupla = ins.arteDupla || null;
const temExt = !!(dupla && dupla.ext && dupla.ext.temTextura);
const temInt = !!(dupla && dupla.int && dupla.int.temTextura);
const temArte = temExt || temInt || !!(ins.arteUnica && ins.arteUnica.temTextura);
ok("caixaFacaUV definida", !!(ins.caixaFacaUV && ins.caixaFacaUV.W > 0 && ins.caixaFacaUV.H > 0),
  JSON.stringify(ins.caixaFacaUV));

if (temArte) {
  // Decals: 2 por face quando as 2 texturas existem; 1 quando só 1 lado.
  const nDecals = ins.decals;
  if (temExt && temInt) {
    ok("decals = 2 por face (ext+int)", nDecals === nFaces * 2, "decals=" + nDecals + " faces=" + nFaces);
  } else {
    ok("decals = 1 por face (só 1 lado)", nDecals === nFaces, "decals=" + nDecals + " faces=" + nFaces);
  }
  ok("nota cita camada ARTE", /Arte/.test(txt("faca3dNotaArtes")), txt("faca3dNotaArtes"));

  /* ------------------------------------------------------- UV por face */
  const uvs = ins.uvs || {};
  let facesUv = 0;
  let fora = [];
  let degeneradas = [];
  for (const f in uvs) {
    facesUv++;
    const q = uvs[f];
    if (q.minU < -0.02 || q.maxU > 1.02 || q.minV < -0.02 || q.maxV > 1.02) {
      fora.push(f + " u[" + q.minU.toFixed(2) + ".." + q.maxU.toFixed(2) + "] v[" + q.minV.toFixed(2) + ".." + q.maxV.toFixed(2) + "]");
    }
    if (q.maxU - q.minU < 0.001 && q.maxV - q.minV < 0.001) degeneradas.push(f);
  }
  ok("UV presente em todas as faces", facesUv === nFaces, facesUv + "/" + nFaces);
  ok("UV dentro de 0..1 (lateral)", fora.length === 0, fora.join(" | "));
  ok("nenhuma UV degenerada", degeneradas.length === 0, degeneradas.join(","));

  /* amostra: duas faces vizinhas não ocupam exatamente a mesma região */
  let iguais = 0;
  const ids = Object.keys(uvs);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = uvs[ids[i]], b = uvs[ids[j]];
      if (Math.abs(a.minU - b.minU) < 1e-4 && Math.abs(a.maxU - b.maxU) < 1e-4 &&
          Math.abs(a.minV - b.minV) < 1e-4 && Math.abs(a.maxV - b.maxV) < 1e-4) iguais++;
    }
  }
  ok("faces não compartilham a mesma UV", iguais < 3, "pares iguais=" + iguais);

  /* ------------------------------------------------------ materiais */
  let mats = v.materiais();
  let comArte = 0;
  for (const k in mats) if (mats[k] === "arte" || mats[k] === "arte-ext" || mats[k] === "arte-int") comArte++;
  ok("decals com material arte", comArte === nDecals, "arte=" + comArte + " decals=" + nDecals);
  if (temExt && temInt) {
    let ext = 0, int = 0;
    for (const k in mats) {
      if (k.indexOf("ext-") === 0 && mats[k] === "arte-ext") ext++;
      if (k.indexOf("int-") === 0 && mats[k] === "arte-int") int++;
    }
    ok("ext+int com materiais separados", ext === nFaces && int === nFaces, "ext=" + ext + " int=" + int);
  }

  /* -------------------------------------------------- toggle arte/papel */
  const chk = document.getElementById("faca3dMostrarArte");
  ok("toggle existe", !!chk);
  if (chk) {
    const uvAntes = JSON.stringify(v.inspecionar().uvs);
    chk.checked = false;
    chk.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(400);
    ok("desligar arte muda estado", v.inspecionar().mostrarArte === false);
    ok("desligar arte não muda a UV", JSON.stringify(v.inspecionar().uvs) === uvAntes, "uvs alteradas");
    chk.checked = true;
    chk.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(400);
    ok("religar arte restaura", v.inspecionar().mostrarArte === true);
  }

  /* ------------------------------------------- UV estável ao dobrar */
  v.definirAngulos({}); // planificado 0°
  await wait(300);
  const uv0 = JSON.stringify(v.inspecionar().uvs);
  v.definirAngulos(v.perfilPadrao()); // 90°
  await wait(300);
  const uv90 = JSON.stringify(v.inspecionar().uvs);
  ok("UV igual em 0° e 90° (gruda ao dobrar)", uv0 === uv90, "uvs mudaram ao dobrar");
  v.definirAngulos({});
  await wait(200);
} else {
  ok("sem arte => 0 decals, papel", ins.decals === 0, "decals=" + ins.decals);
  ok("nota sem arte", txt("faca3dNotaArtes").length > 0, txt("faca3dNotaArtes"));
}

/* --------------------------------------------------- vista interior */
v.definirAngulos(v.perfilPadrao());
await wait(200);
v.definirVista("interior");
await wait(300);
const det = v.inspecionar();
const cam = det.camera;
const c0 = det.centro;
const caixa = {
  min: { x: det.caixaMundo.min.x - c0.x, y: det.caixaMundo.min.y - c0.y, z: det.caixaMundo.min.z - c0.z },
  max: { x: det.caixaMundo.max.x - c0.x, y: det.caixaMundo.max.y - c0.y, z: det.caixaMundo.max.z - c0.z }
};
ok("vista interior coloca a câmera dentro da caixa",
  cam.x > caixa.min.x && cam.x < caixa.max.x &&
    cam.y > caixa.min.y && cam.y < caixa.max.y &&
    cam.z > caixa.min.z && cam.z < caixa.max.z,
  "cam=" + cam.x.toFixed(0) + "," + cam.y.toFixed(0) + "," + cam.z.toFixed(0));
v.definirVista("perspectiva_direita");
await wait(300);

linhas.push("TOTAL=" + total + " FALHAS=" + falhas);
return linhas.join("\n");
