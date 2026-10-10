"""Página principal: la cartelera en tres capas (hallazgos → evidencia → apéndice) con los filtros de zona, periodo y
franja horaria en la barra lateral. La dulcería vive en su propia página (views/dulceria.py)."""
from analytics.labels import (
    CARTELERA_CHART_TEXT as CT,
)
from analytics.labels import (
    CARTELERA_TEXT as T,
)
from analytics.labels import (
    EXCLUSIVE_LABEL,
    PERIOD_TEXT,
    PRESALE_OTHER_LABEL,
    PRESALE_TAG,
    PUBLICATION_LABEL,
    RED_RAMP_TEXT,
)
from ui.common import *  # noqa: F401,F403

# --- barra lateral: zona, periodo y franja ---------------------------------------------------------------
today_s = analytics.today()
today_d = date.fromisoformat(today_s)
if not config.DB_PATH.exists():
    # Recién desplegado: el scraper aún no ha creado la base. Aviso claro en lugar del traceback.
    now_hm = datetime.now(TZ).strftime("%H:%M")
    nxt = next((hm for hm in SNAPSHOT_TIMES if hm > now_hm), SNAPSHOT_TIMES[0])
    md(f'<div class="enc"><h1>{T["title"].format(plaza=esc(plaza_title(None)))}</h1></div>')
    st.info(T["no_db"].format(path=config.DB_PATH, times=", ".join(time_12(hm) for hm in SNAPSHOT_TIMES), next=time_12(nxt)))
    st.stop()
plaza = plaza_selector()
cov = load("coverage", plaza=plaza)
if cov.empty:
    st.info(T["no_shows"])
    st.stop()
this_w0, this_w1 = analytics.cinema_week(today_s)
next_w0, next_w1 = analytics.cinema_week((date.fromisoformat(this_w1) + timedelta(days=1)).isoformat())
next_state = PUBLICATION_LABEL.get(load_raw("week_publication", d0=next_w0, d1=next_w1, plaza=plaza), "")

periods = {
    PERIOD_TEXT["today"]: (today_s, today_s),
    PERIOD_TEXT["tomorrow"]: ((today_d + timedelta(days=1)).isoformat(),) * 2,
    PERIOD_TEXT["week"].format(d1=date_es(this_w1, with_year=False)): (today_s, this_w1),
    PERIOD_TEXT["next_week"].format(d0=date_es(next_w0, with_year=False), d1=date_es(next_w1, with_year=False),
                                    state=next_state): (next_w0, next_w1),
    PERIOD_TEXT["custom"]: None,
}
st.sidebar.header(PERIOD_TEXT["header"])
choice = st.sidebar.radio(PERIOD_TEXT["select"], list(periods), index=2, label_visibility="collapsed")
if periods[choice] is None:
    rng = st.sidebar.date_input(PERIOD_TEXT["custom_range"], value=(today_d, date.fromisoformat(this_w1)),
                                min_value=today_d - timedelta(days=1), max_value=today_d + timedelta(days=35),
                                format="DD/MM/YYYY")
    d0, d1 = (rng[0].isoformat(), rng[-1].isoformat()) if isinstance(rng, tuple) and rng else (today_s, today_s)
else:
    d0, d1 = periods[choice]
includes_today = d0 <= today_s <= d1

# Franja horaria: filtra por la hora de inicio de la función. Aplica a todo el tablero salvo al Resumen general,
# que muestra sus dos cortes lado a lado. Solo corta en los límites de las franjas, así ninguna queda partida.
st.sidebar.header(T["hours_header"])
preset = st.sidebar.radio(T["hours_header"], list(HOUR_PRESETS) + [T["hours_free"]], index=0, label_visibility="collapsed",
                          key="hours_preset")
if preset == T["hours_free"]:
    hours = st.sidebar.select_slider(T["hours_slider"], options=HOUR_MARKS, value=FULL_DAY, format_func=hour_mark,
                                     key="hours_range")
else:
    hours = HOUR_PRESETS[preset]
hours = tuple(hours)
full_day = analytics.is_full_day(hours)
if not full_day:
    st.sidebar.caption(T["hours_caption"].format(hours=hours_label(hours)))

st.sidebar.header(T["read_header"])
st.sidebar.markdown(T["read_body"] + (T["read_today"] if includes_today else ""))
with st.sidebar.expander(T["glossary_header"]):
    st.markdown("\n".join(f"- {item}" for item in T["glossary"]))
st.sidebar.caption(T["capture_caption"].format(times=", ".join(time_12(hm) for hm in SNAPSHOT_TIMES),
                                               refresh=T["refresh_caption"].format(ttl=TTL)))

# --- datos del encabezado ---------------------------------------------------------------------------------
capture = load_raw("capture_status", limit=12)
stale = [(CHAIN_LABEL.get(r["chain"], r["chain"]), r["age_min"], r["error"]) for r in capture if r["stale"]]
kp = load("kpis", d0=d0, d1=d1, hours=hours, plaza=plaza)
if kp.empty or len(kp) < 2:
    md(f'<div class="enc"><h1>{T["title"].format(plaza=esc(plaza_title(plaza)))}</h1></div>')
    st.info(T["no_board"].format(range=range_es(d0, d1)))
    st.stop()
