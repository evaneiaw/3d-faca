/* FACA 3D — unidades e utilidades numéricas.
 * O Illustrator trabalha em pontos (pt). A interface do módulo usa mm.
 */
(function () {
  var F = (window.Faca3D = window.Faca3D || {});

  var U = (F.units = {});
  U.PT_POR_MM = 2.834645669291339;
  U.MM_POR_PT = 1 / U.PT_POR_MM;

  U.mmParaPt = function (mm) {
    return Number(mm) * U.PT_POR_MM;
  };

  U.ptParaMm = function (pt) {
    return Number(pt) * U.MM_POR_PT;
  };

  U.numero = function (valor, padrao) {
    var n = parseFloat(valor);
    return isFinite(n) ? n : padrao;
  };

  U.arredondar = function (valor, casas) {
    var f = Math.pow(10, casas === undefined ? 3 : casas);
    return Math.round(Number(valor) * f) / f;
  };

  U.formatarMm = function (valor, casas) {
    var n = U.numero(valor, 0);
    return U.arredondar(n, casas === undefined ? 2 : casas).toString().replace(".", ",") + " mm";
  };

  U.formatarDuracao = function (ms) {
    var n = U.numero(ms, 0);
    if (n < 1000) return Math.round(n) + " ms";
    return U.arredondar(n / 1000, 2).toString().replace(".", ",") + " s";
  };

  U.formatarBytes = function (bytes) {
    var n = U.numero(bytes, 0);
    if (n < 1024) return Math.round(n) + " caracteres";
    return U.arredondar(n / 1024, 1).toString().replace(".", ",") + " KB";
  };
})();
