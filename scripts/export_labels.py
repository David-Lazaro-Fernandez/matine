"""Exporta los textos y colores de `analytics/labels.py` a `dashboard/lib/labels.generated.ts`, así el dashboard de
Next.js no escribe ningún hex ni texto de usuario a mano.

`python3 scripts/export_labels.py` reescribe el archivo generado (`make labels`). Con `check`, sale con 1 si el archivo
no coincide con `labels.py`; lo corre pytest.

Exporta cada constante pública de `labels.py`: nombre en mayúsculas, sin `_` inicial y con valor JSON (las tuplas pasan
a arreglos). Las funciones no se exportan; sus equivalentes van en TypeScript. Solo librería estándar.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from analytics import labels  # noqa: E402

OUT = ROOT / "dashboard" / "lib" / "labels.generated.ts"
HEADER = "// Generado por `make labels` (scripts/export_labels.py) desde analytics/labels.py; no se edita a mano.\n"


def render():
    """El contenido de `labels.generated.ts`: un `export const NOMBRE = … as const;` por constante, en el orden de labels.py."""
    public = {name: value for name, value in vars(labels).items()
              if name.isupper() and not name.startswith("_") and not callable(value)}
    body = "".join(f"\nexport const {name} = {json.dumps(value, ensure_ascii=False, indent=2)} as const;\n"
                   for name, value in public.items())
    return HEADER + body


def check():
    """True si el archivo versionado coincide con lo que generaría `render()`."""
    return OUT.exists() and OUT.read_text(encoding="utf-8") == render()


def main(argv):
    if argv[1:] == ["check"]:
        if not check():
            print(f"{OUT.relative_to(ROOT)} no coincide con analytics/labels.py: corre `make labels` y versiona el resultado.")
            return 1
        return 0
    OUT.write_text(render(), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
