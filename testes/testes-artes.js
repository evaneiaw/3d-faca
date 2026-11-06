/* FACA 3D — arte externa/interna (0.8.0).
 * Cobre: leitura dos nomes de artboard, decisão externo/interno, UV por face,
 * materiais por lado, alternância de modo e espelhamento da arte interna.
 * Roda no painel com um documento de 2 artboards (EXTERNO/INTERNO) ativo.
 */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function txt(id) { const e = document.getElementById(id); return e ? (e.textContent || "").trim() : ""; }

if (!document.getElementById("faca3dApp")) return "ABRA_A_FERRAMENTA";
const v = Faca3D.viewer3dAtual;
if (!v) return "LEIA_A_FACA";
const ARTES = Faca3D.view.artes;
v.selecionarFace(null);

const linhas = [];
let total = 0, falhas = 0;
function ok(nome, cond, det) {
  total++;
  if (!cond) falhas++;
  linhas.push("  " + (cond ? "ok   " : "FALHA ") + nome + (det ? " -> " + det : ""));
}

/* ------------------------------------------- classificação (unitário) */
function ab(indice, nome) {
  return { indice: indice, nome: nome, rect: { left: 0, top: 100, right: 100, bottom: 0 } };
}

let r = ARTES.decidir([ab(0, "externo"), ab(1, "interno")]);
ok("EXTERNO/INTERNO por nome", r.externa.indice === 0 && r.interna.indice === 1, r.externa.nome + "/" + r.interna.nome);

r = ARTES.decidir([ab(0, "FRENTE"), ab(1, "VERSO")]);
ok("FRENTE/VERSO por nome", r.externa.indice === 0 && r.interna.indice === 1, r.externa.nome + "/" + r.interna.nome);

r = ARTES.decidir([ab(0, "Externo"), ab(1, "Interno")]);
ok("nome sem depender de maiúsculas", r.externa.indice === 0 && r.interna.indice === 1, r.externa.nome + "/" + r.interna.nome);

r = ARTES.decidir([ab(0, "Interno"), ab(1, "Externo")]);
ok("nome manda mais que a ordem", r.externa.indice === 1 && r.interna.indice === 0, r.externa.nome + "/" + r.interna.nome);

r = ARTES.decidir([ab(0, "Arte 1"), ab(1, "Arte 2")]);
ok("sem nome reconhecível usa a ordem", r.externa.indice === 0 && r.interna.indice === 1, JSON.stringify(r.avisos));
ok("sem nome avisa o usuário", r.avisos.length > 0);

r = ARTES.decidir([ab(0, "Externo")]);
ok("uma artboard = externa", r.externa.indice === 0 && r.interna === null, JSON.stringify(r.avisos));

r = ARTES.decidir([ab(0, "Externo"), ab(1, "Interno"), ab(2, "Sobra")]);
ok("mais de 2 artboards escolhe as nomeadas", r.externa.indice === 0 && r.interna.indice === 1, JSON.stringify(r.avisos));
ok("mais de 2 artboards avisa", r.avisos.length > 0);

r = ARTES.decidir([ab(0, "Externo e Interno"), ab(1, "Outra")]);
ok("nome ambíguo avisa", r.avisos.length > 0 && String(r.avisos.join(" ")).length > 0, JSON.stringify(r.avisos));

r = ARTES.decidir([]);
ok("sem artboard não quebra", r.externa === null && r.interna === null);

/* --------------------------------------------- estado real do documento */
const ins = v.inspecionar();
ok("arte externa carregada", !!(ins.artes.externa && ins.artes.externa.temTextura), JSON.stringify(ins.artes.externa));
ok("arte interna carregada", !!(ins.artes.interna && ins.artes.interna.temTextura), JSON.stringify(ins.artes.interna));
ok("nota cita as duas artboards", txt("faca3dNotaArtes").indexOf("externa") >= 0 && txt("faca3dNotaArtes").indexOf("interna") >= 0,
  txt("faca3dNotaArtes"));

