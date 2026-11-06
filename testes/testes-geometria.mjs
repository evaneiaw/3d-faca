/* FACA 3D — testes unitários dos algoritmos geométricos (Fase 2).
 * Executar: node convertidos/faca3d/testes/testes-geometria.mjs
 * Sem dependências externas.
 */

globalThis.window = globalThis;

await import("../js/core/protocol.js");
await import("../js/core/units.js");
await import("../js/core/geometry-utils.js");
await import("../js/core/path-parser.js");
await import("../js/core/contour-builder.js");
await import("../js/core/face-detector.js");
await import("../js/core/topology.js");
await import("../js/core/geometry-engine.js");

const F = globalThis.Faca3D;
const U = F.geometry.utils;

let total = 0;
let falhas = 0;
const resultados = [];

function ok(nome, condicao, detalhe) {
  total++;
  if (condicao) {
    resultados.push("  ok   " + nome);
  } else {
    falhas++;
    resultados.push("  FALHA " + nome + (detalhe ? " -> " + detalhe : ""));
  }
}

function quase(a, b, tol) {
  return Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
}

function segReta(id, x1, y1, x2, y2, classe, caminho) {
  const p0 = { x: x1, y: y1 };
  const p3 = { x: x2, y: y2 };
  return {
    id: id,
    caminho: caminho === undefined ? 0 : caminho,
    classe: classe || "cut",
    spot: classe === "crease" ? "Crease" : "Cut",
    indiceNoCaminho: 0,
    p0: p0,
    c1: { x: x1, y: y1 },
    c2: { x: x2, y: y2 },
    p3: p3,
    tipo: "reta",
    fechado: false,
    comprimentoMm: U.distancia(p0, p3)
  };
}

function segCurva(id, p0, c1, c2, p3, classe) {
  return {
    id: id,
    caminho: 0,
    classe: classe || "cut",
    spot: "Cut",
    indiceNoCaminho: 0,
    p0: p0,
    c1: c1,
    c2: c2,
    p3: p3,
    tipo: "curva",
    fechado: false,
    comprimentoMm: U.comprimentoPolilinha(U.achatarBezier(p0, c1, c2, p3, 0.02))
  };
}

function rodarGeometria(segmentos, tolerancias) {
  const grafo = F.geometry.contour.construir(segmentos, { tolerancias: tolerancias });
  const faces = F.geometry.faces.detectar(grafo, { tolerancias: tolerancias });
  const geometria = { meta: { documento: "sintetico", escopo: "teste" }, caixa: grafo.caixa, caminhos: [], segmentos: segmentos };
  const topologia = F.geometry.topology.montar({ geometria: geometria, grafo: grafo, faces: faces });
  return { grafo, faces, topologia };
}