K = kp.set_index("chain")
us, them = K.loc["cinemex"], K.loc["cinepolis"]
last_capture = min((datetime.fromisoformat(r["last_ok_at"]) for r in capture if r["last_ok_at"]), default=None)
nav = "".join(f'<a href="#capa{i}"><b>{i}</b>{esc(label)}</a>' for i, label in enumerate(T["nav"], 1))

md(f"""
<div class="enc">
  <h1>{T["title"].format(plaza=esc(plaza_title(plaza)))}</h1>
  <div class="meta">
    <span><strong>{T["meta_period"]}</strong> {esc(range_short(d0, d1))}</span>
    {"" if full_day else f"<span><strong>{T['meta_hours']}</strong> {esc(hours_label(hours))}</span>"}
    <span><strong>{int(us.cinemas)} + {int(them.cinemas)}</strong> {T["meta_cinemas"]}</span>
    <span><strong>{int(us.shows + them.shows):,}</strong> {T["meta_shows"]}</span>
    <span>{T["meta_capture"]} {esc(local_time(last_capture.isoformat())) if last_capture else "—"}</span>
  </div>
  <nav class="nav-capas">{nav}</nav>
</div>
""")
for name, age_min, err in stale:
    if age_min is None:
        st.warning(T["stale_none"].format(name=name))
    elif err:
        st.warning(T["stale_error"].format(name=name, age=f"{age_min:.0f}", error=err[:120]))
    else:
        st.warning(T["stale_old"].format(name=name, age=f"{age_min:.0f}"))

# ============ CAPA 1 ============
capa(1, T["layer1"], T["layer1_desc"], roja=True)
hallazgos = load_raw("findings", d0=d0, d1=d1, hours=hours, plaza=plaza)
if not hallazgos:
    st.info(T["no_findings"])
for f in hallazgos:
    hallazgo(f)
if any(f["topic"] == "dulceria" for f in hallazgos):
    st.page_link("views/dulceria.py", label=T["link_dulceria"], icon=":material/fastfood:")
if any(f["topic"] == "independientes" for f in hallazgos):
    st.page_link("views/independientes.py", label=INDEP_TEXT["link"], icon=":material/theaters:")

# ============ CAPA 2 ============
capa(2, T["layer2"], T["layer2_desc"])
concl = load_raw("conclusions", d0=d0, d1=d1, shown=SHOWN_MOVIES, total=TOTAL_MOVIES, hours=hours, plaza=plaza)

# --- Resumen general (formato del reporte diario del cliente) ------------------------------------------
with seccion("resumen"):
    pregunta(T["q_resumen"], concl.get("resumen", ""))
    # "Todo el día" y "Después de las 6 PM", lado a lado como en su reporte.
    tab_labels = list(HOUR_PRESETS)[:2]
    for tab, label in zip(st.tabs(tab_labels), tab_labels):
        with tab:
            gs = load("general_summary", d0=d0, d1=d1, hours=HOUR_PRESETS[label], plaza=plaza)
            if gs.empty:
                st.info(T["empty_period"])
                continue
            rows_ = []
            rank = 0
            for r in gs.itertuples():
                cls = "sum" if r.kind != "title" else ""
                rank += r.kind == "title"
                name = {"title": r.title, "rest": T["resumen_rest"], "total": T["resumen_total"]}[r.kind]

                def cell(txt, extra="", cls=cls):
                    return txt, " ".join(x for x in (extra, cls) if x)

                rows_.append([cell(str(rank) if r.kind == "title" else ""), cell(name),
                              cell(n(r.cinemas_cinemex) if r.kind != "rest" else "—", "cmx"), cell(n(r.shows_cinemex), "cmx"),
                              cell(f"{r.share_cinemex:.1f} %" if pd.notna(r.share_cinemex) else "—", "cmx"),
                              cell(n(r.cinemas_cinepolis) if r.kind != "rest" else "—", "cnp"), cell(n(r.shows_cinepolis), "cnp"),
                              cell(f"{r.share_cinepolis:.1f} %" if pd.notna(r.share_cinepolis) else "—", "cnp"),
                              cell(f"{int(r.diff_shows):+,d}".replace("-", "−")), cell(pp(r.diff_pp) if r.kind != "total" else ""),
                              cell(f"{r.ratio:.2f}" if pd.notna(r.ratio) else "—")])
            table(T["resumen_headers"], rows_, num_cols=range(2, 11))
    leerla("resumen", T["leer_resumen"])

