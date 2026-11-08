// Teste isolado da placa de papelão 3D (Etapas 2 e 3)
import assert from 'assert';

function construirPlacaTeste(largura, altura, espessura) {
  var x0 = 0, y0 = 0;
  var x1 = largura, y1 = 0;
  var x2 = largura, y2 = altura;
  var x3 = 0, y3 = altura;

  var pontos2d = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 }
  ];

  var meioT = espessura / 2;

  var vertices = [];
  for (var i = 0; i < pontos2d.length; i++) {
    vertices.push({ x: pontos2d[i].x, y: pontos2d[i].y, z: meioT });
  }
  for (var i = 0; i < pontos2d.length; i++) {
    vertices.push({ x: pontos2d[i].x, y: pontos2d[i].y, z: -meioT });
  }

  var triangulosFrente = [
    [0, 1, 2],
    [0, 2, 3]
  ];

  var triangulosVerso = [
    [4, 6, 5],
    [4, 7, 6]
  ];

  var arestas = [
    { a: 0, b: 1, fa: 4, fb: 5 },
    { a: 1, b: 2, fa: 5, fb: 6 },
    { a: 2, b: 3, fa: 6, fb: 7 },
    { a: 3, b: 0, fa: 7, fb: 4 }
  ];

  var triangulosLaterais = [];
  for (var j = 0; j < arestas.length; j++) {
    var ar = arestas[j];
    triangulosLaterais.push([ar.a, ar.b, ar.fb]);
    triangulosLaterais.push([ar.a, ar.fb, ar.fa]);
  }

  return {
    largura: largura,
    altura: altura,
    espessura: espessura,
    vertices: vertices,
    frente: triangulosFrente,
    verso: triangulosVerso,
    laterais: triangulosLaterais
  };
}

function validarPlaca(placa) {
  assert.strictEqual(placa.vertices.length, 8, "Deve ter exatamente 8 vértices");
  var totalTriangulos = placa.frente.length + placa.verso.length + placa.laterais.length;
  assert.strictEqual(totalTriangulos, 12, "Deve ter exatamente 12 triângulos");

  var maxIdx = placa.vertices.length - 1;
  [placa.frente, placa.verso, placa.laterais].forEach(function(lista) {
    lista.forEach(function(tri) {
      assert(tri[0] >= 0 && tri[0] <= maxIdx);
      assert(tri[1] >= 0 && tri[1] <= maxIdx);
      assert(tri[2] >= 0 && tri[2] <= maxIdx);
    });
  });

  function areaTriangulo(pA, pB, pC) {
    var ab = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z };
    var ac = { x: pC.x - pA.x, y: pC.y - pA.y, z: pC.z - pA.z };
    var cruz = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };
    return 0.5 * Math.sqrt(cruz.x * cruz.x + cruz.y * cruz.y + cruz.z * cruz.z);
  }

  [placa.frente, placa.verso, placa.laterais].forEach(function(lista) {
    lista.forEach(function(tri) {
      var area = areaTriangulo(placa.vertices[tri[0]], placa.vertices[tri[1]], placa.vertices[tri[2]]);
      assert(area > 0.001);
    });
  });

  function normalTriangulo(pA, pB, pC) {
    var ab = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z };
    var ac = { x: pC.x - pA.x, y: pC.y - pA.y, z: pC.z - pA.z };
    var nx = ab.y * ac.z - ab.z * ac.y;
    var ny = ab.z * ac.x - ab.x * ac.z;
    var nz = ab.x * ac.y - ab.y * ac.x;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return { x: nx / len, y: ny / len, z: nz / len };
  }

  placa.frente.forEach(function(tri) {
    var n = normalTriangulo(placa.vertices[tri[0]], placa.vertices[tri[1]], placa.vertices[tri[2]]);
    assert(n.z > 0.9, "Normal da frente deve apontar para +Z");
  });

  placa.verso.forEach(function(tri) {
    var n = normalTriangulo(placa.vertices[tri[0]], placa.vertices[tri[1]], placa.vertices[tri[2]]);
    assert(n.z < -0.9, "Normal do verso deve apontar para -Z");
  });

  var zFrente = placa.vertices[0].z;
  var zVerso = placa.vertices[4].z;
  var espessuraReal = Math.abs(zFrente - zVerso);
  assert(Math.abs(espessuraReal - placa.espessura) < 1e-5);

  assert.strictEqual(placa.largura, 100);
  assert.strictEqual(placa.altura, 100);
  assert.strictEqual(placa.espessura, 1.5);

  var volume = placa.largura * placa.altura * placa.espessura;
  assert.strictEqual(volume, 15000);

  console.log("TODAS AS VALIDAÇÕES DA PLACA DE TESTE PASSARAM COM SUCESSO!");
}

var placaTeste = construirPlacaTeste(100, 100, 1.5);
validarPlaca(placaTeste);