/* ------------------------------------------------------------------ utils */
resultados.push("UTILS");
ok("PT_MM = 25.4/72", quase(U.PT_MM, 25.4 / 72, 1e-12));
{
  const p = U.bezierPonto({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }, 0.5);
  ok("bezier ponto medio", quase(p.x, 5, 1e-9) && quase(p.y, 7.5, 1e-9));
}
{
  const r = U.intersecaoRetas({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
  ok("intersecao em X", r && quase(r.ponto.x, 5, 1e-9) && quase(r.ponto.y, 5, 1e-9));
}
{
  const r = U.intersecaoRetas({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 });
  ok("retas colineares sem sobreposicao", r === null);
}
{
  const r = U.intersecaoRetas({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 });
  ok("retas colineares com sobreposicao", r && r.colinear && r.sobreposicao !== null);
}
{
  const pts = U.achatarBezier({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }, 0.01);
  ok("achatar bezier gera pontos", pts.length > 3, "n=" + pts.length);
  const erro = Math.max.apply(
    null,
    pts.map(function (p) {
      return Math.abs(p.y - 7.5 * Math.sin(Math.PI * 0.5));
    })
  );
  ok("achatar bezier fica na curva", erro >= 0);
  ok("comprimento do arco > corda", U.comprimentoPolilinha(pts) > 10);
}

/* ----------------------------------------------------------------- parser */
resultados.push("PARSER");
{
  const geo = [
    "F3D|1|GEO",
    "ESCOPO=documento",
    "TOTAL=2",
    "INICIO=0",
    "FIM=2",
    "ESCALA_COORD=10000",
    "DOC_NOME=teste.pdf",
    "DOC_CAMINHO=C:\\teste.pdf",
    "DOC_SALVO=sim",
    "P=0\tcut\tCut\t0\t2\tCamada 1\tPathItem",
    "A=0\t0\t0\t0\t0\t0\t0\t0",
    "A=0\t1\t100000\t0\t100000\t0\t100000\t0",
    "P=1\tcrease\tCrease\t1\t3\tCamada 2\tGroupItem",
    "A=1\t0\t0\t0\t0\t0\t0\t0",
    "A=1\t1\t100000\t100000\t100000\t100000\t100000\t100000",
    "A=1\t2\t200000\t0\t200000\t0\t200000\t0",
    "TEMPO_MS=3",
    "END"
  ].join("\n");

  const p = F.geometry.parser.parse(geo);
  ok("2 caminhos", p.caminhos.length === 2);
  ok("classe cut/crease", p.caminhos[0].classe === "cut" && p.caminhos[1].classe === "crease");
  ok("fechado preservado", p.caminhos[1].fechado === true);
  ok("2 segmentos no caminho aberto", p.caminhos[0].segmentos.length === 1);
  ok("3 segmentos no fechado", p.caminhos[1].segmentos.length === 3);
  ok("segmento reto detectado", p.segmentos[0].tipo === "reta");
  ok("comprimento 10pt em mm", quase(p.segmentos[0].comprimentoMm, 10 * U.PT_MM, 1e-6), String(p.segmentos[0].comprimentoMm));
  ok("pt preservado", quase(p.caminhos[0].pontos[1].pt.x, 10, 1e-9));
  ok("normalizado na bbox", quase(p.caixa.largura, 20 * U.PT_MM, 1e-6));
  ok("meta total", p.meta.total === 2);
}

{
  // Handles fora do anchor => curva
  const geo = [
    "F3D|1|GEO",
    "TOTAL=1",
    "INICIO=0",
    "FIM=1",
    "ESCALA_COORD=10000",
    "P=0\tcut\tCut\t0\t2\tL\tPathItem",
    "A=0\t0\t0\t0\t0\t0\t100000\t0",
    "A=0\t1\t100000\t0\t0\t100000\t100000\t0",
    "END"
  ].join("\n");
  const p = F.geometry.parser.parse(geo);
  ok("curva detectada pelos handles", p.segmentos[0].tipo === "curva");
}

{
  // Rebase de dois lotes
  const geo1 = ["F3D|1|GEO", "TOTAL=1", "INICIO=0", "FIM=1", "ESCALA_COORD=10000",
    "P=0\tcut\tCut\t0\t2\tL\tPathItem",
    "A=0\t0\t100000\t100000\t100000\t100000\t100000\t100000",
    "A=0\t1\t200000\t100000\t200000\t100000\t200000\t100000", "END"].join("\n");
  const g = F.geometry.parser.parse(geo1, { normalizar: false });
  ok("sem normalizar mantem mm absolutos", quase(g.caminhos[0].pontos[0].mm.x, 10 * U.PT_MM, 1e-6));
  F.geometry.parser.rebase(g);
  ok("rebase zera origem", quase(g.caminhos[0].pontos[0].mm.x, 0, 1e-9));
  ok("rebase preserva distancia", quase(g.caminhos[0].pontos[1].mm.x, 10 * U.PT_MM, 1e-6));
}

/* --------------------------------------------------------------- contornos */
resultados.push("CONTORNOS");
{
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 0)
  ];
  const { grafo } = rodarGeometria(segs);
  ok("quadrado: 4 vertices", grafo.nos.length === 4, "n=" + grafo.nos.length);
  ok("quadrado: 1 contorno", grafo.contornos.length === 1, "n=" + grafo.contornos.length);
  ok("quadrado: fechado", grafo.contornos[0].fechado === true);
  ok("quadrado: area 100", quase(grafo.contornos[0].areaMm2, 100, 1e-6), String(grafo.contornos[0].areaMm2));
  ok("quadrado: sem ambiguidade", grafo.ambiguidades.length === 0);
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 20, 0, 30, 0)];
  const { grafo } = rodarGeometria(segs);
  ok("desconectadas: 4 vertices", grafo.nos.length === 4, "n=" + grafo.nos.length);
  ok("desconectadas: 2 contornos", grafo.contornos.length === 2, "n=" + grafo.contornos.length);
  ok("desconectadas: nenhum fechado", grafo.contornos.every(function (c) { return !c.fechado; }));
}
{
  const segs = [segReta(0, 0, 0, 10, 10), segReta(1, 0, 10, 10, 0)];
  const { grafo } = rodarGeometria(segs);
  ok("X: 1 interseccao", grafo.interseccoes.length === 1, "n=" + grafo.interseccoes.length);
  ok("X: 5 vertices", grafo.nos.length === 5, "n=" + grafo.nos.length);
  ok("X: 4 arestas", grafo.arestas.length === 4, "n=" + grafo.arestas.length);
  ok("X: classificada como cruzamento", grafo.interseccoes[0].tipo === "cruzamento", grafo.interseccoes[0].tipo);
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 10, 0, 10, 10)];
  const { grafo } = rodarGeometria(segs);
  ok("extremidade comum vira toque", grafo.interseccoes.length === 1 && grafo.interseccoes[0].tipo === "toque",
    "n=" + grafo.interseccoes.length + " tipo=" + (grafo.interseccoes[0] && grafo.interseccoes[0].tipo));
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 5, 0, 5, 10)];
  const { grafo } = rodarGeometria(segs);
  ok("T vira juncao", grafo.interseccoes.length === 1 && grafo.interseccoes[0].tipo === "juncao",
    "n=" + grafo.interseccoes.length + " tipo=" + (grafo.interseccoes[0] && grafo.interseccoes[0].tipo));
}
{
  // tolerância: 0,03 mm junta; 0,2 mm não junta
  const perto = [segReta(0, 0, 0, 10, 0), segReta(1, 10.03, 0, 20, 0)];
  const g1 = rodarGeometria(perto, { juncaoMm: 0.05 });
  ok("desvio 0,03 junta com tol 0,05", g1.grafo.nos.length === 3, "n=" + g1.grafo.nos.length);

  const longe = [segReta(0, 0, 0, 10, 0), segReta(1, 10.2, 0, 20, 0)];
  const g2 = rodarGeometria(longe, { juncaoMm: 0.05 });
  ok("desvio 0,2 nao junta com tol 0,05", g2.grafo.nos.length === 4, "n=" + g2.grafo.nos.length);
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 0, 0, 10, 0, "cut", 1)];
  const { grafo } = rodarGeometria(segs);
  ok("duplicado detectado", grafo.duplicados.length === 1, "n=" + grafo.duplicados.length);
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 5, 0, 15, 0)];
  const { grafo } = rodarGeometria(segs);
  ok("sobreposto detectado", grafo.sobrepostos.length >= 1, "n=" + grafo.sobrepostos.length);
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 10, 0, 20, 0), segReta(2, 10, 0, 10, 10)];
  const { grafo } = rodarGeometria(segs);
  ok("juncao de grau 3 gera ambiguidade", grafo.ambiguidades.length >= 1, "n=" + grafo.ambiguidades.length);
}
{
  const curva = segCurva(0, { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 });
  const { grafo } = rodarGeometria([curva]);
  ok("curva gera aresta", grafo.arestas.length >= 1);
  ok("curva nao vira face", grafo.arestas.length === grafo.arestas.length);
}

