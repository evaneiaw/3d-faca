# -*- coding: utf-8 -*-
"""Extrai os caminhos da camada 'faca' de um PDF do Illustrator e grava o
protocolo F3D|1|GEO no formato que o parser do painel entende.

Uso: python extrair_pdf.py <arquivo.pdf> <saida.txt> [<saida_json>]
"""
import re
import sys
import zlib
import json

ESCALA = 10000


def objs_do_pdf(data):
    return dict(
        (int(n), (g, b))
        for n, g, b in re.findall(rb"(\d+)\s+(\d+)\s+obj(.*?)endobj", data, re.S)
    )


def conteudo_do_pdf(data):
    objs = objs_do_pdf(data)
    for num, (gen, body) in objs.items():
        if re.search(rb"/Type\s*/Page[^s]", body):
            m = re.search(rb"/Contents\s+(\d+)\s+0\s+R", body)
            if not m:
                continue
            cb = objs[int(m.group(1))][1]
            head, rest = cb.split(b"stream", 1)
            stream = rest.split(b"endstream", 1)[0].lstrip(b"\r\n")
            return zlib.decompress(stream).decode("latin-1")
    raise SystemExit("pagina/contents nao encontrados")


def nomes_cores(data):
    """Mapeia /CSn -> nome do spot (Separation)."""
    objs = objs_do_pdf(data)
    nomes = {}
    for m in re.finditer(rb"/CS(\d+)\s+(\d+)\s+0\s+R", data):
        idx = int(m.group(1))
        num = int(m.group(2))
        body = objs.get(num, (None, b""))[1]
        sep = re.search(rb"/Separation\s*/([^\s/\[\]<>()]+)", body)
        nomes[idx] = sep.group(1).decode("latin-1") if sep else ("CS%d" % idx)
    if not nomes:
        nomes = {0: "Cut", 1: "Crease"}
    return nomes


TOKEN_RE = re.compile(
    r"""\s*(?:
        (?P<num>[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)
      | (?P<name>/[^\s/\[\]<>(){}%]+)
      | (?P<op>[A-Za-z'"*]+)
      | (?P<delim>[\[\]{}<>()])
      | (?P<comment>%[^\r\n]*)
    )""",
    re.X,
)


def tokenizar(txt):
    pos = 0
    n = len(txt)
    while pos < n:
        m = TOKEN_RE.match(txt, pos)
        if not m:
            pos += 1
            continue
        pos = m.end()
        if m.group("num") is not None:
            yield ("num", float(m.group("num")))
        elif m.group("name") is not None:
            yield ("name", m.group("name"))
        elif m.group("op") is not None:
            yield ("op", m.group("op"))


def mat_mul(a, b):
    return [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]


