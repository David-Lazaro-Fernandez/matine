"""Mide al modelo con la muestra semanal ya etiquetada.

Lee el CSV que regresó de etiquetar `data/listening/muestra_*.csv`, con las columnas `opinion` (pos, neu, neg, otro) y
`quiere_verla` (si, no, nd) llenas. Primero revisa a quien etiquetó con las etiquetas manuales de control: si coincide
menos de `GOLD_MIN` en `opinion`, la semana queda como no confiable y no sirve para juzgar al modelo. Después compara las
predicciones del modelo con las etiquetas del resto, guarda el resultado en `evaluation` y las etiquetas en `review`.
`quiere_verla` del modelo es binaria: `si` contra todo lo demás.

Con n comentarios, la coincidencia tiene un margen de error de unos ±1.96·√(p(1−p)/n): con 200, cerca de ±6 puntos. Una
semana aislada no dice nada; cuenta la tendencia.

Uso: python3 -m listening.compare ETIQUETADO.csv
"""
import argparse
import csv
import math
import sys

from . import sample, store

OPINIONS = ("pos", "neu", "neg", "otro")
WANTS = ("si", "no", "nd")
# Con el control, quien etiqueta debe coincidir al menos en esta proporción con las etiquetas manuales.
GOLD_MIN = 0.85


def _margin(p, n):
    return 1.96 * math.sqrt(p * (1 - p) / n) if n else 0.0


def _share(hits, n):
    return hits / n if n else None


def _read(path):
    """({comment_id: (opinion, quiere_verla)}, filas descartadas por una etiqueta inválida)."""
    labels, invalid = {}, 0
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            opinion, wants = row["opinion"].strip().lower(), row["quiere_verla"].strip().lower()
            if opinion in OPINIONS and wants in WANTS:
                labels[row["comment_id"]] = (opinion, wants)
            else:
                invalid += 1
    return labels, invalid


def _gold_agreement(labels):
    """(n, coincidencia en opinion, coincidencia en quiere_verla) de quien etiquetó contra las manuales."""
    with open(sample.GOLD_PATH, newline="", encoding="utf-8") as handle:
        gold = {r["comment_id"]: (r["opinion"], r["quiere_verla"]) for r in csv.DictReader(handle)}
    both = [(labels[i], gold[i]) for i in gold if i in labels]
    return (len(both), _share(sum(a[0] == b[0] for a, b in both), len(both)),
            _share(sum((a[1] == "si") == (b[1] == "si") for a, b in both), len(both)))


def measure(conn, week, labels):
    """Coincidencia del modelo con `labels` en los comentarios de la muestra `week`."""
    rows = conn.execute("""
        SELECT s.comment_id, p.opinion, p.wants_to_see FROM sample s
        JOIN prediction p ON p.comment_id = s.comment_id AND p.model = s.model
        WHERE s.week = ?""", (week,)).fetchall()
    rows = [r for r in rows if r["comment_id"] in labels]
    n = len(rows)
    opinion_hits = sum(r["opinion"] == labels[r["comment_id"]][0] for r in rows)
    wants_hits = sum(bool(r["wants_to_see"]) == (labels[r["comment_id"]][1] == "si") for r in rows)
    predicted = [r for r in rows if r["wants_to_see"]]
    actual = [r for r in rows if labels[r["comment_id"]][1] == "si"]
    both = sum(labels[r["comment_id"]][1] == "si" for r in predicted)
    by_class = {c: [r["opinion"] == c for r in rows if labels[r["comment_id"]][0] == c] for c in OPINIONS}
    return {"n": n, "opinion": _share(opinion_hits, n), "wants": _share(wants_hits, n),
            "wants_precision": _share(both, len(predicted)), "wants_recall": _share(both, len(actual)),
            "wants_positives": len(actual), "by_class": by_class}


def _pct(value):
    return "—" if value is None else f"{value:.0%}"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("labeled")
    args = ap.parse_args(argv)
    labels, invalid = _read(args.labeled)
    conn = store.connect()
    weeks = conn.execute(f"""SELECT week, COUNT(*) n FROM sample WHERE comment_id IN ({','.join('?' * len(labels))})
                             GROUP BY week ORDER BY n DESC LIMIT 1""", list(labels)).fetchone() if labels else None
    if weeks is None:
        print("Ningún comentario del archivo está en una muestra semanal.", file=sys.stderr)
        return 1
    week = weeks["week"]
    if invalid:
        print(f"{invalid} filas con etiqueta inválida, descartadas.")
    gold_n, gold_opinion, gold_wants = _gold_agreement(labels) if sample.GOLD_PATH.exists() else (0, None, None)
    trusted = int(gold_opinion is None or gold_opinion >= GOLD_MIN)
    m = measure(conn, week, labels)
    model = conn.execute("SELECT model FROM sample WHERE week = ? LIMIT 1", (week,)).fetchone()["model"]
    conn.execute("INSERT OR REPLACE INTO evaluation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 (week, model, m["n"], m["opinion"], m["wants"], m["wants_precision"], m["wants_recall"], gold_n,
                  gold_opinion, gold_wants, trusted, store.now()))
    sampled = {r[0] for r in conn.execute("SELECT comment_id FROM sample WHERE week = ?", (week,))}
    conn.executemany("INSERT OR REPLACE INTO review VALUES (?, ?, ?, ?, ?)",
                     [(i, week, o, int(w == "si"), store.now()) for i, (o, w) in labels.items() if i in sampled])
    conn.commit()
    print(f"Semana {week} · modelo {model} · {m['n']} comentarios")
    print(f"Control: quien etiquetó coincide {_pct(gold_opinion)} en opinión y {_pct(gold_wants)} en quiere_verla "
          f"con {gold_n} etiquetas manuales" + ("" if trusted else f" (mínimo {GOLD_MIN:.0%}: semana NO confiable)"))
    if m["n"]:
        print(f"opinión: el modelo coincide {_pct(m['opinion'])} (±{_margin(m['opinion'], m['n']):.0%})")
        for c, hits in m["by_class"].items():
            print(f"  {c}: {_pct(_share(sum(hits), len(hits)))} de {len(hits)}")
        print(f"quiere_verla: coincide {_pct(m['wants'])}; precisión {_pct(m['wants_precision'])} y cobertura "
              f"{_pct(m['wants_recall'])} sobre {m['wants_positives']} comentarios con intención")
    return 0


if __name__ == "__main__":
    sys.exit(main())
