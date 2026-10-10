"""APIs sobre `analytics/`: la pública de Matiné (`api/main.py`) y la interna del dashboard (`api/internal.py`).

Ambas leen `snapshots.db` en solo lectura. Solo la interna escribe, y solo en `app.db` a través de `auth/`.
"""
