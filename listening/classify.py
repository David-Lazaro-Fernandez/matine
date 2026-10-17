"""Clasifica los comentarios de `listening.db` que el modelo vigente aún no ha visto.

Usa los dos modelos de `data/modelos/` (`opinion` y `quiere_verla`, entrenados con `listening.train`). Necesita torch y
transformers, que solo están en `.venv-ml` (`make ml-env`). Un modelo nuevo vuelve a clasificar todo: la versión de ambos
va en cada predicción. Con una Mac son unos 100 comentarios por segundo por modelo.

Uso: .venv-ml/bin/python -m listening.classify
"""
import json
import sys

from scraper import config

from . import store

_BATCH = 64
_SAVE_EVERY = 512


def _load(name):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    path = config.MODEL_DIR / name
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = AutoModelForSequenceClassification.from_pretrained(path).to(device).eval()
    return {"tokenizer": AutoTokenizer.from_pretrained(path), "model": model, "device": device,
            "classes": json.loads((path / "clases.json").read_text(encoding="utf-8")),
            "trained_at": json.loads((path / "meta.json").read_text(encoding="utf-8"))["trained_at"]}


def _predict(loaded, texts):
    """[(clase, confianza)] de cada texto, en el mismo orden."""
    import torch

    # Los textos de largo parecido van juntos para no rellenar de más cada lote.
    order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
    out = [None] * len(texts)
    for start in range(0, len(order), _BATCH):
        ids = order[start:start + _BATCH]
        batch = loaded["tokenizer"]([texts[i] for i in ids], truncation=True, max_length=128, padding=True,
                                    return_tensors="pt").to(loaded["device"])
        with torch.inference_mode():
            probs = loaded["model"](**batch).logits.softmax(-1).cpu()
        confidence, best = probs.max(-1)
        for i, c, b in zip(ids, confidence.tolist(), best.tolist()):
            out[i] = (loaded["classes"][b], c)
    return out


def model_version(opinion, wants):
    return f"opinion@{opinion['trained_at']}+quiere_verla@{wants['trained_at']}"


def main():
    conn = store.connect()
    opinion, wants = _load("opinion"), _load("quiere_verla")
    version = model_version(opinion, wants)
    pending = conn.execute("""
        SELECT comment_id, text FROM comment c
        WHERE NOT EXISTS (SELECT 1 FROM prediction p WHERE p.comment_id = c.comment_id AND p.model = ?)
        ORDER BY comment_id""", (version,)).fetchall()
    print(f"{len(pending)} comentarios por clasificar con {version}", flush=True)
    for start in range(0, len(pending), _SAVE_EVERY):
        chunk = pending[start:start + _SAVE_EVERY]
        texts = [r["text"] for r in chunk]
        conn.executemany(
            "INSERT OR REPLACE INTO prediction (comment_id, model, opinion, opinion_confidence, wants_to_see, "
            "wants_confidence, classified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(r["comment_id"], version, o[0], o[1], int(w[0] == "quiere"), w[1], store.now())
             for r, o, w in zip(chunk, _predict(opinion, texts), _predict(wants, texts))])
        conn.commit()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
