# Engineering execution plan: Matiné AI Analytics Agent (MCP)

Oct 14, 2026 · Companion to `docs/prd-agente-ia.md` (Draft 2)

Sizes: S = under 1 day, M = 1 to 3 days, L = 3 to 5 days. One engineer, one worktree per workstream
(`scripts/wt new`), `make check` before every merge to `main`.

## 0. Corrections to the PRD found while reading the code

These change scope. Fix the PRD before Phase 0 ends.

| PRD says | Code says | Effect |
| --- | --- | --- |
| "We do not capture sales" | `analytics/cinema_sales.py` measures **% vendido**: seats sold over seats measured, read 15 to 75 min after each showtime start. Only in `AC_SEATS_PLAZAS` plazas, and only cinemas with at least `MIN_SHOWS` (50) measured showtimes in the window | Use case 1 and 2 are answerable with `cinema_occupancy`. The answer must say "ocupación medida", name the plaza and the window (last 7 days vs the previous 7), and refuse outside seat plazas |
| "Competidor número 1" is open | `main_rivals` gives each Cinemex site its nearest Cinépolis rival that sells most (`RIVAL_MAX_KM` = 3) | Closed. The tool wraps `main_rivals` |
| Week is Thursday to Wednesday | `cinema_sales` uses a rolling `days=7` window, not `cinema_week()` | The tool must state which window it uses. Do not pass a week to a rolling function without saying so |
| New SQLite journal mode spike | `scraper/store.py` already sets WAL, and `analytics.connect()` is built for reading during writes | Spike removed. Keep timeout and row limits only |
| New "restricted" column in a YAML catalog | `analytics/datasets.py` already is the explorer catalog (`DATASETS`, `page`, `count`) | Reuse it. Add Spanish descriptions there, no new YAML |
| `MODULES` and `require_module` | `auth/db.py` `MODULES` and `api/session.require_module` exist | "agente" becomes one more module. No new gating code |

Functions available to wrap, by use case:

| Use case | Wrap |
| --- | --- |
| Cinemas selling most or least | `cinema_occupancy(conn, days, plaza)` |
| Our price vs the rival, popcorn | `delivery_compare` (the only source with both chains; see 0b.1). Theater prices: Cinépolis only |
| Titles with most screens | `movies_by_chain` (`shows_cinemex`, `share_cinemex`), `offered_by_title` for `share_seats` |
| Two titles compared | `movies_by_chain` filtered by `title_key` for both, plus `occupancy_by_title(chain="cinemex")` when seat data exists |

## 0b. Second pass: verified against the code and the real database (2026-10-14)

I ran the wrapped functions against `data/snapshots.db` (local copy, 5.4 GB folder, last capture 2026-10-14 05:02 UTC).

**What holds**
- `cinema_occupancy(plaza="cdmx")` returns 161 cinemas (87 Cinemex, 74 Cinépolis) in 0.2 s cold, 0.06 s warm. Each row has `sold_pct`, `sold_pct_prev` and `delta_pp`.
- `main_rivals(plaza="cdmx")` returns 51 pairs in 0.07 s. `chain_occupancy` gives the chain totals.
- `movies_by_chain` already returns `share_cinemex`, `share_cinepolis` and `gap_pp` per title, matched by `title_key`. `offered_by_title` adds `share_shows` and `share_seats`.
- The occupancy query uses `idx_occ_post` (a `SEARCH`, not a `SCAN`). No new index is needed for it.
- The `analyst` and `viewer` roles, `organization.modules` and `require_module` exist as the plan says.

**What breaks the plan, and the fix**