# --- Películas: dumbbell -------------------------------------------------------------------------------
with seccion("peliculas"):
    show_all = st.session_state.get("all_movies", False)
    pregunta(T["q_peliculas"], concl.get("peliculas", ""), None if show_all else concl.get("peliculas_note"))
    top = load("movie_gaps", d0=d0, d1=d1, hours=hours, plaza=plaza, limit=TOTAL_MOVIES).head(TOTAL_MOVIES if show_all else SHOWN_MOVIES)
    order = top["title"].tolist()
    long = top.melt(id_vars=["title"], value_vars=["share_cinemex", "share_cinepolis"], var_name="chain", value_name="share")
    long["chain"] = long["chain"].str.replace("share_", "", regex=False)
    ti = top.set_index("title")
    long["shows"] = [ti.loc[t, f"shows_{c}"] for t, c in zip(long["title"], long["chain"])]
    long["cinemas"] = [ti.loc[t, f"cinemas_{c}"] for t, c in zip(long["title"], long["chain"])]
    long = long[long["shows"] > 0]
    long["Cadena"] = long["chain"].map(CHAIN_LABEL)
    top["delta"] = [EXCLUSIVE_LABEL.get(e) or pp(g) for e, g in zip(top["exclusive"], top["gap_pp"])]
    leyenda([("Cinemex", RED), ("Cinépolis", INK)])
    y_axis = alt.Y("title:N", sort=order, title=None, axis=alt.Axis(labelLimit=300, labelColor=GRAY_DARK, labelFontSize=12.5,
                                                                    ticks=False, domain=False, labelPadding=10))
    color = alt.Color("Cadena:N", scale=alt.Scale(domain=CHAIN_DOMAIN, range=CHAIN_RANGE), legend=None)
    rule = alt.Chart(long).mark_rule(strokeWidth=2, color=NEUTRAL).encode(
        y=y_axis, x=alt.X("min(share):Q", title=T["peliculas_axis"], axis=alt.Axis(grid=True, tickCount=6)),
        x2="max(share):Q")
    dots = alt.Chart(long).mark_circle(size=120, opacity=1).encode(
        y=y_axis, x="share:Q", color=color,
        tooltip=[alt.Tooltip("title:N", title="Película"), alt.Tooltip("Cadena:N"),
                 alt.Tooltip("share:Q", title="% de su programación", format=".1f"),
                 alt.Tooltip("shows:Q", title="Funciones"), alt.Tooltip("cinemas:Q", title="Cines")])
    delta = alt.Chart(top).mark_text(align="left", fontSize=12.5, fontWeight="bold").encode(
        y=alt.Y("title:N", sort=order, axis=None), x=alt.value(4), text="delta:N",
        color=alt.Color("leader:N", scale=alt.Scale(domain=["cinemex", "cinepolis"], range=[RED, GRAY_DARK]), legend=None),
        tooltip=[alt.Tooltip("title:N", title="Película"),
                 alt.Tooltip("share_cinemex:Q", title="% programación Cinemex", format=".1f"),
                 alt.Tooltip("share_cinepolis:Q", title="% programación Cinépolis", format=".1f"),
                 alt.Tooltip("gap_pp:Q", title="Δ pp (Cinemex − Cinépolis)", format="+.1f")]
    ).properties(width=110, height=alt.Step(24))
    chart(alt.hconcat((rule + dots).properties(width=620, height=alt.Step(24)), delta, spacing=6).resolve_scale(y="shared"))
    st.toggle(T["peliculas_all"].format(n=TOTAL_MOVIES), key="all_movies")
    leerla("peliculas", T["leer_peliculas"].format(total=TOTAL_MOVIES))

# --- Horarios: heatmap ---------------------------------------------------------------------------------
with seccion("horarios"):
    pregunta(T["q_horarios"], concl.get("franjas", ""))
    hm = load("heatmap_day_slot", d0=d0, d1=d1, hours=hours, plaza=plaza)
    if hm.empty:
        st.info(T["empty_period"])
    else:
        hm["Día"] = hm["weekday"].map(lambda i: WEEKDAY_LABEL[int(i)])
        hm["Franja"] = hm["slot"].map(SLOT_SHORT)
        hm["label"] = hm["gap_pp"].map(pp).str.replace(" pp", "")
        lim = max(1.0, float(hm["gap_pp"].abs().max()))
        days_present = [d for d in WEEKDAY_LABEL if d in set(hm["Día"])]
        base = alt.Chart(hm).encode(
            x=alt.X("Franja:N", sort=[SLOT_SHORT[k] for k, lo, hi, _ in SLOTS if lo >= hours[0] and hi <= hours[1]], title=None,
                    axis=alt.Axis(labelAngle=0, orient="top", labelFontSize=12, ticks=False, domain=False, labelPadding=6, labelOverlap=False, labelLimit=0)),
            y=alt.Y("Día:N", sort=days_present, title=None,
                    axis=alt.Axis(ticks=False, domain=False, labelFontSize=13, labelFontWeight="bold", labelColor=INK, labelPadding=10)))
        cells = base.mark_rect(stroke=PAPER, strokeWidth=4, cornerRadius=4).encode(
            color=alt.Color("gap_pp:Q", scale=alt.Scale(domain=[-lim, -lim / 2, 0, lim / 2, lim], range=DIVERGING, interpolate="lab"),
                            legend=None),
            tooltip=[alt.Tooltip("Día:N"), alt.Tooltip("Franja:N"),
                     alt.Tooltip("share_cinemex:Q", title="% parrilla Cinemex", format=".1f"),
                     alt.Tooltip("share_cinepolis:Q", title="% parrilla Cinépolis", format=".1f"),
                     alt.Tooltip("gap_pp:Q", title="Δ pp", format="+.1f"),
                     alt.Tooltip("shows_cinemex:Q", title="Funciones Cinemex"), alt.Tooltip("shows_cinepolis:Q", title="Funciones Cinépolis")])
        text = base.mark_text(fontSize=13.5, fontWeight="bold").encode(
            text="label:N", color=alt.condition(f"abs(datum.gap_pp) > {lim * 0.5}", alt.value(PAPER), alt.value(INK)))
        chart((cells + text).properties(height=alt.Step(46), width=alt.Step(134)), width="content")
    leerla("horarios", T["leer_horarios"])

