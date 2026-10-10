"""Que `dashboard/lib/labels.generated.ts` coincida con `analytics/labels.py`."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_labels  # noqa: E402


def test_generated_labels_match_labels_py():
    # Si falla: `make labels` y versionar el resultado.
    assert export_labels.check()
