/* FACA 3D — seleção de face por clique e por droplist (0.7.6).
 * Cobre: clique seleciona a face certa (raycast), clicar de novo desmarca,
 * clicar fora desmarca, arrastar (órbita) não seleciona, droplist de faces,
 * "Desdobrar" animado e "Dobrar" de volta ao perfil.
 */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function txt(id) { const e = document.getElementById(id); return e ? (e.textContent || "").trim() : ""; }

if (!document.getElementById("faca3dApp")) return "ABRA_A_FERRAMENTA";
const v = Faca3D.viewer3dAtual;
if (!v) return "LEIA_A_FACA";
const canvas = document.querySelector("#faca3dViewer3D canvas");
if (!canvas) return "SEM_CANVAS";
const slider = document.getElementById("faca3dAngulo");
const sinalBtn = document.getElementById("faca3dBtnSentido");
const rotuloFace = document.getElementById("faca3dFaceAtual");
const listaFace = document.getElementById("faca3dFaceLista");
const btnDobrar = document.getElementById("faca3dBtnDobrar");
const btnDesdobrar = document.getElementById("faca3dBtnDesdobrar");

const linhas = [];
let total = 0, falhas = 0;
function ok(nome, cond, det) {
  total++;
  if (!cond) falhas++;
  linhas.push("  " + (cond ? "ok   " : "FALHA ") + nome + (det ? " -> " + det : ""));
}

function clique(x, y, mods) {
  const m = mods || {};
  for (const tipo of ["pointerdown", "pointerup"]) {
    canvas.dispatchEvent(new PointerEvent(tipo, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: tipo === "pointerdown" ? 1 : 0,
      ctrlKey: !!m.ctrl,
      shiftKey: !!m.shift,
      metaKey: false,
      clientX: x,
      clientY: y
    }));
  }
}

function arrasto(x, y, dx, dy) {
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse",
    isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y
  }));
  canvas.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse",
    isPrimary: true, button: 0, buttons: 0, clientX: x + dx, clientY: y + dy
  }));
}

/* ---------------------------------------------------- estado inicial */
v.selecionarFace(null);
v.definirVista("perspectiva_direita");
await wait(120);
ok("nenhuma face selecionada no início", v.faceSelecionada() === null, String(v.faceSelecionada()));
ok("rótulo 'todas as dobras'", rotuloFace.textContent === "todas as dobras", rotuloFace.textContent);
ok("sentido desabilitado sem face", sinalBtn.disabled === true);

/* ------------------------------------------------ droplist de faces */
ok("droplist de faces existe", !!listaFace);
ok("droplist lista todas as faces articuláveis",
  !!listaFace && listaFace.options.length === v.articulaveis().length + 1,
  listaFace ? "n=" + listaFace.options.length : "-");
ok("droplist começa em 'todas as dobras'", !!listaFace && listaFace.value === "", listaFace ? listaFace.value : "-");

const faceLista = v.articulaveis()[4];
listaFace.value = String(faceLista);
listaFace.dispatchEvent(new Event("change", { bubbles: true }));
await wait(140);
ok("droplist seleciona a face", v.faceSelecionada() === faceLista, String(v.faceSelecionada()));
ok("rótulo acompanha o droplist", rotuloFace.textContent.indexOf("face " + faceLista) === 0, rotuloFace.textContent);
ok("sentido habilitado pelo droplist", sinalBtn.disabled === false);

const faceLista2 = v.articulaveis()[7];
listaFace.value = String(faceLista2);
listaFace.dispatchEvent(new Event("change", { bubbles: true }));
await wait(140);
ok("droplist troca a face (substitui)",
  v.facesSelecionadas().length === 1 && v.faceSelecionada() === faceLista2,
  v.facesSelecionadas().join(","));