| # | Finding | Fix in the plan |
| --- | --- | --- |
| 1 | **Cinemex has no in-theater concession prices.** `concession_price` and `concession_size` hold only Cinépolis rows. Cinemex is only in `delivery_price` (Rappi and DiDi, 7,070 rows). Its menu is not exposed by its API (`project.md`, "no expuesto"). `concession_*` take one `chain`, so a "compare" tool cannot use them | Rewrite the popcorn tool. Wrap `delivery_compare` (Cinemex vs Cinépolis by comparable bucket, last reading per store). Say in every answer that the price is the delivery price. A theater price is Cinépolis only. Add a test: asking for the theater price of Cinemex gets "no puedo responder" |
| 2 | **Seat data exists only in CDMX.** `cinema_occupancy` returns 0 rows for `gdl` and `mty`, and `plaza=None` returns the same 161 CDMX cinemas. `AC_SEATS_PLAZAS` defaults to `("cdmx",)` | The ranking tool refuses outside CDMX and says so. A national question gets the CDMX answer labeled as CDMX, never as national. Add golden-set cases for `gdl`, `mty` and national |
| 3 | `cinema_occupancy` sorts by chain first, then by `sold_pct`. There is no combined ranking, and "nuestros cines" means Cinemex only | `get_cinema_ranking` takes `chain` (default `cinemex`), filters and sorts in the wrapper by `sold_pct` with `asc` or `desc`, and applies `limit`. Say which chain in the answer |
| 4 | The 7-day window ends today (sampled at least 15 min after start), and `MIN_SHOWS` = 50 drops small cinemas | State `days`, the cutoff date and the count of cinemas dropped. Tool output carries `min_shows` |
| 5 | `movies_by_chain` has `limit=60` by default. A title outside the top 60 would look "missing" | The wrapper searches by `title_key` and uses a high limit, or returns "no encuentro esa película en cartelera". Test with a rarely shown title |
| 6 | The chain totals look uneven: 6.6% sold for Cinemex against 12.3% for Cinépolis, over the same rule | Before any user sees "Cinemex vende la mitad", check with David that the measuring rule is equal in both chains (`scraper.sample --post-start`). Put the check in Phase 0 |
| 7 | `cinema_week(iso)` needs an ISO date string, not `None` | The wrapper passes `today()` |
| 8 | Provider keys: `organization.integrations` is a JSON column with no encryption, and the repo has no KMS code or provider env variables | Spike 0.3 grows: decide encryption (env key with `cryptography`, or KMS) before storing the first key. PRD promises "encrypted" |
| 9 | `fastmcp` is not in `.venv`. The system Python is 3.10, so `agent/` must stay venv-only and never be imported by `scraper/`, `analytics/` or `jobs/` | Add the check to `make check`: `/usr/bin/python3 -c "import analytics, scraper.run"` must still pass without `agent/` |
| 10 | `app.db` already has an `audit` table (account actions, `detail` JSON) | Keep a separate `agent_audit`: one row per question, many per day. Reuse nothing but the style |

## 1. Placement (AGENTS.md architecture rules)

New layer, added to the table in `AGENTS.md` section 1 and to `ARCHITECTURE.md`:

| Layer | Folder | Dependencies | Writes |
| --- | --- | --- | --- |
| Agent | `agent/` | `.venv` (fastmcp, provider SDKs); reads `analytics/`; talks to `auth/` for state | nothing directly. Audit, conversations and feedback go through `auth/` into `data/app.db` |

- `agent/tools.py`: one function per tool. Each calls an `analytics/` function and returns a `TypedDict`. No SQL.
- `agent/server.py`: FastMCP app that registers `tools.py`. Read-only annotation on every tool.
- `agent/host.py`: the loop (question, provider, tool calls, answer). Functions, not classes. One provider interface as a module-level function table.
- `agent/providers/`: one module per provider.
- `auth/conversations.py`: tables `agent_conversation`, `agent_message`, `agent_audit`, `agent_feedback`, additive in `auth/db.py`.
- `api/pages/agente.py`: router with `read` for history and a streaming endpoint for asking. Requires `session.require_module("agente")` and a role of analyst or above.
- `dashboard/app/agente/`: chat page. Labels from `analytics/labels.py` (`make labels`).
- `scraper/` and `analytics/` never import `agent/`. `agent/` never imports FastAPI. `auth/` never imports `agent/`.

The server runs in the API process, so memory stays within the 2 GB box.

## 2. Workstreams

### Phase 0: foundations (about 3 days)