/* ------------------------------------------------------- UV por face */
const uvs = ins.uvs || {};
let facesUv = 0;
let fora = [];
let degeneradas = [];
for (const f in uvs) {
  facesUv++;
  const q = uvs[f];
  if (q.minU < -0.08 || q.maxU > 1.08 || q.minV < -0.08 || q.maxV > 1.08) {
    fora.push(f + " u[" + q.minU.toFixed(2) + ".." + q.maxU.toFixed(2) + "] v[" + q.minV.toFixed(2) + ".." + q.maxV.toFixed(2) + "]");
  }
  if (q.maxU - q.minU < 0.001 && q.maxV - q.minV < 0.001) degeneradas.push(f);
}
const nFaces = ins.montagem.facesMontadas.length;
ok("UV presente em todas as faces montadas", facesUv === nFaces, facesUv + "/" + nFaces);
ok("UV dentro da artboard", fora.length === 0, fora.join(" | "));
ok("nenhuma face com UV degenerada", degeneradas.length === 0, degeneradas.join(","));

/* amostra: duas faces vizinhas não podem ocupar exatamente a mesma região */
let iguais = 0;
const ids = Object.keys(uvs);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = uvs[ids[i]], b = uvs[ids[j]];
    if (Math.abs(a.minU - b.minU) < 1e-4 && Math.abs(a.maxU - b.maxU) < 1e-4 &&
        Math.abs(a.minV - b.minV) < 1e-4 && Math.abs(a.maxV - b.maxV) < 1e-4) {
      iguais++;
    }
  }
}
ok("faces não compartilham a mesma UV", iguais < 3, "pares iguais=" + iguais);

/* ------------------------------------------------------ materiais */
const sel = document.getElementById("faca3dArteModo");
const chk = document.getElementById("faca3dEspelharInterna");
sel.value = "ambas";
sel.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);
let mats = v.materiais();
let ext = 0, int = 0, papel = 0;
for (const k in mats) {
  if (k.indexOf("ext-") === 0 && mats[k] === "arte-externa") ext++;
  if (k.indexOf("int-") === 0 && mats[k] === "arte-interna") int++;
  if (mats[k].indexOf("papel") === 0) papel++;
}
ok("modo ambas: arte externa nas faces externas", ext === nFaces, "ext=" + ext);
ok("modo ambas: arte interna nas faces internas", int === nFaces, "int=" + int);

sel.value = "externa";
sel.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);
mats = v.materiais();
let intPapel = 0, extArte = 0;
for (const k in mats) {
  if (k.indexOf("int-") === 0 && mats[k] === "papel-interno") intPapel++;
  if (k.indexOf("ext-") === 0 && mats[k] === "arte-externa") extArte++;
}
ok("modo externa: só a face externa recebe arte", intPapel === nFaces && extArte === nFaces,
  "intPapel=" + intPapel + " extArte=" + extArte);

sel.value = "interna";
sel.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);
mats = v.materiais();
let extPapel = 0, intArte = 0;
for (const k in mats) {
  if (k.indexOf("ext-") === 0 && mats[k] === "papel") extPapel++;
  if (k.indexOf("int-") === 0 && mats[k] === "arte-interna") intArte++;
}
ok("modo interna: só a face interna recebe arte", extPapel === nFaces && intArte === nFaces,
  "extPapel=" + extPapel + " intArte=" + intArte);

sel.value = "nenhuma";
sel.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);
mats = v.materiais();
let semArte = 0;
for (const k in mats) if (mats[k].indexOf("papel") === 0) semArte++;
ok("modo sem arte: só papel", semArte === nFaces * 2, "papel=" + semArte);

sel.value = "ambas";
sel.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);

/* -------------------------------------------------- espelhar interna */
const uvAntes = JSON.stringify(v.inspecionar().uvs);
chk.checked = true;
chk.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);
ok("espelhar interna muda o estado", v.inspecionar().espelharInterna === true);
ok("espelhar interna não muda a UV externa",
  JSON.stringify(v.inspecionar().uvs) === uvAntes, "uvs externas alteradas");
chk.checked = false;
chk.dispatchEvent(new Event("change", { bubbles: true }));
await wait(400);
ok("voltar espelhamento restaura", v.inspecionar().espelharInterna === false);

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
