/* FACA 3D — articulação individual (0.7.6).
 * A face pode ser escolhida por clique ou pelo droplist (ambos em
 * testes-selecao.js); aqui a seleção é feita pela API e o ângulo é conferido em
 * cada face. Cada face guarda o próprio ângulo: trocar de face NÃO zera as outras.
 */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function txt(id) { const e = document.getElementById(id); return e ? (e.textContent || "").trim() : ""; }

if (!document.getElementById("faca3dApp")) return "ABRA_A_FERRAMENTA";
const v = Faca3D.viewer3dAtual;
if (!v) return "LEIA_A_FACA";
const m = v.auditoria();
const slider = document.getElementById("faca3dAngulo");
const sinalBtn = document.getElementById("faca3dBtnSentido");
const rotuloFace = document.getElementById("faca3dFaceAtual");

const filhos = {};
for (const s of m.ordem) {
  if (s.pai === null || s.pai === undefined) continue;
  (filhos[s.pai] = filhos[s.pai] || []).push(s.face);
}
function subarvore(face) {
  const out = {};
  const fila = [face];
  while (fila.length) {
    const f = fila.shift();
    out[f] = true;
    for (const c of (filhos[f] || [])) fila.push(c);
  }
  return out;
}
function moveram(ins, base) {
  const out = {};
  for (const id in ins.matrices) {
    const a = ins.matrices[id];
    const b = base[id];
    if (!b) { out[id] = true; continue; }
    let dif = 0;
    for (let i = 0; i < 16; i++) dif = Math.max(dif, Math.abs(a[i] - b[i]));
    if (dif > 1e-6) out[id] = true;
  }
  return out;
}
function conjunto(o) { return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }).join(","); }
function anguloNaTela() { return parseFloat(String(txt("faca3dAnguloValor")).replace("°", "")) || 0; }

const linhas = [];
linhas.push("DROPLIST=" + (document.getElementById("faca3dHinge") ? "AINDA_EXISTE" : "REMOVIDA"));
let total = 0, falhas = 0;
function ok(nome, cond, det) {
  total++;
  if (!cond) falhas++;
  linhas.push("  " + (cond ? "ok   " : "FALHA ") + nome + (det ? " -> " + det : ""));
}

const articulacoes = v.articulacoes();
ok("articulações listadas", articulacoes.length > 0, "n=" + articulacoes.length);
ok("checkbox de sentido começa desabilitado", sinalBtn.disabled === true);

let base = null;
for (const art of articulacoes) {
  const filho = art.faceFilho;
  v.definirAngulos(v.perfilPadrao());
  await wait(80);
  base = v.inspecionar().matrices;

  v.selecionarFace(filho);
  await wait(80);
  ok("A" + art.facePai + "→" + filho + " seleção", v.faceSelecionada() === filho, String(v.faceSelecionada()));
  ok("A" + art.facePai + "→" + filho + " rótulo", rotuloFace.textContent.indexOf("face " + filho) === 0, rotuloFace.textContent);
  ok("A" + art.facePai + "→" + filho + " slider no ângulo atual", anguloNaTela() === v.anguloDaFace(filho), anguloNaTela() + "x" + v.anguloDaFace(filho));

  slider.value = "60";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(160);
  const ins = v.inspecionar();
  const mov = moveram(ins, base);
  const esperado = subarvore(filho);
  const h = ins.hinges.filter(function (x) { return x.face === filho; })[0];
  const err = h ? Math.max(h.erroP1 || 0, h.erroP2 || 0) : -1;
  linhas.push("ART " + art.facePai + "→" + filho + " eixo=(" + art.p1.x.toFixed(1) + "," + art.p1.y.toFixed(1) + ")→(" +
    art.p2.x.toFixed(1) + "," + art.p2.y.toFixed(1) + ") base=" + art.sinalBase +
    " move=[" + conjunto(mov) + "] esperado=[" + conjunto(esperado) + "] erroEixo=" + err.toFixed(6));
  ok("A" + art.facePai + "→" + filho + " 60° move só a subárvore", conjunto(mov) === conjunto(esperado), "mov=" + conjunto(mov));
  ok("A" + art.facePai + "→" + filho + " eixo fixo", err >= 0 && err < 1e-6, String(err));
  ok("A" + art.facePai + "→" + filho + " guardou 60°", v.anguloDaFace(filho) === 60, String(v.anguloDaFace(filho)));
}