# --- Formatos e idioma: barras -------------------------------------------------------------------------
with seccion("formatos"):
    pregunta(T["q_formatos"], concl.get("formatos", ""))
    mx = load("mix", d0=d0, d1=d1, hours=hours, plaza=plaza)
    if not mx.empty:
        mx["Cadena"] = mx["chain"].map(CHAIN_LABEL)
        m1, m2 = st.columns([3, 2])
        for col, dim, buckets, label_map, palette in ((m1, "format", FORMAT_BUCKETS, FORMAT_LABEL, RED_RAMP),
                                                      (m2, "language", LANGUAGE_BUCKETS, LANGUAGE_LABEL, [RED_RAMP[1], RED_RAMP[3]])):
            sub = mx[mx.dimension == dim].copy()
            sub["Grupo"] = sub["bucket"].map(label_map)
            sub["orden"] = sub["bucket"].map({b: i for i, b in enumerate(buckets)})
            sub["label"] = sub["share"].map(lambda v: f"{v:.0f} %" if v >= 7 else "")
            # Tonos claros: texto oscuro.
            sub["light"] = sub["orden"] >= (2 if dim == "format" else 1)
            domain = [label_map[b] for b in buckets]
            with col:
                leyenda(list(zip(domain, palette)), square=True)
                bars = alt.Chart(sub).mark_bar(cornerRadius=0, stroke=PAPER, strokeWidth=1.5, height=26).encode(
                    y=alt.Y("Cadena:N", sort=CHAIN_DOMAIN, title=None,
                            axis=alt.Axis(ticks=False, domain=False, labelFontSize=13, labelFontWeight="bold", labelPadding=10,
                                          labelColor=alt.condition("datum.value == 'Cinemex'", alt.value(RED), alt.value(INK)))),
                    x=alt.X("share:Q", stack="normalize", title=None, axis=None),
                    order=alt.Order("orden:Q"),
                    color=alt.Color("Grupo:N", scale=alt.Scale(domain=domain, range=palette[:len(domain)]), legend=None),
                    tooltip=[alt.Tooltip("Cadena:N"), alt.Tooltip("Grupo:N"),
                             alt.Tooltip("share:Q", title="% de su programación", format=".1f"), alt.Tooltip("shows:Q", title="Funciones")])
                labels = alt.Chart(sub).mark_text(fontSize=11.5, fontWeight="bold").encode(
                    y=alt.Y("Cadena:N", sort=CHAIN_DOMAIN), x=alt.X("share:Q", stack="normalize", bandPosition=0.5),
                    order=alt.Order("orden:Q"), text="label:N", detail="Grupo:N",
                    color=alt.condition("datum.light", alt.value(RED_RAMP_TEXT), alt.value(PAPER)))
                chart((bars + labels).properties(height=90))
    leerla("formatos", T["leer_formatos"])

