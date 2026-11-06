# -*- coding: utf-8 -*-
"""Desenha o diagnostico 2D da reproducao (repro.json) em PNG.

Uso: python desenhar.py <repro.json> <saida.png>
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont

ESCALA_PX_MM = 0.9
MARGEM = 40


def main():
    dados = json.load(open(sys.argv[1], encoding="utf-8"))
    saida = sys.argv[2]
    caixa = dados["caixa"]
    larg = caixa["largura"]
    alt = caixa["altura"]
    w = int(larg * ESCALA_PX_MM) + MARGEM * 2
    h = int(alt * ESCALA_PX_MM) + MARGEM * 2
    img = Image.new("RGB", (w, h), (250, 250, 252))
    d = ImageDraw.Draw(img, "RGBA")
    try:
        fonte = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 13)
        fonte_peq = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 10)
    except Exception:
        fonte = ImageFont.load_default()
        fonte_peq = fonte

    def px(p):
        return (MARGEM + (p["x"] - caixa["minX"]) * ESCALA_PX_MM,
                h - MARGEM - (p["y"] - caixa["minY"]) * ESCALA_PX_MM)

    # faces: fora em laranja, montadas em azul, furos em branco
    for f in dados["faces"]:
        pts = [px(p) for p in f["pontos"]]
        if len(pts) < 3:
            continue
        if f["montada"]:
            cor = (20, 115, 230, 40)
            borda = (20, 115, 230, 150)
        elif f["area"] < 40000:
            cor = (215, 55, 63, 45)
            borda = (215, 55, 63, 170)
        else:
            cor = (224, 123, 24, 45)
            borda = (224, 123, 24, 180)
        d.polygon(pts, fill=cor)
        d.line(pts + [pts[0]], fill=borda, width=2)
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        if f["area"] > 250:
            txt = "F%d" % f["id"]
            bb = d.textbbox((0, 0), txt, font=fonte_peq)
            d.rectangle([cx - 2, cy - 2, cx + (bb[2] - bb[0]) + 2, cy + (bb[3] - bb[1]) + 2],
                        fill=(255, 255, 255, 210))
            d.text((cx, cy), txt, fill=(20, 20, 20, 255), font=fonte_peq)
        for furo in f.get("furos") or []:
            hp = [px(p) for p in furo]
            if len(hp) >= 3:
                d.polygon(hp, fill=(255, 255, 255, 255))
                d.line(hp + [hp[0]], fill=(120, 0, 120, 220), width=2)

    # segmentos por classe
    for s in dados["segmentos"]:
        pts = [px(p) for p in s["pts"]]
        if len(pts) < 2:
            continue
        if s["classe"] == "crease":
            d.line(pts, fill=(0, 140, 90, 255), width=2)
        else:
            d.line(pts, fill=(220, 40, 40, 255), width=1)

    # rodape de legenda
    d.rectangle([8, h - 26, 460, h - 6], fill=(255, 255, 255, 230))
    d.text((12, h - 24), "azul=face montada  laranja=face fora  vermelho=corte  verde=vinco",
           fill=(30, 30, 30, 255), font=fonte_peq)
    img.save(saida)
    print("ok", saida, img.size)


if __name__ == "__main__":
    main()
