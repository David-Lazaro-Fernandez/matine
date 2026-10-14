# PRD: Matiné AI Analytics Agent (MCP)

Oct 14, 2026 · Draft 3 (verified against the code and `snapshots.db`, 2026-10-14)

## 1. Summary

Matiné adds an AI Agent section. Analysts ask questions in Spanish about current cinema data and get answers in Spanish, backed by a read-only MCP server (FastMCP) that wraps the existing `analytics/` functions.

Today the dashboard answers only the questions it has widgets for. Any other question needs a new widget or a manual query. This PRD covers the MCP foundation and the first agent experience.

| Item | Current | Target |
| --- | --- | --- |
| Access to data | Dashboard pages call `analytics/` | Natural-language questions answered by an agent |
| Data layer | `analytics/` functions over `snapshots.db` (read-only) | The same functions, exposed as typed MCP tools |
| Permissions | Roles and contracted modules gate pages | The same gates apply to AI (AI is a module; viewer has none) |
| Environments | `AC_DATA_DIR` selects the data folder | Every answer shows its environment |

The MCP client and host run in the API backend, not in the dashboard. The dashboard is a static site and only renders the chat.

## 2. Problem, goals, metrics

**Problem.** Users cannot ask free-form questions of cartelera data. Each new question needs a new widget or a manual query.

**Goals**
1. Answer Spanish questions with accurate Spanish answers and the numbers behind them.
2. Build the data access as an MCP server that a later client can reuse.
3. Guarantee read-only access, within the user's role and organization module.
4. Never answer with data the platform does not have (principle 1: real data only).

**Non-goals (v1)**
- Writing data through the agent.
- A customer-facing support agent (the foundation allows it; it ships later).
- Forecasts beyond what `analytics/` already computes.
- Languages other than Spanish.
- Box-office or ticket revenue. We do not capture it. "Ventas" means the measured share of seats sold (section 4).
- Replacing the dashboard.

**Metrics** (targets are proposals)

| Metric | Target | How measured |
| --- | --- | --- |
| Accuracy on the golden set | 90% or more, with at least 10 questions per category | Offline eval per release |
| Unanswerable questions | 95% get a clear "no puedo responder" | Out-of-scope questions in the eval set |
| Median / p95 latency | Under 10 s / under 25 s | Server logs |
| Adoption | N analysts with 3+ questions per week at 60 days (N set with the pilot customer) | Usage events |
| Unsafe actions | 0 writes, 0 cross-role or cross-module accesses | Audit review and CI tests |

## 3. Users and roles

Roles are the existing ones. Each includes the one before it. The role comes from the session on every request, never from the model or the client.

| Role | Dashboards | Datos (tables) | AI Agent | Admin |
| --- | --- | --- | --- | --- |
| viewer | Read | No | No | No |
| analyst | Read | Read | Yes | No |
| admin | Read | Read | Yes | Users, access, logo |
| staff | Read | Read | Yes | Operaciones, AI provider and key |

- AI is a contracted module. Access needs the right role **and** the module on the organization (`session.require_module`).
- Managers use the analyst role in v1. A manager role is a later decision (section 10).
- Data is shared cartelera, the same for every organization. Row-level scoping is not needed. Conversations and feedback are per user and per organization.

## 4. Use cases

Each use case maps to a typed MCP tool that wraps an `analytics/` function. The model never writes SQL in phase 1.

**Constraints from the data (all use cases)**
- We capture showtimes, prices, seat maps and concessions. We do not capture box-office. The closest measure is **% vendido**: seats sold over seats measured, read 15 to 75 minutes after each showtime starts (`analytics/cinema_sales.py`).
- % vendido exists only in plazas with seat maps (`AC_SEATS_PLAZAS`, today CDMX). Outside them the agent answers "no puedo responder" and says why. A national question gets the CDMX answer labeled as CDMX.
- % vendido uses a rolling window of 7 days against the 7 before, and drops cinemas with fewer than 50 measured showtimes. The answer states the window, the cutoff date and how many cinemas were dropped. Showtime shares use the cinema week (Thursday to Wednesday, `analytics.cinema_week()`).
- Scope is one plaza (default `cdmx`) or national. Never one chain in one scope against the other in another.
- The comparison is Cinemex (us) against Cinépolis (them). Independents and the Cineteca are not in the shares.
- Measures are shares of showtimes per chain, not absolutes. Titles match across chains by `title_key`.
- A conclusion is shown only if it crosses its threshold (`findings.py`). Otherwise the answer says no difference crosses it.