| # | Task | Size | Exit |
| --- | --- | --- | --- |
| 0.1 | Fix the PRD with section 0 above and re-confirm with David | S | PRD Draft 3 |
| 0.2 | **Spike: FastMCP.** Run the server in the FastAPI process (mounted ASGI or in-memory client). Prefer the in-memory FastMCP client: host and server share a process, so no network hop and no token over the wire. Check how the user identity reaches a tool call (per-call context). Check Python 3.12 venv and that `/usr/bin/python3` imports stay clean (`agent/` is venv only) | M | Written decision: transport, identity passing, fastmcp version pinned in `requirements-api.txt` |
| 0.3 | **Spike: providers and keys.** Which providers at launch. Reuse how `auth/orgs.py` stores integration secrets and what the narrative plan says about KMS | M | Decision on key storage and provider list |
| 0.4 | Choose the measure per use case (table above). For "screens": share of showtimes, as AGENTS.md principle 3 requires | S | Tool signatures frozen |
| 0.5 | Check the popcorn buckets in `delivery_compare` (`bucket_of`) on real data: do Cinemex "Mega Palomitas" and Cinépolis "Palomitas" land in one comparable bucket? | S | A bucket list, or the tool is cut |
| 0.7 | Confirm with David that the post-start measuring rule is equal in both chains (0b.6) before any ranking ships | S | Written yes, or a caveat in every answer |
| 0.6 | `EXPLAIN QUERY PLAN` on each wrapped function against the real database, cold and warm (AGENTS.md section 3) | S | Missing indexes listed |

### Phase 1: MCP server (about 2 weeks)

| # | Task | Size | Tests |
| --- | --- | --- | --- |
| 1.1 | Add `"agente"` to `auth/db.py` `MODULES`; plan gating and `make user-create` flags | S | `test_auth.py`: module on and off |
| 1.2 | `auth/conversations.py` and additive tables; audit record per question (user, role, org, environment, tools with arguments, row counts, latency, provider, tokens) | M | `test_auth.py` style on a temp `app.db` |
| 1.3 | `agent/tools.py`: `list_tables`, `describe_table` over `analytics/datasets.py`, plus the four business tools (wrappers per 0b: chain filter, CDMX-only refusal, title search, delivery source). Each output carries window, cutoff date, plaza, environment, row count. The fixture in `tests/fixtures/capture/` has no seat data: record a small `occupancy_sample` and `delivery_price` fixture first | L | Contract tests per tool, plus the refusal cases from 0b.1, 0b.2 and 0b.5 |
| 1.4 | Add Spanish descriptions per table and column to the catalog, reviewed by a person. `app.db` is not in the catalog | M | Test: every catalog table has a description |
| 1.5 | `agent/server.py`: register tools, read-only annotation, resources `schema://tables` and `schema://table/{name}`, Spanish answer prompt | M | Test: server lists exactly the expected tools |
| 1.6 | Role and module check on every call, from the session user. Row limit and timeout per tool | M | Viewer refused; org without the module refused |
| 1.7 | **Security tests**: INSERT, UPDATE, DELETE, DROP and PRAGMA writes through the agent connection must fail. No tool can reach `app.db` or `precalc.db`. Environment cannot come from an argument | M | `tests/test_agent_security.py` in CI |
| 1.8 | Environment name in every response. Dev refuses a non-local `AC_DATA_DIR` at startup | S | Test with a fake path |

Exit: contract and security tests pass in `make check`.

### Phase 2: agent section (about 2 to 3 weeks)

