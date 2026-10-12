"""Mapa de distribuidores: variantes de las cadenas, eventos, programas propios y errores de fuente."""
import csv

import pytest

from scraper import distributors


@pytest.mark.parametrize("raw, canonical", [
    ("Pramount Pictures", "Paramount"),
    ("Paramount Pictures", "Paramount"),
    ("The Walt Disney Company", "Disney"),
    ("Cinemex distribución", "Cinemex Distribución"),
    ("  Mubi  ", "MUBI"),
])
def test_variants_resolve_to_one_name(raw, canonical):
    assert distributors.distributor_key(raw) == canonical


@pytest.mark.parametrize("raw, kind", [
    ("Paramount Pictures", "distribuidor"),
    ("+QueCine", "programa_propio"),
    ("Cinemex Alternativo", "programa_propio"),
    ("Riot Games", "evento"),
    ("1h 40m", "error_fuente"),
    ("Estudio Nuevo", "sin_clasificar"),
])
def test_kind(raw, kind):
    assert distributors.distributor_kind(raw) == kind


def test_duration_in_distributor_field_is_no_distributor():
    # Una duración que el mapa no conoce también es error de fuente.
    assert distributors.distributor_key("2h 5m") is None
    assert distributors.distributor_kind("2h 5m") == "error_fuente"


def test_unknown_name_keeps_its_text_and_is_visible():
    assert distributors.distributor_key("Estudio   Nuevo ") == "Estudio Nuevo"


def test_empty_values_are_none():
    assert distributors.distributor_key(None) is None
    assert distributors.distributor_key("  ") is None
    assert distributors.distributor_kind(None) is None


def test_map_has_no_conflicting_rows():
    with open(distributors.MAP_PATH, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    seen = {}
    for r in rows:
        key = distributors._key(r["raw"])
        assert seen.get(key, (r["canonical"], r["kind"])) == (r["canonical"], r["kind"]), r["raw"]
        seen[key] = (r["canonical"], r["kind"])
        assert r["kind"] in {"distribuidor", "programa_propio", "evento", "error_fuente"}, r["raw"]
