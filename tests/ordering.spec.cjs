const { test, expect } = require("@playwright/test");

const foods = [
    { id: 1, food_name: "Classic Burger", price: "120.50" },
    { id: 2, food_name: "Margherita Pizza", price: 245 },
    { id: 3, food_name: "Chicken Rice", price: 150 },
    { id: 4, food_name: "Fresh Salad", price: 99 },
    { id: 5, food_name: "Spaghetti", price: 130 },
    { id: 6, food_name: "Iced Tea", price: 45 }
];

async function mockBackend(page, options = {}) {
    // Replace the SDK before application startup; no real database writes occur.
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: options.missingSDK ? "/* SDK unavailable */" : `
            window.testBackend = { foods: ${JSON.stringify(options.foods || foods)}, reads: 0, orders: [], failRead: ${Boolean(options.failRead)}, failOrder: ${Boolean(options.failOrder)} };
            window.supabase = { createClient() { return { from(table) {
                if (table === 'foods') return { select() { return { async order() {
                    window.testBackend.reads++;
                    if (window.testBackend.failRead) return { data: null, error: { message: 'Mock read failure' } };
                    return { data: window.testBackend.foods, error: null };
                } }; } };
                if (table === 'orders') return { async insert(payload) {
                    window.testBackend.orders.push(payload);
                    await new Promise(resolve => {
                        if (${Boolean(options.holdOrder)}) window.testBackend.finishOrder = resolve;
                        else setTimeout(resolve, 150);
                    });
                    return { error: window.testBackend.failOrder ? { message: 'Mock order failure' } : null };
                } };
                throw new Error('Unexpected table: ' + table);
            } }; } };
        `
    }));
    // Tests must never reach the production API, even if the mock is broken.
    await page.route("**/*.supabase.co/**", route => route.abort());
    await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
    await page.goto("/");
}

test("menu, card selection, dropdown, search, and totals stay in sync", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await mockBackend(page);
    await expect(page.locator(".food-card")).toHaveCount(6);
    await expect(page.locator("#placeOrderBtn")).toBeDisabled();
    await page.getByRole("button", { name: /Classic Burger.*select meal/ }).click();
    await expect(page.locator("#foodSelect")).toHaveValue("1");
    await expect(page.locator("#total")).toHaveText("₱120.50");
    await expect(page.locator(".is-selected")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator("#total")).toHaveText("₱241.00");
    await expect(page.locator("#orderCount")).toHaveText("2");
    await page.locator("#foodSelect").selectOption("2");
    await expect(page.locator("#total")).toHaveText("₱490.00");
    await page.locator("#foodSearch").fill("burger");
    await expect(page.locator(".food-card")).toHaveCount(1);
    await expect(page.locator("#foodSelect")).toHaveValue("2");
    await page.locator("#foodSearch").fill("not a meal");
    await expect(page.locator("#menuStatus")).toContainText("No meals match");
    await page.locator("#foodSearch").fill("");
    await expect(page.locator(".food-card.is-selected")).toHaveCount(1);
    expect(errors).toEqual([]);
});

test("successful order submits the original schema once and resets the form", async ({ page }) => {
    await mockBackend(page, { holdOrder: true });
    await page.locator("#customerName").fill("  Alex Cruz  ");
    await page.locator("#foodSelect").selectOption("1");
    await page.locator("#quantity").fill("3");
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#orderForm")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#orderFields")).toHaveAttribute("disabled", "");
    await expect(page.locator("#customerName")).toBeDisabled();
    await expect(page.locator(".food-card").first()).toBeDisabled();
    await page.locator("#orderForm").dispatchEvent("submit");
    await page.evaluate(() => window.testBackend.finishOrder());
    await expect(page.locator("#message")).toHaveClass("success");
    const orders = await page.evaluate(() => window.testBackend.orders);
    expect(orders).toEqual([[{ customer_name: "Alex Cruz", food_id: 1, quantity: 3, price: 120.5 }]]);
    await expect(page.locator("#customerName")).toHaveValue("");
    await expect(page.locator("#foodSelect")).toHaveValue("");
    await expect(page.locator("#quantity")).toHaveValue("1");
    await expect(page.locator("#total")).toHaveText("₱0.00");
    await expect(page.locator("#placeOrderBtn")).toBeDisabled();
    await expect(page.locator(".food-card.is-selected")).toHaveCount(0);
});

