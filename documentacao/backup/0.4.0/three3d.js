/* FACA 3D — visualizador 3D (Entrega 3).
 *
 * Monta as faces em 3D usando SOMENTE as dobradiças reais identificadas:
 * adjacência por vinco cuja linha compartilhada é reta. Cada face é rígida;
 * a árvore é percorrida a partir da maior face do maior componente.
 *
 * O que não pode ser montado (dobradiça não reta, faces ligadas só por corte)
 * não é inventado: fica fora e é relatado no painel.
 *
 * Depende de window.THREE (vendorizado em js/vendor/three.min.js).
 * API:
 *   Faca3D.view.three3d.criar({ host, aoInfo })
 *   viewer.desenhar(resultadoDoMotor)
 *   viewer.definirAngulo(graus) / viewer.resetarVista() / viewer.destruir()
 */
(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var V = (F.view = F.view || {});

  var TOL_RETA_MM = 0.05;
  var TOL_PONTO_MM = 0.001;
  var COR_PAPEL = 0xf2e8d5;
  var COR_BORDA = 0x6b7280;
  var COR_VINCO = 0x1473e6;
  var ANGULO_PADRAO = 90;

  function exigirThree() {
    if (!raiz.THREE) {
      var e = new Error("Three.js não carregado.");
      e.codigo = "SEM_THREE";
      throw e;
    }
    return raiz.THREE;
  }

  /* ------------------------------------------------------------ geometria */

  function distancia(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  function desvioMax(pontos) {
    if (pontos.length < 3) return 0;
    var pior = 0;
    for (var i = 0; i < pontos.length; i++) {
      for (var j = i + 2; j < pontos.length; j++) {
        var ax = pontos[j].x - pontos[i].x;
        var ay = pontos[j].y - pontos[i].y;
        var L = Math.sqrt(ax * ax + ay * ay);
        if (L < TOL_PONTO_MM) continue;
        for (var k = i + 1; k < j; k++) {
          var d = Math.abs((pontos[k].x - pontos[i].x) * ay - (pontos[k].y - pontos[i].y) * ax) / L;
          if (d > pior) pior = d;
        }
      }
    }
    return pior;
  }

  function limparPoligono(pontos) {
    var saida = [];
    for (var i = 0; i < pontos.length; i++) {
      var p = pontos[i];
      if (!saida.length || distancia(saida[saida.length - 1], p) > TOL_PONTO_MM) saida.push(p);
    }
    if (saida.length > 2 && distancia(saida[0], saida[saida.length - 1]) <= TOL_PONTO_MM) saida.pop();
    return saida;
  }

  /* Constrói a árvore de dobra com as ligações de vinco. */
  function construirMontagem(res) {
    var faces = res.faces.faces || [];
    var adj = res.faces.adjacencias || [];
    var topo = res.topologia;

    var mapaFaces = {};
    var i, j;
    for (i = 0; i < faces.length; i++) mapaFaces[faces[i].id] = faces[i];

    function pontosAresta(id) {
      var a = topo.arestas[id];
      if (!a) return null;
      var va = topo.vertices[a.a];
      var vb = topo.vertices[a.b];
      if (!va || !vb) return null;
      return [{ x: va.x, y: va.y }, { x: vb.x, y: vb.y }];
    }

    // Todas as ligações por vinco: as retas dobram; as não retas (ex.: "U")
    // mantêm os painéis no mesmo plano, porque não há eixo rígido único.
    var dobradicas = [];
    var retas = [];
    var rigidas = [];
    for (i = 0; i < adj.length; i++) {
      var a = adj[i];
      if (!(a.classes && a.classes.crease)) continue;
      var unicos = [];
      for (j = 0; j < a.arestas.length; j++) {
        var par = pontosAresta(a.arestas[j]);
        if (!par) continue;
        for (var p = 0; p < 2; p++) {
          var achou = false;
          for (var u = 0; u < unicos.length; u++) {
            if (distancia(unicos[u], par[p]) <= TOL_PONTO_MM) {
              achou = true;
              break;
            }
          }
          if (!achou) unicos.push(par[p]);
        }
      }
      if (unicos.length < 2) continue;

      var desvio = desvioMax(unicos);
      var reta = desvio <= TOL_RETA_MM;
      var melhor = { d: -1, p1: unicos[0], p2: unicos[1] };
      if (reta) {
        for (j = 0; j < unicos.length; j++) {
          for (var k = j + 1; k < unicos.length; k++) {
            var d = distancia(unicos[j], unicos[k]);
            if (d > melhor.d) melhor = { d: d, p1: unicos[j], p2: unicos[k] };
          }
        }
        if (melhor.d < 1) reta = false;
      }

      var item = {
        a: a.a,
        b: a.b,
        reta: reta,
        p1: reta ? melhor.p1 : null,
        p2: reta ? melhor.p2 : null,
        comprimentoMm: reta ? melhor.d : 0,
        desvioMm: desvio
      };
      dobradicas.push(item);
      if (reta) retas.push(item);
      else rigidas.push(item);
    }

    // Componente conexo por QUALQUER ligação de vinco (retas + rígidas).
    var pai = {};
    function achar(x) {
      while (pai[x] !== x) {
        pai[x] = pai[pai[x]];
        x = pai[x];
      }
      return x;
    }
    for (i = 0; i < faces.length; i++) pai[faces[i].id] = faces[i].id;
    for (i = 0; i < dobradicas.length; i++) {
      var ra = achar(dobradicas[i].a);
      var rb = achar(dobradicas[i].b);
      if (ra !== rb) pai[ra] = rb;
    }
    var grupos = {};
    for (i = 0; i < faces.length; i++) {
      var r = achar(faces[i].id);
      (grupos[r] = grupos[r] || []).push(faces[i].id);
    }
    var melhorGrupo = null;
    for (var chave in grupos) {
      if (!grupos.hasOwnProperty(chave)) continue;
      if (!melhorGrupo || grupos[chave].length > melhorGrupo.length) melhorGrupo = grupos[chave];
    }
    melhorGrupo = melhorGrupo || [];

    // Raiz = face com mais dobradiças (centro da montagem); empate pela área.
    var grau = {};
    for (i = 0; i < dobradicas.length; i++) {
      grau[dobradicas[i].a] = (grau[dobradicas[i].a] || 0) + 1;
      grau[dobradicas[i].b] = (grau[dobradicas[i].b] || 0) + 1;
    }
    var raiz = null;
    for (i = 0; i < melhorGrupo.length; i++) {
      var f = mapaFaces[melhorGrupo[i]];
      if (!raiz) {
        raiz = f;
        continue;
      }
      var grauF = grau[f.id] || 0;
      var grauR = grau[raiz.id] || 0;
      if (grauF > grauR || (grauF === grauR && f.areaMm2 > raiz.areaMm2)) raiz = f;
    }
    if (!raiz) {
      return {
        ordem: [],
        facesMontadas: [],
        fora: faces.map(function (ff) { return ff.id; }),
        retas: 0,
        rigidas: 0,
        grupoTamanho: 0,
        semConexaoVinco: faces.length
      };
    }

    var porFace = {};
    for (i = 0; i < dobradicas.length; i++) {
      var h = dobradicas[i];
      (porFace[h.a] = porFace[h.a] || []).push(h);
      (porFace[h.b] = porFace[h.b] || []).push(h);
    }

    var visitados = {};
    visitados[raiz.id] = true;
    var ordem = [{ face: raiz.id, pai: null, p1: null, p2: null, rigida: false }];
    var fila = 0;
    while (fila < ordem.length) {
      var atual = ordem[fila++];
      var ligacoes = porFace[atual.face] || [];
      for (i = 0; i < ligacoes.length; i++) {
        var lig = ligacoes[i];
        var outro = lig.a === atual.face ? lig.b : lig.a;
        if (visitados[outro]) continue;
        visitados[outro] = true;
        ordem.push({
          face: outro,
          pai: atual.face,
          p1: lig.p1,
          p2: lig.p2,
          rigida: !lig.reta
        });
      }
    }

    var montadas = [];
    for (i = 0; i < ordem.length; i++) montadas.push(ordem[i].face);
    var fora = [];
    for (i = 0; i < faces.length; i++) {
      if (!visitados[faces[i].id]) fora.push(faces[i].id);
    }

    return {
      raiz: raiz.id,
      ordem: ordem,
      facesMontadas: montadas,
      fora: fora,
      retas: retas.length,
      rigidas: rigidas.length,
      grupoTamanho: melhorGrupo.length,
      semConexaoVinco: fora.length
    };
  }

  /* ----------------------------------------------------------------- criar */

  function criar(opcoes) {
    var THREE = exigirThree();
    var opt = opcoes || {};
    var host = opt.host;
    if (!host) throw new Error("Visualizador 3D sem container.");

    var canvas = document.createElement("canvas");
    canvas.className = "faca3d-canvas3d";
    host.appendChild(canvas);

    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
    } catch (e) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      var erro = new Error("WebGL indisponível para a visualização 3D: " + (e && e.message ? e.message : e));
      erro.codigo = "SEM_WEBGL";
      throw erro;
    }
    renderer.setClearColor(0x000000, 0);

    var cena = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 1, 200000);
    var grupo = new THREE.Group();
    cena.add(grupo);

    var luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x6b7280, 0.95);
    cena.add(luzAmbiente);
    var luz = new THREE.DirectionalLight(0xffffff, 0.75);
    luz.position.set(0.4, 0.7, 1);
    cena.add(luz);

    var materialFace = new THREE.MeshStandardMaterial({
      color: COR_PAPEL,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
      flatShading: false
    });
    var materialBorda = new THREE.LineBasicMaterial({ color: COR_BORDA });
    var materialVinco = new THREE.LineBasicMaterial({ color: COR_VINCO });

    var estado = {
      res: null,
      montagem: null,
      angulo: ANGULO_PADRAO,
      malhas: [],
      bordas: null,
      vincos: null,
      grade: null,
      centro: { x: 0, y: 0, z: 0 },
      dimensao: 1,
      dimensaoPlana: 1,
      theta: 0.75,
      phi: 1.05,
      raio: 1000
    };
    var observador = null;

    /* --------------------------------------------------------- matemática */

    function matrizDobra(matrizPai, p1, p2, anguloRad, sinal) {
      var v1 = new THREE.Vector3(p1.x, p1.y, 0).applyMatrix4(matrizPai);
      var v2 = new THREE.Vector3(p2.x, p2.y, 0).applyMatrix4(matrizPai);
      var eixo = new THREE.Vector3().subVectors(v2, v1).normalize();
      var q = new THREE.Quaternion().setFromAxisAngle(eixo, anguloRad * sinal);
      var rot = new THREE.Matrix4().makeRotationFromQuaternion(q);
      var t1 = new THREE.Matrix4().makeTranslation(v1.x, v1.y, v1.z);
      var t2 = new THREE.Matrix4().makeTranslation(-v1.x, -v1.y, -v1.z);
      return t1.multiply(rot).multiply(t2).multiply(matrizPai);
    }

    /* ------------------------------------- escolha da direção das dobras */

    function subtrair(a, b) {
      return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }

    function produtoVetorial(a, b) {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
      };
    }

    function produtoEscalar(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    function caixaDe(pontos) {
      var b = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
      for (var i = 0; i < pontos.length; i++) {
        var p = pontos[i];
        if (p.x < b.minX) b.minX = p.x;
        if (p.y < b.minY) b.minY = p.y;
        if (p.z < b.minZ) b.minZ = p.z;
        if (p.x > b.maxX) b.maxX = p.x;
        if (p.y > b.maxY) b.maxY = p.y;
        if (p.z > b.maxZ) b.maxZ = p.z;
      }
      return b;
    }

    function caixasCruzam(a, b) {
      return !(a.maxX < b.minX || a.minX > b.maxX ||
        a.maxY < b.minY || a.minY > b.maxY ||
        a.maxZ < b.minZ || a.minZ > b.maxZ);
    }

    /* Interseção própria entre um segmento e um triângulo (Möller–Trumbore).
     * Extremidades e casos coplanares são ignorados. */
    function segmentoTriangulo(p, q, a, b, c) {
      var d = subtrair(q, p);
      var e1 = subtrair(b, a);
      var e2 = subtrair(c, a);
      var h = produtoVetorial(d, e2);
      var det = produtoEscalar(e1, h);
      if (Math.abs(det) < 1e-9) return false;
      var f = 1 / det;
      var s = subtrair(p, a);
      var u = f * produtoEscalar(s, h);
      if (u < 0 || u > 1) return false;
      var qv = produtoVetorial(s, e1);
      var v = f * produtoEscalar(d, qv);
      if (v < 0 || u + v > 1) return false;
      var t = f * produtoEscalar(e2, qv);
      return t > 1e-5 && t < 1 - 1e-5;
    }

    function arestaCruzaFace(aresta, pontosFace, triangulos) {
      for (var i = 0; i < triangulos.length; i++) {
        var tri = triangulos[i];
        if (segmentoTriangulo(aresta[0], aresta[1], pontosFace[tri[0]], pontosFace[tri[1]], pontosFace[tri[2]])) {
          return true;
        }
      }
      return false;
    }

    function faceCruzaFace(pA, tA, pB, tB) {
      var i;
      for (i = 0; i < pA.length; i++) {
        if (arestaCruzaFace([pA[i], pA[(i + 1) % pA.length]], pB, tB)) return true;
      }
      for (i = 0; i < pB.length; i++) {
        if (arestaCruzaFace([pB[i], pB[(i + 1) % pB.length]], pA, tA)) return true;
      }
      return false;
    }

    function compartilhaVertice2D(a, b, tol) {
      for (var i = 0; i < a.length; i++) {
        for (var j = 0; j < b.length; j++) {
          var dx = a[i].x - b[j].x;
          var dy = a[i].y - b[j].y;
          if (dx * dx + dy * dy <= tol * tol) return true;
        }
      }
      return false;
    }

    function matrizesComSinais(sinais, anguloRad) {
      var ordem = estado.montagem.ordem;
      var matrizes = {};
      matrizes[ordem[0].face] = new THREE.Matrix4();
      for (var i = 1; i < ordem.length; i++) {
        var passo = ordem[i];
        if (passo.rigida) {
          matrizes[passo.face] = matrizes[passo.pai].clone();
        } else {
          matrizes[passo.face] = matrizDobra(
            matrizes[passo.pai],
            passo.p1,
            passo.p2,
            anguloRad,
            sinais[passo.face] || 1
          );
        }
      }
      return matrizes;
    }

    /* Conta pares de faces que se atravessam (aproximação por aresta × triângulo). */
    function contarCruzamentos(poligonos, matrizes, limite) {
      var montagem = estado.montagem;
      var ids = montagem.facesMontadas;
      var pontos3 = {};
      var caixas = {};
      var i, j;

      for (i = 0; i < ids.length; i++) {
        var poly = poligonos[ids[i]];
        if (!poly) continue;
        var lista = [];
        for (j = 0; j < poly.pontos.length; j++) {
          var v = new THREE.Vector3(poly.pontos[j].x, poly.pontos[j].y, 0).applyMatrix4(matrizes[ids[i]]);
          lista.push({ x: v.x, y: v.y, z: v.z });
        }
        pontos3[ids[i]] = lista;
        caixas[ids[i]] = caixaDe(lista);
      }

      var ligados = {};
      for (i = 1; i < montagem.ordem.length; i++) {
        ligados[montagem.ordem[i].pai + ":" + montagem.ordem[i].face] = true;
        ligados[montagem.ordem[i].face + ":" + montagem.ordem[i].pai] = true;
      }

      var total = 0;
      for (i = 0; i < ids.length; i++) {
        for (j = i + 1; j < ids.length; j++) {
          var a = ids[i];
          var b = ids[j];
          if (ligados[a + ":" + b]) continue;
          var pa = poligonos[a];
          var pb = poligonos[b];
          if (!pa || !pb) continue;
          if (compartilhaVertice2D(pa.pontos, pb.pontos, 0.05)) continue;
          if (!caixasCruzam(caixas[a], caixas[b])) continue;
          if (faceCruzaFace(pontos3[a], pa.triangulos, pontos3[b], pb.triangulos)) {
            total++;
            if (limite !== undefined && total >= limite) return total;
          }
        }
      }
      return total;
    }

    /* Testa as 2^n combinações de montanha/vale e escolhe a que menos
     * autointersecta. A faca não traz essa informação. */
    function escolherSinais(poligonos) {
      var ordem = estado.montagem.ordem;
      var passos = [];
      for (var p = 1; p < ordem.length; p++) {
        if (!ordem[p].rigida) passos.push(ordem[p]);
      }
      var n = passos.length;
      var i;

      function centroide(pontos) {
        var x = 0, y = 0;
        for (var k = 0; k < pontos.length; k++) {
          x += pontos[k].x;
          y += pontos[k].y;
        }
        return { x: x / pontos.length, y: y / pontos.length };
      }

      function sinalDobra(matrizPai, p1, p2, centroFilho) {
        var v1 = new THREE.Vector3(p1.x, p1.y, 0).applyMatrix4(matrizPai);
        var v2 = new THREE.Vector3(p2.x, p2.y, 0).applyMatrix4(matrizPai);
        var eixo = new THREE.Vector3().subVectors(v2, v1).normalize();
        var normal = new THREE.Vector3(0, 0, 1).transformDirection(matrizPai);
        var c0 = new THREE.Vector3(centroFilho.x, centroFilho.y, 0).applyMatrix4(matrizPai);
        var q = new THREE.Quaternion().setFromAxisAngle(eixo, Math.PI / 2);
        var c90 = c0.clone().sub(v1).applyQuaternion(q).add(v1);
        var deslocamento = new THREE.Vector3().subVectors(c90, c0);
        return deslocamento.dot(normal) >= 0 ? 1 : -1;
      }

      if (n <= 0) return { sinais: {}, cruzamentos: 0 };

      // Padrão coerente: cada painel dobra para o lado +Z do pai.
      var centros = {};
      for (i = 0; i < estado.montagem.facesMontadas.length; i++) {
        var idf = estado.montagem.facesMontadas[i];
        var poly = poligonos[idf];
        if (poly) centros[idf] = centroide(poly.pontos);
      }
      var base = {};
      var matrizesBase = {};
      matrizesBase[ordem[0].face] = new THREE.Matrix4();
      for (i = 1; i < ordem.length; i++) {
        var passoB = ordem[i];
        if (passoB.rigida) {
          base[passoB.face] = 0;
          matrizesBase[passoB.face] = matrizesBase[passoB.pai].clone();
        } else {
          var sB = sinalDobra(matrizesBase[passoB.pai], passoB.p1, passoB.p2, centros[passoB.face]);
          base[passoB.face] = sB;
          matrizesBase[passoB.face] = matrizDobra(
            matrizesBase[passoB.pai], passoB.p1, passoB.p2, Math.PI / 2, sB
          );
        }
      }

      var cruzBase = contarCruzamentos(poligonos, matrizesBase);
      if (cruzBase === 0 || opt.modoSinais === "cima") {
        return { sinais: base, cruzamentos: cruzBase };
      }

      // Se o padrão coerente se atravessa, procura o menor conjunto de
      // inversões que elimine os cruzamentos.
      var melhor = base;
      var melhorCruz = cruzBase;
      var melhorFlips = 0;
      var combinacoes = Math.pow(2, n);
      for (var mask = 1; mask < combinacoes; mask++) {
        var sinais = {};
        var flips = 0;
        for (i = 0; i < n; i++) {
          var inverter = mask & (1 << i);
          sinais[passos[i].face] = inverter ? -base[passos[i].face] : base[passos[i].face];
          if (inverter) flips++;
        }
        if (flips >= melhorFlips && melhorCruz === 0) continue;
        var matrizes = matrizesComSinais(sinais, Math.PI / 2);
        var c = contarCruzamentos(poligonos, matrizes, melhorCruz + 1);
        if (c < melhorCruz || (c === melhorCruz && flips < melhorFlips)) {
          melhorCruz = c;
          melhorFlips = flips;
          melhor = sinais;
          if (c === 0) break;
        }
      }
      return { sinais: melhor, cruzamentos: melhorCruz };
    }

    /* ------------------------------------------------------ malha de faces */

    function triangular(face) {
      var pontos = limparPoligono(face.pontos);
      if (pontos.length < 3) return null;
      var contorno = pontos.map(function (p) {
        return new THREE.Vector2(p.x, p.y);
      });
      var indices = null;
      try {
        indices = THREE.ShapeUtils.triangulateShape(contorno, []);
      } catch (e) {
        indices = null;
      }
      if (!indices || !indices.length) {
        indices = [];
        for (var i = 1; i < pontos.length - 1; i++) indices.push([0, i, i + 1]);
      }
      return { pontos: pontos, triangulos: indices };
    }

    function recriarMalhas() {
      var i, j;
      for (i = 0; i < estado.malhas.length; i++) {
        grupo.remove(estado.malhas[i]);
        estado.malhas[i].geometry.dispose();
      }
      estado.malhas = [];
      if (estado.bordas) {
        grupo.remove(estado.bordas);
        estado.bordas.geometry.dispose();
        estado.bordas = null;
      }
      if (estado.vincos) {
        grupo.remove(estado.vincos);
        estado.vincos.geometry.dispose();
        estado.vincos = null;
      }
      if (!estado.res || !estado.montagem || !estado.montagem.ordem.length) return;

      var faces = estado.res.faces.faces;
      var mapa = {};
      for (i = 0; i < faces.length; i++) mapa[faces[i].id] = faces[i];

      var matrizes = {};

      // Sinais escolhidos em desenhar() (minimizam autointersecção).
      var sinais = estado.sinais || {};
      matrizes[estado.montagem.raiz] = new THREE.Matrix4();
      var anguloRad = (estado.angulo * Math.PI) / 180;
      for (i = 1; i < estado.montagem.ordem.length; i++) {
        var p2 = estado.montagem.ordem[i];
        if (p2.rigida) {
          matrizes[p2.face] = matrizes[p2.pai].clone();
        } else {
          matrizes[p2.face] = matrizDobra(
            matrizes[p2.pai],
            p2.p1,
            p2.p2,
            anguloRad,
            sinais[p2.face] || 1
          );
        }
      }

      // Caixa final para centralizar.
      var min = { x: Infinity, y: Infinity, z: Infinity };
      var max = { x: -Infinity, y: -Infinity, z: -Infinity };
      var planaMin = { x: Infinity, y: Infinity };
      var planaMax = { x: -Infinity, y: -Infinity };
      for (i = 0; i < estado.montagem.facesMontadas.length; i++) {
        var fid = estado.montagem.facesMontadas[i];
        var ff = mapa[fid];
        if (!ff) continue;
        var mm = matrizes[fid];
        for (j = 0; j < ff.pontos.length; j++) {
          var pf = ff.pontos[j];
          if (pf.x < planaMin.x) planaMin.x = pf.x;
          if (pf.y < planaMin.y) planaMin.y = pf.y;
          if (pf.x > planaMax.x) planaMax.x = pf.x;
          if (pf.y > planaMax.y) planaMax.y = pf.y;
          var v = new THREE.Vector3(ff.pontos[j].x, ff.pontos[j].y, 0).applyMatrix4(mm);
          if (v.x < min.x) min.x = v.x;
          if (v.y < min.y) min.y = v.y;
          if (v.z < min.z) min.z = v.z;
          if (v.x > max.x) max.x = v.x;
          if (v.y > max.y) max.y = v.y;
          if (v.z > max.z) max.z = v.z;
        }
      }
      estado.dimensaoPlana = Math.max(planaMax.x - planaMin.x, planaMax.y - planaMin.y, 1);
      estado.centroPlano = {
        x: (planaMin.x + planaMax.x) / 2,
        y: (planaMin.y + planaMax.y) / 2
      };
      estado.centro = {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        z: (min.z + max.z) / 2
      };
      estado.dimensao = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1);

      var verticesBorda = [];
      var verticesVinco = [];

      for (i = 0; i < estado.montagem.facesMontadas.length; i++) {
        var id = estado.montagem.facesMontadas[i];
        var face = mapa[id];
        if (!face) continue;
        var tri = estado.poligonos[id] || triangular(face);
        if (!tri) continue;
        var matriz = matrizes[id];

        var posicoes = new Float32Array(tri.pontos.length * 3);
        for (j = 0; j < tri.pontos.length; j++) {
          var vt = new THREE.Vector3(tri.pontos[j].x, tri.pontos[j].y, 0).applyMatrix4(matriz);
          posicoes[j * 3] = vt.x - estado.centro.x;
          posicoes[j * 3 + 1] = vt.y - estado.centro.y;
          posicoes[j * 3 + 2] = vt.z - estado.centro.z;
        }
        var indices = [];
        for (j = 0; j < tri.triangulos.length; j++) {
          indices.push(tri.triangulos[j][0], tri.triangulos[j][1], tri.triangulos[j][2]);
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        var malha = new THREE.Mesh(geo, materialFace);
        grupo.add(malha);
        estado.malhas.push(malha);

        for (j = 0; j < tri.pontos.length; j++) {
          var a = new THREE.Vector3(tri.pontos[j].x, tri.pontos[j].y, 0).applyMatrix4(matriz);
          var b = new THREE.Vector3(
            tri.pontos[(j + 1) % tri.pontos.length].x,
            tri.pontos[(j + 1) % tri.pontos.length].y,
            0
          ).applyMatrix4(matriz);
          verticesBorda.push(
            a.x - estado.centro.x, a.y - estado.centro.y, a.z - estado.centro.z,
            b.x - estado.centro.x, b.y - estado.centro.y, b.z - estado.centro.z
          );
        }
      }

      // Linhas de vinco (dobradiças retas) na posição dobrada.
      for (i = 1; i < estado.montagem.ordem.length; i++) {
        var passo2 = estado.montagem.ordem[i];
        if (passo2.rigida) continue;
        var mp = matrizes[passo2.pai];
        var h1 = new THREE.Vector3(passo2.p1.x, passo2.p1.y, 0).applyMatrix4(mp);
        var h2 = new THREE.Vector3(passo2.p2.x, passo2.p2.y, 0).applyMatrix4(mp);
        verticesVinco.push(
          h1.x - estado.centro.x, h1.y - estado.centro.y, h1.z - estado.centro.z,
          h2.x - estado.centro.x, h2.y - estado.centro.y, h2.z - estado.centro.z
        );
      }

      var geoBorda = new THREE.BufferGeometry();
      geoBorda.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verticesBorda), 3));
      estado.bordas = new THREE.LineSegments(geoBorda, materialBorda);
      grupo.add(estado.bordas);

      if (verticesVinco.length) {
        var geoVinco = new THREE.BufferGeometry();
        geoVinco.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verticesVinco), 3));
        estado.vincos = new THREE.LineSegments(geoVinco, materialVinco);
        grupo.add(estado.vincos);
      }

      if (estado.grade) {
        grupo.remove(estado.grade);
        estado.grade.geometry.dispose();
        estado.grade = null;
      }
      var tam = estado.dimensao * 2.2;
      var grade = new THREE.GridHelper(tam, 10, 0xd9dde3, 0xe8ebef);
      grade.rotation.x = Math.PI / 2;
      grade.position.z = min.z - estado.centro.z - estado.dimensao * 0.02;
      grade.material.opacity = 0.55;
      grade.material.transparent = true;
      estado.grade = grade;
      grupo.add(grade);
    }

    /* ------------------------------------------------------------- câmera */

    function posicionarCamera() {
      var r = estado.raio;
      var sp = Math.sin(estado.phi);
      camera.position.set(
        r * sp * Math.sin(estado.theta),
        r * Math.cos(estado.phi),
        r * sp * Math.cos(estado.theta)
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    }

    function ajustarCamera() {
      var base = estado.dimensaoPlana || estado.dimensao;
      estado.raio = base * 1.2 + 40;
      estado.theta = 0.75;
      estado.phi = 1.05;
      posicionarCamera();
    }

    function dimensoes() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width));
      var h = Math.max(1, Math.round(r.height));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      return { w: w, h: h };
    }

    function renderizar() {
      renderer.render(cena, camera);
    }

    function redimensionar() {
      dimensoes();
      renderizar();
    }

    /* ------------------------------------------------------------- eventos */

    var arrastando = false;
    var ultimoX = 0;
    var ultimoY = 0;

    function aoPressionar(e) {
      if (e.button !== 0) return;
      arrastando = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      canvas.classList.add("is-dragging");
      e.preventDefault();
    }

    function aoMover(e) {
      if (!arrastando) return;
      var dx = e.clientX - ultimoX;
      var dy = e.clientY - ultimoY;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      estado.theta -= dx * 0.008;
      estado.phi = Math.max(0.12, Math.min(Math.PI - 0.12, estado.phi - dy * 0.008));
      posicionarCamera();
      renderizar();
    }

    function aoSoltar() {
      arrastando = false;
      canvas.classList.remove("is-dragging");
    }

    function aoRolar(e) {
      e.preventDefault();
      var fator = Math.exp(e.deltaY * 0.0012);
      estado.raio = Math.max(estado.dimensao * 0.4, Math.min(estado.dimensao * 12, estado.raio * fator));
      posicionarCamera();
      renderizar();
    }

    canvas.addEventListener("mousedown", aoPressionar);
    canvas.addEventListener("wheel", aoRolar, { passive: false });
    canvas.addEventListener("mouseleave", aoSoltar);
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    window.addEventListener("mouseup", aoSoltar);
    window.addEventListener("mousemove", aoMover);

    if (typeof raiz.ResizeObserver === "function") {
      observador = new raiz.ResizeObserver(function () {
        redimensionar();
      });
      observador.observe(host);
    } else {
      raiz.addEventListener("resize", redimensionar);
    }

    /* ---------------------------------------------------------------- API */

    function avisar() {
      if (typeof opt.aoInfo !== "function" || !estado.montagem) return;
      var total = estado.res.faces.faces.length;
      var texto =
        estado.montagem.facesMontadas.length + " de " + total + " faces montadas · " +
        (estado.montagem.ordem.length - 1 - estado.montagem.rigidas) + " dobradiças · " +
        (estado.montagem.rigidas ? estado.montagem.rigidas + " ligação(ões) rígida(s) · " : "") +
        "ângulo " + Math.round(estado.angulo) + "°";
      try {
        opt.aoInfo(texto);
      } catch (e) {}
    }

    function desenhar(resultado) {
      estado.res = resultado;
      estado.montagem = construirMontagem(resultado);
      estado.poligonos = {};
      var faces = resultado.faces && resultado.faces.faces ? resultado.faces.faces : [];
      var montadas = estado.montagem.facesMontadas || [];
      for (var i = 0; i < montadas.length; i++) {
        for (var j = 0; j < faces.length; j++) {
          if (faces[j].id === montadas[i]) {
            estado.poligonos[montadas[i]] = triangular(faces[j]);
            break;
          }
        }
      }
      var escolha = escolherSinais(estado.poligonos);
      estado.sinais = escolha.sinais;
      estado.cruzamentos = escolha.cruzamentos;
      recriarMalhas();
      ajustarCamera();
      dimensoes();
      renderizar();
      avisar();
    }

    function definirAngulo(graus) {
      var g = Number(graus);
      if (!isFinite(g)) return;
      estado.angulo = Math.max(0, Math.min(180, g));
      recriarMalhas();
      renderizar();
      avisar();
    }

    function resetarVista() {
      ajustarCamera();
      renderizar();
    }

    function destruir() {
      if (observador) {
        try {
          observador.disconnect();
        } catch (e) {}
        observador = null;
      }
      window.removeEventListener("mouseup", aoSoltar);
      window.removeEventListener("mousemove", aoMover);
      for (var i = 0; i < estado.malhas.length; i++) estado.malhas[i].geometry.dispose();
      if (estado.bordas) estado.bordas.geometry.dispose();
      if (estado.vincos) estado.vincos.geometry.dispose();
      if (estado.grade) estado.grade.geometry.dispose();
      materialFace.dispose();
      materialBorda.dispose();
      materialVinco.dispose();
      try {
        renderer.dispose();
      } catch (e) {}
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return {
      desenhar: desenhar,
      definirAngulo: definirAngulo,
      resetarVista: resetarVista,
      redimensionar: redimensionar,
      destruir: destruir,
      montagem: function () {
        return estado.montagem;
      },
      cruzamentos: function () {
        return estado.cruzamentos || 0;
      }
    };
  }

  V.three3d = {
    criar: criar,
    ANGULO_PADRAO: ANGULO_PADRAO
  };
})();
