# Handoff: asistente de IA (MCP)

14 oct 2026 · Rama `agente-ia`, worktree `../absolut-cinema-agente-ia`, 10 commits sobre `main` (`07398b6` a `96ffae8`).
Sin push ni merge. Plan de origen: `docs/plan-agente-ia.md` (Fases 1 y 2). `make check` completo no se corrió; sí 439 tests
(sin `test_mobile` ni `test_live_capture`) y `make lint`.

## Estado

| Plan | Estado |
| --- | --- |
| 1.1 módulo `agente` | Hecho. `auth/db.py` `MODULES`, etiquetas en `analytics/labels.py` |
| 1.2 conversaciones y auditoría | Hecho. `auth/conversations.py`, tablas `agent_*` |
| 1.3 / 1.4 herramientas y descripciones | Hecho. `agent/tools.py`, `DATASET_DESCRIPTION` (**falta que una persona las revise**) |
| 1.5 servidor MCP | Hecho. `agent/server.py`, cliente en memoria, `fastmcp==4.1.0` |
| 1.6 / 1.7 / 1.8 acceso, seguridad, entorno | Hecho. `tools.require_access`, `check_startup`, `tests/test_agent.py` |
| 2.1 proveedor | Hecho para DeepSeek. `agent/providers/deepseek.py` |
| 2.2 ciclo | Hecho. `agent/host.py` |
| 2.3 / 2.4 endpoints | Hecho. `api/pages/agente.py` (staff elige proveedor y clave por `PUT /api/agente/proveedores/{org_id}`) |
| 2.5 pantalla | Hecha, sin streaming. `dashboard/app/(app)/agente/page.tsx` |
| 2.6 límites | Hecho. 30 preguntas/hora por cuenta, 500,000 tokens/día por organización |
| 2.7 conjunto de oro | Hecho. `tests/fixtures/agent_golden.json`, `make test-eval` |
| 2.8 formato de cifras | Hecho. Campos `*_text` en las herramientas |

## Cómo funciona una pregunta (`host.ask`)

1. `tools.require_access`: rol analyst o más y módulo `agente` (staff pasa siempre). Luego los topes de uso (429).
2. Clasificador de alcance (`_in_scope`): una llamada sin herramientas divide la petición en tareas. Si **una** cae fuera de lo
   que las herramientas resuelven, se cancela todo con "Lo siento, no puedo hacer eso." y no corre ninguna herramienta.
   Falla cerrada: un veredicto ilegible cancela.
3. Ciclo de herramientas por el servidor MCP de la cuenta (`server.build(user)`), máximo `AC_AGENT_MAX_STEPS` = 6 vueltas.
4. Filtro de salida (`_answer_fits`): otro revisor sin herramientas; si la respuesta se sale del tema, se reemplaza por la
   misma frase. Falla cerrada.
5. Se guardan mensajes y un renglón en `agent_audit`. Las cancelaciones llevan `error="out_of_scope"`.

Los dos revisores usan `temperature=0`. Sin eso daban rechazos falsos intermitentes (~1 de cada 17 preguntas válidas).

## Clave del proveedor

- Cifrada con KMS en `organization.agent_key`, ligada a la organización por el contexto de cifrado (`auth/secrets.py`).
- `AC_KEY_BACKEND=kms` y `AC_KMS_KEY_ID` en prod. `dev` solo codifica en base64 y se rechaza con `AC_ENV=prod`.
- El rol de la instancia necesita `kms:Encrypt` y `kms:Decrypt`. **No se probó contra KMS real**, solo con un doble.
- No hay pantalla para guardarla. Por ahora: `PUT /api/agente/proveedores/{org_id}` como staff, o
  `orgs.set_agent_provider(conn, org_id, "deepseek", "<clave>")`.
- David habló con el cliente: sabe que las preguntas se procesan en DeepSeek y no le preocupa (2026-10-14, de palabra, sin
  contrato escrito). DeepSeek se usa porque David tiene créditos y es más barato en dev. Antes del piloto (Fase 3), dejar los
  términos por escrito, porque el plan pide compliance.

## Cómo correrlo

- Servidores (desde este worktree): `make dashboard` (:8501), `make dashboard-dev` (:3000), `make marketing-dev` (:3001).
  Siguen corriendo en la sesión que escribió esto; si no, se levantan igual.
- Pruebas: `.venv/bin/python -m pytest tests/ -p no:warnings`. Celular: `AC_UI=1 .venv/bin/python -m pytest tests/test_mobile.py -k agente`.
- Evaluación con modelo real (red y costo; ~54 preguntas más 14 de estrés, 3 llamadas extra por pregunta):
  `DEEPSEEK_API_KEY=… make test-eval`. La clave del desarrollador está en `.env` de la carpeta principal como
  `DEEP_SEEK_API_KEY`; no se imprime ni se versiona.
- `fastmcp` se instala con `uv pip install --python .venv/bin/python --default-index https://pypi.org/simple fastmcp`
  (siempre PyPI público, nunca Shadowbox). Ya está en `.venv/` y fijado en `requirements-api.txt`.

