/* FACA 3D - Render Top Avançado (Snapshot HD).
 *
 * Gera render da FACA REAL com:
 * - Geometria extraída do plugin (malhas, faces, vincos)
 * - Materiais PBR por tipo (corte, vinco, arte)
 * - Iluminação HDRI + ACES Filmic
 * - Bloom (via CDN), Sombras PCF
 *
 * Use: window.faca3dRenderTop({ angulo, mostrarArte, espessura })
 */

(function () {
  "use strict";

  var raiz = typeof window !== "undefined" ? window : globalThis;
  var F = (raiz.Faca3D = raiz.Faca3D || {});
  var V = (F.view = F.view || {});

  var DEFAULTS = {
    angulo: 90,
    mostrarArte: true,
    espessura: 1.5,
    resolucao: 3,
    width: 1920,
    height: 1080,
    qualidadeBloom: 0.6,
    bloomRadius: 0.8,
    bloomThreshold: 0.2
  };

  var modulosExtrasCarregados = false;

  function preCarregarModulosExtras(THREE) {
    if (modulosExtrasCarregados) return Promise.resolve(THREE);
    return new Promise(function(resolve) {
      var modulos = [
        'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js',
        'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js',
        'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js'
      ];
      var carregados = 0;
      modulos.forEach(function(url) {
        var s = document.createElement('script');
        s.type = 'module'; s.src = url;
        s.onload = function() { if (++carregados === modulos.length) { modulosExtrasCarregados = true; resolve(THREE); } };
        s.onerror = function() { if (++carregados === modulos.length) { modulosExtrasCarregados = true; resolve(THREE); } };
        document.head.appendChild(s);
      });
    });
  }

  // Aguarda Three.js
  if (raiz.THREE) preCarregarModulosExtras(raiz.THREE);
  else { var t=0; var iv=setInterval(function(){ if (raiz.THREE) { clearInterval(iv); preCarregarModulosExtras(raiz.THREE); } else if (++t>100) { clearInterval(iv); } }, 100); }

  // ============================================================
  // EXTRAI GEOMETRIA REAL DO PLUGIN (estado.viewer3d / estado.res)
  // ============================================================
  function obterGeometriaFacaReal() {
    // Tenta pegar do estado global do faca3d.js
    var estado = (raiz.Faca3D && raiz.Faca3D.estado) || (raiz.estado) || {};
    var viewer3d = estado.viewer3d;
    var res = estado.res; // resultado do motor (geometria, faces, etc.)

    var malhas = [];
    var vincos = [];
    var caixas = [];

    // 1. Tenta viewer3d.malhas (Three.js meshes já criados)
    if (viewer3d && viewer3d.malhas && viewer3d.malhas.length) {
      viewer3d.malhas.forEach(function(m, i) {
        if (m.geometry) {
          malhas.push({
            index: i,
            geometry: m.geometry.clone(),
            matrix: m.matrixWorld.clone(),
            userData: m.userData || {},
            tipo: (m.userData && m.userData.tipo) || 'face'
          });
        }
      });
    }

    // 2. Tenta res (dados do motor - faces, pontos, vincos)
    if (res && res.faces && res.faces.length) {
      res.faces.forEach(function(face, i) {
        if (face.pontos && face.pontos.length >= 3) {
          // Cria Shape a partir dos pontos 2D
          var shape = new raiz.THREE.Shape();
          var pts = face.pontos;
          shape.moveTo(pts[0].x, pts[0].y);
          for (var j = 1; j < pts.length; j++) shape.lineTo(pts[j].x, pts[j].y);
          
          // Extrude para 3D
          var extrudeSettings = {
            depth: estado.espessura || 1.5,
            bevelEnabled: false
          };
          var geom = new raiz.THREE.ExtrudeGeometry(shape, extrudeSettings);
          geom.rotateX(-Math.PI/2); // Deita no plano XZ
          
          malhas.push({
            index: i,
            geometry: geom,
            faceId: face.id || i,
            tipo: face.tipo || 'face',
            vinco: face.vinco || false
          });
        }
      });

      // Vincos (linhas de dobra)
      if (res.vincos && res.vincos.length) {
        res.vincos.forEach(function(v) {
          if (v.p1 && v.p2) {
            vincos.push({ p1: v.p1, p2: v.p2, angulo: v.angulo || 90 });
          }
        });
      }
    }

    // 3. Fallback: caixa bbox da faca
    if (malhas.length === 0) {
      var bbox = estado.caixaFaca || { min: [-10, -5], max: [10, 5] };
      var w = (bbox.max[0] - bbox.min[0]) || 20;
      var h = (bbox.max[1] - bbox.min[1]) || 10;
      var box = new raiz.THREE.BoxGeometry(w, estado.espessura || 1.5, h);
      malhas.push({ index: 0, geometry: box, tipo: 'bbox' });
    }

    return { malhas: malhas, vincos: vincos, caixaFaca: estado.caixaFaca };
  }

  // ============================================================
  // MATERIAIS PBR POR TIPO
  // ============================================================
  function criarMateriaisPBR(THREE) {
    return {
      corte: new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.2, metalness: 0.85, name: 'corte' }),
      vinco: new THREE.MeshStandardMaterial({ color: 0xe94560, roughness: 0.4, metalness: 0.6, emissive: 0xe94560, emissiveIntensity: 0.15, name: 'vinco' }),
      face: new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.3, metalness: 0.7, name: 'face' }),
      arte: new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide, name: 'arte' }),
      piso: new THREE.MeshStandardMaterial({ color: 0x15151e, roughness: 0.95, metalness: 0.0, name: 'piso' }),
      aresta: new THREE.LineBasicMaterial({ color: 0xe94560, linewidth: 3 })
    };
  }

  // ============================================================
  // CRIA CENA AVANÇADA COM GEOMETRIA REAL
  // ============================================================
  function criarCenaAvancada(opts) {
    var cfg = Object.assign({}, DEFAULTS, opts);
    var THREE = raiz.THREE;

    var angulo = cfg.angulo;
    var mostrarArte = cfg.mostrarArte;
    var espessura = cfg.espessura;
    var resolucao = cfg.resolucao;
    var width = cfg.width * resolucao;
    var height = cfg.height * resolucao;

    // GEOMETRIA REAL
    var facaReal = obterGeometriaFacaReal();
    var malhas = facaReal.malhas;
    var vincos = facaReal.vincos;
    var bbox = facaReal.caixaFaca || { min: [-10, -10], max: [10, 10] };

    var materiais = criarMateriaisPBR(THREE);

    // Cena
    var cena = new THREE.Scene();
    cena.background = new THREE.Color(0x0d0d12);

    // Câmera posicionada baseada no tamanho da faca
    var tamanhoMax = Math.max(
      (bbox.max[0] - bbox.min[0]) || 20,
      (bbox.max[1] - bbox.min[1]) || 20
    );
    var distCam = Math.max(tamanhoMax * 1.2, 8);
    
    var camera = new THREE.PerspectiveCamera(35, width / height, 0.1, distCam * 5);
    camera.position.set(0, distCam * 0.6, distCam);
    camera.lookAt(0, 0, 0);

    // LUZES HDRI-STYLE
    // Ambiente
    cena.add(new THREE.AmbientLight(0x303040, 0.6));

    // Key light (sol)
    var keyLight = new THREE.DirectionalLight(0xffffee, 2.0);
    keyLight.position.set(distCam, distCam * 1.5, distCam);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = distCam * 3;
    keyLight.shadow.camera.left = -tamanhoMax;
    keyLight.shadow.camera.right = tamanhoMax;
    keyLight.shadow.camera.top = tamanhoMax;
    keyLight.shadow.camera.bottom = -tamanhoMax;
    keyLight.shadow.radius = 6;
    keyLight.shadow.bias = -0.0005;
    cena.add(keyLight);

    // Fill light
    var fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
    fillLight.position.set(-distCam, distCam * 0.5, -distCam);
    cena.add(fillLight);

    // Rim light (contorno)
    var rimLight = new THREE.DirectionalLight(0x4466ff, 0.4);
    rimLight.position.set(0, 0, -distCam * 1.2);
    cena.add(rimLight);

    // PISO reflexivo
    var tamanhoPiso = tamanhoMax * 2;
    var pisoGeo = new THREE.PlaneGeometry(tamanhoPiso, tamanhoPiso);
    var piso = new THREE.Mesh(pisoGeo, materiais.piso);
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = -espessura / 2;
    piso.receiveShadow = true;
    cena.add(piso);

    // GRUPO DA FACA
    var grupoFaca = new THREE.Group();

    // Cria malhas com materiais corretos
    malhas.forEach(function(m) {
      var geom = m.geometry;
      if (!geom) return;

      // Garante que a geometria tem normais
      geom.computeVertexNormals();
      geom.computeBoundingBox();

      var tipo = m.tipo || 'face';
      var material = materiais[tipo] || materiais.face;

      // Se é vinco, usa material de vinco
      if (m.vinco || tipo === 'vinco') material = materiais.vinco;

      var mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Aplica matriz se veio do viewer3d
      if (m.matrix) mesh.applyMatrix4(m.matrix);
      
      // Centraliza no origem se tem boundingBox
      if (geom.boundingBox) {
        var center = new THREE.Vector3();
        geom.boundingBox.getCenter(center);
        mesh.position.sub(center);
      }

      grupoFaca.add(mesh);

      // Arestas destacadas nas faces de corte
      if (tipo === 'corte' || tipo === 'face') {
        var edges = new THREE.EdgesGeometry(geom, 30);
        var lines = new THREE.LineSegments(edges, materiais.aresta);
        lines.position.copy(mesh.position);
        if (m.matrix) lines.applyMatrix4(m.matrix);
        grupoFaca.add(lines);
      }
    });

    // VINCOS como linhas brilhantes
    if (vincos.length > 0) {
      var vincoMat = new THREE.LineBasicMaterial({ color: 0xff3355, linewidth: 4, transparent: true, opacity: 0.9 });
      vincos.forEach(function(v) {
        var geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(v.p1.x, espessura/2 + 0.01, v.p1.y),
          new THREE.Vector3(v.p2.x, espessura/2 + 0.01, v.p2.y)
        ]);
        var line = new THREE.Line(geo, vincoMat);
        grupoFaca.add(line);
      });
    }

    // ARTE (textura projetada)
    if (mostrarArte && bbox) {
      var w = (bbox.max[0] - bbox.min[0]) || 20;
      var h = (bbox.max[1] - bbox.min[1]) || 20;
      var arteGeo = new THREE.PlaneGeometry(w * 0.9, h * 0.9);
      var arteMesh = new THREE.Mesh(arteGeo, materiais.arte);
      arteMesh.position.set(0, espessura/2 + 0.02, 0);
      arteMesh.rotation.x = -Math.PI / 2;
      arteMesh.castShadow = true;
      arteMesh.receiveShadow = true;
      grupoFaca.add(arteMesh);
    }

    // Rotação da faca baseada no ângulo de dobra
    grupoFaca.rotation.x = THREE.MathUtils.degToRad(-angulo);
    cena.add(grupoFaca);

    // RENDERER
    var renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: "high-performance",
      preserveDrawingBuffer: true, logarithmicDepthBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(resolucao, 3));
    renderer.setClearColor(0x0d0d12, 1);
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputEncoding = THREE.sRGBEncoding;

    // BLOOM
    var composer = null;
    if (modulosExtrasCarregados && THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
      try {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(cena, camera));
        composer.addPass(new THREE.UnrealBloomPass(
          new THREE.Vector2(width, height), cfg.qualidadeBloom, cfg.bloomRadius, cfg.bloomThreshold
        ));
      } catch(e) { composer = null; }
    }

    // RENDER
    if (composer) composer.render();
    else renderer.render(cena, camera);

    return {
      dataURL: renderer.domElement.toDataURL("image/png"),
      width: width, height: height, resolucao: resolucao,
      comBloom: !!composer, numMalhas: malhas.length, numVincos: vincos.length
    };
  }

  // ============================================================
  // FUNÇÃO PRINCIPAL
  // ============================================================
  function renderTop(opts) {
    try {
      var r = criarCenaAvancada(Object.assign({}, DEFAULTS, opts));
      return { success: true, dataURL: r.dataURL, 
        message: "Render Top OK - " + r.numMalhas + " malhas, " + r.numVincos + " vincos" + (r.comBloom ? " + Bloom" : "") };
    } catch(e) {
      console.error("Render Top:", e);
      return { success: false, error: e.message, dataURL: null };
    }
  }

  window.faca3dRenderTop = renderTop;
  F.renderTop = { render: renderTop, DEFAULTS: DEFAULTS };
  console.log("Render Top Avançado: GEOMETRIA REAL + PBR + ACES + Bloom (CDN) pronto");
})();