document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true, bubbles: true }));
listaFace.value = String(faceLista);
listaFace.dispatchEvent(new Event("change", { bubbles: true }));
document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", ctrlKey: false, bubbles: true }));
await wait(140);
ok("Ctrl no droplist soma a face", v.facesSelecionadas().length === 2, v.facesSelecionadas().join(","));
ok("droplist mostra a seleção múltipla",
  listaFace.value === "" && listaFace.options[0].textContent.indexOf("2 faces") === 0,
  listaFace.options[0].textContent);

v.selecionarFace(faceLista);
await wait(120);
ok("droplist acompanha a seleção por clique", listaFace.value === String(faceLista), listaFace.value);

listaFace.value = "";
listaFace.dispatchEvent(new Event("change", { bubbles: true }));
await wait(140);
ok("droplist em 'todas as dobras' limpa a seleção",
  v.faceSelecionada() === null && v.facesSelecionadas().length === 0,
  v.facesSelecionadas().join(","));
ok("rótulo volta para 'todas as dobras'", rotuloFace.textContent === "todas as dobras", rotuloFace.textContent);

const perfilPadraoTeste = v.perfilPadrao();
let so90 = true, nao90 = [];
for (const k in perfilPadraoTeste) {
  if (perfilPadraoTeste[k] !== 90) {
    so90 = false;
    nao90.push(k + "=" + perfilPadraoTeste[k]);
  }
}
ok("perfil padrão com todas as dobras em 90°", so90, nao90.join(","));

/* ---------------------------------------------------- desdobrar animado */
v.definirAngulos(v.perfilPadrao());
await wait(150);
const antes = v.angulosAtuais();
let algumDobrado = false;
for (const k in antes) if (antes[k] > 1) algumDobrado = true;
ok("perfil aplicado antes de desdobrar", algumDobrado);

btnDesdobrar.click();
await wait(320);
const durante = v.angulosAtuais();
let intermed = false;
for (const k in durante) if (durante[k] > 1 && durante[k] < antes[k] - 1) intermed = true;
ok("Desdobrar anima (valor intermediário)", intermed, JSON.stringify(durante));
ok("Desdobrar limpa a seleção", v.faceSelecionada() === null);

await wait(1500);
const zero = v.angulosAtuais();
let tudoZero = true;
for (const k in zero) if (Math.abs(zero[k]) > 1e-6) tudoZero = false;
ok("Desdobrar chega a 0° em todas", tudoZero, JSON.stringify(zero));
ok("Desdobrar mostra 0°", txt("faca3dAnguloValor") === "0°", txt("faca3dAnguloValor"));
ok("Desdobrar informa o modo", txt("faca3dInfo3D").indexOf("desdobrado") >= 0, txt("faca3dInfo3D"));

/* ------------------------------------- clique com a faca plana (vista topo) */
v.definirVista("topo");
await wait(250);
const faces = v.articulaveis();
ok("faces articuláveis listadas", faces.length === 18, "n=" + faces.length);

let clicaveis = 0, acertos = 0, erradas = [];
for (const f of faces) {
  const p = v.telaDaFace(f);
  if (!p || !p.visivel) continue;
  if (v.faceNoPonto(p.x, p.y) !== f) continue;
  clicaveis++;
  clique(p.x, p.y);
  await wait(45);
  if (v.faceSelecionada() === f) acertos++;
  else erradas.push(f + "->" + v.faceSelecionada());
}
ok("faces planas clicáveis encontradas", clicaveis >= 12, "n=" + clicaveis);
ok("clique seleciona a face certa", acertos === clicaveis, acertos + "/" + clicaveis + " " + erradas.join(","));

const alvo = v.telaDaFace(faces[0]);
clique(alvo.x, alvo.y);
await wait(80);
ok("rótulo mostra a face clicada", rotuloFace.textContent.indexOf("face " + faces[0]) === 0, rotuloFace.textContent);
ok("sentido habilitado com face", sinalBtn.disabled === false);
ok("info mostra face selecionada", txt("faca3dInfo3D").indexOf("face " + faces[0] + " selecionada") >= 0, txt("faca3dInfo3D"));

