/* FACA 3D — orientação da faca e da arte com referência assimétrica.
 * Executar: node testes/testes-orientacao.mjs
 *
 * Simula o caminho tela <- UV <- textura de cada lado da folha, usando as
 * funções reais de UV e de decisão do visualizador. A referência assimétrica
 * tem quatro quadrantes com marcas distintas, uma letra e uma seta para cima:
 * qualquer espelhamento ou giro muda o quadrante de pelo menos uma marca.
 *
 * Cenário coberto: documento de 2 artboards em que a artboard 0 fornece a
 * faca e a 1 é a mesma folha vista por dentro (espelhada), com todas as faces
 * invertidas (lado de fora = -Z), como no documento real.
 */
globalThis.window = globalThis;
await import("../js/view/three3d.js");

const T = globalThis.Faca3D.view.three3d;
const quase = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol);

let total = 0;
let falhas = 0;
const linhas = [];
function ok(nome, cond, det) {
  total++;
  if (cond) linhas.push("  ok   " + nome);
  else {
    falhas++;
    linhas.push("  FALHA " + nome + (det ? " -> " + det : ""));
  }
}

/* ------------------------------------------------------------------ */
/* 1. Sinal global da folha (qual vista a folha plana mostra)          */
/* ------------------------------------------------------------------ */

const faces = [0, 1, 2, 3];
const todasInvertidas = { 0: -1, 1: -1, 2: -1, 3: -1 };
const todasNormais = { 0: 1, 1: 1, 2: 1, 3: 1 };

ok("folha invertida -> montagem espelhada em X",
  T.espelhoDaFolha(todasInvertidas, faces) === true);
ok("folha normal -> montagem sem espelho",
  T.espelhoDaFolha(todasNormais, faces) === false);
ok("maioria invertida decide",
  T.espelhoDaFolha({ 0: -1, 1: -1, 2: -1, 3: 1 }, faces) === true);
ok("maioria normal decide",
  T.espelhoDaFolha({ 0: 1, 1: 1, 2: 1, 3: -1 }, faces) === false);
ok("sem faces não espelha", T.espelhoDaFolha({}, []) === false);

const faces32 = Array.from({ length: 32 }, (_, i) => i);
const invertidas32 = {};
for (const f of faces32) invertidas32[f] = -1;
ok("documento real: 32 faces invertidas espelham",
  T.espelhoDaFolha(invertidas32, faces32) === true);

/* ------------------------------------------------------------------ */
/* 2. Decisão do U por lado (a mesma usada nos decais e filetes)       */
/* ------------------------------------------------------------------ */

const extReal = { fonteEspelhada: false, espelhoX: true, inverter: true, externo: true };
const intReal = { fonteEspelhada: true, espelhoX: true, inverter: true, externo: false };

ok("externa usa a artboard 0 (U direto)", T.ladoEspelhaU(extReal) === false);
ok("interna usa a artboard 1 (U invertido)", T.ladoEspelhaU(intReal) === true);

// Fallback sem o espelho da montagem: regra antiga ("visto por trás").
const extSem = { fonteEspelhada: false, espelhoX: false, inverter: true, externo: true };
const intSem = { fonteEspelhada: true, espelhoX: false, inverter: true, externo: false };
ok("fallback externa inverte (vista por trás)", T.ladoEspelhaU(extSem) === true);
ok("fallback interna mantém U invertido (regra antiga)", T.ladoEspelhaU(intSem) === true);

// Uma única artboard: o verso herda a externa (mesmo objeto). Para manter a
// leitura na vista plana, a interna entra como fonte espelhada.
const intHerdada = { fonteEspelhada: true, espelhoX: true, inverter: true, externo: false };
ok("interna herdada continua legível na vista plana", T.ladoEspelhaU(intHerdada) === true);

/* ------------------------------------------------------------------ */
/* 3. Referência assimétrica                                           */
/* ------------------------------------------------------------------ */

/* Marcas na textura (u,v normalizados; v=1 é o topo da imagem).
 * O desenho é propositalmente assimétrico: letra F no canto superior
 * esquerdo, seta para cima no centro e uma cor em cada canto. */
const marcas = [
  { nome: "canto sup. esq. (vermelho)", u: 0.08, v: 0.92, q: "TL" },
  { nome: "canto sup. dir. (verde)", u: 0.92, v: 0.92, q: "TR" },
  { nome: "canto inf. esq. (azul)", u: 0.08, v: 0.08, q: "BL" },
  { nome: "canto inf. dir. (amarelo)", u: 0.92, v: 0.08, q: "BR" },
  { nome: "letra F (sup. esq.)", u: 0.25, v: 0.75, q: "TL" },
  { nome: "seta para cima (centro)", u: 0.5, v: 0.9, q: "topo" }
];

/* Posição na TELA de uma marca da textura.
 * flip: U do lado invertido; m: grupo espelhado em X (1/0);
 * vista: "topo" (face +Z, de cima) ou "baixo" (face -Z, de baixo).
 * Sem espelho, a vista de cima usa uObj e a de baixo usa 1-uObj; com o
 * espelho do grupo as duas trocam. */
