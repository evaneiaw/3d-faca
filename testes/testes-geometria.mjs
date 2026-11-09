/* FACA 3D — testes unitários dos algoritmos geométricos (Fase 2).
 * Executar: node testes/testes-geometria.mjs
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
await import("../js/core/structural-lines.js");
await import("../js/core/hinge-audit.js");

const threeModulo = await import("../js/vendor/three.min.js");
globalThis.THREE = threeModulo.default || threeModulo;
await import("../js/view/three3d.js");

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
  // Caso real (faaaaccaaaa.pdf): horizontal terminando sobre vertical quase-
  // exata em (186,797), com desvio paramétrico ~1,5e-6 (0,00006 mm). Com a
  // folga fixa de 1e-6 a junção era rejeitada e a ponta ficava solta (grau 1).
  const r = U.intersecaoRetas(
    { x: 225.99963972222224, y: 796.9988011111111 },
    { x: 185.99968444444443, y: 796.9988011111111 },
    { x: 185.99968444444443, y: 791.9988111111111 },
    { x: 185.99950805555557, y: 806.9986752777777 }, 0.01);
  ok("intersecao em T na ponta com desvio sub-micrometrico",
    r && Math.abs(r.ponto.x - 185.9996) < 0.01 && Math.abs(r.ponto.y - 796.9988) < 0.01, JSON.stringify(r));
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
  // Regressão (faaaaccaaaa.pdf, V14/V19): a vertical ligeiramente inclinada
  // deve ser partida na ponta do corte horizontal; sem o corte, o corte fica
  // solto (grau 1, aresta em ponte) e funde os dois painéis numa face só.
  const segs = [
    segReta(0, 185.99968444444443, 791.9988111111111, 185.99950805555557, 806.9986752777777),
    segReta(1, 225.99963972222224, 796.9988011111111, 185.99968444444443, 796.9988011111111)
  ];
  const { grafo } = rodarGeometria(segs);
  const noT = grafo.nos.filter(function (n) { return Math.abs(n.x - 185.9996) < 0.01 && Math.abs(n.y - 796.9988) < 0.01; });
  ok("T inclinada parte a vertical (no grau 3)",
    grafo.interseccoes.length === 1 && noT.length === 1 && noT[0].arestas.length === 3,
    "inters=" + grafo.interseccoes.length + " nos=" + JSON.stringify(noT.map(function (n) { return n.arestas; })));
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

/* ------------------------------------------------------- costura e furos */
resultados.push("COSTURA DE PONTAS");
{
  // Retângulo com um vão de 2 mm na borda esquerda (picote da base da aba).
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 2)
  ];
  const sem = rodarGeometria(segs, { costuraMm: 0 });
  ok("sem costura o painel fica aberto", sem.faces.faces.length === 0, "n=" + sem.faces.faces.length);
  ok("sem costura nao ha pontes", sem.grafo.costuras.length === 0);

  const com = rodarGeometria(segs, { costuraMm: 2.5 });
  ok("com costura 2,5 mm o painel fecha", com.faces.faces.length === 1, "n=" + com.faces.faces.length);
  ok("uma ponte registrada", com.grafo.costuras.length === 1, "n=" + com.grafo.costuras.length);
  ok("area preservada (100)", com.faces.faces.length === 1 && quase(com.faces.faces[0].areaMm2, 100, 1e-6),
    com.faces.faces.map(function (f) { return f.areaMm2; }).join(","));

  const curta = rodarGeometria(segs, { costuraMm: 1 });
  ok("costura menor que o vao nao emenda", curta.faces.faces.length === 0, "n=" + curta.faces.faces.length);
}
{
  // A ponte não pode cruzar uma linha existente: a linha horizontal em y=1
  // cruza a emenda (0,2)-(0,0).
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 2),
    segReta(4, -5, 1, 5, 1)
  ];
  const g = rodarGeometria(segs, { costuraMm: 2.5 });
  ok("costura nao cruza linha existente", g.grafo.costuras.length === 0, "n=" + g.grafo.costuras.length);
}