// Persistência: mudar de face não zera a anterior.
v.definirAngulos(v.perfilPadrao());
await wait(120);
let faceA = null, faceB = null;
for (const a of articulacoes) {
  for (const b of articulacoes) {
    if (a.faceFilho === b.faceFilho) continue;
    if (subarvore(a.faceFilho)[b.faceFilho]) continue;
    faceA = a.faceFilho;
    faceB = b.faceFilho;
    break;
  }
  if (faceA !== null) break;
}
ok("par de faces independentes", faceA !== null && faceB !== null && faceA !== faceB, faceA + "/" + faceB);

v.selecionarFace(faceA);
await wait(80);
slider.value = "40";
slider.dispatchEvent(new Event("input", { bubbles: true }));
await wait(160);
const matA40 = v.inspecionar().matrices[faceA];

v.selecionarFace(faceB);
await wait(80);
ok("ao trocar de face o slider mostra o da nova face", anguloNaTela() === v.anguloDaFace(faceB), anguloNaTela() + "x" + v.anguloDaFace(faceB));
slider.value = "120";
slider.dispatchEvent(new Event("input", { bubbles: true }));
await wait(160);
const insB = v.inspecionar();
let matIgual = true;
for (let i = 0; i < 16; i++) matIgual = matIgual && Math.abs(insB.matrices[faceA][i] - matA40[i]) < 1e-9;
ok("face A manteve 40° depois de mexer na B", v.anguloDaFace(faceA) === 40, String(v.anguloDaFace(faceA)));
ok("face A não se moveu ao mexer na B", matIgual);
ok("face B em 120°", v.anguloDaFace(faceB) === 120, String(v.anguloDaFace(faceB)));

v.selecionarFace(faceA);
await wait(80);
ok("voltar na A restaura o slider", anguloNaTela() === 40, txt("faca3dAnguloValor"));
ok("voltar na A não muda o ângulo", v.anguloDaFace(faceA) === 40, String(v.anguloDaFace(faceA)));

// Sentido é por face e não zera as outras.
const sinalAntesA = v.sinalDaFace(faceA);
sinalBtn.click();
await wait(160);
ok("sentido alterna só a face A", v.sinalDaFace(faceA) === -sinalAntesA, String(v.sinalDaFace(faceA)));
ok("sentido da B intacto", v.anguloDaFace(faceB) === 120 && v.sinalDaFace(faceB) === 1, String(v.sinalDaFace(faceB)));
sinalBtn.click();
await wait(160);
ok("sentido da A voltou", v.sinalDaFace(faceA) === sinalAntesA, String(v.sinalDaFace(faceA)));

// Desmarcar (mesma face) não altera ângulos.
v.selecionarFace(faceA, true);
await wait(80);
ok("clicar na mesma face desmarca", v.faceSelecionada() === null, String(v.faceSelecionada()));
ok("sentido desabilitado ao desmarcar", sinalBtn.disabled === true);
ok("ângulos preservados ao desmarcar", v.anguloDaFace(faceA) === 40 && v.anguloDaFace(faceB) === 120,
  v.anguloDaFace(faceA) + "/" + v.anguloDaFace(faceB));

// Snap 85–95 → 90 na articulação.
v.selecionarFace(faceA);
await wait(80);
slider.value = "88";
slider.dispatchEvent(new Event("input", { bubbles: true }));
await wait(160);
ok("snap 88 → 90 na face", v.anguloDaFace(faceA) === 90, String(v.anguloDaFace(faceA)));
ok("snap mostra 90°", anguloNaTela() === 90, txt("faca3dAnguloValor"));
slider.value = "96";
slider.dispatchEvent(new Event("input", { bubbles: true }));
await wait(160);
ok("snap não pega 96", v.anguloDaFace(faceA) === 96, String(v.anguloDaFace(faceA)));

// Dobrar volta ao perfil e limpa a seleção.
document.getElementById("faca3dBtnDobrar").click();
await wait(1500);
const perfil = v.perfilPadrao();
const atuais = v.angulosAtuais();
let perfilOk = true;
for (const k in perfil) if (Math.abs(atuais[k] - perfil[k]) > 1e-6) perfilOk = false;
ok("Dobrar reaplica o perfil", perfilOk);
ok("Dobrar limpa a seleção", v.faceSelecionada() === null, String(v.faceSelecionada()));
ok("Dobrar volta a info de perfil", txt("faca3dInfo3D").indexOf("montagem por perfil") >= 0, txt("faca3dInfo3D"));
linhas.push("VOLTOU_GLOBAL=" + txt("faca3dInfo3D"));

linhas.push("TOTAL=" + total + " FALHAS=" + falhas);
return linhas.join("\n");
