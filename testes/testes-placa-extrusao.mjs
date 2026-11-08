// Teste objetivo de fechamento e volume para ExtrudeGeometry (Etapa 6)
import assert from 'assert';

globalThis.window = globalThis;
globalThis.document = { createElement: function() { return { getContext: function() { return {}; } }; } };

const threeMod = await import("../js/vendor/three.min.js");
const THREE = threeMod.default || threeMod;

function testarPlacaExtrusao() {
  console.log("Iniciando teste de extrusão 100x100x3mm...");

  var shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(100, 0);
  shape.lineTo(100, 100);
  shape.lineTo(0, 100);

  var extrudeSettings = {
    steps: 1,
    depth: 3,
    bevelEnabled: false
  };

  var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.translate(0, 0, -1.5); // Centralizar em Z (-1.5 a +1.5)
  geometry.computeBoundingBox();

  var box = geometry.boundingBox;
  var dimX = box.max.x - box.min.x;
  var dimY = box.max.y - box.min.y;
  var dimZ = box.max.z - box.min.z;

  console.h = "Dimensões da caixa delimitadora: " + dimX + " x " + dimY + " x " + dimZ;
  console.log("Dimensões:", dimX, "x", dimY, "x", dimZ);

  assert(Math.abs(dimX - 100) < 0.01, "Largura deve ser 100");
  assert(Math.abs(dimY - 100) < 0.01, "Altura deve ser 100");
  assert(Math.abs(dimZ - 3) < 0.01, "Espessura deve ser 3");

  var volumeCalculado = dimX * dimY * dimZ;
  console.log("Volume calculado (WxHxD):", volumeCalculado, "mm³");
  assert.strictEqual(volumeCalculado, 30000, "Volume deve ser exatamente 30.000 mm³");

  // Verificar fechamento (manifold): cada aresta compartilhada por exatamente 2 faces
  var pos = geometry.attributes.position;
  var posMap = [];
  var index = [];
  var tolerance = 1e-6;

  for (var i = 0; i < pos.count; i++) {
    var v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    var found = -1;
    for (var j = 0; j < posMap.length; j++) {
      if (v.distanceTo(posMap[j]) < tolerance) {
        found = j;
        break;
      }
    }
    if (found === -1) {
      posMap.push(v);
      index.push(posMap.length - 1);
    } else {
      index.push(found);
    }
  }

  var arestasCount = {};
  function addEdge(a, b) {
    var key = a < b ? a + "_" + b : b + "_" + a;
    arestasCount[key] = (arestasCount[key] || 0) + 1;
  }

  for (var i = 0; i < index.length; i += 3) {
    addEdge(index[i], index[i + 1]);
    addEdge(index[i + 1], index[i + 2]);
    addEdge(index[i + 2], index[i]);
  }

  var arestasNaoFechadas = 0;
  for (var key in arestasCount) {
    if (arestasCount[key] !== 2) {
      arestasNaoFechadas++;
    }
  }

  console.log("Total de vértices únicos:", posMap.length);
  console.log("Total de arestas únicas:", Object.keys(arestasCount).length);
  console.log("Arestas com contagem != 2:", arestasNaoFechadas);

  assert.strictEqual(arestasNaoFechadas, 0, "Malha deve ser fechada (manifold)");

  console.log("TESTE DE EXTRUSÃO APROVADO COM SUCESSO!");
}

testarPlacaExtrusao();