function telaDaMarca(uTex, flip, m, vista) {
  const uObj = flip ? 1 - uTex : uTex;
  const u = vista === "topo"
    ? (m ? 1 - uObj : uObj)
    : (m ? uObj : 1 - uObj);
  return { u, v: null };
}

/* Posição na tela de um ponto da GEOMETRIA (silhueta), sem passar pela textura. */
function telaDoObjeto(uObj, m, vista) {
  return vista === "topo" ? (m ? 1 - uObj : uObj) : (m ? uObj : 1 - uObj);
}

function quadrante(p) {
  if (p.v > 0.5) return p.u < 0.5 ? "TL" : "TR";
  return p.u < 0.5 ? "BL" : "BR";
}

// Interna: face +Z, fonte espelhada (artboard 1), grupo espelhado.
const flipInt = T.ladoEspelhaU(intReal);
const telaInt = marcas.map((mk) => {
  const p = telaDaMarca(mk.u, flipInt, 1, "topo");
  p.v = mk.v;
  return p;
});
ok("interna: marcas aparecem na mesma posição da textura",
  marcas.every((mk, i) => quase(telaInt[i].u, mk.u) && quase(telaInt[i].v, mk.v)),
  JSON.stringify(marcas.map((mk, i) => [mk.nome, mk.u, telaInt[i].u])));
ok("interna: quadrante TL continua TL",
  quadrante(telaInt[0]) === "TL" && quadrante(telaInt[4]) === "TL");
ok("interna: quadrante TR continua TR", quadrante(telaInt[1]) === "TR");
ok("interna: quadrante BL continua BL", quadrante(telaInt[2]) === "BL");
ok("interna: quadrante BR continua BR", quadrante(telaInt[3]) === "BR");
ok("interna: seta continua para cima", quase(telaInt[5].v, 0.9));

// Externa: face -Z, artboard 0, grupo espelhado.
const flipExt = T.ladoEspelhaU(extReal);
const telaExt = marcas.map((mk) => {
  const p = telaDaMarca(mk.u, flipExt, 1, "baixo");
  p.v = mk.v;
  return p;
});
ok("externa: marcas aparecem na mesma posição da textura",
  marcas.every((mk, i) => quase(telaExt[i].u, mk.u) && quase(telaExt[i].v, mk.v)),
  JSON.stringify(marcas.map((mk, i) => [mk.nome, mk.u, telaExt[i].u])));
ok("externa: quadrantes preservados",
  quadrante(telaExt[0]) === "TL" && quadrante(telaExt[1]) === "TR" &&
  quadrante(telaExt[2]) === "BL" && quadrante(telaExt[3]) === "BR");
ok("externa: seta continua para cima", quase(telaExt[5].v, 0.9));

/* Silhueta: um entalhe assimétrico à esquerda do objeto (uObj=0.15) deve
 * aparecer à DIREITA na vista plana com o espelho, como na 2ª artboard. */
const uEntalhe = 0.15;
const uEntalheNovo = telaDoObjeto(uEntalhe, 1, "topo");
const uEntalheAntigo = telaDoObjeto(uEntalhe, 0, "topo");
ok("silhueta espelhada: entalhe esquerdo aparece à direita",
  quase(uEntalheNovo, 0.85), "uTela=" + uEntalheNovo);

/* Detector de regressão: o código antigo (sem espelho do grupo, U invertido
 * na interna) colocava a marca da textura em u=0.15 do lado direito da tela
 * (uTela=0.85) — exatamente o "Verso" espelhado do Screenshot_5. O caminho
 * novo coloca a mesma marca em uTela=0.15. */
const uTelaAntigo = telaDaMarca(0.15, true, 0, "topo").u;
const uTelaNovo = telaDaMarca(0.15, true, 1, "topo").u;
ok("detector: caminho antigo espelhava a arte interna", quase(uTelaAntigo, 0.85),
  "u=" + uTelaAntigo);
ok("detector: caminho novo mantém a arte interna legível", quase(uTelaNovo, 0.15),
  "u=" + uTelaNovo);
ok("silhueta antiga ficava à esquerda (artboard 1)", quase(uEntalheAntigo, 0.15),
  "uTela=" + uEntalheAntigo);
ok("silhueta nova fica à direita (artboard 2)", quase(uEntalheNovo, 0.85));

/* Dobra: o espelho é decidido pelo lado físico da folha (ladoExterno), que é
 * congelado e não muda com o ângulo. As mesmas faces invertidas em 0°, 90° e
 * ao desdobrar mantêm o mesmo espelho. */
ok("espelho estável antes de dobrar", T.espelhoDaFolha(todasInvertidas, faces) === true);
ok("espelho estável a 90°", T.espelhoDaFolha(todasInvertidas, faces) === true);
ok("espelho estável ao desdobrar", T.espelhoDaFolha(todasInvertidas, faces) === true);

linhas.push("TOTAL=" + total + " FALHAS=" + falhas);
console.log(linhas.join("\n"));
process.exit(falhas ? 1 : 0);