| Question (Spanish) | Answerable? | Tool |
| --- | --- | --- |
| ¿Cuáles son los cines que más/menos están vendiendo esta semana? | Yes in CDMX, as % vendido of our cinemas (Cinemex). Otherwise "no puedo responder" | `get_cinema_ranking(chain, order, limit)` over `cinema_occupancy` |
| ¿Cómo van nuestros precios de palomitas frente a Cinépolis? | **Only delivery prices.** Cinemex theater prices are not exposed by its API. The comparison uses Rappi and DiDi prices and says so. Theater prices exist for Cinépolis only | `compare_concession_prices(product)` over `delivery_compare` |
| ¿A qué película le damos más pantallas? | Yes, as share of showtimes | `get_screen_allocation(order)` |
| ¿Damos suficientes pantallas a X frente a Y? | Facts yes; "suficientes" only as a labeled interpretation backed by a threshold | `compare_screen_allocation(title_a, title_b)` |

Behavior rules
- Every answer states the date range, plaza, data freshness and the numbers behind the conclusion.
- If the data is missing, the agent says so in Spanish and names what is missing. It never estimates.
- "Competidor número 1" is `main_rivals`: for each Cinemex site, the Cinépolis site within 3 km that sells the most.
- A title that is not in the cartelera gets "no encuentro esa película", never a zero.

## 5. Architecture

```
Dashboard (static) → /api → Agent host (backend) → AI provider
                                   │
                                   └→ MCP server (FastMCP, same service) → analytics/ → snapshots.db (mode=ro)
```

1. The analyst asks a question in the AI Agent section.
2. The API checks the session, role and module (`api/session.py`). A viewer or an organization without the module gets 403.
3. The host sends the question and the tool list to the organization's AI provider.
4. The provider picks tools. The host calls them on the MCP server with the user's identity.
5. The server checks the role, calls an `analytics/` function and returns rows plus metadata (date range, plaza, environment, row count).
6. The provider writes the Spanish answer. The dashboard shows the answer, the table and the "Cómo llegué a esto" panel.

Decisions
- Tools are hand-written wrappers of `analytics/`. SQL and business logic stay in `analytics/` (a missing calculation goes there). Outputs are `TypedDict`.
- The provider is behind one interface in the host. Staff pick it per organization.
- Writes by layer (single writer per file): `auth/` writes audit, conversations and feedback in `data/app.db`. Nothing in the agent path writes `snapshots.db`. `app.db` is never reachable from a tool.
- This work overlaps the planned "Resumen general narrado con IA" (BYO key, KMS, audit, HTTPS). This PRD shares its provider-key storage and audit. Confirm whether the narrative feature is absorbed here.

## 6. MCP server

Every tool is read-only and carries the MCP read-only annotation. Every output includes date range, plaza, environment and row count.

| Tool | Purpose | Min. role | Phase |
| --- | --- | --- | --- |
| `list_tables` | Tables and descriptions | analyst | 1 |
| `describe_table` | Columns, types, row count, sample rows | analyst | 1 |
| `get_cinema_ranking` | Cinemas of one chain ranked by % vendido (CDMX) | analyst | 1 |
| `compare_concession_prices` | Our delivery price vs Cinépolis for a comparable product | analyst | 1 |
| `get_screen_allocation` | Titles ranked by share of showtimes | analyst | 1 |
| `compare_screen_allocation` | Two titles: showtimes, share, with interpretation labeled | analyst | 1 |
| `run_readonly_query` | Guarded free SQL | to decide | 2, behind a flag |

**Catalog.** Reuse the Datos explorer catalog (`analytics/datasets.py`) as the single source for `list_tables` and `describe_table`. Add a plain-language description in Spanish per table and column, reviewed by a person. `app.db` is outside the catalog and never exposed.

**Resources and prompts.** Resources `schema://tables` and `schema://table/{name}` expose the catalog. One prompt defines Spanish tone and how to state dates and separate fact from interpretation. The model cites figures. Numbers and dates are formatted by the existing helpers (`n`, `pp`, `date_es`), not by the model.

**Phase 2 free SQL.** It needs single-SELECT parsing, a table and column allowlist, a row limit and a timeout, on top of a read-only connection.

## 7. Security and data access

Rules are enforced in the server and the database layer, not by the prompt.

**Read-only (defense in depth)**
1. Agent connections use `analytics.connect()` (`mode=ro`).
2. No write tools. The model supplies tool arguments only.
3. If free SQL ships, add the guards from section 6.
4. CI tests try INSERT, UPDATE, DELETE, DROP and PRAGMA writes. All must fail.

**Authorization**
- The server checks the minimum role on every call from the session token the host passes.
- Staff controls (provider, keys, billing) are not MCP tools.

**Environments.** `AC_DATA_DIR` selects the data folder. The agent has no tool argument for it. Dev must resolve to a local path. Every response and audit record carries the environment name.