# --- Preventa: nuestras funciones en preventa (panel diario del plano público) -----------------------------
with seccion("preventa"):
    pregunta(T["q_preventa"], concl.get("preventa", ""))
    pv = load("presale_compare", plaza=plaza)
    if pv.empty:
        st.info(T["preventa_empty"])
    else:
        long = load("presale_by_chain", plaza=plaza)
        long["Título"] = long["title"].map(lambda t: t if len(t) <= 42 else t[:41].rstrip() + "…")
        long["Cadena"] = long["chain"].map(CHAIN_LABEL)
        long["Estreno"] = long["release_date"].map(lambda d: date_es(d, with_year=False) if isinstance(d, str) else CT["presale_no_release"])
        long["Vendido"] = long["sold_pct"].map(lambda v: CT["percent"].format(value=f"{v:.0f}"))
        long["Butacas"] = long.apply(lambda r: CT["presale_seats_value"].format(sold=f"{int(r.sold):,}", seats=f"{int(r.seats):,}"), axis=1)
        long["Ritmo"] = long["pace_pct_day"].map(lambda v: CT["presale_pace_value"].format(pace=f"{v:+.1f}".replace("-", "−")) if pd.notna(v)
                                         else CT["presale_pace_pending"])
        other = {"cinemex": CHAIN_LABEL["cinepolis"], "cinepolis": CHAIN_LABEL["cinemex"]}
        long["En la otra cadena"] = [PRESALE_OTHER_LABEL[k].format(other=other[c]) for k, c in zip(long["in_other_chain"], long["chain"])]
        long["Etiqueta"] = [CT["presale_tagged"].format(sold=v, tag=PRESALE_TAG[k]) if k in PRESALE_TAG else v
                            for v, k in zip(long["Vendido"], long["in_other_chain"])]
        tooltip = [alt.Tooltip("title:N", title=CT["presale_title"]), alt.Tooltip("Cadena:N", title=CT["chain"]),
                   alt.Tooltip("Estreno:N", title=CT["presale_release"]),
                   alt.Tooltip("shows:Q", title=CT["presale_shows"]), alt.Tooltip("Butacas:N", title=CT["presale_seats"]),
                   alt.Tooltip("Vendido:N", title=CT["presale_sold"]), alt.Tooltip("Ritmo:N", title=CT["presale_pace"]),
                   alt.Tooltip("En la otra cadena:N", title=CT["presale_other"])]
        x = alt.X("sold_pct:Q", title=CT["presale_axis"], scale=alt.Scale(domain=[0, 100]),
                  axis=alt.Axis(grid=True, values=[0, 25, 50, 75, 100], labelExpr="datum.value + ' %'"))
        color = alt.Color("Cadena:N", scale=alt.Scale(domain=CHAIN_DOMAIN, range=CHAIN_RANGE), legend=None)

        def presale_bars(data, paired):
            order = data.sort_values("sold_pct", ascending=False)["Título"].drop_duplicates().tolist()
            y = alt.Y("Título:N", sort=order, title=None, axis=alt.Axis(labelLimit=320, labelColor=GRAY_DARK, ticks=False, domain=False))
            enc = {"y": y, "x": x, "color": color, "tooltip": tooltip}
            if paired:
                enc["yOffset"] = alt.YOffset("Cadena:N", sort=CHAIN_DOMAIN)
            bars = alt.Chart(data).mark_bar(height=11 if paired else 16).encode(**enc)
            text = alt.Chart(data).mark_text(align="left", dx=4, fontSize=11, fontWeight="bold").encode(
                **{k: v for k, v in enc.items() if k != "x"}, x="sold_pct:Q", text="Etiqueta:N")
            chart((bars + text).properties(height=max(90, (34 if paired else 26) * len(order))))

        leyenda([("Cinemex", RED), ("Cinépolis", INK)])
        both = long[long["status"] == "ambas"]
        if not both.empty:
            md(f'<p class="nota">{T["preventa_both"]}</p>')
            presale_bars(both, paired=True)
        single = long[long["status"] != "ambas"]
        if not single.empty:
            md(f'<p class="nota">{T["preventa_single"]}</p>')
            presale_bars(single, paired=False)
        pick = st.selectbox(T["curve_pick"], pv["title"].tolist(), key="preventa_titulo")
        row = pv.set_index("title").loc[pick]
        curves = [load("presale_curve", title_norm=row[f"title_norm_{c}"], chain=c, plaza=plaza).assign(Cadena=CHAIN_LABEL[c])
                  for c in CHAINS if isinstance(row[f"title_norm_{c}"], str)]
        curve = pd.concat(curves, ignore_index=True) if curves else pd.DataFrame()
        if len(curve) > 1:
            line = alt.Chart(curve).mark_line(point=alt.OverlayMarkDef(size=40)).encode(
                x=alt.X("days_to_start:Q", title=CT["curve_x"], scale=alt.Scale(reverse=True)),
                y=alt.Y("sold_pct:Q", title=CT["curve_y"], scale=alt.Scale(domain=[0, 100]),
                        axis=alt.Axis(values=[0, 25, 50, 75, 100], labelExpr="datum.value + ' %'")),
                color=color,
                tooltip=[alt.Tooltip("Cadena:N", title=CT["chain"]), alt.Tooltip("days_to_start:Q", title=CT["curve_days"]),
                         alt.Tooltip("readings:Q", title=CT["curve_readings"]), alt.Tooltip("sold_pct:Q", title=CT["curve_sold"], format=".1f")])
            chart(line.properties(height=220))
        else:
            st.caption(T["curve_pending"])
    leerla("preventa", T["leer_preventa"])

# ============ CAPA 3 ============
capa(3, T["layer3"], T["layer3_desc"])

# --- Indicadores del periodo (el antiguo KPI strip) --------------------------------------------------
offered = load("offered_seats", d0=d0, d1=d1, hours=hours, plaza=plaza).set_index("chain")
cc = load("concentration", d0=d0, d1=d1, hours=hours, plaza=plaza).set_index("chain")
cm = offered.loc["cinemex"] if "cinemex" in offered.index else None
cp = offered.loc["cinepolis"] if "cinepolis" in offered.index else None
with_seats = cm is not None and cp is not None and has(cm.seats_offered) and has(cp.seats_offered)
resumen = T["kpis_summary"].format(us=f"{us.shows_per_cinema:.1f}", them=f"{them.shows_per_cinema:.1f}")
if with_seats:
    resumen += T["kpis_summary_seats"].format(us=f"{int(cm.seats_offered):,}", them=f"{int(cp.seats_offered):,}")
KPI = T["kpi"]
with apendice("kpis", T["kpis_title"], resumen):
    weekend = bool(us.weekend_shows and them.weekend_shows)
    rows = [
        [KPI["shows_per_cinema"], n(us.shows_per_cinema, 1), n(them.shows_per_cinema, 1),
         f"{100.0 * (us.shows_per_cinema - them.shows_per_cinema) / them.shows_per_cinema:+.1f} %".replace("-", "−")],
        [KPI["shows"], n(us.shows), n(them.shows), ""],
        [KPI["cinemas"], n(us.cinemas), n(them.cinemas), ""],
        *([[KPI["prime"], f"{us.pct_prime:.1f} %", f"{them.pct_prime:.1f} %", pp(us.pct_prime - them.pct_prime)]
           if weekend else
           [KPI["evening"], f"{us.pct_evening:.1f} %", f"{them.pct_evening:.1f} %", pp(us.pct_evening - them.pct_evening)]]
          if full_day else []),
        [KPI["subtitled"], f"{us.pct_subtitled:.1f} %", f"{them.pct_subtitled:.1f} %", pp(us.pct_subtitled - them.pct_subtitled)],
        [KPI["movies"], n(us.movies), n(them.movies), f"{int(us.movies - them.movies):+d}".replace("-", "−")],
    ]
    if with_seats:
        rows += [[KPI["seats_offered"], n(cm.seats_offered), n(cp.seats_offered),
                  f"{100.0 * (cm.seats_offered - cp.seats_offered) / cp.seats_offered:+.1f} %".replace("-", "−")],
                 [KPI["seats_per_show"], n(cm.avg_seats_per_show), n(cp.avg_seats_per_show), ""]]
    if "cinemex" in cc.index and "cinepolis" in cc.index:
        rows += [[KPI["top3"], f"{cc.loc['cinemex'].top3_pct:.1f} %", f"{cc.loc['cinepolis'].top3_pct:.1f} %",
                  pp(cc.loc["cinemex"].top3_pct - cc.loc["cinepolis"].top3_pct)],
                 [KPI["hhi"], n(cc.loc["cinemex"].hhi), n(cc.loc["cinepolis"].hhi), ""],
                 [KPI["titles_per_cinema"], n(cc.loc["cinemex"].titles_per_cinema, 1), n(cc.loc["cinepolis"].titles_per_cinema, 1), ""]]
    table(T["kpis_headers"], [[r[0], (r[1], "cmx"), (r[2], "cnp"), r[3]] for r in rows], num_cols=(1, 2, 3))
    md(f'<p class="nota">{T["kpis_note"]}</p>')