def aplicar(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def nome_indice(valor, cores):
    """'/CS0' -> 0; se nao reconhecer, devolve o proprio valor."""
    if isinstance(valor, str) and valor.startswith("/CS"):
        try:
            return int(valor[3:])
        except ValueError:
            return valor
    return valor


def extrair(txt, cores):
    caminhos = []
    ctm = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    pilha = []
    cor_traco = None
    cor_preench = None
    cs_traco = None
    cs_preench = None
    pilha_ops = []
    subpaths = []

    def novo_subpath(m, x, y):
        p = aplicar(m, x, y)
        subpaths.append({"pontos": [{"x": p[0], "y": p[1], "l": None, "r": None}], "fechado": False})

    def adicionar_seg(m, x, y):
        p = aplicar(m, x, y)
        subpaths[-1]["pontos"].append({"x": p[0], "y": p[1], "l": None, "r": None})

    def adicionar_curva(m, x1, y1, x2, y2, x3, y3):
        c1 = aplicar(m, x1, y1)
        c2 = aplicar(m, x2, y2)
        p3 = aplicar(m, x3, y3)
        pts = subpaths[-1]["pontos"]
        pts[-1]["r"] = c1
        pts.append({"x": p3[0], "y": p3[1], "l": c2, "r": None})

    def emitir(fechado_forcado=None):
        for s in [s for s in subpaths if len(s["pontos"]) >= 2]:
            fechado = s["fechado"] if fechado_forcado is None else fechado_forcado
            classe = "cut"
            spot = "Cut"
            cs = cs_traco
            if fechado_forcado is True and cs_preench is not None:
                cs = cs_preench
            if cs is not None:
                nome = cores.get(cs, "CS%s" % cs)
                baixo = nome.lower()
                if "crease" in baixo or "vinco" in baixo:
                    classe, spot = "crease", nome
                elif "cut" in baixo or "corte" in baixo:
                    classe, spot = "cut", nome
                else:
                    classe, spot = "other", nome
            caminhos.append({"classe": classe, "spot": spot, "fechado": fechado,
                             "pontos": s["pontos"]})
        del subpaths[:]

    for tipo, val in tokenizar(txt):
        if tipo == "num":
            pilha_ops.append(val)
            continue
        if tipo == "name":
            pilha_ops.append(val)
            continue
        op = val
        try:
            if op == "q":
                pilha.append(list(ctm))
            elif op == "Q":
                if pilha:
                    ctm = pilha.pop()
            elif op == "cm" and len(pilha_ops) >= 6:
                mtx = [float(v) for v in pilha_ops[-6:]]
                ctm = mat_mul(mtx, ctm)
            elif op == "m" and len(pilha_ops) >= 2:
                novo_subpath(ctm, float(pilha_ops[-2]), float(pilha_ops[-1]))
            elif op == "l" and len(pilha_ops) >= 2:
                adicionar_seg(ctm, float(pilha_ops[-2]), float(pilha_ops[-1]))
            elif op == "c" and len(pilha_ops) >= 6:
                adicionar_curva(ctm, *[float(v) for v in pilha_ops[-6:]])
            elif op == "v" and len(pilha_ops) >= 4 and subpaths and subpaths[-1]["pontos"]:
                x2, y2, x3, y3 = [float(v) for v in pilha_ops[-4:]]
                cur = subpaths[-1]["pontos"][-1]
                c2 = aplicar(ctm, x2, y2)
                p3 = aplicar(ctm, x3, y3)
                subpaths[-1]["pontos"][-1]["r"] = (cur["x"], cur["y"])
                subpaths[-1]["pontos"].append({"x": p3[0], "y": p3[1], "l": c2, "r": None})
            elif op == "y" and len(pilha_ops) >= 4 and subpaths and subpaths[-1]["pontos"]:
                x1, y1, x3, y3 = [float(v) for v in pilha_ops[-4:]]
                c1 = aplicar(ctm, x1, y1)
                p3 = aplicar(ctm, x3, y3)
                pts = subpaths[-1]["pontos"]
                pts[-1]["r"] = c1
                pts.append({"x": p3[0], "y": p3[1], "l": (p3[0], p3[1]), "r": None})
            elif op == "h":
                if subpaths and subpaths[-1]["pontos"]:
                    subpaths[-1]["fechado"] = True
            elif op == "re" and len(pilha_ops) >= 4:
                x, y, w, h = [float(v) for v in pilha_ops[-4:]]
                novo_subpath(ctm, x, y)
                adicionar_seg(ctm, x + w, y)
                adicionar_seg(ctm, x + w, y + h)
                adicionar_seg(ctm, x, y + h)
                subpaths[-1]["fechado"] = True
            elif op in ("S", "s"):
                emitir(True if op == "s" else None)
            elif op in ("f", "F", "f*", "B", "B*", "b", "b*"):
                emitir(True)
            elif op == "n":
                del subpaths[:]
            elif op == "CS" and pilha_ops:
                cs_traco = nome_indice(pilha_ops[-1], cores)
            elif op == "cs" and pilha_ops:
                cs_preench = nome_indice(pilha_ops[-1], cores)
            elif op == "SCN":
                cor_traco = pilha_ops[-1] if pilha_ops else None
            elif op == "scn":
                cor_preench = pilha_ops[-1] if pilha_ops else None
        except Exception as e:
            print("aviso op %s: %s" % (op, e))
        pilha_ops = []
    return caminhos


def protocolo(caminhos):
    linhas = ["F3D|1|GEO", "ESCOPO=documento", "TOTAL=%d" % len(caminhos),
              "INICIO=0", "FIM=%d" % len(caminhos), "ESCALA_COORD=%d" % ESCALA,
              "DOC_NOME=faaaaccaaaa.pdf",
              "DOC_CAMINHO=C:\\Users\\user\\Desktop\\faaaaccaaaa.pdf",
              "DOC_SALVO=sim"]
    for idx, c in enumerate(caminhos):
        linhas.append("P=%d\t%s\t%s\t%s\t%d\t%s\t%s" % (
            idx, c["classe"], c["spot"], "1" if c["fechado"] else "0",
            len(c["pontos"]), "FACA", "PathItem"))
        for pi, p in enumerate(c["pontos"]):
            l = p["l"] or (p["x"], p["y"])
            r = p["r"] or (p["x"], p["y"])
            linhas.append("A=%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d" % (
                idx, pi,
                int(round(p["x"] * ESCALA)), int(round(p["y"] * ESCALA)),
                int(round(l[0] * ESCALA)), int(round(l[1] * ESCALA)),
                int(round(r[0] * ESCALA)), int(round(r[1] * ESCALA))))
    linhas.append("TEMPO_MS=0")
    linhas.append("END")
    return "\n".join(linhas)


def main():
    if len(sys.argv) < 3:
        raise SystemExit("uso: extrair_pdf.py <pdf> <saida.txt> [saida.json]")
    data = open(sys.argv[1], "rb").read()
    txt = conteudo_do_pdf(data)
    cores = nomes_cores(data)
    caminhos = extrair(txt, cores)
    with open(sys.argv[2], "w", encoding="ascii") as f:
        f.write(protocolo(caminhos))
    resumo = {
        "caminhos": len(caminhos),
        "porClasse": {},
        "fechados": sum(1 for c in caminhos if c["fechado"]),
        "pontos": sum(len(c["pontos"]) for c in caminhos),
        "cores": cores,
    }
    for c in caminhos:
        resumo["porClasse"][c["classe"]] = resumo["porClasse"].get(c["classe"], 0) + 1
    if len(sys.argv) >= 4:
        with open(sys.argv[3], "w", encoding="utf-8") as f:
            json.dump(resumo, f, indent=2)
    print(json.dumps(resumo, indent=2))


if __name__ == "__main__":
    main()
