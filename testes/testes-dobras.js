/* FACA 3D — teste de SALVAR/RESTAURAR os ângulos definidos à mão.
 *
 * Executar com o painel CEP exposto em 127.0.0.1:7778/7777:
 *   node %TEMP%\opencode\cep_cdp2.mjs testes\testes-dobras.js
 * Requer a ferramenta aberta e a faca lida.
 *
 * Grava um arquivo real em %APPDATA%\FACA3D\dobras (chave do
 * documento + geometria), restaura, relê a faca e confere a persistência.
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
function definirAngulo(graus) {
  const s = document.getElementById("faca3dAngulo");
  s.value = String(graus);
  s.dispatchEvent(new Event("input", { bubbles: true }));
}
async function esperar(cond, ms) {
  const limite = Date.now() + (ms || 5000);
  while (Date.now() < limite) {
    try { if (cond()) return true; } catch (e) {}
    await wait(120);
  }
  return false;
}
function todosIguais(mapa, valor) {
  const ids = Object.keys(mapa || {});
  if (!ids.length) return false;
  return ids.every(function (id) { return Math.abs(mapa[id] - valor) < 0.001; });
}

if (!document.getElementById("faca3dApp")) return "ABRA_A_FERRAMENTA";
const v = Faca3D.viewer3dAtual;
if (!v || !v.aplicarDobras || !v.angulosAtuais) return "LEIA_A_FACA";
const art = v.articulaveis();
if (!art.length) return "SEM_FACES";

// ---------------------------------------------------- estado inicial previsível
definirAngulo(0);
await wait(250);

// ---------------------------------------------------- 1) salvar 90°
definirAngulo(90);
await wait(350);
ok("ângulo global aplicado em 90°", todosIguais(v.angulosAtuais(), 90), JSON.stringify(v.angulosAtuais()));
document.getElementById("faca3dBtnSalvarDobra").click();
const salvou = await esperar(function () { return /Ângulos salvos/.test(txt("faca3dStatusText")); }, 4000);
ok("salvar ângulos grava no disco", salvou, txt("faca3dStatusText"));

// ---------------------------------------------------- 2) mudar e restaurar
definirAngulo(0);
await wait(250);
ok("ângulos zerados antes de restaurar", todosIguais(v.angulosAtuais(), 0), JSON.stringify(v.angulosAtuais()));
document.getElementById("faca3dBtnRestaurarDobra").click();
const restaurou = await esperar(function () { return todosIguais(v.angulosAtuais(), 90); }, 4000);
ok("restaurar devolve os 90°", restaurou, JSON.stringify(v.angulosAtuais()));
ok("status informa a restauração", /Ângulos restaurados/.test(txt("faca3dStatusText")), txt("faca3dStatusText"));
ok("slider acompanha o ângulo restaurado", txt("faca3dAnguloValor") === "90°", txt("faca3dAnguloValor"));

// ---------------------------------------------------- 3) releitura preserva
await wait(3200); // respeita o debounce de 3 s da leitura
document.getElementById("faca3dBtnLer").click();
const releu = await esperar(function () {
  return /restaurados/i.test(txt("faca3dStatusText")) && todosIguais(v.angulosAtuais(), 90);
}, 12000);
ok("reler a faca restaura os ângulos salvos", releu,
  txt("faca3dStatusText") + " | " + JSON.stringify(v.angulosAtuais()));

// ---------------------------------------------------- 4) configuração individual
if (v.articulaveis().length >= 2) {
  const faces = v.articulaveis();
  v.definirArticulacao(faces[0], 45, 1);
  v.definirArticulacao(faces[1], 120, -1);
  await wait(300);
  document.getElementById("faca3dBtnSalvarDobra").click();
  await esperar(function () { return /Ângulos salvos/.test(txt("faca3dStatusText")); }, 4000);
  definirAngulo(0);
  await wait(250);
  document.getElementById("faca3dBtnRestaurarDobra").click();
  const voltaIndividual = await esperar(function () {
    const a = v.angulosAtuais();
    return Math.abs(a[faces[0]] - 45) < 0.001 && Math.abs(a[faces[1]] - 120) < 0.001;
  }, 4000);
  ok("ângulos por face são preservados", voltaIndividual, JSON.stringify(v.angulosAtuais()));
  ok("sentido por face é preservado", v.sinalDaFace(faces[1]) === -1, "sinal=" + v.sinalDaFace(faces[1]));
}

// ---------------------------------------------------- limpeza
document.getElementById("faca3dBtnSalvarDobra").click();
await wait(200);
definirAngulo(0);
await wait(200);

return saida.join("\n") + "\n\nTOTAL=" + total + " FALHAS=" + falhas;
