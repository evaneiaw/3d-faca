/* FACA 3D — carregador de submódulos.
 * O hub remove as tags <script> do HTML da ferramenta e executa apenas
 * js/faca3d.js. Este carregador injeta os demais arquivos em ordem, uma vez
 * cada, com cache-buster para o CEP não servir versão antiga.
 */
(function () {
  var F = (window.Faca3D = window.Faca3D || {});
  var carregados = {};

  function normalizarBase(base) {
    var b = String(base || "./");
    if (b.charAt(b.length - 1) !== "/") b += "/";
    return b;
  }

  function carregarScript(src, timeoutMs, cb) {
    var terminado = false;
    var timer = null;

    function finalizar(erro) {
      if (terminado) return;
      terminado = true;
      if (timer) clearTimeout(timer);
      cb(erro || null);
    }

    var el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = function () {
      finalizar(null);
    };
    el.onerror = function () {
      finalizar(new Error("Falha ao carregar módulo: " + src));
    };

    if (timeoutMs > 0) {
      timer = setTimeout(function () {
        finalizar(new Error("Tempo esgotado ao carregar módulo: " + src));
      }, timeoutMs);
    }

    document.head.appendChild(el);
  }

  F.loader = {
    base: normalizarBase(F.loader && F.loader.base),

    carregados: carregados,

    carregar: function (arquivos, cb) {
      var lista = arquivos || [];
      var i = 0;
      var base = F.loader.base;

      function proximo() {
        if (i >= lista.length) {
          cb(null);
          return;
        }
        var rel = lista[i++];
        var src = base + rel;
        if (carregados[src]) {
          proximo();
          return;
        }
        var url = src + "?v=" + F.build;
        carregarScript(url, 15000, function (erro) {
          if (erro) {
            cb(erro);
            return;
          }
          carregados[src] = true;
          proximo();
        });
      }

      proximo();
    }
  };
})();