| # | Task | Size | Tests |
| --- | --- | --- | --- |
| 2.1 | `agent/providers/`: interface plus the first provider. Keys encrypted, never returned to the model or the browser | L | Fake provider in tests |
| 2.2 | `agent/host.py`: tool loop, step limit, structured errors, no invented results after a failure | L | Loop test with a fake provider that calls tools, errors and times out |
| 2.3 | `api/pages/agente.py`: ask (streaming), history, feedback. Register in `api/internal.py` | M | `test_internal_api.py`: each role and module combination |
| 2.4 | Staff endpoint to select provider and key per organization (inside Operaciones or the workspace page) | M | `require_staff` test |
| 2.5 | `dashboard/app/agente/`: chat, "Ver detalle", trace panel in plain Spanish (names via `labels.py`, not tool names), CSV export, copy, thumbs, progress state. Reuse `components/common.tsx`. Colors from tokens | L | `pnpm run build`; add the page to `tests/test_mobile.py` at 320, 360, 390, 820 px |
| 2.6 | Per-user rate limit and a token budget per organization | M | Test: over the limit returns 429 |
| 2.7 | Golden set: at least 50 questions, at least 10 per category (core with variations, ambiguous, out of scope, write attempts), expected answers from a **frozen capture** in `tests/fixtures/` | L | `tests/test_agent_eval.py`, manual run with a real provider per release (not in CI: network and cost) |
| 2.8 | Number, date and percent formatting through `n`, `pp`, `date_es`, `time_12`. The model cites values, it does not format them | S | Test with sample tool output |

Exit: golden set at 90% or more, and 95% on out of scope, in dev.

### Phase 3: pilot (4 weeks)

- Enable the module for the Cinemex organization in prod only. Provider contract confirmed first (open PRD question).
- Operaciones view for staff: questions per day, latency, errors, token cost, feedback. This reads `app.db`.
- Weekly review of thumbs-down and out-of-scope questions. Add each to the golden set.
- Exit: adoption and accuracy metrics for 4 weeks.

### Phase 4: expansion (not scheduled)

Guarded free SQL, more tools, support agent on the same server.

## 3. Documentation and housekeeping (in each PR)

- `AGENTS.md`: layer row for `agent/`, the new writer rows in `app.db` (conversations, audit, feedback), and the rule that tools wrap `analytics/`.
- `ARCHITECTURE.md`: service catalog entry and data flow. `project.md`: decisions with dates and provider facts verified against the real API.
- `DESIGN.md`: chat component and the answer card.
- `deploy/README.md` and `deploy/absolut-cinema.env.example`: provider variables, no secrets in the repo.
- `make help`: any new target. `requirements-api.txt`: `fastmcp` pinned.
- Comments only for the why, in ETS Spanish, never at end of line. PR descriptions follow `.claude/rules/pull-requests.md`.

## 4. Risks specific to this plan

| Risk | Plan |
| --- | --- |
| FastMCP auth does not fit the cookie session | Spike 0.2. Fallback: in-memory client with the user passed per call |
| Occupancy exists only in seat plazas | Tool refuses outside them and says why. Test in the golden set |
| Rolling 7 days vs the cinema week | Each answer states its window. Decide in 0.4 whether to add a `cinema_week` option to `cinema_occupancy` |
| Model formats or invents numbers | Formatting by helpers, answer prompt requires citing tool values, golden set checks figures |
| Provider cost or latency misses the targets | Token budget (2.6), step limit (2.2), measure in the pilot before widening |
| Narrative-summary plan duplicates provider and key work | Decide in 0.3 whether one module serves both |

## 5. Order and parallelism

```
0.1 → 0.2 ┬→ 1.3 → 1.5 → 1.6 → 1.7 ─┐
          └→ 1.1 → 1.2 ──────────────┼→ 2.2 → 2.3 → 2.5 → 2.7 → pilot
0.3 → 2.1 ───────────────────────────┘
```

Parallel safely: 1.4 (descriptions) with 1.3; 2.5 (UI against a fake endpoint) with 2.2. Each in its own worktree.

## 6. Open decisions that block a task

| Decision | Blocks |
| --- | --- |
| Which provider first | 2.1 |
| Seat-plaza-only sales (CDMX), or also a showtimes proxy elsewhere. Default: CDMX only, with a clear refusal | 1.3 |
| Popcorn from delivery prices only, or drop the use case until Cinemex theater prices exist | 1.3 |
| Key encryption: env key or KMS | 0.3, 2.1 |
| Absorb the narrative-summary feature | 0.3, 2.1 |
| Conversation retention and who reads them | 1.2 |
| Contract terms for sending questions to a provider | Phase 3 |