test("failed order keeps customer details and can be retried", async ({ page }) => {
    await mockBackend(page, { failOrder: true });
    await page.locator("#customerName").fill("Jamie");
    await page.locator("#foodSelect").selectOption("2");
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#message")).toHaveClass("error");
    await expect(page.locator("#customerName")).toHaveValue("Jamie");
    await expect(page.locator("#foodSelect")).toHaveValue("2");
    await expect(page.locator("#placeOrderBtn")).toBeEnabled();
    await page.evaluate(() => { window.testBackend.failOrder = false; });
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#message")).toHaveClass("success");
});

test("invalid quantities and blank names never submit an order", async ({ page }) => {
    await mockBackend(page);
    await page.locator("#foodSelect").selectOption("1");
    await page.locator("#customerName").fill("   ");
    await page.locator("#orderForm").dispatchEvent("submit");
    await expect(page.locator("#message")).toContainText("enter your name");
    await page.locator("#customerName").fill("Alex");
    for (const value of ["0", "-1", "1.5", "100", ""]) {
        await page.locator("#quantity").fill(value);
        await expect(page.locator("#placeOrderBtn")).toBeDisabled();
        await page.locator("#orderForm").dispatchEvent("submit");
        await expect(page.locator("#message")).toContainText("whole-number quantity");
    }
    expect(await page.evaluate(() => window.testBackend.orders)).toEqual([]);
    await page.locator("#quantity").fill("99");
    await expect(page.locator("#increaseQuantity")).toBeDisabled();
    await page.locator("#quantity").fill("1");
    await expect(page.locator("#decreaseQuantity")).toBeDisabled();
});

test("menu loading failure offers a working retry", async ({ page }) => {
    await mockBackend(page, { failRead: true });
    await expect(page.locator("#menuStatus")).toContainText("couldn’t load the menu");
    await expect(page.locator("#placeOrderBtn")).toBeDisabled();
    await expect(page.locator("#foodSelect")).toBeDisabled();
    await page.evaluate(() => { window.testBackend.failRead = false; });
    await page.locator("#retryFoodsBtn").click();
    await expect(page.locator(".food-card")).toHaveCount(6);
    await expect(page.locator("#retryFoodsBtn")).toBeHidden();
    await expect(page.locator("#foodSelect")).toBeEnabled();
});

test("empty menu and unavailable SDK fail gracefully", async ({ page }) => {
    await mockBackend(page, { foods: [] });
    await expect(page.locator("#menuStatus")).toContainText("menu is empty");
    await expect(page.locator("#placeOrderBtn")).toBeDisabled();
    await expect(page.locator(".food-skeleton")).toHaveCount(0);
    await page.unrouteAll();
    await mockBackend(page, { missingSDK: true });
    await expect(page.locator("#menuStatus")).toContainText("couldn’t load the menu");
    await expect(page.locator("#retryFoodsBtn")).toBeVisible();
});

test("database text renders safely and malformed prices are excluded", async ({ page }) => {
    await mockBackend(page, { foods: [
        { id: "uuid-meal", food_name: '<img src=x onerror="window.injected=true">', price: "10" },
        { id: 2, food_name: "Bad price", price: "not a price" },
        { id: 3, food_name: "Missing price", price: null },
        { id: 4, food_name: "Negative price", price: -3 }
    ] });
    await expect(page.locator(".food-card")).toHaveCount(1);
    await expect(page.locator(".food-name")).toHaveText('<img src=x onerror="window.injected=true">');
    expect(await page.evaluate(() => window.injected)).toBeUndefined();
    await page.locator(".food-card").click();
    await expect(page.locator("#total")).toHaveText("₱10.00");
    await expect(page.locator("#foodSelect")).toHaveValue("uuid-meal");
});

for (const width of [320, 375, 520, 768, 1024, 1440]) {
    test(`layout fits a ${width}px viewport`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await mockBackend(page);
        await expect(page.locator(".food-card")).toHaveCount(6);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        for (const selector of [".hero", ".food-grid", ".order-panel", "#placeOrderBtn"]) {
            const box = await page.locator(selector).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
    });
}

test("keyboard selection and reduced-motion preferences are respected", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockBackend(page);
    const card = page.locator(".food-card").first();
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("aria-pressed", "true");
    const styles = await page.locator(".hero-plate").evaluate(element => ({
        animation: getComputedStyle(element).animationName,
        scroll: getComputedStyle(document.documentElement).scrollBehavior
    }));
    expect(styles).toEqual({ animation: "none", scroll: "auto" });
});