## Resultados de la evaluación (DeepSeek `deepseek-flash`, captura grabada)

Tres corridas finales: núcleo 94 a 100 %, ambiguas, fuera de alcance, escritura, mezcladas e inyección 100 % en las tres.
Los 94 % fueron un marcador de frase que faltaba, no un fallo del agente (ya corregido).
Mide contra **nuestros propios casos**; los criterios de la eval son por frases ("no puedo", "no pude", "no devolvió").

## Pendiente

1. **Probar contra la base real de CDMX.** La captura grabada es de Hermosillo, sin planos de asientos ni precios de
   delivery: ranking y dulcería solo se midieron como "sin datos". Preguntar con cifras reales es lo más valioso que falta.
2. **Pantalla de staff** para elegir proveedor y clave (hoy solo el endpoint).
3. **Documentación**, que el plan pide en cada PR: `ARCHITECTURE.md` (catálogo de servicios y flujo), `project.md` (decisiones
   con fecha y hechos de DeepSeek verificados el 2026-10-14), `DESIGN.md` (componente de chat), `deploy/README.md`.
   `AGENTS.md` ya tiene la fila de la capa `agent/`.
4. **Chequeo en `make check`** de que `/usr/bin/python3 -c "import analytics, scraper.run"` importe sin `agent/` (hoy se
   cumple, pero no hay prueba que lo vigile).
5. Revisión humana de las descripciones de tablas (`DATASET_DESCRIPTION`).
6. Streaming de la respuesta (hoy llega completa; la pantalla muestra "Consultando los datos…").
7. Decisiones abiertas del plan: retención de conversaciones y quién las lee; si el resumen narrado reutiliza este módulo y
   la clave; otros proveedores; términos con el proveedor.
8. Fase 3 (piloto): vista de Operaciones con preguntas por día, latencia, errores, costo y pulgares. `agent_audit` ya trae
   los datos.

## Límites conocidos

- **Revisores basados en modelo.** El clasificador y el filtro de salida son un modelo: una inyección que no probamos puede
  colarse. 12 casos de inyección y 13 mezclados pasan, pero son una muestra.
- **El filtro de salida revisa el tema, no las cifras.** Que cada número sea correcto depende de que el modelo cite los
  campos `*_text` de las herramientas.
- **Costo.** Cada pregunta hace de tres a seis llamadas al modelo (clasificador, vueltas de herramientas, filtro). Entran
  todas en el tope de tokens por organización. No se midió el costo por pregunta.
- **Seguridad de lectura.** Las herramientas no tienen escritura y `analytics.connect()` abre en `mode=ro`; el entorno
  (`AC_ENV`) no es un argumento de ninguna herramienta. Los hilos de FastMCP abren su propia conexión por llamada.
- **Datos que no existen.** Cinemex no publica su dulcería en sala: `get_popcorn_price` usa precios a domicilio y lo dice.
  Solo CDMX tiene "% vendido" (`AC_SEATS_PLAZAS`); fuera de CDMX la herramienta se niega.
- **Pendiente de confirmar con David** (plan 0.7): que la regla de medición post-inicio sea igual en ambas cadenas, porque
  los totales de ocupación son 6.6 % contra 12.3 %. Hasta entonces, no mostrar "Cinemex vende la mitad" a ningún cliente.
- Un `fastmcp` nuevo cambia nombres (`inputSchema` pasó a `input_schema` en 4.1); está fijado en 4.1.0.

## Mapa de archivos

- `agent/tools.py`: las 6 herramientas, acceso, `AccessDenied`, `environment()`, `check_startup()`.
- `agent/server.py`: `build(user)` y `INSTRUCTIONS` (el prompt del agente).
- `agent/host.py`: `ask`, clasificador, filtro de salida, topes de uso, `AgentError`, `OverLimit`.
- `agent/providers/`: `CHAT` indexa los proveedores por nombre; `deepseek.py` es el único.
- `auth/conversations.py`, `auth/secrets.py`, `auth/orgs.py` (`set_agent_provider`, `agent_provider`, `agent_status`).
- `api/pages/agente.py`: preguntar, conversación, pulgar y proveedores (staff).
- `analytics/labels.py`: `AGENT_TEXT`, `AGENT_UI`, `AGENT_TOOL_LABEL`, `DATASET_DESCRIPTION`; luego `make labels`.
- `tests/test_agent.py`, `test_agent_api.py`, `test_agent_eval.py` y `tests/fixtures/agent_golden.json` (68 casos).
- `scraper/config.py`: `AC_AGENT_*`, `AC_KEY_BACKEND`, `AC_KMS_KEY_ID`.

## Para integrar

Antes del merge: `make check` completo, `AC_UI=1` con `tests/test_mobile.py`, y la descripción del PR según
`.claude/rules/pull-requests.md`. Antes de prod: clave KMS creada, permisos del rol de la instancia, `AC_ENV=prod`,
`AC_KEY_BACKEND=kms` y confirmar los términos con el proveedor.