# --- Cambios en la cartelera publicada -----------------------------------------------------------------
# Los cambios del competidor valen como comportamiento semanal, no como alerta: Cinemex programa por semana de cine.
# La ocupación es una medida, no un cambio de cartelera.
CARTELERA_KINDS = [k for k in KINDS if k != "availability"]
by_kind = load("events_by_kind", since_hours=24 * 7, plaza=plaza)
ev = {(r.chain, r.kind): int(r.n) for r in by_kind.itertuples()} if not by_kind.empty else {}
g = lambda c, k: ev.get((c, k), 0)  # noqa: E731
resumen = (T["cambios_summary"].format(us_removed=f"{g('cinemex', 'removed'):,}", them_removed=f"{g('cinepolis', 'removed'):,}",
                                       us_moved=f"{g('cinemex', 'moved'):,}", them_moved=f"{g('cinepolis', 'moved'):,}")
           if ev else T["cambios_none"])
with apendice("cambios", T["cambios_title"], resumen):
    if ev:
        table(T["cambios_headers"],
              [[(CHAIN_LABEL[c], "cmx" if c == "cinemex" else "cnp")] + [f"{g(c, k):,}" for k in CARTELERA_KINDS] for c in CHAINS],
              num_cols=(1, 2, 3, 4))
    md(f'<p class="nota">{T["cambios_note_lead"]} ' + " ".join(f"<b>{KIND_LABEL[k]}.</b> {KIND_HELP[k]}" for k in CARTELERA_KINDS) +
       f' {T["cambios_note_tail"]}</p>')
    kinds = st.multiselect(T["cambios_log"], CARTELERA_KINDS, default=CARTELERA_KINDS, format_func=lambda k: KIND_LABEL[k])
    events = load("recent_events", limit=300, kinds=kinds or None, plaza=plaza)
    if events.empty:
        st.info(T["cambios_empty"])
    else:
        st.dataframe(pretty(events.drop(columns=["show_id", "date"])), width="stretch", hide_index=True, height=360)

# --- Precios ---------------------------------------------------------------------------------------------
pr = load("prices", plaza=plaza)
if not pr.empty:
    P = {(r.chain, r.format_bucket, r.day_type): r.median_price for r in pr.itertuples()}

    def par(b, d):
        a, c = P.get(("cinemex", b, d)), P.get(("cinepolis", b, d))
        return (T["precios_pair"].format(format=FORMAT_LABEL[b], day=DAY_TYPE_LABEL[d].lower(), us=f"{a:,.0f}", them=f"{c:,.0f}")
                if a and c else None)
    bits = [x for x in (par("traditional", "promo"), par("premium", "weekend")) if x]
    ps = load_raw("price_summary", plaza=plaza)
    if ps["markup_min_pct"] is not None:
        bits.insert(0, T["precios_markup"].format(min=f"{ps['markup_min_pct']:.0f}", max=f"{ps['markup_max_pct']:.0f}"))
    with apendice("precios", T["precios_title"], " · ".join(bits)):
        rows = []
        for b in FORMAT_BUCKETS:
            for d in ("weekday", "promo", "weekend"):
                a, c = P.get(("cinemex", b, d)), P.get(("cinepolis", b, d))
                if a is None and c is None:
                    continue
                delta = f"{100.0 * (c - a) / a:+.0f} %".replace("-", "−") if a and c else ""
                rows.append([FORMAT_LABEL[b], DAY_TYPE_LABEL[d], (f"${a:,.0f}" if a else "—", "cmx"), (f"${c:,.0f}" if c else "—", "cnp"), delta])
        table(T["precios_headers"], rows, num_cols=(2, 3, 4))
        cinemas = ", ".join(T["precios_cinemas"].format(chain=CHAIN_LABEL[c], n=int(v)) for c, v in sorted(ps["cinemas"].items()))
        md(f'<p class="nota">{T["precios_note"].format(cinemas=cinemas)}</p>')
        st.dataframe(pretty(pr[["chain", "format_bucket", "day_type", "samples", "cinemas", "median_price", "min_price", "max_price"]]),
                     width="stretch", hide_index=True)

