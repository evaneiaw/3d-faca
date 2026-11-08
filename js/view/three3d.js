/* FACA 3D -" visualizador 3D (Entrega 3).
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
  var G = (F.geometry = F.geometry || {});

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


  function limparPoligono(pontos) {
    var saida = [];
    for (var i = 0; i < pontos.length; i++) {
      var p = pontos[i];
      if (!saida.length || distancia(saida[saida.length - 1], p) > TOL_PONTO_MM) saida.push(p);
    }
    if (saida.length > 2 && distancia(saida[0], saida[saida.length - 1]) <= TOL_PONTO_MM) saida.pop();
    return saida;
  }

  /* Triangula uma face COM os furos (recortes vazados).
   *
   * `pontos` devolve contorno + furos na mesma ordem usada pelos índices da
   * triangulação; `contorno` guarda só a borda externa (UV, borda e seleção).
   * Se a triangulação com furos falhar, cai para a face sólida (nunca some).
   * Exposta para os testes de Node (sem WebGL). */
  function triangularFace(face) {
    var THREE = exigirThree();
    var contornoPts = limparPoligono(face.pontos);
    if (contornoPts.length < 3) return null;
    var contorno = contornoPts.map(function (p) {
      return new THREE.Vector2(p.x, p.y);
    });
    var furos = [];
    var listaFuros = face.furos || [];
    for (var f = 0; f < listaFuros.length; f++) {
      var hp = limparPoligono(listaFuros[f]);
      if (hp.length < 3) continue;
      furos.push(
        hp.map(function (p) {
          return new THREE.Vector2(p.x, p.y);
        })
      );
    }
    var indices = null;
    if (furos.length) {
      try {
        indices = THREE.ShapeUtils.triangulateShape(contorno, furos);
      } catch (e) {
        indices = null;
      }
      if (!indices || !indices.length) furos = [];
    }
    if (!indices || !indices.length) {
      try {
        indices = THREE.ShapeUtils.triangulateShape(contorno, []);
      } catch (e2) {
        indices = null;
      }
    }
    if (!indices || !indices.length) {
      indices = [];
      for (var i = 1; i < contorno.length - 1; i++) indices.push([0, i, i + 1]);
    }
    var vertices = furos.length ? Array.prototype.concat.apply(contorno, furos) : contorno;
    return { pontos: vertices, contorno: contorno, triangulos: indices };
  }

  /* Matriz de uma dobra: gira o filho em torno do eixo (p1,p2) já no mundo. */
  function matrizDobra3(THREE, matrizPai, p1, p2, anguloRad, sinal) {
    var v1 = new THREE.Vector3(p1.x, p1.y, 0).applyMatrix4(matrizPai);
    var v2 = new THREE.Vector3(p2.x, p2.y, 0).applyMatrix4(matrizPai);
    var eixo = new THREE.Vector3().subVectors(v2, v1).normalize();
    var q = new THREE.Quaternion().setFromAxisAngle(eixo, anguloRad * sinal);
    var rot = new THREE.Matrix4().makeRotationFromQuaternion(q);
    var t1 = new THREE.Matrix4().makeTranslation(v1.x, v1.y, v1.z);
    var t2 = new THREE.Matrix4().makeTranslation(-v1.x, -v1.y, -v1.z);
    return t1.multiply(rot).multiply(t2).multiply(matrizPai);
  }

  /* Matrizes de todas as faces a partir da raiz da montagem. A raiz fica com a
   * identidade (imóvel); cada filho gira em torno da própria dobradiça. Esta é
   * a transformação real usada no 3D — a base fixa escolhida muda a raiz.
   * Exposta para os testes de Node (sem WebGL). */
  function matrizesDaMontagem(THREE, montagem, sinais, angulos, anguloGlobal, overrides) {
    var matrizes = {};
    if (!montagem || !montagem.ordem || !montagem.ordem.length) return matrizes;
    matrizes[montagem.raiz] = new THREE.Matrix4();
    for (var i = 1; i < montagem.ordem.length; i++) {
      var passo = montagem.ordem[i];
      if (!matrizes[passo.pai]) continue;
      if (passo.rigida) {
        matrizes[passo.face] = matrizes[passo.pai].clone();
        continue;
      }
      var angFace =
        angulos && angulos.hasOwnProperty(passo.face) ? angulos[passo.face] : anguloGlobal;
      var sinalFace =
        (sinais && sinais[passo.face] ? sinais[passo.face] : 1) *
        (overrides && overrides.hasOwnProperty(passo.face) ? overrides[passo.face] : 1);
      matrizes[passo.face] = matrizDobra3(
        THREE,
        matrizes[passo.pai],
        passo.p1,
        passo.p2,
        (angFace * Math.PI) / 180,
        sinalFace
      );
    }
    return matrizes;
  }

  /* Escolhe o sentido de cada dobradiça pelo INTERIOR da caixa.
   *
   * A faca não traz montanha/vale. Cada painel dobra para o lado em que o
   * centro da face raiz está, e nenhum painel pode ficar abaixo da base. O
   * número de cruzamentos vira diagnóstico, não o critério. Exposta para os
   * testes de Node (sem WebGL). */
  function escolherSinaisCom(THREE, montagem, poligonos) {
    var ordem = montagem && montagem.ordem ? montagem.ordem : [];
    var sinais = {};
    var matrizes = {};
    if (!ordem.length) return { sinais: sinais, matrizes: matrizes };
    var i;
    var raizId = ordem[0].face;

    function centroide(pontos) {
      var x = 0, y = 0;
      for (var c = 0; c < pontos.length; c++) {
        x += pontos[c].x;
        y += pontos[c].y;
      }
      return pontos.length ? { x: x / pontos.length, y: y / pontos.length } : { x: 0, y: 0 };
    }

    var polyRaiz = poligonos[raizId];
    var centroRaiz = polyRaiz ? centroide(polyRaiz.contorno || polyRaiz.pontos) : { x: 0, y: 0 };
    matrizes[raizId] = new THREE.Matrix4();

    for (i = 1; i < ordem.length; i++) {
      var passo = ordem[i];
      if (!matrizes[passo.pai]) continue;
      if (passo.rigida) {
        sinais[passo.face] = 0;
        matrizes[passo.face] = matrizes[passo.pai].clone();
        continue;
      }
      var poly = poligonos[passo.face];
      if (!poly) {
        sinais[passo.face] = 1;
        matrizes[passo.face] = matrizDobra3(
          THREE, matrizes[passo.pai], passo.p1, passo.p2, Math.PI / 2, 1
        );
        continue;
      }
      var c = centroide(poly.contorno || poly.pontos);
      var mA = matrizDobra3(THREE, matrizes[passo.pai], passo.p1, passo.p2, Math.PI / 2, 1);
      var mB = matrizDobra3(THREE, matrizes[passo.pai], passo.p1, passo.p2, Math.PI / 2, -1);
      var cA = new THREE.Vector3(c.x, c.y, 0).applyMatrix4(mA);
      var cB = new THREE.Vector3(c.x, c.y, 0).applyMatrix4(mB);

      function pontuar(p) {
        var dx = p.x - centroRaiz.x;
        var dy = p.y - centroRaiz.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var abaixo = p.z < -0.5 ? 10000 + Math.abs(p.z) : 0;
        return dist + abaixo + Math.abs(p.z) * 0.1;
      }
      var escolha = pontuar(cA) <= pontuar(cB) ? 1 : -1;
      sinais[passo.face] = escolha;
      matrizes[passo.face] = escolha > 0 ? mA : mB;
    }
    return { sinais: sinais, matrizes: matrizes };
  }

  /* Normaliza uma configuração de dobra salva (JSON do disco) para o estado
   * do visualizador: ângulos por face (0..180), sentidos (-1) e ângulo global
   * de reserva para faces que não estavam no arquivo. Exposta para testes. */
  function normalizarDobras(config, montagem, articulaveis) {
    var out = { angulos: {}, sinaisOverride: {}, angulo: 0 };
    var cfg = config || {};
    var global = Number(cfg.anguloGlobal);
    if (!isFinite(global)) global = 0;
    global = Math.max(0, Math.min(180, global));
    out.angulo = global;
    if (!montagem || !montagem.ordem) return out;
    var mapa = cfg.angulos || {};
    for (var i = 1; i < montagem.ordem.length; i++) {
      var passo = montagem.ordem[i];
      if (passo.rigida) continue;
      if (articulaveis && !articulaveis[passo.face]) continue;
      var v = mapa.hasOwnProperty(passo.face) ? Number(mapa[passo.face]) : global;
      if (!isFinite(v)) v = 0;
      out.angulos[passo.face] = Math.max(0, Math.min(180, v));
    }
    var sinais = cfg.sinais || {};
    for (var f in sinais) {
      if (!sinais.hasOwnProperty(f)) continue;
      var face = Number(f);
      if (articulaveis && !articulaveis[face]) continue;
      if (Number(sinais[f]) === -1) out.sinaisOverride[face] = -1;
    }
    return out;
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
        alpha: false,
        preserveDrawingBuffer: true
      });
    } catch (e) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      var erro = new Error("WebGL indisponível para a visualização 3D: " + (e && e.message ? e.message : e));
      erro.codigo = "SEM_WEBGL";
      throw erro;
    }
    renderer.setClearColor(0xf1f5f9, 1);

    var cena = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 1, 200000);
    camera.up.set(0, 0, 1);

    var controls = null;
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = false;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 0.8;
      controls.panSpeed = 0.8;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      controls.target.set(0, 0, 0);
      // Render on demand: o OrbitControls avisa a cada mudança de câmera.
      controls.addEventListener("change", function () { renderizar(); });
    }
    var grupo = new THREE.Group();
    cena.add(grupo);

    var luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x6b7280, 0.95);
    cena.add(luzAmbiente);
    var luz = new THREE.DirectionalLight(0xffffff, 0.75);
    luz.position.set(0.4, 0.7, 1);
    cena.add(luz);
    var luzFrontal = new THREE.DirectionalLight(0xffffff, 0.35);
    luzFrontal.position.set(-0.5, -0.8, 0.6);
    cena.add(luzFrontal);

    var COR_FRENTE = 0xfcfaf7;
    var COR_VERSO = 0xf0e6d6;
    var COR_LADO = 0xbf864e;
    var COR_MIOLO = 0xd99b5b;

    var materialFace = new THREE.MeshStandardMaterial({
      color: COR_FRENTE,
      roughness: 0.90,
      metalness: 0.02,
      side: THREE.FrontSide,
      flatShading: false,
      depthWrite: true,
      depthTest: true
    });
    var materialFaceInterno = new THREE.MeshStandardMaterial({
      color: COR_VERSO,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.FrontSide,
      flatShading: false,
      depthWrite: true,
      depthTest: true
    });
    var materialFaceLateral = new THREE.MeshStandardMaterial({
      color: COR_LADO,
      roughness: 0.95,
      metalness: 0.02,
      side: THREE.DoubleSide,
      flatShading: false,
      depthWrite: true,
      depthTest: true
    });
    var materialMiolo = new THREE.MeshStandardMaterial({
      color: COR_MIOLO,
      roughness: 0.95,
      metalness: 0.02,
      side: THREE.DoubleSide,
      flatShading: false,
      depthWrite: true,
      depthTest: true
    });
    var materialSelecionada = new THREE.MeshStandardMaterial({
      color: 0xffcc85,
      roughness: 0.84,
      metalness: 0.02,
      side: THREE.FrontSide,
      emissive: 0x6b3f00,
      emissiveIntensity: 0.55
    });
    var materialSelecionadaInterna = new THREE.MeshStandardMaterial({
      color: 0xffcc85,
      roughness: 0.84,
      metalness: 0.02,
      side: THREE.FrontSide,
      emissive: 0x6b3f00,
      emissiveIntensity: 0.55
    });
    var materialArteExterna = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.FrontSide
    });
    var materialArteInterna = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.BackSide
    });
    var materialSelArteExterna = new THREE.MeshStandardMaterial({
      color: 0xffd9a3,
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.FrontSide,
      emissive: 0x5a3500,
      emissiveIntensity: 0.45
    });
    var materialSelArteInterna = new THREE.MeshStandardMaterial({
      color: 0xffd9a3,
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.BackSide,
      emissive: 0x5a3500,
      emissiveIntensity: 0.45
    });
    var materialBorda = new THREE.LineBasicMaterial({ color: COR_BORDA });
    var materialVinco = new THREE.LineBasicMaterial({ color: COR_VINCO });
    var materialDestaque = new THREE.LineBasicMaterial({
      color: 0xe07b18,
      depthTest: false,
      depthWrite: false
    });

    var estado = {
      res: null,
      montagem: null,
      angulo: ANGULO_PADRAO,
      angulos: {},
      sinaisOverride: {},
      faceSelecionada: null,
      facesSelecionadas: {},
      articulaveis: {},
      rotuloModo: null,
      malhas: [],
      malhasInternas: [],
      espessura: 1.5,
      artes: { externa: null, interna: null },
      modoArte: "ambas",
      espelharInterna: false,
      ladoExterno: null,
      giroFace: null,
      destaque: null,
      bordas: null,
      vincos: null,
      centro: { x: 0, y: 0, z: 0 },
      alvo: { x: 0, y: 0, z: 0 },
      dimensao: 1,
      dimensaoPlana: 1,
      vista: "perspectiva_direita",
      theta: 0.75,
      phi: 1.05,
      raio: 1000
    };
    var observador = null;

    /* --------------------------------------------------------- matemática */

    function matrizDobra(matrizPai, p1, p2, anguloRad, sinal) {
      return matrizDobra3(THREE, matrizPai, p1, p2, anguloRad, sinal);
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

    /* Interseção própria entre um segmento e um triângulo (Möller-"Trumbore).
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

    /* Conta pares de faces que se atravessam (aproximação por aresta -- triângulo). */
    function contarCruzamentos(poligonos, matrizes, limite, pares) {
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
            if (pares) pares.push({ a: a, b: b });
            if (limite !== undefined && total >= limite) return total;
          }
        }
      }
      return total;
    }

    /* Escolhe o sentido de cada dobradiça pelo INTERIOR da caixa. */
    function escolherSinais(poligonos) {
      var r = escolherSinaisCom(THREE, estado.montagem, poligonos);
      var paresCruz = [];
      var cruz = contarCruzamentos(poligonos, r.matrizes, undefined, paresCruz);
      estado.cruzamentosPares = paresCruz;
      return { sinais: r.sinais, cruzamentos: cruz };
    }

    /* ------------------------------------------------------ malha de faces */

    function triangular(face) {
      return triangularFace(face);
    }

    /* Ponto garantidamente dentro da face (centro do maior triângulo), já
     * transformado e relativo ao centro do modelo. Usado para o teste de
     * clique (raycast) e para saber onde a face está na tela. */
    function pontoInterno(tri, matriz) {
      var melhor = null;
      var melhorArea = -1;
      for (var t = 0; t < tri.triangulos.length; t++) {
        var a = tri.pontos[tri.triangulos[t][0]];
        var b = tri.pontos[tri.triangulos[t][1]];
        var c = tri.pontos[tri.triangulos[t][2]];
        var area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
        if (area > melhorArea) {
          melhorArea = area;
          melhor = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
        }
      }
      if (!melhor) return null;
      var v = new THREE.Vector3(melhor.x, melhor.y, 0).applyMatrix4(matriz);
      return {
        x: v.x - estado.centro.x,
        y: v.y - estado.centro.y,
        z: v.z - estado.centro.z
      };
    }

    function recriarMalhas() {
      var i, j;
      for (i = 0; i < estado.malhas.length; i++) {
        grupo.remove(estado.malhas[i]);
        estado.malhas[i].geometry.dispose();
      }
      estado.malhas = [];
      for (i = 0; i < estado.malhasInternas.length; i++) {
        grupo.remove(estado.malhasInternas[i]);
        estado.malhasInternas[i].geometry.dispose();
      }
      estado.malhasInternas = [];
      if (estado.destaque) {
        grupo.remove(estado.destaque);
        estado.destaque.geometry.dispose();
        estado.destaque = null;
      }
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

      // Sinais escolhidos em desenhar()/montarArvore() (minimizam autointersecção).
      var matrizes = matrizesDaMontagem(
        THREE,
        estado.montagem,
        estado.sinais || {},
        estado.angulos,
        estado.angulo,
        estado.sinaisOverride
      );

      // Caixa final para centralizar.
      estado.matrizes = matrizes;
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
      estado.caixaMundo = { min: min, max: max };
      estado.dimensao = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1);

      // Lado de fora da folha: a folha e UMA so, entao todas as faces precisam
      // do mesmo lado. O criterio antigo decidia face por face comparando a
      // normal com a direcao ate o centroide; com a folha plana (paraFora.z==0)
      // ou face perto do centroide isso virava ruido numerico e o sinal saia
      // aleatorio por painel. Painel com sinal errado e descartado pelo
      // FrontSide: sobrava o fundo cinza do painel entre as faces.
      //
      // Recalculado a cada montagem de malhas (o voto depende da pose atual):
      // com a folha plana vale a convencao +z; assim que ela dobra, o voto fica
      // decisivo e o lado de fora passa a ser o de fora de verdade.
      if (estado.montagem && estado.montagem.facesMontadas.length) {
        estado.ladoExterno = {};
        if (!estado.giroFace) estado.giroFace = {};
        var prof = {};
        var ordemM = estado.montagem.ordem;
        for (var ip = 1; ip < ordemM.length; ip++) {
          prof[ordemM[ip].face] = (prof[ordemM[ip].pai] || 0) + 1;
        }
        var somaFora = 0;
        var facesValidas = [];
        for (i = 0; i < estado.montagem.facesMontadas.length; i++) {
          var idL = estado.montagem.facesMontadas[i];
          var faceL = mapa[idL];
          if (!faceL) continue;
          var triL = estado.poligonos[idL] || triangular(faceL);
          if (!triL || !triL.triangulos.length || triL.pontos.length < 3) continue;
          facesValidas.push(idL);
          estado.giroFace[idL] = (prof[idL] || 0) >= 2;

          var mL = matrizes[idL];
          var vertL = [];
          for (j = 0; j < triL.pontos.length; j++) {
            vertL.push(new THREE.Vector3(triL.pontos[j].x, triL.pontos[j].y, 0).applyMatrix4(mL));
          }
          var contL = triL.contorno || triL.pontos;
          var cenL = new THREE.Vector3(0, 0, 0);
          for (j = 0; j < contL.length; j++) {
            cenL.add(new THREE.Vector3(contL[j].x, contL[j].y, 0).applyMatrix4(mL));
          }
          cenL.multiplyScalar(1 / contL.length);

          var tL = triL.triangulos[0];
          var normalL = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(vertL[tL[1]], vertL[tL[0]]),
            new THREE.Vector3().subVectors(vertL[tL[2]], vertL[tL[0]])
          );
          // Normal sempre para o lado +z da folha plana (mesma convencao).
          if (frenteNegativa(triL, false)) normalL.negate();

          var paraFora = new THREE.Vector3(
            cenL.x - estado.centro.x,
            cenL.y - estado.centro.y,
            cenL.z - estado.centro.z
          );
          // Peso: so vale quando a folha esta dobrada (paraFora.z != 0). Com a
          // folha plana o voto nao informa nada e o padrao +z decide.
          var peso = Math.abs(paraFora.z);
          if (peso > 1e-9) somaFora += normalL.dot(paraFora) >= 0 ? peso : -peso;
        }
        var sinalGlobal = somaFora < 0 ? -1 : 1;
        for (i = 0; i < facesValidas.length; i++) {
          var idF = facesValidas[i];
          var triF = estado.poligonos[idF] || triangular(mapa[idF]);
          estado.ladoExterno[idF] =
            (frenteNegativa(triF, false) ? -1 : 1) * sinalGlobal;
        }
      }

      var verticesBorda = [];
      var verticesVinco = [];

      for (i = 0; i < estado.montagem.facesMontadas.length; i++) {
        var id = estado.montagem.facesMontadas[i];
        var face = mapa[id];
        if (!face) continue;
        var tri = estado.poligonos[id] || triangular(face);
        if (!tri) continue;
        var matriz = matrizes[id];

        var tMm = (estado.espessura !== undefined && isFinite(estado.espessura)) ? estado.espessura : 1.5;
        var tPt = F.units && F.units.mmParaPt ? F.units.mmParaPt(tMm) : tMm * 2.834645669291339;
        var meioT = tPt / 2;

        var p0 = tri.pontos[tri.triangulos[0][0]];
        var p1 = tri.pontos[tri.triangulos[0][1]];
        var p2 = tri.pontos[tri.triangulos[0][2]];
        var v0 = new THREE.Vector3(p0.x, p0.y, 0).applyMatrix4(matriz);
        var v1 = new THREE.Vector3(p1.x, p1.y, 0).applyMatrix4(matriz);
        var v2 = new THREE.Vector3(p2.x, p2.y, 0).applyMatrix4(matriz);
        var cb = new THREE.Vector3().subVectors(v1, v0);
        var ab = new THREE.Vector3().subVectors(v2, v0);
        var normal = new THREE.Vector3().crossVectors(cb, ab).normalize();
        if (normal.lengthSq() < 0.0001) {
          normal.set(0, 0, 1);
        }

        var inverter = (estado.ladoExterno && estado.ladoExterno[id] < 0) ? true : false;
        var uv = uvDaFace(tri.pontos, estado.artes.externa);
        var girarAgora =
          estado.giroFace &&
          estado.giroFace[id] === true &&
          (estado.angulos[id] || 0) > 45;
        orientarUv(
          uv,
          frenteNegativa(tri, inverter),
          false,
          false,
          girarAgora
        );

        // 1. Face Externa (Frente) +meioT
        var posExt = new Float32Array(tri.pontos.length * 3);
        for (j = 0; j < tri.pontos.length; j++) {
          var vt = new THREE.Vector3(tri.pontos[j].x, tri.pontos[j].y, 0).applyMatrix4(matriz);
          vt.addScaledVector(normal, meioT);
          posExt[j * 3] = vt.x - estado.centro.x;
          posExt[j * 3 + 1] = vt.y - estado.centro.y;
          posExt[j * 3 + 2] = vt.z - estado.centro.z;
        }
        var indicesExt = [];
        for (j = 0; j < tri.triangulos.length; j++) {
          if (inverter) {
            indicesExt.push(tri.triangulos[j][2], tri.triangulos[j][1], tri.triangulos[j][0]);
          } else {
            indicesExt.push(tri.triangulos[j][0], tri.triangulos[j][1], tri.triangulos[j][2]);
          }
        }
        var geoExt = new THREE.BufferGeometry();
        geoExt.setAttribute("position", new THREE.BufferAttribute(posExt, 3));
        geoExt.setIndex(indicesExt);
        geoExt.computeVertexNormals();
        geoExt.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

        var malhaExt = new THREE.Mesh(geoExt, materialFace);
        var baseContorno = tri.contorno || tri.pontos;
        var dadosFace = {
          face: id,
          lado: "externo",
          pontoInterior: pontoInterno(tri, matriz),
          contorno: baseContorno.map(function (pt) {
            var vc = new THREE.Vector3(pt.x, pt.y, 0).applyMatrix4(matriz);
            vc.addScaledVector(normal, meioT);
            return {
              x: vc.x - estado.centro.x,
              y: vc.y - estado.centro.y,
              z: vc.z - estado.centro.z
            };
          })
        };
        malhaExt.userData = dadosFace;
        grupo.add(malhaExt);
        estado.malhas.push(malhaExt);

        // 2. Face Interna (Verso) -meioT
        var posInt = new Float32Array(tri.pontos.length * 3);
        for (j = 0; j < tri.pontos.length; j++) {
          var vt = new THREE.Vector3(tri.pontos[j].x, tri.pontos[j].y, 0).applyMatrix4(matriz);
          vt.addScaledVector(normal, -meioT);
          posInt[j * 3] = vt.x - estado.centro.x;
          posInt[j * 3 + 1] = vt.y - estado.centro.y;
          posInt[j * 3 + 2] = vt.z - estado.centro.z;
        }
        var indicesInt = [];
        for (j = 0; j < tri.triangulos.length; j++) {
          if (inverter) {
            indicesInt.push(tri.triangulos[j][0], tri.triangulos[j][1], tri.triangulos[j][2]);
          } else {
            indicesInt.push(tri.triangulos[j][2], tri.triangulos[j][1], tri.triangulos[j][0]);
          }
        }
        var geoInt = new THREE.BufferGeometry();
        geoInt.setAttribute("position", new THREE.BufferAttribute(posInt, 3));
        geoInt.setIndex(indicesInt);
        geoInt.computeVertexNormals();
        geoInt.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

        var malhaInt = new THREE.Mesh(geoInt, materialFaceInterno);
        malhaInt.userData = {
          face: id,
          lado: "interno",
          pontoInterior: dadosFace.pontoInterior,
          contorno: baseContorno.map(function (pt) {
            var vc = new THREE.Vector3(pt.x, pt.y, 0).applyMatrix4(matriz);
            vc.addScaledVector(normal, -meioT);
            return {
              x: vc.x - estado.centro.x,
              y: vc.y - estado.centro.y,
              z: vc.z - estado.centro.z
            };
          })
        };
        grupo.add(malhaInt);
        estado.malhasInternas.push(malhaInt);

        // 3. Miolo Ondulado (Fluting) - preenchendo o espaço interno com onda sinusoidal
        var posMiolo = new Float32Array(tri.pontos.length * 3);
        for (j = 0; j < tri.pontos.length; j++) {
          var ptJ = tri.pontos[j];
          var vt = new THREE.Vector3(ptJ.x, ptJ.y, 0).applyMatrix4(matriz);
          var onda = Math.sin((ptJ.x * 2 * Math.PI) / 14.17) * (meioT * 0.5);
          vt.addScaledVector(normal, onda);
          posMiolo[j * 3] = vt.x - estado.centro.x;
          posMiolo[j * 3 + 1] = vt.y - estado.centro.y;
          posMiolo[j * 3 + 2] = vt.z - estado.centro.z;
        }
        var geoMiolo = new THREE.BufferGeometry();
        geoMiolo.setAttribute("position", new THREE.BufferAttribute(posMiolo, 3));
        geoMiolo.setIndex(indicesExt);
        geoMiolo.computeVertexNormals();
        var malhaMiolo = new THREE.Mesh(geoMiolo, materialMiolo);
        malhaMiolo.userData = { face: id, lado: "miolo" };
        grupo.add(malhaMiolo);
        estado.malhasInternas.push(malhaMiolo);

        // 4. Bordas Laterais com Perfil de Papelão Ondulado (Edge Profile)
        var sidePositions = [];
        for (j = 0; j < baseContorno.length; j++) {
          var ptA = baseContorno[j];
          var ptB = baseContorno[(j + 1) % baseContorno.length];
          var aW = new THREE.Vector3(ptA.x, ptA.y, 0).applyMatrix4(matriz);
          var bW = new THREE.Vector3(ptB.x, ptB.y, 0).applyMatrix4(matriz);

          var steps = 4;
          for (var s = 0; s < steps; s++) {
            var f1 = s / steps;
            var f2 = (s + 1) / steps;
            var pA = new THREE.Vector3().lerpVectors(aW, bW, f1);
            var pB = new THREE.Vector3().lerpVectors(aW, bW, f2);

            var waveA = Math.sin((pA.x * 2 * Math.PI) / 14.17) * (meioT * 0.5);
            var waveB = Math.sin((pB.x * 2 * Math.PI) / 14.17) * (meioT * 0.5);

            var aEx = pA.clone().addScaledVector(normal, meioT).sub(new THREE.Vector3(estado.centro.x, estado.centro.y, estado.centro.z));
            var bEx = pB.clone().addScaledVector(normal, meioT).sub(new THREE.Vector3(estado.centro.x, estado.centro.y, estado.centro.z));
            var aMi = pA.clone().addScaledVector(normal, waveA).sub(new THREE.Vector3(estado.centro.x, estado.centro.y, estado.centro.z));
            var bMi = pB.clone().addScaledVector(normal, waveB).sub(new THREE.Vector3(estado.centro.x, estado.centro.y, estado.centro.z));
            var aIn = pA.clone().addScaledVector(normal, -meioT).sub(new THREE.Vector3(estado.centro.x, estado.centro.y, estado.centro.z));
            var bIn = pB.clone().addScaledVector(normal, -meioT).sub(new THREE.Vector3(estado.centro.x, estado.centro.y, estado.centro.z));

            sidePositions.push(
              aEx.x, aEx.y, aEx.z,
              bEx.x, bEx.y, bEx.z,
              bMi.x, bMi.y, bMi.z,

              aEx.x, aEx.y, aEx.z,
              bMi.x, bMi.y, bMi.z,
              aMi.x, aMi.y, aMi.z,

              aMi.x, aMi.y, aMi.z,
              bMi.x, bMi.y, bMi.z,
              bIn.x, bIn.y, bIn.z,

              aMi.x, aMi.y, aMi.z,
              bIn.x, bIn.y, bIn.z,
              aIn.x, aIn.y, aIn.z
            );
          }
        }
        if (sidePositions.length > 0) {
          var geoSide = new THREE.BufferGeometry();
          geoSide.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sidePositions), 3));
          geoSide.computeVertexNormals();
          var malhaSide = new THREE.Mesh(geoSide, materialFaceLateral);
          malhaSide.userData = { face: id, lado: "lateral" };
          grupo.add(malhaSide);
          estado.malhasInternas.push(malhaSide);
        }

        for (j = 0; j < baseContorno.length; j++) {
          var a = new THREE.Vector3(baseContorno[j].x, baseContorno[j].y, 0).applyMatrix4(matriz);
          var b = new THREE.Vector3(
            baseContorno[(j + 1) % baseContorno.length].x,
            baseContorno[(j + 1) % baseContorno.length].y,
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

      atualizarSelecao();
    }

    /* ------------------------------------------------------------ seleção */

    function malhaDaFace(face) {
      for (var i = 0; i < estado.malhas.length; i++) {
        if (estado.malhas[i].userData.face === face) return estado.malhas[i];
      }
      return null;
    }

    function faceValida(face) {
      return face !== null && face !== undefined && estado.articulaveis[face] === true;
    }

    function listaSelecionadas() {
      var out = [];
      for (var f in estado.facesSelecionadas) {
        if (estado.facesSelecionadas.hasOwnProperty(f)) out.push(Number(f));
      }
      out.sort(function (a, b) {
        return a - b;
      });
      return out;
    }

    function frenteNegativa(tri, inverter) {
      if (!tri || !tri.triangulos || !tri.triangulos.length || tri.pontos.length < 3) return false;
      var t = tri.triangulos[0];
      var a = tri.pontos[t[0]];
      var b = tri.pontos[t[1]];
      var c = tri.pontos[t[2]];
      if (!a || !b || !c) return false;
      var crossZ = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      var z = crossZ >= 0 ? 1 : -1;
      if (inverter) z = -z;
      return z < 0;
    }

    /* Orientação da textura em relação à própria face (mantém a região da
     * arte no painel): espelha o U e/ou gira 180° em torno do centro do UV. */
    function centroUv(uv) {
      var minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (var i = 0; i < uv.length; i += 2) {
        if (uv[i] < minU) minU = uv[i];
        if (uv[i] > maxU) maxU = uv[i];
        if (uv[i + 1] < minV) minV = uv[i + 1];
        if (uv[i + 1] > maxV) maxV = uv[i + 1];
      }
      return { u: (minU + maxU) / 2, v: (minV + maxV) / 2 };
    }

    function orientarUv(uv, espelharU, girar180, espelharV, girar90) {
      if (!espelharU && !girar180 && !espelharV && !girar90) return;
      var c = centroUv(uv);
      for (var i = 0; i < uv.length; i += 2) {
        var u = uv[i];
        var v = uv[i + 1];
        if (espelharU || girar180) u = 2 * c.u - u;
        if (girar180 || espelharV) v = 2 * c.v - v;
        if (girar90) {
          var du = u - c.u;
          var dv = v - c.v;
          u = c.u - dv;
          v = c.v + du;
        }
        uv[i] = u;
        uv[i + 1] = v;
      }
    }

    /* UV da face. Referencia = retangulo da artboard (mm do documento).
     * Se a arte tem uma caixa de conteudo (`conteudo`, normalizada em [0,1]),
     * a UV e remapeada para o DESENHO preencher o painel: sem isso, a parte
     * da artboard sem arte virava papel branco/cinza no meio do 3D. */
    function uvDaFace(pontos, arte) {
      var uv = new Float32Array(pontos.length * 2);
      var r = arte && arte.rect ? arte.rect : null;
      if (!r) return uv;
      var larg = r.right - r.left;
      var alt = r.top - r.bottom;
      if (!(larg > 0) || !(alt > 0)) return uv;
      var off = estado.artes.offset || { x: 0, y: 0 };
      var c = arte && arte.conteudo ? arte.conteudo : null;
      var du = c ? c.u1 - c.u0 : 1;
      var dv = c ? c.v1 - c.v0 : 1;
      for (var i = 0; i < pontos.length; i++) {
        var u = (pontos[i].x + off.x - r.left) / larg;
        var v = (pontos[i].y + off.y - r.bottom) / alt;
        if (c) {
          u = c.u0 + u * du;
          v = c.v0 + v * dv;
        }
        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
      }
      return uv;
    }

    /* Alguma arte esta sendo exibida como textura nos paineis? */
    function artesVisiveis() {
      var modo = estado.modoArte;
      if (modo === "nenhuma") return false;
      if (modo === "ambas") return !!(estado.artes.externa || estado.artes.interna);
      if (modo === "externa") return !!estado.artes.externa;
      if (modo === "interna") return !!estado.artes.interna;
      return false;
    }

    /* Bordas (cinza) e vincos (azul) sao guias TECNICAS. Elas sao desenhadas
     * em LineSegments sobre os paineis e, quando a arte esta aplicada como
     * textura, cortam o desenho com riscos/faixas cinzas. Com arte visivel
     * elas ficam invisiveis: a face mostra somente o material com a imagem.
     * O fundo tambem passa a ser cor de papel: qualquer fresta entre paineis
     * aparece como papel, nunca como o cinza da interface. */
    function atualizarOverlays() {
      var comArte = artesVisiveis();
      var mostrar = !comArte;
      if (estado.bordas) estado.bordas.visible = mostrar;
      if (estado.vincos) estado.vincos.visible = mostrar;
      if (renderer) {
        if (comArte) renderer.setClearColor(COR_PAPEL, 1);
        else renderer.setClearColor(0x000000, 0);
      }
    }

    /* Arte de cada lado da folha. Documento com UMA artboard nao tem arte
     * interna: nesse caso o lado de dentro mostra a MESMA arte externa (e o
     * UV interno ja usa o retangulo da 1a artboard, espelhado). Sem esse
     * fallback o verso dos paineis e das abas caia no material de papel e
     * aparecia como faixa/mancha cinza entre as faces com arte. */
    function arteDoLado(interno) {
      if (interno) return estado.artes.interna || estado.artes.externa || null;
      return estado.artes.externa || null;
    }

    function materialDaMalha(malha, selecionada) {
      var interno = malha.userData.lado === "interno";
      var arte = arteDoLado(interno);
      var modo = estado.modoArte;
      var mostraArte =
        !!arte && (modo === "ambas" || (interno ? modo === "interna" : modo === "externa"));
      if (!mostraArte) {
        if (selecionada) return interno ? materialSelecionadaInterna : materialSelecionada;
        return interno ? materialFaceInterno : materialFace;
      }
      if (selecionada) return interno ? materialSelArteInterna : materialSelArteExterna;
      return interno ? materialArteInterna : materialArteExterna;
    }

    function atualizarSelecao() {
      var i;
      atualizarOverlays();
      for (i = 0; i < estado.malhas.length; i++) {
        var m = estado.malhas[i];
        m.material = materialDaMalha(m, estado.facesSelecionadas[m.userData.face] === true);
      }
      for (i = 0; i < estado.malhasInternas.length; i++) {
        var mi = estado.malhasInternas[i];
        mi.material = materialDaMalha(mi, estado.facesSelecionadas[mi.userData.face] === true);
      }
      if (estado.destaque) {
        grupo.remove(estado.destaque);
        estado.destaque.geometry.dispose();
        estado.destaque = null;
      }
      var lista = listaSelecionadas();
      if (!lista.length) return;
      var verts = [];
      for (i = 0; i < lista.length; i++) {
        var malha = malhaDaFace(lista[i]);
        if (!malha || !malha.userData.contorno || malha.userData.contorno.length < 2) continue;
        var contorno = malha.userData.contorno;
        for (var j = 0; j < contorno.length; j++) {
          var a = contorno[j];
          var b = contorno[(j + 1) % contorno.length];
          verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      if (!verts.length) return;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
      estado.destaque = new THREE.LineSegments(geo, materialDestaque);
      estado.destaque.renderOrder = 2;
      grupo.add(estado.destaque);
    }

    function notificarSelecao(face) {
      if (typeof opt.aoSelecionarFace !== "function") return;
      try {
        opt.aoSelecionarFace(face);
      } catch (e) {}
    }

    /* modo:
     *   undefined / "substituir" -> seleciona só a face (clicar na única
     *                               selecionada desmarca)
     *   true / "alternar"         -> soma/remove (Ctrl+clique)
     *   "adicionar"               -> sempre soma (Shift+clique)
     *   null/undefined face       -> limpa tudo */
    function selecionarFace(face, modo) {
      var alvo = face === null || face === undefined ? null : Number(face);
      if (!faceValida(alvo)) alvo = null;
      var antes = listaSelecionadas().join(",");
      var novo = {};
      var i;
      var atuais = listaSelecionadas();

      if (alvo === null) {
        // limpa tudo
      } else if (modo === true || modo === "alternar") {
        for (i = 0; i < atuais.length; i++) novo[atuais[i]] = true;
        if (novo[alvo]) delete novo[alvo];
        else novo[alvo] = true;
      } else if (modo === "adicionar") {
        for (i = 0; i < atuais.length; i++) novo[atuais[i]] = true;
        novo[alvo] = true;
      } else {
        // substituir; clicar na única face já selecionada desmarca
        var unica = atuais.length === 1 && atuais[0] === alvo;
        if (!unica) novo[alvo] = true;
      }

      var lista = [];
      for (var f in novo) {
        if (novo.hasOwnProperty(f)) lista.push(Number(f));
      }
      lista.sort(function (a, b) {
        return a - b;
      });
      estado.facesSelecionadas = novo;
      if (alvo !== null && novo[alvo]) estado.faceSelecionada = alvo;
      else estado.faceSelecionada = lista.length ? lista[0] : null;
      if (estado.faceSelecionada !== null) estado.rotuloModo = null;
      atualizarSelecao();
      renderizar();
      avisar();
      if (lista.join(",") !== antes) notificarSelecao(estado.faceSelecionada);
    }

    function limparSelecao() {
      if (!listaSelecionadas().length && estado.faceSelecionada === null) return;
      estado.facesSelecionadas = {};
      estado.faceSelecionada = null;
      notificarSelecao(null);
    }

    function faceNoPonto(x, y) {
      if (!estado.malhas.length) return null;
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      var ndc = {
        x: ((x - r.left) / r.width) * 2 - 1,
        y: -((y - r.top) / r.height) * 2 + 1
      };
      if (ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) return null;
      var raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      grupo.updateMatrixWorld(true);
      var alvos = estado.malhas.concat(estado.malhasInternas);
      var achados = raycaster.intersectObjects(alvos, false);
      if (!achados.length) return null;
      return achados[0].object.userData.face;
    }

    function telaDaFace(face) {
      var malha = malhaDaFace(face);
      if (!malha || !malha.userData.pontoInterior) return null;
      var p = malha.userData.pontoInterior;
      var v = new THREE.Vector3(p.x, p.y, p.z);
      v.project(camera);
      var r = canvas.getBoundingClientRect();
      return {
        x: r.left + (v.x * 0.5 + 0.5) * r.width,
        y: r.top + (-v.y * 0.5 + 0.5) * r.height,
        visivel: v.z > -1 && v.z < 1
      };
    }

    /* ------------------------------------------------------------- câmera */

    function posicionarCamera() {
      var r = estado.raio;
      var sp = Math.sin(estado.phi);
      var alvo = estado.alvo || { x: 0, y: 0, z: 0 };
      camera.position.set(
        alvo.x + r * sp * Math.cos(estado.theta),
        alvo.y + r * sp * Math.sin(estado.theta),
        alvo.z + r * Math.cos(estado.phi)
      );
      camera.up.set(0, 0, 1);
      if (estado.vista === "baixo") camera.up.set(0, 1, 0);
      if (controls) {
        controls.target.set(alvo.x, alvo.y, alvo.z);
        controls.update();
      } else {
        camera.lookAt(alvo.x, alvo.y, alvo.z);
      }
      renderizar();
    }

    function ajustarCamera() {
      var base = estado.dimensaoPlana || estado.dimensao;
      estado.raio = base * 1.2 + 40;
      estado.theta = -0.75;
      estado.phi = 1.05;
      estado.vista = "perspectiva_direita";
      estado.alvo = { x: 0, y: 0, z: 0 };
      grupo.rotation.set(0, 0, 0);
      posicionarCamera();
    }

    function definirVista(vista) {
      estado.alvo = { x: 0, y: 0, z: 0 };
      estado.vista = vista;
      grupo.rotation.set(0, 0, 0);
      if (vista === "frente") {
        estado.theta = -Math.PI / 2;
        estado.phi = Math.PI / 2;
      } else if (vista === "topo") {
        estado.theta = -Math.PI / 2;
        estado.phi = 0.08;
      } else if (vista === "baixo") {
        estado.theta = -Math.PI / 2;
        estado.phi = Math.PI - 0.08;
      } else if (vista === "lado_direito") {
        estado.theta = 0;
        estado.phi = Math.PI / 2;
      } else if (vista === "lado_esquerdo") {
        estado.theta = Math.PI;
        estado.phi = Math.PI / 2;
      } else if (vista === "perspectiva_esquerda") {
        estado.theta = -Math.PI + 0.75;
        estado.phi = 1.05;
      } else if (vista === "interior") {
        var caixa = estado.caixaMundo || { min: { x: -100, y: -100, z: -100 }, max: { x: 100, y: 100, z: 100 } };
        var hx = Math.max(1, (caixa.max.x - caixa.min.x) / 2);
        var hy = Math.max(1, (caixa.max.y - caixa.min.y) / 2);
        var hz = Math.max(1, (caixa.max.z - caixa.min.z) / 2);
        var alvoI = { x: hx * 0.3, y: hy * 0.3, z: -hz * 0.2 };
        var camI = { x: -hx * 0.55, y: -hy * 0.55, z: hz * 0.4 };
        var vx = camI.x - alvoI.x;
        var vy = camI.y - alvoI.y;
        var vz = camI.z - alvoI.z;
        estado.alvo = alvoI;
        estado.raio = Math.max(Math.sqrt(vx * vx + vy * vy + vz * vz), 1);
        estado.theta = Math.atan2(vy, vx);
        estado.phi = Math.acos(Math.min(1, Math.max(-1, vz / estado.raio)));
      } else {
        estado.vista = "perspectiva_direita";
        estado.theta = -0.75;
        estado.phi = 1.05;
      }
      posicionarCamera();
      camera.fov = vista === "interior" ? 72 : 42;
      camera.updateProjectionMatrix();
      renderizar();
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

    var arrastando = null;
    var ultimoX = 0;
    var ultimoY = 0;

    function aoPressionar(e) {
      if (e.button === 0) arrastando = "orbita";
      else if (e.button === 2) arrastando = "pan";
      else return;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      canvas.classList.add(arrastando === "pan" ? "is-panning" : "is-dragging");
      e.preventDefault();
    }

    function aoMover(e) {
      if (!arrastando) return;
      var dx = e.clientX - ultimoX;
      var dy = e.clientY - ultimoY;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      if (arrastando === "pan") {
        var largura = Math.max(1, canvas.getBoundingClientRect().width);
        var escala = (estado.raio / largura) * 1.1;
        camera.updateMatrixWorld();
        var direita = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        var cima = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        estado.alvo.x += (-dx * direita.x + dy * cima.x) * escala;
        estado.alvo.y += (-dx * direita.y + dy * cima.y) * escala;
        estado.alvo.z += (-dx * direita.z + dy * cima.z) * escala;
      } else {
        estado.vista = "livre";
        estado.theta -= dx * 0.008;
        estado.phi = Math.max(0.12, Math.min(Math.PI - 0.12, estado.phi - dy * 0.008));
      }
      posicionarCamera();
      renderizar();
    }

    function aoSoltar() {
      if (!arrastando) return;
      arrastando = null;
      canvas.classList.remove("is-dragging");
      canvas.classList.remove("is-panning");
    }

    function aoRolar(e) {
      e.preventDefault();
      var fator = Math.exp(e.deltaY * 0.0012);
      estado.raio = Math.max(estado.dimensao * 0.4, Math.min(estado.dimensao * 12, estado.raio * fator));
      posicionarCamera();
      renderizar();
    }

    if (!controls) {
      canvas.addEventListener("mousedown", aoPressionar);
      canvas.addEventListener("wheel", aoRolar, { passive: false });
      canvas.addEventListener("mouseleave", aoSoltar);
      window.addEventListener("mouseup", aoSoltar);
      window.addEventListener("mousemove", aoMover);
    }
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    /* Clique (sem arrastar) seleciona a face; clicar na mesma face ou fora da
     * caixa desmarca. Arrastar continua sendo órbita/pan do OrbitControls. */
    var LIMITE_CLIQUE_PX = 4;
    var inicioClique = null;

    function aoApontarBaixo(e) {
      if (e.button !== 0) {
        inicioClique = null;
        return;
      }
      inicioClique = { x: e.clientX, y: e.clientY };
    }

    function aoApontarCima(e) {
      var inicio = inicioClique;
      inicioClique = null;
      if (!inicio || e.button !== 0) return;
      var dx = e.clientX - inicio.x;
      var dy = e.clientY - inicio.y;
      if (dx * dx + dy * dy > LIMITE_CLIQUE_PX * LIMITE_CLIQUE_PX) return;
      var face = faceNoPonto(e.clientX, e.clientY);
      var modo = e.ctrlKey || e.metaKey ? "alternar" : e.shiftKey ? "adicionar" : undefined;
      selecionarFace(face, modo);
    }

    function aoCancelarClique() {
      inicioClique = null;
    }

    function aoMoverCursor(e) {
      if (e.buttons !== 0) {
        if (canvas.style.cursor) canvas.style.cursor = "";
        return;
      }
      var face = faceNoPonto(e.clientX, e.clientY);
      var novo = face === null ? "" : "pointer";
      if (novo !== canvas.style.cursor) canvas.style.cursor = novo;
    }

    function aoSairCursor() {
      if (canvas.style.cursor) canvas.style.cursor = "";
    }

    canvas.addEventListener("pointerdown", aoApontarBaixo);
    canvas.addEventListener("pointerup", aoApontarCima);
    canvas.addEventListener("pointercancel", aoCancelarClique);
    canvas.addEventListener("pointermove", aoMoverCursor);
    canvas.addEventListener("pointerleave", aoSairCursor);

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
        (estado.montagem.rigidas ? estado.montagem.rigidas + " ligação(ões) rígida(s) · " : "");
      var face = estado.faceSelecionada;
      var selecionadas = listaSelecionadas();
      if (selecionadas.length > 1) {
        var sinalMulti = sinalDaFace(face);
        texto +=
          selecionadas.length + " faces selecionadas (" + selecionadas.join(", ") + ")" +
          " · sentido " + (sinalMulti > 0 ? "+" : "-") +
          " · " + Math.round(anguloDaFace(face)) + "°";
      } else if (face !== null && estado.articulaveis[face]) {
        var passo = null;
        for (var i = 0; i < estado.montagem.ordem.length; i++) {
          if (estado.montagem.ordem[i].face === face) {
            passo = estado.montagem.ordem[i];
            break;
          }
        }
        var sinal = (estado.sinais[face] || 1) * sinalDaFace(face);
        texto +=
          "face " + face + " selecionada" +
          (passo ? " · articulação " + passo.pai + " -> " + face : "") +
          " · sentido " + (sinal > 0 ? "+" : "-") + " · " + Math.round(anguloDaFace(face)) + "°" +
          " · Ctrl+clique soma faces";
      } else if (estado.rotuloModo) {
        texto += estado.rotuloModo;
      } else {
        var temProprios = false;
        for (var k in estado.angulos) {
          if (estado.angulos.hasOwnProperty(k)) {
            temProprios = true;
            break;
          }
        }
        if (temProprios) {
          texto += "nenhuma face selecionada · clique numa face para articulá-la (Ctrl+clique soma várias)";
        } else {
          texto += "ângulo global " + Math.round(estado.angulo) +
            "° · clique numa face para articulá-la (Ctrl+clique soma várias)";
        }
      }
      try {
        opt.aoInfo(texto);
      } catch (e) {}
    }

    function anguloDaFace(face) {
      if (estado.angulos.hasOwnProperty(face)) return estado.angulos[face];
      return estado.angulo;
    }

    function sinalDaFace(face) {
      return estado.sinaisOverride[face] === -1 ? -1 : 1;
    }

    function definirSinalFace(face, sinal) {
      definirSinais([face], sinal);
    }

    function definirSinais(faces, sinal) {
      if (!faces || !faces.length) return;
      for (var i = 0; i < faces.length; i++) {
        var face = Number(faces[i]);
        if (!estado.articulaveis[face]) continue;
        if (sinal === -1) estado.sinaisOverride[face] = -1;
        else delete estado.sinaisOverride[face];
      }
      estado.rotuloModo = null;
      recriarMalhas();
      renderizar();
      avisar();
    }

    function angulosAtuais() {
      var mapa = {};
      if (!estado.montagem) return mapa;
      for (var i = 1; i < estado.montagem.ordem.length; i++) {
        var s = estado.montagem.ordem[i];
        if (s.rigida) continue;
        mapa[s.face] = anguloDaFace(s.face);
      }
      return mapa;
    }

    function definirAngulo(graus) {
      var g = Number(graus);
      if (!isFinite(g)) return;
      estado.angulo = Math.max(0, Math.min(180, g));
      estado.angulos = {};
      estado.sinaisOverride = {};
      estado.rotuloModo = null;
      limparSelecao();
      recriarMalhas();
      renderizar();
      avisar();
    }

    /* Ajusta SOMENTE as faces indicadas. As demais mantêm o ângulo e o sentido
     * já definidos (não são zeradas). */
    function definirArticulacoes(faces, graus, sinal) {
      var g = Number(graus);
      if (!isFinite(g) || !estado.montagem || !faces || !faces.length) return;
      var ang = Math.max(0, Math.min(180, g));
      for (var i = 0; i < faces.length; i++) {
        var face = Number(faces[i]);
        if (!estado.articulaveis[face]) continue;
        estado.angulos[face] = ang;
        if (sinal === -1) estado.sinaisOverride[face] = -1;
        else delete estado.sinaisOverride[face];
      }
      estado.rotuloModo = null;
      recriarMalhas();
      renderizar();
      avisar();
    }

    function definirArticulacao(faceFilho, graus, sinal) {
      definirArticulacoes([faceFilho], graus, sinal);
    }

    function definirAngulos(mapa, rotulo) {
      if (!estado.montagem) return;
      estado.angulos = {};
      for (var i = 1; i < estado.montagem.ordem.length; i++) {
        var s = estado.montagem.ordem[i];
        if (s.rigida) continue;
        estado.angulos[s.face] = mapa && mapa.hasOwnProperty(s.face)
          ? Math.max(0, Math.min(180, Number(mapa[s.face]) || 0))
          : 0;
      }
      estado.sinaisOverride = {};
      estado.angulo = 0;
      estado.rotuloModo = rotulo || "montagem por perfil (todas as dobras 90°)";
      limparSelecao();
      recriarMalhas();
      renderizar();
      avisar();
    }

    /* Restaura uma configuração de dobra salva (ângulos e sentidos por face).
     * Não mexe na base fixa nem na câmera. */
    function aplicarDobras(config, rotulo) {
      if (!estado.montagem) return false;
      var norm = normalizarDobras(config, estado.montagem, estado.articulaveis);
      estado.angulos = norm.angulos;
      estado.sinaisOverride = norm.sinaisOverride;
      estado.angulo = norm.angulo;
      estado.rotuloModo = rotulo || "ângulos restaurados";
      limparSelecao();
      recriarMalhas();
      renderizar();
      avisar();
      return true;
    }

    function perfilPadrao() {
      var mapa = {};
      if (!estado.montagem) return mapa;
      for (var i = 1; i < estado.montagem.ordem.length; i++) {
        var s = estado.montagem.ordem[i];
        if (s.rigida) continue;
        // Todas as dobras fecham em 90°. Orelha em 180° ficava deitada sobre a
        // face vizinha (parecia atravessar o painel); 90° encosta para dentro.
        mapa[s.face] = 90;
      }
      return mapa;
    }

    /* Artes: { externa: {texture, rect}, interna: {texture, rect} }
     * opcoes: { modo: "ambas"|"externa"|"interna"|"nenhuma", espelharInterna } */
    function logArteDebug() {
      if (!F.log) return;
      var off = estado.artes.offset || { x: 0, y: 0 };
      F.log("3d", "arteDebug: modo=" + estado.modoArte +
        " texturaExt=" + (materialArteExterna.map ? "sim" : "nao") +
        " offset=" + off.x.toFixed(2) + "," + off.y.toFixed(2));
      var r = estado.artes.externa && estado.artes.externa.rect;
      if (r) {
        F.log("3d", "arteDebug: rectExt=[" + r.left.toFixed(2) + "," +
          r.bottom.toFixed(2) + "," + r.right.toFixed(2) + "," + r.top.toFixed(2) + "]");
      }
      var c = estado.artes.externa && estado.artes.externa.conteudo;
      F.log("3d", "arteDebug: conteudoExt=" + (c
        ? ("u " + c.u0.toFixed(3) + ".." + c.u1.toFixed(3) + " v " + c.v0.toFixed(3) + ".." + c.v1.toFixed(3))
        : "artboard inteira"));
      var comArte = 0, semArte = 0;
      for (var i = 0; i < estado.malhas.length; i++) {
        if (estado.malhas[i].material === materialArteExterna ||
            estado.malhas[i].material === materialSelArteExterna) comArte++;
        else semArte++;
      }
      F.log("3d", "arteDebug: facesExternas=" + estado.malhas.length +
        " comArte=" + comArte + " semArte=" + semArte +
        " bordas=" + (estado.bordas ? (estado.bordas.visible ? "visiveis" : "ocultas") : "-") +
        " fundo=" + (artesVisiveis() ? "papel" : "transparente"));
      var invertidas = 0;
      for (var w = 0; w < estado.malhas.length; w++) {
        var idw = estado.malhas[w].userData.face;
        if (estado.ladoExterno && estado.ladoExterno[idw] < 0) invertidas++;
      }
      F.log("3d", "arteDebug: invertidas=" + invertidas + " de " + estado.malhas.length);
      if (estado.malhas.length <= 40) {
        for (var j = 0; j < estado.malhas.length; j++) {
          var m = estado.malhas[j];
          var uv = m.geometry.getAttribute("uv");
          if (!uv) continue;
          var minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (var k = 0; k < uv.count; k++) {
            var u = uv.getX(k), v = uv.getY(k);
            if (u < minU) minU = u;
            if (u > maxU) maxU = u;
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
          }
          F.log("3d", "arteDebug: face=" + m.userData.face +
            " mat=" + (m.material === materialArteExterna || m.material === materialSelArteExterna ? "arte" : "papel") +
            " u=" + minU.toFixed(3) + ".." + maxU.toFixed(3) +
            " v=" + minV.toFixed(3) + ".." + maxV.toFixed(3));
        }
      }
    }

    function definirArtes(novas, opcoes) {
      if (novas) {
        estado.artes.externa = novas.externa || null;
        estado.artes.interna = novas.interna || null;
        estado.artes.offset = novas.offset || estado.artes.offset || { x: 0, y: 0 };
        var texExterna = estado.artes.externa ? estado.artes.externa.texture : null;
        var texInterna = estado.artes.interna
          ? estado.artes.interna.texture
          : texExterna; // 1 artboard: o verso mostra a mesma arte (espelhada).
        materialArteExterna.map = texExterna;
        materialArteInterna.map = texInterna;
        materialSelArteExterna.map = materialArteExterna.map;
        materialSelArteInterna.map = materialArteInterna.map;
        materialArteExterna.needsUpdate = true;
        materialArteInterna.needsUpdate = true;
        materialSelArteExterna.needsUpdate = true;
        materialSelArteInterna.needsUpdate = true;
      }
      if (opcoes) {
        if (opcoes.modo) estado.modoArte = opcoes.modo;
        if (typeof opcoes.espelharInterna === "boolean") {
          estado.espelharInterna = opcoes.espelharInterna;
        }
      }
      recriarMalhas();
      if (novas) logArteDebug();
      renderizar();
    }

    function articulacoes() {
      if (!estado.montagem) return [];
      var out = [];
      for (var i = 1; i < estado.montagem.ordem.length; i++) {
        var s = estado.montagem.ordem[i];
        if (s.rigida) continue;
        out.push({
          faceFilho: s.face,
          facePai: s.pai,
          sinalBase: (estado.sinais && estado.sinais[s.face]) || 1,
          p1: s.p1,
          p2: s.p2
        });
      }
      return out;
    }

    function cruzamentosAtuais() {
      if (!estado.montagem || !estado.matrizes || !estado.poligonos) return 0;
      var pares = [];
      var n = contarCruzamentos(estado.poligonos, estado.matrizes, undefined, pares);
      estado.cruzamentosPares = pares;
      return n;
    }

    function cruzamentosPares() {
      return estado.cruzamentosPares || [];
    }

    function infoBase() {
      var m = estado.montagem;
      if (!m) return null;
      return {
        raiz: m.raiz,
        raizAutomatica: m.raizAutomatica,
        raizSolicitada: m.raizSolicitada,
        manual: !!m.baseManual,
        motivo: m.motivoBase || null,
        faces: (m.facesMontadas || []).length
      };
    }

    /* Monta a árvore a partir da raiz pedida (null = automática) e recalcula
     * os sinais de dobra. Usada pelo desenho inicial e pela troca de base. */
    function montarArvore(resultado, raiz) {
      estado.res = resultado;
      estado.raizSolicitada = raiz === undefined ? null : raiz;
      estado.montagem = G.hinge.construir(resultado, { raiz: estado.raizSolicitada });
      estado.poligonos = {};
      estado.articulaveis = {};
      for (var k = 1; k < estado.montagem.ordem.length; k++) {
        if (!estado.montagem.ordem[k].rigida) estado.articulaveis[estado.montagem.ordem[k].face] = true;
      }
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
      // A base mudou: o lado de fora e o giro da tampa podem mudar.
      estado.ladoExterno = null;
      estado.giroFace = null;
      var escolha = escolherSinais(estado.poligonos);
      estado.sinais = escolha.sinais;
      estado.cruzamentos = escolha.cruzamentos;
      G.hinge.anotarSinais(estado.montagem, escolha.sinais);
      estado.baseInfo = infoBase();
      return estado.baseInfo;
    }

    function desenhar(resultado, opcoes) {
      var opt = opcoes || {};
      estado.faceSelecionada = null;
      estado.facesSelecionadas = {};
      estado.rotuloModo = null;
      estado.angulos = {};
      estado.sinaisOverride = {};
      estado.angulo = ANGULO_PADRAO;
      montarArvore(resultado, opt.raiz === undefined ? null : opt.raiz);
      recriarMalhas();
      ajustarCamera();
      dimensoes();
      renderizar();
      avisar();
      notificarSelecao(null);
    }

    /* Troca a base fixa da montagem. A raiz da árvore passa a ser esse painel:
     * a raiz não recebe matriz (fica imóvel) e as outras faces giram em
     * relação a ela. Ângulos e sentidos já escolhidos pelo usuário são
     * mantidos; a câmera não é reposicionada.
     * Devolve { ok, motivo }. Em caso de recusa a montagem anterior fica. */
    function definirBase(faceId) {
      if (!estado.res || !estado.montagem) return { ok: false, motivo: "Nenhuma faca montada." };
      var pedido = Number(faceId);
      if (!isFinite(pedido)) return { ok: false, motivo: "Painel inválido." };
      var teste = G.hinge.construir(estado.res, { raiz: pedido });
      if (!teste.baseManual || teste.raiz !== pedido) {
        return {
          ok: false,
          motivo: teste.motivoBase || "O painel " + pedido + " não pode ser a base fixa."
        };
      }
      montarArvore(estado.res, pedido);
      recriarMalhas();
      dimensoes();
      renderizar();
      avisar();
      notificarSelecao(null);
      return { ok: true, raiz: estado.montagem.raiz, info: estado.baseInfo };
    }

    function definirBaseAutomatica() {
      if (!estado.res || !estado.montagem) return { ok: false, motivo: "Nenhuma faca montada." };
      montarArvore(estado.res, null);
      recriarMalhas();
      dimensoes();
      renderizar();
      avisar();
      notificarSelecao(null);
      return { ok: true, raiz: estado.montagem.raiz, info: estado.baseInfo };
    }

    function resetarVista() {
      grupo.rotation.set(0, 0, 0);
      ajustarCamera();
      renderizar();
    }

    var quadroContinuo = null;

    function destruir() {
      if (quadroContinuo) {
        cancelAnimationFrame(quadroContinuo);
        quadroContinuo = null;
      }
      if (controls) {
        try {
          controls.dispose();
        } catch (e) {}
        controls = null;
      }
      if (observador) {
        try {
          observador.disconnect();
        } catch (e) {}
        observador = null;
      }
      window.removeEventListener("mouseup", aoSoltar);
      window.removeEventListener("mousemove", aoMover);
      canvas.removeEventListener("pointerdown", aoApontarBaixo);
      canvas.removeEventListener("pointerup", aoApontarCima);
      canvas.removeEventListener("pointercancel", aoCancelarClique);
      canvas.removeEventListener("pointermove", aoMoverCursor);
      canvas.removeEventListener("pointerleave", aoSairCursor);
      for (var i = 0; i < estado.malhas.length; i++) estado.malhas[i].geometry.dispose();
      for (var im = 0; im < estado.malhasInternas.length; im++) estado.malhasInternas[im].geometry.dispose();
      if (estado.destaque) estado.destaque.geometry.dispose();
      if (estado.bordas) estado.bordas.geometry.dispose();
      if (estado.vincos) estado.vincos.geometry.dispose();
      materialFace.dispose();
      materialFaceInterno.dispose();
      materialSelecionada.dispose();
      materialSelecionadaInterna.dispose();
      materialArteExterna.dispose();
      materialArteInterna.dispose();
      materialSelArteExterna.dispose();
      materialSelArteInterna.dispose();
      materialBorda.dispose();
      materialVinco.dispose();
      materialDestaque.dispose();
      try {
        if (estado.artes.externa && estado.artes.externa.texture) estado.artes.externa.texture.dispose();
        if (estado.artes.interna && estado.artes.interna.texture) estado.artes.interna.texture.dispose();
      } catch (eTex) {}
      try {
        renderer.dispose();
      } catch (e) {}
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return {
      desenhar: desenhar,
      definirBase: definirBase,
      definirBaseAutomatica: definirBaseAutomatica,
      base: function () {
        return estado.baseInfo || infoBase();
      },
      definirAngulo: definirAngulo,
      definirArticulacao: definirArticulacao,
      definirArticulacoes: definirArticulacoes,
      definirAngulos: definirAngulos,
      perfilPadrao: perfilPadrao,
      aplicarDobras: aplicarDobras,
      definirArtes: definirArtes,
      materiais: function () {
        var mapa = {};
        function nome(m) {
          if (m === materialFace) return "papel";
          if (m === materialFaceInterno) return "papel-interno";
          if (m === materialSelecionada) return "sel";
          if (m === materialSelecionadaInterna) return "sel-interno";
          if (m === materialArteExterna) return "arte-externa";
          if (m === materialArteInterna) return "arte-interna";
          if (m === materialSelArteExterna) return "sel-arte-externa";
          if (m === materialSelArteInterna) return "sel-arte-interna";
          return "?";
        }
        for (var i = 0; i < estado.malhas.length; i++) {
          mapa["ext-" + estado.malhas[i].userData.face] = nome(estado.malhas[i].material);
        }
        for (var j = 0; j < estado.malhasInternas.length; j++) {
          mapa["int-" + estado.malhasInternas[j].userData.face] = nome(estado.malhasInternas[j].material);
        }
        return mapa;
      },
      definirVista: definirVista,
      definirEspessura: function (val) {
        var t = Number(val);
        if (isFinite(t) && t >= 0) {
          estado.espessura = t;
          renderizar();
        }
      },
      articulacoes: articulacoes,
      selecionarFace: selecionarFace,
      limparSelecao: limparSelecao,
      faceSelecionada: function () {
        return estado.faceSelecionada;
      },
      facesSelecionadas: listaSelecionadas,
      articulaveis: function () {
        var out = [];
        for (var f in estado.articulaveis) {
          if (estado.articulaveis.hasOwnProperty(f)) out.push(Number(f));
        }
        out.sort(function (a, b) {
          return a - b;
        });
        return out;
      },
      anguloDaFace: anguloDaFace,
      angulosAtuais: angulosAtuais,
      anguloGlobal: function () {
        return estado.angulo;
      },
      sinalDaFace: sinalDaFace,
      definirSinalFace: definirSinalFace,
      definirSinais: definirSinais,
      faceNoPonto: faceNoPonto,
      telaDaFace: telaDaFace,
      cruzamentosAtuais: cruzamentosAtuais,
      cruzamentosPares: cruzamentosPares,
      resetarVista: resetarVista,
      redimensionar: redimensionar,
      destruir: destruir,
      montagem: function () {
        return estado.montagem;
      },
      cruzamentos: function () {
        return estado.cruzamentos || 0;
      },
      auditoria: function () {
        return estado.montagem;
      },
      inspecionar: function () {
        var out = {          angulo: estado.angulo,
          base: estado.baseInfo || infoBase(),
          sinais: estado.sinais || {},
          cruzamentos: estado.cruzamentos || 0,
          montagem: estado.montagem,
          caixaMundo: estado.caixaMundo || null,
          centro: estado.centro || null,
          angulos: estado.angulos,
          sinaisOverride: estado.sinaisOverride,
          faceSelecionada: estado.faceSelecionada,
          facesSelecionadas: listaSelecionadas(),
          modoArte: estado.modoArte,
          espelharInterna: estado.espelharInterna,
          arteInternaHerdada: !estado.artes.interna && !!estado.artes.externa,
          overlays: {
            bordas: estado.bordas ? estado.bordas.visible : null,
            vincos: estado.vincos ? estado.vincos.visible : null
          },
          ladoExterno: (function () {
            var pos = 0, neg = 0;
            for (var q in estado.ladoExterno) {
              if (!estado.ladoExterno.hasOwnProperty(q)) continue;
              if (estado.ladoExterno[q] < 0) neg++;
              else pos++;
            }
            return { positivas: pos, invertidas: neg };
          })(),
          artes: {
            externa: estado.artes.externa
              ? { rect: estado.artes.externa.rect, temTextura: !!estado.artes.externa.texture, caminho: estado.artes.externa.caminho || "", conteudo: estado.artes.externa.conteudo || null }
              : null,
            interna: estado.artes.interna
              ? { rect: estado.artes.interna.rect, temTextura: !!estado.artes.interna.texture, caminho: estado.artes.interna.caminho || "", conteudo: estado.artes.interna.conteudo || null }
              : null
          },
          articulaveis: (function () {
            var lista = [];
            for (var f in estado.articulaveis) {
              if (estado.articulaveis.hasOwnProperty(f)) lista.push(Number(f));
            }
            return lista;
          })(),
          camera: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            upX: camera.up.x,
            upY: camera.up.y,
            upZ: camera.up.z,
            alvoX: controls ? controls.target.x : 0,
            alvoY: controls ? controls.target.y : 0,
            alvoZ: controls ? controls.target.z : 0
          },
          matrices: {},
          uvs: (function () {
            var mapaUv = {};
            for (var k = 0; k < estado.malhas.length; k++) {
              var uvAttr = estado.malhas[k].geometry.getAttribute("uv");
              if (!uvAttr) continue;
              var minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
              for (var p = 0; p < uvAttr.count; p++) {
                var u = uvAttr.getX(p);
                var v = uvAttr.getY(p);
                if (u < minU) minU = u;
                if (u > maxU) maxU = u;
                if (v < minV) minV = v;
                if (v > maxV) maxV = v;
              }
              mapaUv[estado.malhas[k].userData.face] = {
                minU: minU,
                maxU: maxU,
                minV: minV,
                maxV: maxV
              };
            }
            return mapaUv;
          })(),
          hinges: []
        };
        var mat = estado.matrizes || {};
        for (var id in mat) {
          if (mat.hasOwnProperty(id)) out.matrices[id] = mat[id].elements.slice();
        }
        if (!estado.montagem) return out;
        for (var i = 1; i < estado.montagem.ordem.length; i++) {
          var s = estado.montagem.ordem[i];
          if (s.rigida) {
            out.hinges.push({ face: s.face, pai: s.pai, rigida: true });
            continue;
          }
          var mp = mat[s.pai];
          var mc = mat[s.face];
          var a1 = new THREE.Vector3(s.p1.x, s.p1.y, 0).applyMatrix4(mp);
          var a2 = new THREE.Vector3(s.p2.x, s.p2.y, 0).applyMatrix4(mp);
          var b1 = new THREE.Vector3(s.p1.x, s.p1.y, 0).applyMatrix4(mc);
          var b2 = new THREE.Vector3(s.p2.x, s.p2.y, 0).applyMatrix4(mc);
          out.hinges.push({
            face: s.face,
            pai: s.pai,
            rigida: false,
            p1: s.p1,
            p2: s.p2,
            erroP1: a1.distanceTo(b1),
            erroP2: a2.distanceTo(b2)
          });
        }
        return out;
      }
    };
  }

  V.three3d = {
    criar: criar,
    triangularFace: triangularFace,
    matrizesDaMontagem: matrizesDaMontagem,
    escolherSinaisCom: escolherSinaisCom,
    normalizarDobras: normalizarDobras,
    ANGULO_PADRAO: ANGULO_PADRAO
  };
})();