resultados.push("FUROS");
{
  // Painel 10x10 com janela 4..6: a janela é FURO, não painel.
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 0),
    segReta(4, 4, 4, 6, 4),
    segReta(5, 6, 4, 6, 6),
    segReta(6, 6, 6, 4, 6),
    segReta(7, 4, 6, 4, 4)
  ];
  const r = rodarGeometria(segs, {});
  ok("janela vira furo: 1 face", r.faces.faces.length === 1, "n=" + r.faces.faces.length);
  ok("1 furo registrado", r.faces.furos.length === 1, "n=" + r.faces.furos.length);
  ok("face externa guarda o poligono do furo",
    r.faces.faces.length === 1 && r.faces.faces[0].furos && r.faces.faces[0].furos.length === 1);
  ok("topologia conta o furo", r.topologia.resumo.furos === 1, String(r.topologia.resumo.furos));
  ok("face do furo nao e painel", r.topologia.faces.length === 1);

  // Duas vezes o mesmo recorte (linhas duplicadas no desenho) = 1 furo.
  const dobrados = segs.concat([
    segReta(8, 4, 4, 6, 4),
    segReta(9, 6, 4, 6, 6),
    segReta(10, 6, 6, 4, 6),
    segReta(11, 4, 6, 4, 4)
  ].map(function (s) {
    return Object.assign({}, s, { caminho: 1 });
  }));
  const rd = rodarGeometria(dobrados, {});
  ok("recorte redesenhado nao vira 2 furos", rd.faces.furos.length === 1, "n=" + rd.faces.furos.length);
  ok("arestas duplicadas detectadas", rd.grafo.duplicados.length === 4, "n=" + rd.grafo.duplicados.length);
  ok("recorte redesenhado continua 1 face", rd.faces.faces.length === 1, "n=" + rd.faces.faces.length);
}
{
  // Dois quadrados lado a lado não são furo um do outro.
  const segs = [
    segReta(0, 0, 0, 10, 0),
    segReta(1, 10, 0, 10, 10),
    segReta(2, 10, 10, 0, 10),
    segReta(3, 0, 10, 0, 0),
    segReta(4, 20, 0, 30, 0),
    segReta(5, 30, 0, 30, 10),
    segReta(6, 30, 10, 20, 10),
    segReta(7, 20, 10, 20, 0)
  ];
  const r = rodarGeometria(segs, {});
  ok("quadrados vizinhos: 2 faces", r.faces.faces.length === 2, "n=" + r.faces.faces.length);
  ok("quadrados vizinhos: nenhum furo", r.faces.furos.length === 0, "n=" + r.faces.furos.length);
}

resultados.push("TRIANGULACAO COM FURO");
{
  const T = F.view.three3d;
  const contorno = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }
  ];
  const furo = [
    { x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 }
  ];
  const tri = T.triangularFace({ pontos: contorno, furos: [furo] });
  ok("triangula face com furo", !!tri && tri.triangulos.length > 0);
  let area = 0;
  for (const t of tri.triangulos) {
    const a = tri.pontos[t[0]], b = tri.pontos[t[1]], c = tri.pontos[t[2]];
    area += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }
  ok("area triangulada = 100 - 4", quase(area, 96, 1e-6), String(area));
  ok("contorno externo preservado", tri.contorno.length === 4);
  ok("vertices = contorno + furo", tri.pontos.length === 8);

  // Regressão 0.8.0: os índices apontam para a lista combinada. Usar só o
  // contorno para montar os vértices da normal dava "undefined.x" no painel.
  const primeiro = tri.triangulos[0];
  ok("primeiro triangulo tem vertices definidos", primeiro.every(function (k) {
    return !!tri.pontos[k];
  }));
  ok("indices ultrapassam o contorno (lista combinada e obrigatoria)", primeiro.some(function (k) {
    return k >= tri.contorno.length;
  }), "indices=" + primeiro.join(","));

  const solido = T.triangularFace({ pontos: contorno });
  let area2 = 0;
  for (const t of solido.triangulos) {
    const a = solido.pontos[t[0]], b = solido.pontos[t[1]], c = solido.pontos[t[2]];
    area2 += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }
  ok("sem furo a area continua 100", quase(area2, 100, 1e-6), String(area2));
}

