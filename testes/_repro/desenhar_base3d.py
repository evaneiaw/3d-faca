# -*- coding: utf-8 -*-
"""Desenha quadros 3D (projeção simples + pintor) a partir de base3d.json.

Uso: python desenhar_base3d.py <base3d.json> <saida.png>
"""
import json
import math
import sys

from PIL import Image, ImageDraw, ImageFont

LARG = 380
ALT = 320
PAD = 26
COLS = 3
ROWS = 2


def cor_da_face(fid):
    h = (fid * 0.61803398875) % 1.0
    s = 0.55
    v = 0.92
    i = int(h * 6)
    f = h * 6 - i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    i = i % 6
    if i == 0:
        r, g, b = v, t, p
    elif i == 1:
        r, g, b = q, v, p
    elif i == 2:
        r, g, b = p, v, t
    elif i == 3:
        r, g, b = p, q, v
    elif i == 4:
        r, g, b = t, p, v
    else:
        r, g, b = v, p, q
    return (int(r * 255), int(g * 255), int(b * 255))


def main():
    dados = json.load(open(sys.argv[1], encoding="utf-8"))
    saida = sys.argv[2]
    casos = dados["casos"]

    # câmera fixa (frente-direita-acima), igual para todos os quadros
    cam = (0.58, -0.74, 0.60)
    n = math.sqrt(sum(c * c for c in cam))
    cam = tuple(c / n for c in cam)
    up = (0.0, 0.0, 1.0)
    right = (
        up[1] * cam[2] - up[2] * cam[1],
        up[2] * cam[0] - up[0] * cam[2],
        up[0] * cam[1] - up[1] * cam[0],
    )
    nr = math.sqrt(sum(c * c for c in right)) or 1.0
    right = tuple(c / nr for c in right)
    up2 = (
        cam[1] * right[2] - cam[2] * right[1],
        cam[2] * right[0] - cam[0] * right[2],
        cam[0] * right[1] - cam[1] * right[0],
    )

    def dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    # limites na projeção (todos os quadros, mesma escala)
    xs, ys = [], []
    for caso in casos:
        for f in caso["faces"]:
            for p in f["pts"]:
                xs.append(dot(p, right))
                ys.append(dot(p, up2))
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    escala = min(
        (LARG - PAD * 2) / max(maxx - minx, 1),
        (ALT - PAD * 2) / max(maxy - miny, 1),
    )

    img = Image.new("RGB", (LARG * COLS, ALT * ROWS), (250, 250, 252))
    try:
        fonte = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 12)
        fonte_peq = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 10)
    except Exception:
        fonte = ImageFont.load_default()
        fonte_peq = fonte

    for idx, caso in enumerate(casos):
        col = idx % COLS
        row = idx // COLS
        ox = col * LARG
        oy = row * ALT
        d = ImageDraw.Draw(img, "RGBA")

        def proj(p):
            return (
                ox + LARG / 2 + (dot(p, right) - (minx + maxx) / 2) * escala,
                oy + ALT / 2 - (dot(p, up2) - (miny + maxy) / 2) * escala,
            )

        faces = []
        for f in caso["faces"]:
            pts = f["pts"]
            depth = sum(dot(p, cam) for p in pts) / max(len(pts), 1)
            faces.append((depth, f))
        faces.sort(key=lambda t: t[0])  # mais longe primeiro

        for depth, f in faces:
            pts = [proj(p) for p in f["pts"]]
            if len(pts) < 3:
                continue
            base = f["base"]
            cor = (46, 160, 110) if base else cor_da_face(f["id"])
            d.polygon(pts, fill=cor + (235,))
            d.line(pts + [pts[0]], fill=(40, 40, 50, 220), width=2 if base else 1)
            if base:
                cx = sum(p[0] for p in pts) / len(pts)
                cy = sum(p[1] for p in pts) / len(pts)
                txt = "BASE " + str(f["id"])
                bb = d.textbbox((0, 0), txt, font=fonte_peq)
                d.rectangle([cx - 3, cy - 2, cx + (bb[2] - bb[0]) + 3, cy + (bb[3] - bb[1]) + 2],
                            fill=(255, 255, 255, 220))
                d.text((cx, cy), txt, fill=(10, 80, 50, 255), font=fonte_peq)

        titulo = caso["caso"] + " · " + str(caso["angulo"]) + "°"
        d.rectangle([ox + 6, oy + 6, ox + 250, oy + 24], fill=(255, 255, 255, 225))
        d.text((ox + 10, oy + 8), titulo, fill=(30, 30, 40, 255), font=fonte)
        d.text((ox + 10, oy + ALT - 18), "raiz = painel " + str(caso["raiz"]) +
               (" (manual)" if caso["manual"] else " (automática)"),
               fill=(70, 70, 80, 255), font=fonte_peq)

    img.save(saida)
    print("ok", saida, img.size)


if __name__ == "__main__":
    main()
