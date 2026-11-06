/* FACA 3D — teste de hierarquia, eixos, sentido e ângulos no painel real.
 * Executar com o painel CEP exposto em 127.0.0.1:7777:
 *   node %TEMP%\opencode\cep_cdp.mjs testes\testes-3d-painel.js
 * Requer a ferramenta aberta e a faca lida.
 */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function txt(id) { const e = document.getElementById(id); return e ? (e.textContent || "").trim() : ""; }

const saida = [];
let total = 0;
let falhas = 0;
function ok(nome, cond, detalhe) {
  total++;
  if (cond) saida.push("  ok   " + nome);
  else { falhas++; saida.push("  FALHA " + nome + (detalhe ? " -> " + detalhe : "")); }
}

if (!document.getElementById("faca3dApp")) return "ABRA_A_FERRAMENTA";
const v = Faca3D.viewer3dAtual;
if (!v) return "LEIA_A_FACA";
const m = v.auditoria();
// Este teste é do modo GLOBAL: garante que nenhuma face esteja selecionada.
if (v.selecionarFace) v.selecionarFace(null);

ok("19 faces montadas", m.facesMontadas.length === 19, "n=" + m.facesMontadas.length);
ok("18 dobradiças retas", m.retas === 18, "n=" + m.retas);
ok("0 ligações rígidas", m.rigidas === 0, "n=" + m.rigidas);
ok("22 vincos auditados", m.vincos.length === 22, "n=" + m.vincos.length);
const cont = { dobra: 0, rigida: 0, "sem-par": 0 };
for (const x of m.vincos) if (cont[x.status] !== undefined) cont[x.status]++;
ok("22 vincos dobram", cont.dobra === 22, "n=" + cont.dobra);
ok("0 vincos rígidos", cont.rigida === 0, "n=" + cont.rigida);
ok("0 vincos sem par", cont["sem-par"] === 0, "n=" + cont["sem-par"]);

if (!m.estrutural) return "SEM_ESTRUTURAL";
ok("18 linhas estruturais", m.estrutural.linhas.length === 18, "n=" + m.estrutural.linhas.length);
ok("4 conexões virtuais", m.estrutural.resumo.conexoes === 4, "n=" + m.estrutural.resumo.conexoes);
ok("8 extensões virtuais", m.estrutural.resumo.extensoes === 8, "n=" + m.estrutural.resumo.extensoes);
const l5 = m.estrutural.linhas.filter(function (l) { return l.paths.indexOf(5) >= 0; })[0];
const l11 = m.estrutural.linhas.filter(function (l) { return l.paths.indexOf(13) >= 0; })[0];
ok("V5/6/7 na mesma linha", l5 && l5.paths.length === 3, l5 ? l5.paths.join(",") : "-");
ok("V13/14/15 na mesma linha", l11 && l11.paths.length === 3, l11 ? l11.paths.join(",") : "-");
ok("V18/V20 dobram", m.vincos.filter(function (x) { return x.indice === 18 || x.indice === 20; }).every(function (x) { return x.status === "dobra"; }));

// Hierarquia: pai sempre antes do filho.
const indice = {};
for (let i = 0; i < m.ordem.length; i++) indice[m.ordem[i].face] = i;
let hierarquiaOk = true;
for (let i = 1; i < m.ordem.length; i++) {
  if (indice[m.ordem[i].pai] === undefined || indice[m.ordem[i].pai] >= i) hierarquiaOk = false;
}
ok("hierarquia pai antes do filho", hierarquiaOk);

// Sentido definido para todas as dobradiças que dobram.
let sinaisOk = true;
let comSinal = 0;
for (const k in m.pares) {
  const p = m.pares[k];
  if (p.reta && p.faceFilho !== null) {
    comSinal++;
    if (!(p.sinal === 1 || p.sinal === -1)) sinaisOk = false;
  }
}
ok("sentido definido em 18 dobradiças", comSinal === 18 && sinaisOk, "n=" + comSinal);

const angulos = [0, 45, 90, 180];
const slider = document.getElementById("faca3dAngulo");
for (const ang of angulos) {
  slider.value = String(ang);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(500);
  const ins = v.inspecionar();
  let erroMax = 0;
  let nan = 0;
  for (const h of ins.hinges) {
    if (h.rigida) continue;
    erroMax = Math.max(erroMax, h.erroP1, h.erroP2);
  }
  for (const id in ins.matrices) {
    for (const val of ins.matrices[id]) if (!isFinite(val)) nan++;
  }
  ok("ângulo " + ang + ": eixo fixo", erroMax < 1e-6, "erro=" + erroMax);
  ok("ângulo " + ang + ": matrizes finitas", nan === 0, "nan=" + nan);
  if (ins.caixaMundo) {
    const dz = ins.caixaMundo.max.z - ins.caixaMundo.min.z;
    if (ang === 0) ok("ângulo 0: plano (dz≈0)", Math.abs(dz) < 1e-6, "dz=" + dz);
    if (ang === 90) ok("ângulo 90: 3D (dz>100)", dz > 100, "dz=" + dz);
    if (ang === 180) ok("ângulo 180: finito", isFinite(dz), "dz=" + dz);
  }
  saida.push("       cruzamentos@" + ang + "=" + ins.cruzamentos);
}

const resultado = saida.join("\n") + "\n\nTOTAL=" + total + " FALHAS=" + falhas;
slider.value = "90";
slider.dispatchEvent(new Event("input", { bubbles: true }));
await wait(500);
return resultado;