/* ---------------------------------------------- clicar de novo desmarca */
clique(alvo.x, alvo.y);
await wait(80);
ok("clicar na mesma face desmarca", v.faceSelecionada() === null, String(v.faceSelecionada()));
ok("rotulo volta para 'todas as dobras'", rotuloFace.textContent === "todas as dobras", rotuloFace.textContent);

/* -------------------------------------------------- clicar fora desmarca */
clique(alvo.x, alvo.y);
await wait(60);
ok("selecionou de novo", v.faceSelecionada() === faces[0], String(v.faceSelecionada()));
const r = canvas.getBoundingClientRect();
clique(r.left + 4, r.top + 4);
await wait(80);
ok("clicar fora da caixa desmarca", v.faceSelecionada() === null, String(v.faceSelecionada()));

/* ------------------------------------------ arrastar não seleciona a face */
clique(alvo.x, alvo.y);
await wait(60);
clique(r.left + 4, r.top + 4);
await wait(60);
arrasto(alvo.x, alvo.y, 40, 0);
await wait(120);
ok("arrastar (órbita) não seleciona", v.faceSelecionada() === null, String(v.faceSelecionada()));

/* ------------------------------------------- multi-seleção (Ctrl / Shift) */
const tres = [];
for (const f of faces) {
  const p = v.telaDaFace(f);
  if (!p || !p.visivel) continue;
  if (v.faceNoPonto(p.x, p.y) !== f) continue;
  tres.push({ f: f, p: p });
  if (tres.length === 3) break;
}
ok("3 faces visíveis para multi", tres.length === 3, tres.map(function (t) { return t.f; }).join(","));
if (tres.length < 3) {
  linhas.push("  -- multi-seleção ignorada: só " + tres.length + " face(s) visível(is)");
} else {

clique(tres[0].p.x, tres[0].p.y);
await wait(70);
clique(tres[1].p.x, tres[1].p.y, { ctrl: true });
await wait(70);
clique(tres[2].p.x, tres[2].p.y, { ctrl: true });
await wait(140);
let sel = v.facesSelecionadas();
ok("Ctrl+clique soma as 3 faces", sel.length === 3, sel.join(","));
ok("rótulo mostra as 3 faces", rotuloFace.textContent.indexOf("3 faces") === 0, rotuloFace.textContent);
ok("info mostra 3 faces selecionadas", txt("faca3dInfo3D").indexOf("3 faces selecionadas") >= 0, txt("faca3dInfo3D"));

clique(tres[2].p.x, tres[2].p.y, { ctrl: true });
await wait(120);
sel = v.facesSelecionadas();
ok("Ctrl+clique remove a face", sel.length === 2 && sel.indexOf(tres[2].f) < 0, sel.join(","));

clique(tres[2].p.x, tres[2].p.y, { ctrl: true });
await wait(120);
ok("Ctrl+clique devolve a face", v.facesSelecionadas().length === 3, v.facesSelecionadas().join(","));

clique(tres[1].p.x, tres[1].p.y);
await wait(120);
sel = v.facesSelecionadas();
ok("clique sem Ctrl reduz para uma", sel.length === 1 && sel[0] === tres[1].f, sel.join(","));

clique(tres[0].p.x, tres[0].p.y, { shift: true });
await wait(120);
sel = v.facesSelecionadas();
ok("Shift+clique soma", sel.length === 2 && sel.indexOf(tres[0].f) >= 0, sel.join(","));

slider.value = "120";
slider.dispatchEvent(new Event("input", { bubbles: true }));
await wait(200);
ok("slider move as duas selecionadas", v.anguloDaFace(tres[0].f) === 120 && v.anguloDaFace(tres[1].f) === 120,
  v.anguloDaFace(tres[0].f) + "/" + v.anguloDaFace(tres[1].f));

v.selecionarFace(tres[0].f, "alternar");
await wait(140);
sel = v.facesSelecionadas();
ok("remover mantém o ângulo da face", sel.length === 1 && v.anguloDaFace(tres[0].f) === 120,
  sel.join(",") + " ang=" + v.anguloDaFace(tres[0].f));

let extra = null;
for (const f of faces) {
  if (sel.indexOf(f) >= 0) continue;
  const p = v.telaDaFace(f);
  if (!p || !p.visivel) continue;
  if (v.faceNoPonto(p.x, p.y) !== f) continue;
  extra = { f: f, x: p.x, y: p.y };
  break;
}
ok("acha uma face extra visível", extra !== null, extra ? "face " + extra.f : "-");
if (extra) {
  const angExtraAntes = v.anguloDaFace(extra.f);
  v.selecionarFace(extra.f, "alternar");
  await wait(140);
  sel = v.facesSelecionadas();
  ok("somar não altera o ângulo das outras",
    sel.length === 2 && sel.indexOf(tres[1].f) >= 0 && sel.indexOf(extra.f) >= 0 &&
      v.anguloDaFace(tres[1].f) === 120 && v.anguloDaFace(extra.f) === angExtraAntes,
    sel.join(",") + " " + v.anguloDaFace(tres[1].f) + "/" + v.anguloDaFace(extra.f) + " (antes " + angExtraAntes + ")");
}
}

