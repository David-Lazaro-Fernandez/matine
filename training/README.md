# Conjunto de entrenamiento de la escucha social

Comentarios de los tráilers de 67 películas en YouTube (bajados el 2026-10-15), etiquetados para entrenar a los modelos de
`listening/`. Una sola persona etiquetó con reglas fijas; las etiquetas son subjetivas, sobre todo `otro`.

| Archivo | Qué es |
| --- | --- |
| `etiquetas_v3.csv` | **El conjunto vigente**: `opinion` (pos, neu, neg, otro), `quiere_verla` (si, no, nd) e `intencion_nivel` (fuerte, deseo). Conserva las etiquetas originales del proveedor en `*_original` |
| `etiquetas_manuales.csv` | 100 etiquetas manuales de David: el control. Nunca entran al entrenamiento |
| `corpus.csv`, `para_clasificar.csv` | Los 10,380 comentarios con y sin metadatos del video |
| `etiquetas.csv`, `etiquetas_v2.csv`, `etiquetas_lote_*.csv` | Etiquetas anteriores del proveedor (`opinion` cambió de criterio a mitad del archivo) |

Reglas: `opinion` es lo que la persona piensa de la película, no el tono. `otro` son chistes, spam, traducciones del título,
otras películas y asuntos personales. Una reacción emocional sin juicio es `neu`; criticar el doblaje o el reparto es
`neg`. `quiere_verla` es `si` solo con intención clara ("iré", "no veo la hora"), `no` con rechazo explícito y `nd` en
cualquier otro caso, también si ya la vio.
