"""Entrena uno de los dos modelos de la escucha social y lo guarda en `data/modelos/`.

Parte de `robertuito-base-uncased` y lo ajusta con `training/etiquetas_v3.csv`, sin las etiquetas manuales de control
(`training/etiquetas_manuales.csv`), que solo sirven para medirlo al final. `opinion` tiene cuatro clases (pos, neu, neg,
otro); `quiere_verla` es binaria: `si` contra todo lo demás. Necesita torch y transformers de `.venv-ml`
(`make ml-env`) y una GPU de Mac (MPS) o paciencia: unos 2 minutos por época con 10,000 comentarios en una M-series.

Uso: .venv-ml/bin/python -m listening.train {opinion,quiere_verla} [--epochs 2]
"""
import argparse
import csv
import json
import random
import sys
from collections import Counter
from datetime import datetime

from scraper import config

BASE_MODEL = "pysentimiento/robertuito-base-uncased"
BATCH = 32
LEARNING_RATE = 3e-5
MAX_LENGTH = 128
# Cada tarea: clases, cómo sale la etiqueta de una fila y la de las etiquetas manuales.
TASKS = {
    "opinion": {"classes": ["pos", "neu", "neg", "otro"], "label": lambda r: r["opinion"]},
    "quiere_verla": {"classes": ["no_quiere", "quiere"],
                     "label": lambda r: "quiere" if r["quiere_verla"] == "si" else "no_quiere"},
}


def _read(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main(argv=None):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("task", choices=TASKS)
    ap.add_argument("--epochs", type=int, default=2)
    args = ap.parse_args(argv)
    classes, label = TASKS[args.task]["classes"], TASKS[args.task]["label"]
    gold = {r["comment_id"]: r for r in _read(config.TRAINING_DIR / "etiquetas_manuales.csv")}
    rows = [r for r in _read(config.TRAINING_DIR / "etiquetas_v3.csv") if r["comment_id"] not in gold]
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    torch.manual_seed(0)
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL, num_labels=len(classes), ignore_mismatched_sizes=True).to(device)

    def encode(batch):
        return tokenizer([r["comentario"] for r in batch], truncation=True, max_length=MAX_LENGTH, padding=True,
                         return_tensors="pt").to(device)

    # La raíz cuadrada de la frecuencia inversa pesa las clases raras sin que dominen.
    counts = Counter(label(r) for r in rows)
    weights = torch.tensor([(len(rows) / (len(classes) * counts[c])) ** 0.5 for c in classes]).to(device)
    steps = args.epochs * (len(rows) // BATCH + 1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=0.01)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimizer, LEARNING_RATE, total_steps=steps, pct_start=0.1,
                                                   anneal_strategy="linear")
    for epoch in range(args.epochs):
        model.train()
        random.Random(epoch).shuffle(rows)
        for start in range(0, len(rows), BATCH):
            batch = rows[start:start + BATCH]
            target = torch.tensor([classes.index(label(r)) for r in batch]).to(device)
            loss = torch.nn.functional.cross_entropy(model(**encode(batch)).logits, target, weight=weights)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            schedule.step()
            optimizer.zero_grad()
        print(f"época {epoch + 1}: pérdida {loss.item():.3f}", flush=True)
    model.eval()
    hits = 0
    for start in range(0, len(gold), 64):
        batch = list(gold.values())[start:start + 64]
        with torch.inference_mode():
            best = model(**encode(batch)).logits.argmax(-1).tolist()
        hits += sum(classes[b] == label(r) for b, r in zip(best, batch))
    print(f"Control: {hits}/{len(gold)} coinciden con las etiquetas manuales")
    out = config.MODEL_DIR / args.task
    model.save_pretrained(out)
    tokenizer.save_pretrained(out)
    (out / "clases.json").write_text(json.dumps(classes), encoding="utf-8")
    (out / "meta.json").write_text(json.dumps({
        "trained_at": datetime.now().isoformat(timespec="minutes"), "base": BASE_MODEL, "rows": len(rows),
        "epochs": args.epochs, "gold_hits": hits, "gold_n": len(gold)}), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