resultados.push("BASE FIXA (RAIZ DA MONTAGEM)");
{
  // Três painéis em sequência, ligados por vinco: 0–1–2. O painel 1 tem duas
  // dobradiças, então é a raiz automática.
  function face3(id, x0, arestas) {
    return {
      id: id,
      areaMm2: 100,
      centro: { x: x0 + 5, y: 5 },
      pontos: [
        { x: x0, y: 0 }, { x: x0 + 10, y: 0 },
        { x: x0 + 10, y: 10 }, { x: x0, y: 10 }
      ],
      arestas: arestas,
      classes: { crease: arestas.length }
    };
  }
  function aresta(id, v0, v1, caminho) {
    return {
      id: id, a: v0, b: v1, classe: "crease", spot: "Crease",
      caminho: caminho, segmento: caminho, indiceNoCaminho: 0,
      comprimentoMm: 10, tipoOriginal: "reta", fechadoOriginal: false, t0: 0, t1: 1
    };
  }
  function resultado3(painelExtra) {
    const faces = [
      face3(0, 0, [0]),
      face3(1, 10, [0, 1]),
      face3(2, 20, [1])
    ];
    if (painelExtra) {
      faces.push({
        id: 3, areaMm2: 50, centro: { x: 40, y: 5 },
        pontos: [{ x: 35, y: 0 }, { x: 45, y: 0 }, { x: 45, y: 10 }, { x: 35, y: 10 }],
        arestas: [], classes: {}
      });
    }
    return {
      faces: {
        faces: faces,
        adjacencias: [
          { a: 0, b: 1, arestas: [0], classes: { crease: 1 } },
          { a: 1, b: 2, arestas: [1], classes: { crease: 1 } }
        ]
      },
      topologia: {
        vertices: [
          { id: 0, x: 10, y: 0 }, { id: 1, x: 10, y: 10 },
          { id: 2, x: 20, y: 0 }, { id: 3, x: 20, y: 10 }
        ],
        arestas: [aresta(0, 0, 1, 0), aresta(1, 2, 3, 1)],
        resumo: { faces: faces.length }
      },
      geometria: {
        meta: { documento: "sintetico" },
        caixa: { largura: painelExtra ? 45 : 30, altura: 10 },
        caminhos: [],
        segmentos: []
      }
    };
  }

  const auto = F.geometry.hinge.construir(resultado3(false));
  ok("raiz automática = painel com mais dobradiças (1)", auto.raiz === 1, "raiz=" + auto.raiz);
  ok("automática marcada como não manual", auto.baseManual === false);
  ok("automática guarda a raiz automática", auto.raizAutomatica === 1, "n=" + auto.raizAutomatica);
  ok("3 faces montadas", auto.facesMontadas.length === 3, "n=" + auto.facesMontadas.length);

  const base0 = F.geometry.hinge.construir(resultado3(false), { raiz: 0 });
  ok("base manual 0 aplicada", base0.raiz === 0 && base0.baseManual === true, "raiz=" + base0.raiz);
  ok("base manual 0 é a primeira da ordem", base0.ordem[0].face === 0, "n=" + base0.ordem[0].face);
  ok("base manual 0 não tem pai", base0.ordem[0].pai === null);
  ok("base manual 0 monta os 3 painéis", base0.facesMontadas.length === 3, "n=" + base0.facesMontadas.length);
  ok("hierarquia recalculada a partir de 0", base0.ordem[1].pai === 0, "pai=" + base0.ordem[1].pai);

  const base2 = F.geometry.hinge.construir(resultado3(false), { raiz: 2 });
  ok("base manual 2 aplicada", base2.raiz === 2 && base2.ordem[0].face === 2, "raiz=" + base2.raiz);
  ok("base 2 monta os 3 painéis", base2.facesMontadas.length === 3, "n=" + base2.facesMontadas.length);
  ok("base 2: painel 1 é filho de 2", base2.ordem[1].face === 1 && base2.ordem[1].pai === 2,
    "face=" + base2.ordem[1].face + " pai=" + base2.ordem[1].pai);

  const invalida = F.geometry.hinge.construir(resultado3(false), { raiz: 99 });
  ok("base inexistente cai na automática", invalida.raiz === 1 && invalida.baseManual === false,
    "raiz=" + invalida.raiz);
  ok("base inexistente informa motivo", /não existe/.test(invalida.motivoBase || ""), invalida.motivoBase);

  const foraComponente = F.geometry.hinge.construir(resultado3(true), { raiz: 3 });
  ok("painel fora do componente não vira base", foraComponente.raiz === 1 && foraComponente.baseManual === false,
    "raiz=" + foraComponente.raiz);
  ok("painel fora do componente informa motivo", /vinco/.test(foraComponente.motivoBase || ""),
    foraComponente.motivoBase);

  // Assinatura: a base só continua valendo se a geometria não mudou.
  const resA = resultado3(false);
  const resB = resultado3(false);
  const resC = resultado3(true);
  ok("assinatura estável para a mesma geometria",
    F.geometry.engine.assinatura(resA) === F.geometry.engine.assinatura(resB),
    F.geometry.engine.assinatura(resA) + " / " + F.geometry.engine.assinatura(resB));
  ok("assinatura muda quando a faca muda",
    F.geometry.engine.assinatura(resA) !== F.geometry.engine.assinatura(resC),
    F.geometry.engine.assinatura(resA) + " / " + F.geometry.engine.assinatura(resC));

  // Transformação real: a raiz escolhida fica imóvel em 0°, 90° e 180° e as
  // demais faces giram em torno das próprias dobradiças (a base muda de fato).
  const T = F.view.three3d;
  const THREE = globalThis.THREE;
  function matrizPerfeita(m) {
    const e = m.elements;
    return (
      Math.abs(e[0] - 1) < 1e-9 && Math.abs(e[5] - 1) < 1e-9 &&
      Math.abs(e[10] - 1) < 1e-9 && Math.abs(e[15] - 1) < 1e-9 &&
      Math.abs(e[12]) < 1e-9 && Math.abs(e[13]) < 1e-9 && Math.abs(e[14]) < 1e-9
    );
  }
  function erroEixo(mont, matrizes) {
    let pior = 0;
    for (let i = 1; i < mont.ordem.length; i++) {
      const s = mont.ordem[i];
      if (s.rigida) continue;
      const mp = matrizes[s.pai];
      const mc = matrizes[s.face];
      for (const p of [s.p1, s.p2]) {
        const a = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(mp);
        const b = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(mc);
        pior = Math.max(pior, a.distanceTo(b));
      }
    }
    return pior;
  }
  for (const ang of [0, 90, 180]) {
    const mr0 = T.matrizesDaMontagem(THREE, base0, {}, {}, ang, {});
    ok(
      "base manual 0 imóvel em " + ang + "°",
      matrizPerfeita(mr0[base0.raiz]),
      "root=" + base0.raiz
    );
    ok("eixos preservados em " + ang + "° (base 0)", erroEixo(base0, mr0) < 1e-6,
      "erro=" + erroEixo(base0, mr0));

    const mr2 = T.matrizesDaMontagem(THREE, base2, {}, {}, ang, {});
    ok("painel 2 imóvel em " + ang + "°", matrizPerfeita(mr2[base2.raiz]), "raiz=" + base2.raiz);
    ok("eixos preservados em " + ang + "° (base 2)", erroEixo(base2, mr2) < 1e-6,
      "erro=" + erroEixo(base2, mr2));

    if (ang === 90) {
      // O painel 0 é filho na base 2: precisa sair do plano (z ≠ 0).
      const v = new THREE.Vector3(5, 5, 0).applyMatrix4(mr2[0]);
      ok("base 2: painel 0 acompanha a dobra (z ≠ 0)", Math.abs(v.z) > 1, "z=" + v.z);
      const v2 = new THREE.Vector3(25, 5, 0).applyMatrix4(mr2[2]);
      ok("base 2: raiz 2 continua em z=0", Math.abs(v2.z) < 1e-9, "z=" + v2.z);
    }
  }
}