**Concurrency.** The capture job writes `snapshots.db` at `:07`, `:30` and `:50`. The database is already in WAL mode, so reads do not block the capture. Agent reads use `analytics.connect()`, a timeout and row limits.

**Audit and privacy.** Log per question: user, role, organization, environment, tools with arguments, row counts, latency, provider and tokens. Retention is to confirm. Provider keys are encrypted and never reach the model or the browser. Today the repo stores integration settings as plain JSON and has no key management, so the encryption method (environment key or KMS) is a Phase 0 decision. The LLM receives only the tool results needed. It also receives the user's question, which may be sensitive for the customer.

## 8. Experience

- A new dashboard section with a chat. The answer leads with the conclusion and the key number. A short table follows when there are more than two values.
- "Ver detalle" expands the full table, the date range and the assumptions. Depth is a personal setting, defaulting to short.
- "Cómo llegué a esto" shows the steps in plain Spanish. Tool names and arguments are translated through `labels.py`, or the raw trace is staff-only.
- The footer shows date range, freshness and environment. Add follow-up suggestions only if each adds a question the screen does not already show.
- Stream the answer, with a progress state while tools run. Export a table to CSV, copy the answer, thumbs up or down with an optional comment. Keep context within a session so "¿y la semana pasada?" works.

| Situation | Behavior |
| --- | --- |
| Data not available (for example, sales) | Say what is missing; do not estimate |
| Ambiguous ("los mejores cines") | Ask one question, or state the assumption |
| Request to change data | Explain that the agent only reads |
| Question in English | Answer in Spanish (v1) |
| No provider configured | Message directing staff to configure it |
| Tool error or timeout | Short apology and retry; never invent a result |

## 9. Requirements, evaluation, rollout, risks

**Non-functional.** Median under 10 s, p95 under 25 s. Structured tool errors. Row limit and timeout per tool. Per-user rate limit and a token budget per organization. Per-question trace (prompt, tools, result size, model, tokens, latency). Contract and security tests in CI.

**Evaluation.** A golden set of at least 50 Spanish questions, with at least 10 per category: the core questions with variations, ambiguous, out-of-scope (including sales) and write attempts. Expected answers come from a **frozen recorded capture** (`tests/fixtures/capture/` pattern), not the live dev database, which changes three times a day. Run it on every change to prompts, tools or provider. The gate is the section 2 targets.

**Rollout**
0. Foundations: add the descriptions to the catalog, check popcorn buckets in the delivery data, confirm the post-start measuring rule is equal in both chains (today Cinemex shows 6.6% sold and Cinépolis 12.3%), decide key encryption. Exit: catalog approved.
1. MCP server and tools, role and module checks, audit. Exit: contract and security tests pass.
2. AI Agent section, provider selection, feedback. Exit: golden set at target in dev.
3. Pilot with Cinemex analysts in prod for 4 weeks.
4. Free SQL, more tools, support agent.

**Risks**

| Risk | Mitigation |
| --- | --- |
| Confident wrong answers | Typed tools, numbers on every answer, trace panel, golden-set gate, thresholds from `findings.py` |
| Asked for data we do not have (box-office, seats outside CDMX, Cinemex theater prices) | Explicit refusal with the reason, tested in the eval |
| A measured gap read as a business fact (6.6% vs 12.3%) | Verify the rule is equal in both chains before launch; state "ocupación medida" in every answer |
| Prompt injection through data (for example, a cinema name) | Tool output treated as data, read-only tools, no outbound actions |
| User questions sent to third-party LLMs | Provider per organization, minimization, confirm contracts before the pilot |
| SQLite under agent load | Read-only connections, timeouts, limits; measure before the pilot |
| Cost runaway | Token budget and rate limits |

## 10. Assumptions and open questions

**Assumptions**
- The MCP client runs in the backend. The server is mounted in the existing FastAPI service. A spike confirms FastMCP's transport and auth.
- `snapshots.db` holds the data for the four use cases, with the limits in section 4.
- The pilot customer is Cinemex.

**Closed by this draft** (answered by the repo): week and window definitions, "competidor número 1", table names, tenancy and row scoping, SQLite journal mode.

**Open**
- *Data:* ship the popcorn use case on delivery prices only, or hold it until Cinemex theater prices exist? Outside CDMX, refuse, or add a showtimes proxy?
- *Scope:* free SQL in phase 2 or never? Which providers at launch? Are charts in v1? What is the support agent's audience and date? Absorb the narrative-summary plan?
- *Permissions:* can admin limit tools per organization? Are conversations stored, and who reads them? Do managers get the analyst role, or a new role?
- *Compliance:* do contracts allow sending user questions and tool results to third-party providers? Region or zero-retention needs? Retention for audit logs and feedback?
