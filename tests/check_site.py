"""Browser regression check. Run with: python tests/check_site.py (server on :8765)."""

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/"


def ready(page):
    page.locator("#main-content").wait_for(timeout=3000)
    assert page.locator(".boot-screen").count() == 0


def ratio_16_9(page, selector):
    page.locator(selector).first.wait_for()
    dimensions = page.locator(selector).evaluate_all(
        "nodes => nodes.map(n => [n.offsetWidth, n.offsetHeight])"
    )
    assert dimensions, selector
    assert all(
        w > 0 and h > 0 and abs((w / h) - (16 / 9)) < 0.03 for w, h in dimensions
    ), (selector, dimensions)


with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "?v=bs-sq&_=sq1#/brand/beautyscape")
    ready(page)
    assert page.locator(".product-card").count() == 13
    brands = page.evaluate("RAY_KNOWLEDGE.brands.map(b => b.slug)")
    products = page.evaluate(
        "RAY_KNOWLEDGE.brands.flatMap(b => b.products.map(p => p.id))"
    )
    for route in [
        "home",
        "brands",
        *["brand/" + b for b in brands],
        *["product/" + product for product in products],
        "brand/missing",
        "product/missing",
        "search?q=",
        "search?q=zzzzzz",
    ]:
        page.goto(BASE + "#/" + route)
        ready(page)
    print(
        f"PASS: home, catalog, {len(brands)} brands, {len(products)} products, missing IDs, empty/no-match search"
    )

    for width in [1280, 390, 320]:
        page.set_viewport_size({"width": width, "height": 900})
        page.goto(BASE + "#/brands")
        ready(page)
        ratio_16_9(page, ".brand-tile")
        page.locator('a[href="#/brand/beautyscape"]').first.click()
        assert page.locator(".brand-principle-line").count() == 0
        assert page.locator('[data-brand-tab="signature"]').count() == 0
        assert page.locator('[data-brand-tab="products"]').count() == 0
        has_signature = page.evaluate(
            "RAY_KNOWLEDGE.brands.find(b => b.slug === 'beautyscape').mainProfile.signatureIngredient != null"
        )
        assert page.locator(".signature-fact").count() == (1 if has_signature else 0)
        for tab in ["faq", "overview"]:
            button = page.locator(f'[data-brand-tab="{tab}"]')
            if button.count():
                button.click()
                assert button.get_attribute("aria-pressed") == "true"
        assert page.locator(".product-card").count() == 13
        ratio_16_9(page, ".product-card-media")
        page.locator(".product-card").first.click()
        ratio_16_9(page, ".detail-visual")
        assert page.locator('[data-product-tab="use"]').count() == 0
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (
            width
        )
        for tab in ["ingredients", "pairing", "faq", "info"]:
            page.locator(f'[data-product-tab="{tab}"]').click()
            assert (
                page.locator(f'[data-product-tab="{tab}"]').get_attribute(
                    "aria-pressed"
                )
                == "true"
            )
        page.reload()
        ready(page)
        ratio_16_9(page, ".detail-visual")
    page.goto(BASE + "#/admin/products")
    ready(page)
    assert page.locator('[data-adm-field="usage"]').count() == 0
    print(
        "PASS: navigation, reload, product tabs without usage, 16:9 media at 1280/390/320px"
    )

    for scenario in ["missing", "invalid", "offline", "slow", "valid"]:
        isolated = browser.new_context()
        probe = isolated.new_page()
        probe.on("pageerror", lambda error: errors.append(str(error)))
        pending = []

        def overrides(route):
            if scenario == "slow":
                pending.append(route)
            elif scenario == "offline":
                route.abort()
            elif scenario == "missing":
                route.fulfill(status=404, body="Not found")
            elif scenario == "invalid":
                route.fulfill(status=200, body="invalid json")
            else:
                route.fulfill(
                    json={
                        "brands": {
                            "beautyscape": {"profile": {"name": "Override test"}}
                        }
                    }
                )

        probe.route("**/assets/data-overrides.json*", overrides)
        probe.goto(BASE + "#/brand/beautyscape", wait_until="domcontentloaded")
        ready(probe)
        assert probe.locator(".product-card").count() == 13
        if scenario == "slow":
            probe.wait_for_timeout(5500)
            ready(probe)
            for route in pending:
                route.abort()
        if scenario == "valid":
            probe.get_by_role("heading", name="Override test", exact=True).wait_for()
        isolated.close()
    print("PASS: optional overrides missing, malformed, offline, stalled, and valid")
    assert not errors, errors
    print("PASS: no JavaScript exceptions")
    browser.close()