/* --------------------------------------------- clique na caixa dobrada */
v.definirAngulos(v.perfilPadrao());
await wait(150);
v.definirVista("frente");
await wait(250);
let visivelFrente = null;
for (const f of faces) {
  const p = v.telaDaFace(f);
  if (!p || !p.visivel) continue;
  if (v.faceNoPonto(p.x, p.y) !== f) continue;
  visivelFrente = { face: f, x: p.x, y: p.y };
  break;
}
ok("face visível na caixa dobrada", visivelFrente !== null, visivelFrente ? "face " + visivelFrente.face : "-");
if (visivelFrente) {
  clique(visivelFrente.x, visivelFrente.y);
  await wait(80);
  ok("clique na caixa dobrada seleciona", v.faceSelecionada() === visivelFrente.face, String(v.faceSelecionada()));
  slider.value = "45";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(150);
  ok("slider move só a face clicada", v.anguloDaFace(visivelFrente.face) === 45, String(v.anguloDaFace(visivelFrente.face)));
}

/* --------------------------------------------------------- Dobrar volta */
btnDobrar.click();
await wait(1500);
const perfil = v.perfilPadrao();
const atuais = v.angulosAtuais();
let perfilOk = true;
for (const k in perfil) if (Math.abs(atuais[k] - perfil[k]) > 1e-6) perfilOk = false;
ok("Dobrar reaplica o perfil", perfilOk);
ok("Dobrar limpa a seleção", v.faceSelecionada() === null, String(v.faceSelecionada()));
ok("Dobrar volta ao rótulo global", rotuloFace.textContent === "todas as dobras", rotuloFace.textContent);

/* --------------------------------------- deixa uma face selecionada p/ foto */
v.definirVista("perspectiva_direita");
await wait(250);
let paraFoto = null;
for (const f of faces) {
  const p = v.telaDaFace(f);
  if (!p || !p.visivel) continue;
  if (v.faceNoPonto(p.x, p.y) !== f) continue;
  paraFoto = { face: f, x: p.x, y: p.y };
  break;
}
if (paraFoto) {
  clique(paraFoto.x, paraFoto.y);
  await wait(150);
}
linhas.push("FOTO=" + (paraFoto ? "face " + paraFoto.face + " selecionada" : "nenhuma face visível"));
linhas.push("INFO=" + txt("faca3dInfo3D"));

linhas.push("TOTAL=" + total + " FALHAS=" + falhas);
return linhas.join("\n");
