// Teste de placa de papelão ondulado 3D (Liner externo + Miolo sinusoidal + Liner interno)
import assert from 'assert';

function construirPapelaoOndulado(largura, altura, espessuraTotal) {
  var t = espessuraTotal; // e.g., 3.0 mm
  var tLiner = 0.25;      // espessura de cada liner
  var meioT = t / 2;

  var zExternoTop = meioT;
  var zExternoBot = meioT - tLiner;
  var zInternoBot = -meioT;
  var zInternoTop = -meioT + tLiner;
  var zMioloMin = zInternoTop;
  var zMioloMax = zExternoBot;

  var periodo = 5.0; // 5mm
  var amplitude = (zMioloMax - zMioloMin) / 2;
  var zCentroMiolo = (zMioloMax + zMioloMin) / 2;

  return {
    largura: largura,
    altura: altura,
    espessura: t,
    zExterno: zExternoTop,
    zInterno: zInternoBot,
    periodoOnda: periodo,
    amplitudeOnda: amplitude,
    valido: true
  };
}

function validarPapelaoOndulado() {
  var placa = construirPapelaoOndulado(100, 100, 3.0);
  assert.strictEqual(placa.largura, 100);
  assert.strictEqual(placa.altura, 100);
  assert.strictEqual(placa.espessura, 3.0);
  assert(placa.zExterno > placa.zInterno, "Liner externo deve estar acima do liner interno");
  assert(placa.amplitudeOnda > 0, "Miolo ondulado deve ter amplitude maior que zero");
  console.log("VALIDAÇÃO DO PAPELÃO ONDULADO PASSOU COM SUCESSO!");
}

validarPapelaoOndulado();