# --- Salas y butacas por complejo -------------------------------------------------------------------
cap = load("capacity_summary", plaza=plaza)
if not cap.empty:
    C = cap.set_index("chain")
    resumen = " · ".join(T["butacas_summary"].format(chain=CHAIN_LABEL[c], screens=int(r.screens), seats=f"{int(r.seats):,}",
                                                     avg=int(r.avg_seats))
                         for c, r in C.iterrows())
    with apendice("butacas", T["butacas_title"], resumen):
        table(T["butacas_headers"],
              [[(CHAIN_LABEL[c], "cmx" if c == "cinemex" else "cnp"), n(r.cinemas), n(r.screens), n(r.seats), n(r.avg_seats),
                n(r.min_seats), n(r.max_seats), n(r.small)] for c, r in C.iterrows()], num_cols=range(1, 8))
        md(f'<p class="nota">{T["butacas_note"]}</p>')
        chain_sel = st.radio(T["chain"], CHAINS, format_func=lambda c: CHAIN_LABEL[c], horizontal=True, key="cap_chain")
        c1, c2 = st.columns([3, 2])
        bt = load("offered_by_title", d0=d0, d1=d1, limit=TOTAL_MOVIES, chain=chain_sel, hours=hours, plaza=plaza)
        with c1:
            st.markdown(f"**{SEATS_CHART_TEXT['title'].format(chain=CHAIN_LABEL[chain_sel])}**")
            if bt.empty:
                st.info(T["butacas_empty"])
            else:
                bt["title"] = bt["title"].str.strip()
                longb = bt.melt(id_vars=["title", "shows", "seats", "avg_seats"], value_vars=["share_shows", "share_seats"],
                                var_name="medida", value_name="share")
                longb["Medida"] = longb["medida"].map(COLUMN_LABEL)
                measures = [COLUMN_LABEL["share_shows"], COLUMN_LABEL["share_seats"]]
                orderb = bt["title"].tolist()
                yb = alt.Y("title:N", sort=orderb, title=None, axis=alt.Axis(labelLimit=260, labelColor=GRAY_DARK, ticks=False, domain=False))
                ruleb = alt.Chart(longb).mark_rule(strokeWidth=2, color=NEUTRAL).encode(
                    y=yb, x=alt.X("min(share):Q", title=SEATS_CHART_TEXT["axis"].format(chain=CHAIN_LABEL[chain_sel])), x2="max(share):Q")
                dotsb = alt.Chart(longb).mark_point(size=110, filled=True, opacity=1).encode(
                    y=yb, x="share:Q",
                    shape=alt.Shape("Medida:N", scale=alt.Scale(domain=measures, range=["circle", "square"]),
                                    legend=alt.Legend(orient="top", title=None)),
                    color=alt.Color("Medida:N", scale=alt.Scale(domain=measures, range=[NEUTRAL, CHAIN_COLOR[chain_sel]]),
                                    legend=alt.Legend(orient="top", title=None)),
                    tooltip=[alt.Tooltip("title:N", title=COLUMN_LABEL["title"]), alt.Tooltip("Medida:N", title=SEATS_CHART_TEXT["measure"]),
                             alt.Tooltip("share:Q", title=SEATS_CHART_TEXT["share"], format=".1f"), alt.Tooltip("shows:Q", title=COLUMN_LABEL["shows"]),
                             alt.Tooltip("seats:Q", title=COLUMN_LABEL["seats"], format=","), alt.Tooltip("avg_seats:Q", title=COLUMN_LABEL["avg_seats"])])
                chart((ruleb + dotsb).properties(height=alt.Step(24)))
                md(f'<p class="nota">{T["butacas_chart_note"]}</p>')
        with c2:
            st.markdown(f"**{T['butacas_title']}**")
            bc = load("capacity_by_cinema", chain=chain_sel, plaza=plaza)
            st.dataframe(pretty(bc[["cinema_name", "screens", "seats", "avg_seats", "min_seats", "max_seats"]]),
                         width="stretch", hide_index=True, height=420)

