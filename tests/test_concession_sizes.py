"""Tamaños de dulcería de Cinépolis: el tamaño del menú más los demás tamaños, cada uno con su precio."""
from scraper import config, sample


def _menu_item(product_id, structure="compound", category=config.CINEPOLIS_SIZES_CATEGORY):
    return {"product_id": product_id, "product_name": "Palomitas", "price_cents": 10700,
            "product_structure": structure, "category": category}


def test_cinepolis_sizes_joins_menu_size_and_modifiers(monkeypatch):
    calls = []

    products = {
        "18446": {"product": "18446", "productName": "Palomitas", "ingredientName": "Jumbo", "price": 10700,
                  "settings": [{"modifierList": [{"type": "size", "modifierProductList": ["19227", "18446"]},
                                                 {"type": "flavor", "modifierProductList": ["18448"]}]}]},
        "19227": {"product": "19227", "productName": "Chicas", "price": 8500},
    }

    def fake_batch(vista_id, product_ids, stats=None):
        calls.append(sorted(product_ids))
        return [products[p] for p in product_ids if p in products]

    monkeypatch.setattr(sample, "_batch_products", fake_batch)
    items = [_menu_item("18446"), _menu_item("1", structure="simple"), _menu_item("2", category="Bar")]
    sizes = sample.cinepolis_sizes(123, items)
    assert [(z["size_name"], z["price_cents"], z["is_menu_size"]) for z in sizes] == [("Jumbo", 10700, 1), ("Chicas", 8500, 0)]
    assert calls == [["18446"], ["18446", "19227"]]


def test_cinepolis_sizes_without_basket_products_makes_no_calls(monkeypatch):
    monkeypatch.setattr(sample, "_batch_products", lambda *a, **k: 1 / 0)
    assert sample.cinepolis_sizes(123, [_menu_item("1", structure="simple")]) == []
