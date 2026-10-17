"""Escucha social: qué dice la gente de las películas en cartelera y en preventa, en comentarios de tráilers de YouTube.

Cuatro pasos, cada uno un módulo que corre con `python -m`:
  - `capture`: busca el tráiler de cada película y guarda los comentarios nuevos y las vistas (solo stdlib);
  - `classify`: clasifica los comentarios sin predicción con los modelos de `data/modelos/` (torch, solo `.venv-ml`);
  - `sample`: aparta la muestra semanal, junto con las etiquetas manuales de control, para etiquetarla fuera del repo;
  - `compare`: lee la muestra ya etiquetada y mide cuánto coincide el modelo con las etiquetas.
`train` entrena los modelos desde `training/` a mano. Todo lo que se escribe va a `data/listening.db`, y solo lo
escribe el trabajo `listening`. Atención (vistas, comentarios) y opinión (qué dicen) son preguntas separadas: no hay
una puntuación combinada.
"""
