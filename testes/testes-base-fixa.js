/* FACA 3D — teste da BASE FIXA manual no painel real.
 *
 * Executar com o painel CEP exposto em 127.0.0.1:7778/7777:
 *   node %TEMP%\opencode\cep_cdp2.mjs testes\testes-base-fixa.js
 * Requer a ferramenta aberta e a faca lida.
 *
 * Cobre: base automática, troca manual, base imóvel em 0/90/180 (matriz e
 * eixos), demais faces acompanhando, câmera sem trocar a base, confirmação e
 * volta à automática. A invalidação por geometria nova é coberta no Node
 * (testes-geometria.mjs, seção BASE FIXA).
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
if (!v || !v.base || !v.definirBase) return "LEIA_A_FACA";

function identidade(m) {
  return !!m &&
    Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[5] - 1) < 1e-9 &&
    Math.abs(m[10] - 1) < 1e-9 && Math.abs(m[15] - 1) < 1e-9 &&
    Math.abs(m[12]) < 1e-9 && Math.abs(m[13]) < 1e-9 && Math.abs(m[14]) < 1e-9;
}
function rotacaoNaoIdentidade(m) {
  return !!m && (
    Math.abs(m[0] - 1) > 1e-9 || Math.abs(m[1]) > 1e-9 || Math.abs(m[2]) > 1e-9 ||
    Math.abs(m[4]) > 1e-9 || Math.abs(m[5] - 1) > 1e-9 || Math.abs(m[6]) > 1e-9 ||
    Math.abs(m[8]) > 1e-9 || Math.abs(m[9]) > 1e-9 || Math.abs(m[10] - 1) > 1e-9
  );
}
function definirAngulo(graus) {
  const slider = document.getElementById("faca3dAngulo");
  slider.value = String(graus);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
}

// ---------------------------------------------------- 1) base automática
const auto = v.base();
ok("base automática ativa", !!auto && auto.manual === false, JSON.stringify(auto));
ok("base automática = raiz da montagem", !!auto && auto.raiz === v.montagem().raiz);
ok("rótulo mostra a base", /Base fixa atual: Painel \d+/.test(txt("faca3dDiagBase")), txt("faca3dDiagBase"));
ok("botão Base automática desabilitado na automática",
  document.getElementById("faca3dBtnBaseAuto").disabled === true);

const montadas = v.montagem().facesMontadas.slice();
const raizAuto = auto.raiz;
const alvo = montadas.indexOf(22) >= 0 ? 22 : montadas.filter(function (f) { return f !== raizAuto; })[0];
ok("há um painel válido para escolher", alvo !== undefined, "montadas=" + montadas.join(","));

// ---------------------------------------------------- 2) troca manual (UI)
document.getElementById("faca3dBtnBaseDefinir").click();
await wait(120);
ok("entrou no modo de escolha", document.getElementById("faca3dBaseBar").hidden === false);
ok("barra pede o painel", /Escolha o painel/.test(txt("faca3dBaseBarText")), txt("faca3dBaseBarText"));
ok("confirmar desabilitado antes da escolha",
  document.getElementById("faca3dBaseBarOk").disabled === true);

const lista = document.getElementById("faca3dFaceLista");
lista.value = String(alvo);
lista.dispatchEvent(new Event("change", { bubbles: true }));
await wait(150);
ok("confirmação pede o painel escolhido",
  txt("faca3dBaseBarText").indexOf("Painel " + alvo) >= 0, txt("faca3dBaseBarText"));
ok("confirmar habilitado após escolher",
  document.getElementById("faca3dBaseBarOk").disabled === false);

document.getElementById("faca3dBaseBarOk").click();
await wait(250);
const info = v.base();
ok("base manual aplicada", !!info && info.manual === true && info.raiz === alvo, JSON.stringify(info));
ok("rótulo marca manual", txt("faca3dDiagBase").indexOf("(manual)") >= 0, txt("faca3dDiagBase"));
ok("barra esconde após confirmar", document.getElementById("faca3dBaseBar").hidden === true);
ok("lista volta às dobras", /todas as dobras/.test(lista.options[0].textContent));

// --------------------------- 3/4) imóvel em 0/90/180 e demais acompanhando
for (const ang of [0, 90, 180]) {
  definirAngulo(ang);
  await wait(350);
  const ins = v.inspecionar();
  const mRoot = ins.matrices[ins.base.raiz];
  ok("painel " + alvo + " imóvel em " + ang + "° (matriz identidade)", identidade(mRoot),
    JSON.stringify(mRoot));
  let erroMax = 0;
  for (const h of ins.hinges) {
    if (h.rigida) continue;
    erroMax = Math.max(erroMax, h.erroP1, h.erroP2);
  }
  ok("eixos das dobradiças preservados em " + ang + "°", erroMax < 1e-6, "erro=" + erroMax);
  const comRotacao = Object.keys(ins.matrices).filter(function (id) {
    return rotacaoNaoIdentidade(ins.matrices[id]);
  }).length;
  if (ang === 0) ok("0°: nenhuma face girada", comRotacao === 0, "n=" + comRotacao);
  if (ang === 90) ok("90°: as demais faces giram", comRotacao > 0, "n=" + comRotacao);
  if (ang === 180) ok("180°: faces giradas e finitas", comRotacao > 0 && erroMax < 1e-6, "n=" + comRotacao);
}

// ---------------------------------------------------- 5) câmera não muda base
definirAngulo(90);
await wait(200);
v.definirVista("frente");
await wait(150);
v.definirVista("perspectiva_esquerda");
await wait(150);
ok("girar a câmera mantém a base", v.base().raiz === alvo && v.base().manual === true,
  JSON.stringify(v.base()));

// ---------------------------------------------------- 6) voltar à automática
document.getElementById("faca3dBtnBaseAuto").click();
await wait(300);
const volta = v.base();
ok("voltou à base automática", volta.manual === false && volta.raiz === volta.raizAutomatica,
  JSON.stringify(volta));
ok("rótulo volta a automática", txt("faca3dDiagBase").indexOf("(automática)") >= 0, txt("faca3dDiagBase"));
ok("raiz automática restaurada", volta.raiz === raizAuto, "raiz=" + volta.raiz);

// ------------------------- 7) painel inválido é recusado sem mudar a base
const antes = v.base();
const r = v.definirBase(9999);
ok("painel inexistente recusado", r && r.ok === false && !!r.motivo, JSON.stringify(r));
ok("base não mudou após recusa", v.base().raiz === antes.raiz && v.base().manual === antes.manual);

// limites: encerra no estado padrão
definirAngulo(90);
await wait(200);
document.getElementById("faca3dFaceLista").value = "";
v.definirVista("baixo");

return saida.join("\n") + "\n\nTOTAL=" + total + " FALHAS=" + falhas;
