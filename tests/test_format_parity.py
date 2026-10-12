"""Que `dashboard/lib/format.ts` formatee igual que los helpers de Python (`analytics/labels.py`).

Python calcula lo esperado; Node importa `format.ts` con `--experimental-strip-types` y devuelve su salida. Sin un
Node que entienda TypeScript (22.6 o más), la prueba se omite.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from analytics import cinema_week
from analytics.labels import date_es, range_es, time_12
from scraper.normalize import norm_title

FORMAT_TS = Path(__file__).resolve().parents[1] / "dashboard" / "lib" / "format.ts"
_NODE = ["node", "--experimental-strip-types", "--no-warnings"]


# Los formatos de número y de puntos porcentuales que tenía el dashboard de Streamlit, como referencia de `format.ts`.
def n(v, nd=0):
    return "—" if v is None else f"{float(v):,.{nd}f}"


def pp(v):
    return f"{v:+.1f} pp".replace("-", "−")


# Cada caso: nombre de la función en format.ts, argumentos y lo que devuelve Python.
CASES = (
    [("date_es", [d, True], date_es(d)) for d in ("2026-09-07", "2026-10-11", "2026-12-31", "2027-01-01")]
    + [("date_es", ["2026-02-28", False], date_es("2026-02-28", with_year=False))]
    + [("range_es", [a, b], range_es(a, b))
       for a, b in (("2026-09-07", "2026-09-07"), ("2026-09-07", "2026-09-09"), ("2026-12-30", "2027-01-05"))]
    + [("time_12", [t], time_12(t)) for t in ("00:05", "09:30", "12:00", "17:30", "23:59")]
    + [("n", [v, nd], n(v, nd)) for v, nd in ((None, 0), (0, 0), (1234, 0), (1234.5, 1), (-1234567.891, 2),
                                              (2.5, 0), (3.5, 0), (0.125, 2), (999.95, 1), (1e6, 0))]
    + [("pp", [v], pp(v)) for v in (0, 1.26, -1.26, -0.04, 0.05, -0.05, 12.345, -0.0)]
    + [("cinemaWeek", [d], list(cinema_week(d))) for d in ("2026-10-08", "2026-10-10", "2026-10-14", "2026-12-31")]
    + [("fold", [t], norm_title(t)) for t in ("Cinemanía", "CINÉPOLIS · Plaza Satélite", "Ñoño  y  Pingüino", "  ", "4DX/IMAX®")]
)

_SCRIPT = """
const fmt = await import(process.argv[1]);
const { readFileSync } = await import('fs');
const cases = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(cases.map(([fn, args]) => fmt[fn](...args))));
"""


def _node_runs_typescript():
    if not shutil.which("node"):
        return False
    return subprocess.run([*_NODE, "-e", ""], capture_output=True).returncode == 0


@pytest.mark.skipif(not _node_runs_typescript(), reason="hace falta Node 22.6+ con --experimental-strip-types")
def test_format_ts_matches_python():
    out = subprocess.run([*_NODE, "--input-type=module", "-e", _SCRIPT, FORMAT_TS.as_uri()],
                         input=json.dumps([[fn, args] for fn, args, _ in CASES]), capture_output=True, text=True,
                         check=True)
    got = json.loads(out.stdout)
    mismatches = [(fn, args, want, have) for (fn, args, want), have in zip(CASES, got) if want != have]
    assert not mismatches