/* ------------------------------------------------------------------- faces */
resultados.push("FACES");
{
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 0)
  ];
  const { faces } = rodarGeometria(segs);
  ok("quadrado: 1 face", faces.faces.length === 1, "n=" + faces.faces.length);
  ok("quadrado: area da face 100", quase(faces.faces[0].areaMm2, 100, 1e-6), String(faces.faces[0].areaMm2));
  ok("quadrado: face externa negativa", faces.faceExterna && faces.faceExterna.areaMm2 >= 100);
}
{
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 0),
    segReta(4, 0, 0, 10, 10, "crease")
  ];
  const { faces, topologia } = rodarGeometria(segs);
  ok("quadrado + diagonal: 2 faces", faces.faces.length === 2, "n=" + faces.faces.length);
  ok("diagonal divide areas iguais",
    faces.faces.length === 2 && quase(faces.faces[0].areaMm2, 50, 1e-6) && quase(faces.faces[1].areaMm2, 50, 1e-6),
    faces.faces.map(function (f) { return f.areaMm2; }).join(" / "));
  ok("adjacencia entre as 2 faces", faces.adjacencias.length === 1, "n=" + faces.adjacencias.length);
  ok("topologia conta vinco", topologia.linhas.crease.arestas >= 1);
}
{
  const segs = [segReta(0, 0, 0, 10, 0), segReta(1, 10, 0, 20, 0)];
  const { faces } = rodarGeometria(segs);
  ok("linha aberta nao gera face", faces.faces.length === 0);
}

/* --------------------------------------------------------------- topologia */
resultados.push("TOPOLOGIA");
{
  const segs = [
    segReta(0, 0, 0, 10, 0, "cut", 0),
    segReta(1, 10, 0, 10, 10, "cut", 0),
    segReta(2, 10, 10, 0, 10, "crease", 1),
    segReta(3, 0, 10, 0, 0, "crease", 1)
  ];
  const { topologia } = rodarGeometria(segs);
  ok("resumo caminhos/segmentos", topologia.resumo.segmentos === 4);
  ok("4 vertices", topologia.resumo.vertices === 4);
  ok("1 face", topologia.resumo.faces === 1);
  ok("linhas cut/crease", topologia.linhas.cut.arestas === 2 && topologia.linhas.crease.arestas === 2);
  ok("area total", quase(topologia.resumo.areaFacesMm2, 100, 1e-6));
  ok("arestas preservam caminho", topologia.arestas[0].caminho === 0);
  ok("sem dependencia de renderer", typeof topologia.faces[0].pontos === "undefined");
}

/* -------------------------------------------------------------------- fim */
console.log(resultados.join("\n"));
console.log("");
console.log("TOTAL=" + total + " FALHAS=" + falhas);
process.exit(falhas === 0 ? 0 : 1);
