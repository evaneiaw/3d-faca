/* FACA 3D — testes do Structural Line Resolver.
 * Executar: node testes/testes-estruturais.mjs
 */

globalThis.window = globalThis;

await import("../js/core/structural-lines.js");

const S = globalThis.Faca3D.geometry.structural;
let total = 0;
let falhas = 0;
const saida = [];

function ok(nome, cond, detalhe) {
  total++;
  if (cond) saida.push("  ok   " + nome);
  else {
    falhas++;
    saida.push("  FALHA " + nome + (detalhe ? " -> " + detalhe : ""));
  }
}

function seg(id, x1, y1, x2, y2, faces, caminho) {
  return {
    id: id,
    caminho: caminho === undefined ? id : caminho,
    classe: "crease",
    tipo: "reta",
    p0: { x: x1, y: y1 },
    p1: { x: x2, y: y2 },
    comprimentoMm: Math.hypot(x2 - x1, y2 - y1),
    faces: faces || [1, 2]
  };
}

function cort(id, x1, y1, x2, y2) {
  return {
    id: id,
    caminho: 1000 + id,
    classe: "cut",
    tipo: "reta",
    p0: { x: x1, y: y1 },
    p1: { x: x2, y: y2 },
    comprimentoMm: Math.hypot(x2 - x1, y2 - y1),
    faces: []
  };
}

function resolver(segmentos, cortes) {
  return S.resolver({
    segmentos: segmentos,
    cortes: cortes || [],
    faces: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    escala: 1000
  });
}

/* 1. Dois vincos alinhados com pequena lacuna. */
{
  const r = resolver([seg(0, 0, 0, 10, 0), seg(1, 11, 0, 20, 0)]);
  ok("lacuna pequena: 1 linha", r.linhas.length === 1, "n=" + r.linhas.length);
  ok("lacuna pequena: 1 conexão", r.linhas[0].conexoes.length === 1, "n=" + r.linhas[0].conexoes.length);
  ok("lacuna pequena: gap 1", Math.abs(r.linhas[0].conexoes[0].gapMm - 1) < 0.01);
  ok("lacuna pequena: tipo lacuna", r.linhas[0].conexoes[0].tipo === "lacuna");
}

/* 2. Lacuna grande coberta pelo mesmo par de faces (recorte). */
{
  const r = resolver([seg(0, 0, 0, 10, 0), seg(1, 70, 0, 80, 0)]);
  ok("recorte 60mm: 1 linha", r.linhas.length === 1, "n=" + r.linhas.length);
  ok("recorte 60mm: tipo recorte", r.linhas[0].conexoes.length === 1 && r.linhas[0].conexoes[0].tipo === "recorte");
  ok("recorte 60mm: gap 60", Math.abs(r.linhas[0].conexoes[0].gapMm - 60) < 0.01);
}

/* 3. Lacuna grande com faces diferentes: NÃO conectar. */
{
  const r = resolver([seg(0, 0, 0, 10, 0, [1, 2]), seg(1, 70, 0, 80, 0, [3, 4])]);
  ok("faces diferentes: 2 linhas", r.linhas.length === 2, "n=" + r.linhas.length);
  ok("faces diferentes: rejeitada", r.rejeicoes.some(function (x) { return x.motivo === "lacuna-grande"; }));
}

/* 4. Perpendicular: não é continuação. */
{
  const r = resolver([seg(0, 0, 0, 10, 0), seg(1, 10, 0, 10, 10)]);
  ok("perpendicular: 2 linhas", r.linhas.length === 2);
  ok("perpendicular: rejeição angular", r.rejeicoes.some(function (x) { return x.motivo === "angular"; }));
}

/* 5. Paralelas deslocadas 3 mm: não conectar por proximidade. */
{
  const r = resolver([seg(0, 0, 0, 10, 0), seg(1, 11, 3, 20, 3)]);
  ok("offset 3mm: 2 linhas", r.linhas.length === 2, "n=" + r.linhas.length);
  ok("offset 3mm: rejeição desalinhado", r.rejeicoes.some(function (x) { return x.motivo === "desalinhado"; }));
}

