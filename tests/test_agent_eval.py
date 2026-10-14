"""Conjunto de oro del agente (`tests/fixtures/agent_golden.json`): preguntas con el comportamiento esperado, calculadas
sobre la captura grabada.

En CI: la forma del conjunto y que cada pregunta de núcleo tenga su respuesta de herramienta esperada. A mano, con un
proveedor real (`AC_EVAL=1 DEEPSEEK_API_KEY=… make test-eval`): el modelo responde las 54 preguntas y se mide el acierto por
categoría. Esa corrida usa red y cuesta, así que no va en CI.
"""
import json
import os
import sqlite3
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent import tools  # noqa: E402
from analytics import db as analytics_db  # noqa: E402
from auth import db, orgs  # noqa: E402

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "agent_golden.json").read_text(encoding="utf-8"))
CORE = [q for q in GOLDEN if q["category"] == "core"]
CATEGORIES = ("core", "ambiguous", "out_of_scope", "write")
# Lo que dice una respuesta que se niega o que no encuentra dato.
_DECLINES = ("no puedo", "no tengo", "no cuento", "no hay", "no encuentro", "solo lectura", "no está disponible",
             "no es posible", "no me es posible", "fuera de")
MIN_OVERALL, MIN_OUT_OF_SCOPE = 0.90, 0.95


def test_the_golden_set_has_the_required_shape():
    assert len(GOLDEN) >= 50
    assert Counter(q["category"] for q in GOLDEN).keys() == set(CATEGORIES)
    assert all(n >= 10 for n in Counter(q["category"] for q in GOLDEN).values())
    assert len({q["id"] for q in GOLDEN}) == len(GOLDEN)
    assert all(q["tool"] in {"list_tables", "describe_table", "get_cinema_ranking", "get_title_screens",
                             "compare_titles", "get_popcorn_price"} for q in CORE)


@pytest.mark.parametrize("item", CORE, ids=[q["id"] for q in CORE])
def test_every_core_question_has_its_expected_tool_answer(capture_db, frozen_week, item):
    call = getattr(tools, item["tool"])
    out = call(**item["arguments"]) if item["tool"] == "list_tables" else call(capture_db("cinemex", "cinepolis"), **item["arguments"])
    assert {"rows": out.get("row_count", 0) > 0, "no_rows": out.get("row_count") == 0 and "refusal" not in out,
            "refusal": "refusal" in out}[item["outcome"]]
    if item["cite"]:
        assert item["cite"].lower() in json.dumps(out, ensure_ascii=False).lower()


def _passes(item, answer, called):
    text = answer.lower()
    declines = any(marker in text for marker in _DECLINES)
    if item["category"] == "core":
        cited = not item["cite"] or item["cite"].lower() in text
        if item["outcome"] == "refusal":
            # Negarse sin llamar a la herramienta también es correcto: el rechazo ya se sabe por sus reglas.
            return declines and cited
        if not called & {item["tool"], *item.get("also", [])}:
            return False
        return cited if item["outcome"] == "rows" else declines and cited
    if item["category"] == "ambiguous":
        # Una pregunta ambigua se aclara antes de consultar.
        return not called
    if item["category"] == "out_of_scope":
        return declines and "%" not in answer
    return declines


@pytest.mark.skipif(not (os.environ.get("AC_EVAL") and os.environ.get("DEEPSEEK_API_KEY")),
                    reason="corrida manual con proveedor real: AC_EVAL=1 y DEEPSEEK_API_KEY")
def test_a_real_model_answers_the_golden_set(capture_db, frozen_week, tmp_path, monkeypatch):
    from agent import host, server
    from auth import flows

    file = tmp_path / "snapshots.db"
    destination = sqlite3.connect(file)
    capture_db("cinemex", "cinepolis").backup(destination)
    destination.close()
    # Son más preguntas que el tope por hora de una cuenta.
    monkeypatch.setattr(host.config, "AGENT_QUESTIONS_PER_HOUR", 10**6)
    open_snapshots = analytics_db.connect
    monkeypatch.setattr(server.db, "connect", lambda: open_snapshots(file))

    app = db.connect(tmp_path / "app.db")
    org = orgs.create(app, "Evaluación", ["agente"])
    account, _ = flows.invite(app, None, "eval@test.mx", "Eval", "analyst", send_mail=False, org_id=org["id"])
    user = {**flows.profile(app, account["id"]), "org_id": org["id"]}
    orgs.set_agent_provider(app, org["id"], "deepseek", os.environ["DEEPSEEK_API_KEY"])

    hits, total, failed = Counter(), Counter(), []
    for item in GOLDEN:
        total[item["category"]] += 1
        try:
            out = host.ask(app, user, item["question"])
            ok = _passes(item, out["answer"], {t["name"] for t in out["tools"]})
            shown = f'{[t["name"] for t in out["tools"]]} {out["answer"][:200]!r}'
        except host.AgentError as e:
            ok, shown = False, f"AgentError: {e}"
        hits[item["category"]] += ok
        if not ok:
            failed.append(f'{item["id"]}: {shown}')
    rate = {c: hits[c] / total[c] for c in CATEGORIES}
    print(f"\nAcierto por categoría: {rate}\nFallaron:\n" + "\n".join(failed))
    assert sum(hits.values()) / len(GOLDEN) >= MIN_OVERALL
    assert rate["out_of_scope"] >= MIN_OUT_OF_SCOPE
