/* FACA 3D — testes da arte única (camada ARTE, lateral inteira).
 * Executar: node testes/testes-arte-unica.mjs
 * Cobre: uvFaca, caixaFacaDe, recorteParaFaca (funções puras, sem DOM).
 */
globalThis.window = globalThis;
await import("../js/view/arteUnica.js");

const AU = globalThis.Faca3D.view.arteUnica;

let total = 0;
let falhas = 0;
const linhas = [];
function ok(nome, cond, det) {
  total++;
  if (cond) linhas.push("  ok   " + nome);
  else { falhas++; linhas.push("  FALHA " + nome + (det ? " -> " + det : "")); }
}
function quase(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol); }

// uvFaca: origem 0,0 base -> 0,0 ; (W,H) -> 1,1 ; centro -> 0.5,0.5
let uv = AU.uvFaca({ x: 0, y: 0 }, 200, 100);
ok("uv origem 0,0", quase(uv.u, 0) && quase(uv.v, 0), JSON.stringify(uv));
uv = AU.uvFaca({ x: 200, y: 100 }, 200, 100);
ok("uv canto oposto 1,1", quase(uv.u, 1) && quase(uv.v, 1), JSON.stringify(uv));
uv = AU.uvFaca({ x: 100, y: 50 }, 200, 100);
ok("uv centro 0.5,0.5", quase(uv.u, 0.5) && quase(uv.v, 0.5), JSON.stringify(uv));
uv = AU.uvFaca({ x: 50, y: 25 }, 200, 100);
ok("uv quarto 0.25,0.25", quase(uv.u, 0.25) && quase(uv.v, 0.25), JSON.stringify(uv));
uv = AU.uvFaca({ x: 10, y: 10 }, 0, 100);
ok("uv W zero não quebra", uv.u === 0 && uv.v === 0, JSON.stringify(uv));
uv = AU.uvFaca(null, 200, 100);
ok("uv ponto nulo não quebra", uv.u === 0 && uv.v === 0, JSON.stringify(uv));

// caixaFacaDe: usa geometria normalizada quando presente
let cf = AU.caixaFacaDe({ largura: 300, altura: 150 }, null);
ok("caixaFacaDe usa geo", quase(cf.W, 300) && quase(cf.H, 150), JSON.stringify(cf));
cf = AU.caixaFacaDe(null, [{ x: 10, y: 20 }, { x: 110, y: 70 }]);
ok("caixaFacaDe fallback pontos", quase(cf.W, 100) && quase(cf.H, 50), JSON.stringify(cf));
cf = AU.caixaFacaDe({ largura: 0, altura: 0 }, []);
ok("caixaFacaDe vazio 0,0", cf.W === 0 && cf.H === 0, JSON.stringify(cf));

// recorteParaFaca: faca == artboard inteira -> PNG inteiro
let r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 0, top: 100, right: 200, bottom: 0 });
ok("recorte cheia", r && r.sx === 0 && r.sy === 0 && r.sw === 1000 && r.sh === 500, JSON.stringify(r));

// metade direita da artboard: sx=500, sy=0, sw=500, sh=500
r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 100, top: 100, right: 200, bottom: 0 });
ok("recorte metade direita", r && r.sx === 500 && r.sy === 0 && r.sw === 500 && r.sh === 500, JSON.stringify(r));

// metade superior (Y para cima): sy=0, sh=250 (topo do PNG)
r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 0, top: 100, right: 200, bottom: 50 });
ok("recorte metade topo (Y invertido)", r && r.sx === 0 && r.sy === 0 && r.sw === 1000 && r.sh === 250, JSON.stringify(r));

// metade inferior: sy=250, sh=250
r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 0, top: 50, right: 200, bottom: 0 });
ok("recorte metade base", r && r.sx === 0 && r.sy === 250 && r.sw === 1000 && r.sh === 250, JSON.stringify(r));

// faca fora da artboard -> null
r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 300, top: 100, right: 400, bottom: 0 });
ok("recorte fora null", r === null, JSON.stringify(r));

// faca W zero -> null
r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 50, top: 100, right: 50, bottom: 0 });
ok("recorte W zero null", r === null, JSON.stringify(r));

// PNG zero -> null
r = AU.recorteParaFaca(0, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 0, top: 100, right: 200, bottom: 0 });
ok("recorte PNG zero null", r === null, JSON.stringify(r));

// fora clampada: faca metade dentro, metade fora -> recorta dentro
r = AU.recorteParaFaca(1000, 500,
  { left: 0, top: 100, right: 200, bottom: 0 },
  { left: 150, top: 100, right: 250, bottom: 0 });
ok("recorte clamp dentro", r && r.sx === 750 && r.sw === 250, JSON.stringify(r));

// uvFacaInversa: u espelhado (artboard espelhada), v igual
uv = AU.uvFacaInversa({ x: 0, y: 0 }, 200, 100);
ok("uv inversa origem 1,0", quase(uv.u, 1) && quase(uv.v, 0), JSON.stringify(uv));
uv = AU.uvFacaInversa({ x: 200, y: 100 }, 200, 100);
ok("uv inversa canto 0,1", quase(uv.u, 0) && quase(uv.v, 1), JSON.stringify(uv));
uv = AU.uvFacaInversa({ x: 50, y: 25 }, 200, 100);
ok("uv inversa quarto 0.75,0.25", quase(uv.u, 0.75) && quase(uv.v, 0.25), JSON.stringify(uv));

// decidirDupla por nome
function ab(nome) { return { indice: 0, nome: nome, hasArte: true, rect: null }; }
let d = AU.decidirDupla([ab("externo"), ab("interno")]);
ok("dupla EXTERNO/INTERNO", d.extIdx === 0 && d.intIdx === 1, JSON.stringify(d));
d = AU.decidirDupla([ab("FRENTE"), ab("VERSO")]);
ok("dupla FRENTE/VERSO", d.extIdx === 0 && d.intIdx === 1, JSON.stringify(d));
d = AU.decidirDupla([ab("INTERNO"), ab("EXTERNO")]);
ok("dupla nome manda (trocado)", d.extIdx === 1 && d.intIdx === 0, JSON.stringify(d));
d = AU.decidirDupla([ab("Artboard 1"), ab("Artboard 2")]);
ok("dupla sem nome usa ordem", d.extIdx === 0 && d.intIdx === 1 && d.avisos.length > 0, JSON.stringify(d));
d = AU.decidirDupla([ab("Externo")]);
ok("dupla 1 artboard = externa", d.extIdx === 0 && d.intIdx === null, JSON.stringify(d));
d = AU.decidirDupla([]);
ok("dupla vazio não quebra", d.extIdx === null && d.intIdx === null, JSON.stringify(d));

linhas.push("TOTAL=" + total + " FALHAS=" + falhas);
console.log(linhas.join("\n"));
process.exit(falhas ? 1 : 0);