/* 6. Vinco composto por três segmentos. */
{
  const r = resolver([seg(0, 0, 0, 10, 0), seg(1, 11, 0, 20, 0), seg(2, 21, 0, 30, 0)]);
  ok("composto: 1 linha", r.linhas.length === 1);
  ok("composto: 2 conexões", r.linhas[0].conexoes.length === 2);
  ok("composto: caminhos únicos", r.linhas[0].paths.length === 3);
}

/* 7. Vinco termina antes de um corte: extensão virtual. */
{
  const r = resolver([seg(0, 0, 0, 0, 10)], [cort(50, -5, 12, 5, 12)]);
  ok("extensão: 1 linha", r.linhas.length === 1);
  ok("extensão: 1 extensão", r.linhas[0].extensoes.length === 1, "n=" + r.linhas[0].extensoes.length);
  ok("extensão: 2 mm até corte", r.linhas[0].extensoes.length === 1 &&
    Math.abs(r.linhas[0].extensoes[0].gapMm - 2) < 0.01 &&
    r.linhas[0].extensoes[0].alvoClasse === "cut");
}

/* 8. Extensão não atravessa uma linha estrutural: para na linha mais próxima. */
{
  const r = resolver(
    [seg(0, 0, 0, 0, 10), seg(1, -5, 11, 5, 11)],
    [cort(50, -5, 12, 5, 12)]
  );
  const vertical = r.linhas.filter(function (l) { return l.paths.indexOf(0) >= 0; })[0];
  ok("extensão bloqueada: para no vinco a 1 mm",
    vertical && vertical.extensoes.length === 1 &&
      Math.abs(vertical.extensoes[0].gapMm - 1) < 0.01 &&
      vertical.extensoes[0].alvoClasse === "crease",
    vertical ? "n=" + vertical.extensoes.length + " " + JSON.stringify(vertical.extensoes) : "sem linha");
}

/* 9. Duas conexões possíveis: ambiguidade. */
{
  const r = resolver([
    seg(0, 0, 0, 0, 10),
    seg(1, 0, 10, 0.1, 13.8),
    seg(2, 0, 10, -0.1, 13.8)
  ]);
  ok("ambiguidade: sem conexões", r.linhas.every(function (l) { return l.conexoes.length === 0; }),
    "linhas=" + r.linhas.map(function (l) { return l.conexoes.length; }).join(","));
  const amb = r.rejeicoes.filter(function (x) { return x.motivo === "ambiguidade"; }).length;
  ok("ambiguidade: registrada", amb >= 2, "n=" + amb);
}

/* 10. Corte atravessando a ponte virtual: não conectar. */
{
  const r = resolver(
    [seg(0, 0, 0, 5, 0), seg(1, 15, 0, 20, 0)],
    [cort(50, 10, -5, 10, 5)]
  );
  ok("corte na ponte: 2 linhas", r.linhas.length === 2, "n=" + r.linhas.length);
  ok("corte na ponte: rejeição", r.rejeicoes.some(function (x) { return x.motivo === "cruzamento-corte"; }));
}

/* 11. Curvas e comprimento zero não entram. */
{
  const curva = seg(0, 0, 0, 10, 10);
  curva.tipo = "curva";
  const zero = seg(1, 0, 0, 0, 0);
  const r = resolver([curva, zero]);
  ok("curva/zero ignorados", r.resumo.segmentosVinco === 0, "n=" + r.resumo.segmentosVinco);
}

/* 12. Tolerâncias proporcionais à escala. */
{
  const a = S.tolerancias(1000);
  const b = S.tolerancias(100);
  ok("tolerância gap proporcional", a.gapMm > b.gapMm, a.gapMm + " vs " + b.gapMm);
  ok("tolerância projeção proporcional", a.projecaoMm > b.projecaoMm);
}

/* 13. Geometria original não é alterada. */
{
  const a = seg(0, 1.234, 5.678, 9.876, 5.678);
  const antes = JSON.stringify(a);
  resolver([a]);
  ok("geometria original intacta", JSON.stringify(a) === antes);
}

console.log(saida.join("\n"));
console.log("\nTOTAL=" + total + " FALHAS=" + falhas);
process.exit(falhas ? 1 : 0);