# --- Historial de una función y cartelera tal como estaba ------------------------------------------------
with apendice("historia", T["historia_title"], T["historia_summary"].format(date=date_es(FIRST_SNAPSHOT.isoformat()))):
    md(f'<p class="nota" style="margin-top:0">{T["historia_lead"]}</p>')
    h1, h2, h3, h4 = st.columns([1, 2, 1.4, 1])
    chain_h = h1.selectbox(T["chain"], CHAINS, format_func=lambda c: CHAIN_LABEL[c], key="h_chain")
    cins = load("cinemas", chain=chain_h, plaza=plaza)
    cine_h = h2.selectbox(T["cinema"], cins.cinema_id.tolist(), format_func=dict(zip(cins.cinema_id, cins.cinema_name)).get, key="h_cine")
    dates_h = load("dates_known", chain=chain_h, cinema_id=cine_h).date.tolist()
    fecha_h = h3.selectbox(T["date"], dates_h, index=dates_h.index(today_s) if today_s in dates_h else max(len(dates_h) - 1, 0),
                           format_func=lambda d: date_es(d, with_year=False), key="h_date")
    fo = load("functions_on", chain=chain_h, cinema_id=cine_h, date=fecha_h)
    if fo.empty:
        st.info(T["no_functions"])
    else:
        screens = sorted(fo.screen.dropna().unique(), key=lambda x: (len(str(x)), str(x)))
        sala_h = h4.selectbox(T["screen"], [T["all_screens"]] + list(screens), key="h_screen")
        sub = fo if sala_h == T["all_screens"] else fo[fo.screen == sala_h]
        status = T["functions_status"].format(current=int((sub.status == "current").sum()), removed=int((sub.status == "removed").sum()),
                                              expired=int((sub.status == "expired").sum()))
        st.markdown(f"**{T['functions_count'].format(n=len(sub))}** {status}")
        st.dataframe(pretty(sub[["datetime_local", "screen", "movie_title", "language", "format", "status", "first_seen"]]),
                     width="stretch", hide_index=True, height=min(400, 38 * (len(sub) + 1)))
        opciones = {r.show_id: T["function_option"].format(time=time_12(r.datetime_local[11:16]), screen=r.screen, title=r.movie_title)
                    for r in sub.itertuples()}
        show_h = st.selectbox(T["function"], list(opciones), format_func=opciones.get, key="h_show")
        tl = load_raw("showtime_timeline", chain=chain_h, show_id=show_h, date=fecha_h)
        st.markdown(f"**{T['timeline']}**")
        if not tl:
            st.info(T["timeline_empty"])
        else:
            def cambio(ch):
                fmt = (lambda v: time_12(v[11:16]) if isinstance(v, str) and len(v) >= 16 else (v or "—")) if ch["field"] == "datetime_local" else (lambda v: v or "—")
                return T["timeline_change"].format(field=FIELD_LABEL.get(ch["field"], ch["field"]), before=fmt(ch["before"]), after=fmt(ch["after"]))
            table(T["timeline_headers"],
                  [[local_time(e["detected_at"]), KIND_LABEL.get(e["kind"], e["kind"]), "; ".join(cambio(ch) for ch in e["changes"])] for e in tl])
        first = tl[0]["detected_at"] if tl else FIRST_SNAPSHOT.isoformat()
        snaps = load("snapshot_times", chain=chain_h, since=first, until=datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds"))
        st.markdown(f"**{T['board_title']}**")
        if len(snaps) < 2:
            st.info(T["board_few"])
        else:
            opts = snaps.taken_at.tolist()
            as_of = st.select_slider(T["board_capture"], options=opts, value=opts[-1], format_func=local_time, key="h_asof")
            board = load("board_as_of", chain=chain_h, cinema_id=cine_h, date=fecha_h, as_of=as_of)
            if sala_h != T["all_screens"]:
                board = board[board.screen == sala_h]
            if board.empty:
                st.info(T["board_empty"])
            else:
                board["changes"] = board["changed_fields"].map(lambda fs: ", ".join(FIELD_LABEL.get(f, f) for f in fs) if isinstance(fs, list) else "")
                st.dataframe(pretty(board[["datetime_local", "screen", "movie_title", "language", "format", "availability", "vs_now", "changes"]]),
                             width="stretch", hide_index=True, height=min(400, 38 * (len(board) + 1)))
                md(f'<p class="nota">{T["board_note"]}</p>')

# --- Ocupación muestreada -----------------------------------------------------------------------------
occ = load("occupancy_summary", plaza=plaza)
cal = load("semaphore_calibration", chain="cinemex")
occ_total = load_raw("occupancy_total", plaza=plaza)[0]
n_samples, weighted, levels = occ_total["samples"], occ_total["sold_pct"], occ_total["levels"]
resumen = T["ocupacion_summary"].format(
    n=n_samples, pct=f"{weighted:.1f}",
    levels=T["ocupacion_levels"].format(levels=levels) if levels else T["ocupacion_no_levels"],
    calibrated=T["ocupacion_calibrated"] if not cal.empty else T["ocupacion_uncalibrated"])
with apendice("ocupacion", T["ocupacion_title"], resumen):
    if n_samples == 0:
        st.info(T["ocupacion_empty"])
    else:
        st.markdown(T["ocupacion_cinepolis"].format(n=n_samples, pct=f"{weighted:.1f}"))
        st.dataframe(pretty(occ[["availability", "samples", "avg_sold_pct", "min_sold_pct", "max_sold_pct"]]), width="stretch", hide_index=True)
    if cal.empty:
        st.markdown(T["ocupacion_cinemex_pending"])
    else:
        est = load("estimated_occupancy", d0=d0, d1=d1, chain="cinemex", hours=hours, plaza=plaza)
        if not est.empty and has(est.iloc[0].seats_occupied_est):
            e = est.iloc[0]
            st.markdown(T["ocupacion_cinemex"].format(occupied=f"{int(e.seats_occupied_est):,}", offered=f"{int(e.seats_offered):,}",
                                                      pct=f"{e.occupancy_pct_est:.1f}", estimated=f"{int(e.shows_estimated):,}",
                                                      shows=f"{int(e.shows):,}"))
        st.dataframe(pretty(cal.rename(columns={"level": "availability"})[["availability", "samples", "sold_pct", "min_sold_pct", "max_sold_pct"]]),
                     width="stretch", hide_index=True)
    if n_samples:
        st.markdown(f"**{T['ocupacion_recent']}**")
        st.dataframe(pretty(load("occupancy_recent", limit=30, plaza=plaza)), width="stretch", hide_index=True, height=300)
    md(f'<p class="nota">{T["ocupacion_note"]}</p>')

hours_filter = "" if full_day else T["footer_filter"].format(hours=esc(hours_label(hours)))
md(f'<p class="pie">{T["footer"].format(filter=hours_filter, date=esc(date_es(FIRST_SNAPSHOT.isoformat())))}</p>')