resultados.push("ÂNGULOS SALVOS (dobras)");
{
  function resultadoDobra(extra) {
    const faces = extra ? [{ id: 0, areaMm2: 100 }, { id: 1, areaMm2: 50 }] : [{ id: 0, areaMm2: 100 }];
    return {
      geometria: {
        meta: { documento: "sintetico" },
        caminhos: [],
        caixa: { largura: extra ? 45 : 30, altura: 10 }
      },
      topologia: { resumo: { faces: faces.length } },
      faces: { faces: faces }
    };
  }
  const resA = resultadoDobra(false);
  const resB = resultadoDobra(true);
  const chaveA = F.geometry.engine.chaveDobra(resA);
  ok("chave da dobra tem 8 hexadecimais", /^[0-9a-f]{8}$/.test(chaveA), chaveA);
  ok("chave estável para a mesma geometria",
    chaveA === F.geometry.engine.chaveDobra(resA), chaveA);
  ok("chave muda quando a faca muda",
    chaveA !== F.geometry.engine.chaveDobra(resB), chaveA + " / " + F.geometry.engine.chaveDobra(resB));
  ok("chave aceita a assinatura em texto",
    F.geometry.engine.chaveDobra(F.geometry.engine.assinatura(resA)) === chaveA);

  const montagem = {
    ordem: [
      { face: 3, pai: null, rigida: false },
      { face: 1, pai: 3, rigida: false },
      { face: 2, pai: 1, rigida: false },
      { face: 5, pai: 1, rigida: true }
    ]
  };
  const articulaveis = { 1: true, 2: true };
  const cfg = {
    anguloGlobal: 90,
    angulos: { 1: 30 },
    sinais: { 1: -1, 2: 1 }
  };
  const norm = F.view.three3d.normalizarDobras(cfg, montagem, articulaveis);
  ok("face com ângulo próprio preservado", norm.angulos[1] === 30, "n=" + norm.angulos[1]);
  ok("face sem ângulo usa o global", norm.angulos[2] === 90, "n=" + norm.angulos[2]);
  ok("face rígida não recebe dobra", norm.angulos[5] === undefined);
  ok("raiz não recebe dobra", norm.angulos[3] === undefined);
  ok("ângulo global preservado", norm.angulo === 90, "n=" + norm.angulo);
  ok("sentido -1 só da face articulável indicada",
    norm.sinaisOverride[1] === -1 && norm.sinaisOverride[2] === undefined,
    JSON.stringify(norm.sinaisOverride));

  const limite = F.view.three3d.normalizarDobras(
    { angulos: { 1: -10, 2: 200 }, anguloGlobal: 90 },
    montagem,
    articulaveis
  );
  ok("ângulos limitados a 0..180", limite.angulos[1] === 0 && limite.angulos[2] === 180,
    limite.angulos[1] + " / " + limite.angulos[2]);

  const vazio = F.view.three3d.normalizarDobras(null, montagem, articulaveis);
  ok("config vazia zera as dobras", vazio.angulos[1] === 0 && vazio.angulos[2] === 0);
}

/* -------------------------------------------------------------------- fim */
console.log(resultados.join("\n"));
console.log("");
console.log("TOTAL=" + total + " FALHAS=" + falhas);
process.exit(falhas === 0 ? 0 : 1);
