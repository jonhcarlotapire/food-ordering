const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const STORAGE_KEY = "jc-kainan.orders.v1";
const meals = [
    { id: "1", name: "Classic Burger", price: 120 },
    { id: "2", name: "Margherita Pizza", price: 245 },
    { id: "3", name: "Chicken Rice", price: 150 },
    { id: "4", name: "Spaghetti", price: 130 },
    { id: "5", name: "Crispy Fries", price: 75 }
];

async function openApp(page) {
    // Use the real menu and checkout code, not a mocked database or SDK.
    await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1" || url.protocol === "file:") return route.continue();
        if (url.hostname === "fonts.googleapis.com") {
            return route.fulfill({ contentType: "text/css", body: "" });
        }
        return route.abort();
    });
    await page.goto("/");
    await expect(page.locator(".food-card")).toHaveCount(5);
}

function savedOrders(page) {
    return page.evaluate(key => JSON.parse(localStorage.getItem(key)) || [], STORAGE_KEY);
}

async function checkout(page, id = "1", name = "Alex Cruz", quantity = "1") {
    await page.locator("#customerName").fill(name);
    await page.locator("#foodSelect").selectOption(id);
    await page.locator("#quantity").fill(quantity);
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#message")).toHaveClass("success");
}

test("five built-in meals, card selection, dropdown, search, and totals stay in sync", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await openApp(page);
    await expect(page.locator(".food-name")).toHaveText(meals.map(meal => meal.name));
    await expect(page.locator("#placeOrderBtn")).toBeDisabled();
    await page.getByRole("button", { name: /Classic Burger.*select meal/ }).click();
    await expect(page.locator("#foodSelect")).toHaveValue("1");
    await expect(page.locator("#total")).toHaveText("₱120.00");
    await expect(page.locator(".is-selected")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator("#total")).toHaveText("₱240.00");
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

for (const meal of meals) {
    test(`${meal.name} can actually check out and produce a saved receipt`, async ({ page }) => {
        await openApp(page);
        await checkout(page, meal.id, "  Alex Cruz  ", "2");
        const orders = await savedOrders(page);
        expect(orders).toHaveLength(1);
        expect(orders[0]).toMatchObject({
            customer_name: "Alex Cruz",
            food_id: Number(meal.id),
            food_name: meal.name,
            quantity: 2,
            price: meal.price,
            total: meal.price * 2,
            status: "saved-locally"
        });
        expect(orders[0].id).toMatch(/^JC-/);
        expect(Number.isFinite(Date.parse(orders[0].created_at))).toBe(true);
        await expect(page.locator("#receiptFood")).toHaveText(meal.name);
        await expect(page.locator("#receiptName")).toHaveText("Alex Cruz");
        await expect(page.locator("#receiptTotal")).toHaveText(`₱${(meal.price * 2).toFixed(2)}`);
        await expect(page.locator(".receipt-note")).toContainText("Not paid or sent");
        await expect(page.locator("#customerName")).toHaveValue("");
        await expect(page.locator("#foodSelect")).toHaveValue("");
        await expect(page.locator("#quantity")).toHaveValue("1");
        await expect(page.locator("#total")).toHaveText("₱0.00");
        await expect(page.locator("#placeOrderBtn")).toBeDisabled();
        await expect(page.locator(".food-card.is-selected")).toHaveCount(0);
    });
}

test("saved orders and receipts survive a reload", async ({ page }) => {
    await openApp(page);
    await checkout(page, "3", "Jamie", "3");
    const before = await savedOrders(page);
    await page.reload();
    await expect(page.locator("#savedOrderList li")).toHaveCount(1);
    await expect(page.locator("#receiptTotal")).toHaveText("₱450.00");
    await expect(page.locator("#receiptName")).toHaveText("Jamie");
    expect(await savedOrders(page)).toEqual(before);
});

test("duplicate submit events create only one order", async ({ page }) => {
    await openApp(page);
    await page.locator("#customerName").fill("Alex");
    await page.locator("#foodSelect").selectOption("1");
    await page.evaluate(() => {
        const form = document.getElementById("orderForm");
        form.dispatchEvent(new Event("submit", { cancelable: true }));
        form.dispatchEvent(new Event("submit", { cancelable: true }));
    });
    await expect(page.locator("#message")).toHaveClass("success");
    expect(await savedOrders(page)).toHaveLength(1);
});

test("blocked storage reports an error, preserves details, and can be retried", async ({ page }) => {
    await page.addInitScript(key => {
        window.storageWriteBlocked = true;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(name, value) {
            if (name === key && window.storageWriteBlocked) throw new DOMException("Storage unavailable", "QuotaExceededError");
            return original.call(this, name, value);
        };
    }, STORAGE_KEY);
    await openApp(page);
    await page.locator("#customerName").fill("Jamie");
    await page.locator("#foodSelect").selectOption("2");
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#message")).toHaveClass("error");
    await expect(page.locator("#message")).toContainText("wasn’t saved");
    await expect(page.locator("#customerName")).toHaveValue("Jamie");
    await expect(page.locator("#foodSelect")).toHaveValue("2");
    await expect(page.locator("#placeOrderBtn")).toBeEnabled();
    await expect(page.locator("#receiptPanel")).toBeHidden();
    expect(await savedOrders(page)).toEqual([]);
    await page.evaluate(() => { window.storageWriteBlocked = false; });
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#message")).toHaveClass("success");
    expect(await savedOrders(page)).toHaveLength(1);
});

test("corrupted saved data is never overwritten or reported as success", async ({ page }) => {
    await page.addInitScript(key => localStorage.setItem(key, "broken-data"), STORAGE_KEY);
    await openApp(page);
    await expect(page.locator("#ordersStatus")).toContainText("couldn’t be read");
    await page.locator("#customerName").fill("Jamie");
    await page.locator("#foodSelect").selectOption("2");
    await page.locator("#placeOrderBtn").click();
    await expect(page.locator("#message")).toHaveClass("error");
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe("broken-data");
});

test("invalid quantities, missing meals, and blank names never save", async ({ page }) => {
    await openApp(page);
    await page.locator("#customerName").fill("Alex");
    await page.locator("#orderForm").dispatchEvent("submit");
    await expect(page.locator("#message")).toContainText("Choose a meal");
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
    expect(await savedOrders(page)).toEqual([]);
    await page.locator("#quantity").fill("99");
    await expect(page.locator("#increaseQuantity")).toBeDisabled();
    await page.locator("#quantity").fill("1");
    await expect(page.locator("#decreaseQuantity")).toBeDisabled();
});

test("customer text renders safely in receipts and history", async ({ page }) => {
    await openApp(page);
    const name = '<img src=x onerror="window.injected=true">';
    await checkout(page, "1", name);
    await expect(page.locator("#receiptName")).toHaveText(name);
    await expect(page.locator("#savedOrderList")).toContainText(name);
    expect(await page.evaluate(() => window.injected)).toBeUndefined();
    await expect(page.locator("#receiptName img")).toHaveCount(0);
});

test("history keeps all orders and shows the five most recent receipts", async ({ page }) => {
    await openApp(page);
    for (let index = 0; index < 6; index++) await checkout(page, "1", `Customer ${index}`);
    expect(await savedOrders(page)).toHaveLength(6);
    await expect(page.locator("#savedOrderList li")).toHaveCount(5);
    await expect(page.locator("#savedOrderCount")).toHaveText("6 saved");
    await expect(page.locator("#savedOrderList li").first()).toContainText("Customer 5");
    await page.locator("#savedOrderList li").last().getByRole("button").click();
    await expect(page.locator("#receiptName")).toHaveText("Customer 1");
});

test("another tab receives updated local order history", async ({ page, context }) => {
    test.setTimeout(60000);
    await openApp(page);
    const other = await context.newPage();
    await openApp(other);
    await page.bringToFront();
    await checkout(page, "5", "Sam", "2");
    await other.bringToFront();
    await expect(other.locator("#savedOrderList li")).toHaveCount(1);
    await expect(other.locator("#receiptFood")).toHaveText("Crispy Fries");
    await other.close();
});

test("checkout works when external network access is unavailable", async ({ page, context }) => {
    await openApp(page);
    await context.setOffline(true);
    await checkout(page, "4", "Alex", "2");
    await expect(page.locator("#receiptTotal")).toHaveText("₱260.00");
    expect(await savedOrders(page)).toHaveLength(1);
});

test("receipt is printable without the menu or checkout form", async ({ page }) => {
    await openApp(page);
    await checkout(page);
    await page.evaluate(() => { window.print = () => { window.printRequested = true; }; });
    await page.getByRole("button", { name: "Print receipt" }).click();
    expect(await page.evaluate(() => window.printRequested)).toBe(true);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#receiptPanel")).toBeVisible();
    await expect(page.locator("#orderForm")).toBeHidden();
    await expect(page.locator(".hero")).toBeHidden();
});

for (const width of [320, 375, 520, 768, 1024, 1440]) {
    test(`menu, checkout, receipt, and history fit a ${width}px viewport`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openApp(page);
        await checkout(page, "2", "Alex", "3");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        for (const selector of [".hero", ".food-grid", ".order-panel", "#receiptPanel", "#savedOrderList"]) {
            const box = await page.locator(selector).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
    });
}

test("keyboard selection and reduced-motion preferences are respected", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openApp(page);
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

test("card hover animation remains active after its entrance animation", async ({ page }) => {
    // Keep the card in view so smooth anchor scrolling cannot move it under the pointer.
    await page.setViewportSize({ width: 1440, height: 1400 });
    await openApp(page);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    const card = page.locator(".food-card").first();
    await card.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    await card.hover();
    await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -5)");
});

test("opening index.html directly can show the menu and check out", async ({ page }) => {
    await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
    await expect(page.locator(".food-card")).toHaveCount(5);
    // File-origin storage behavior varies by browser. Verify the Chrome path too.
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
    await checkout(page, "1", "Direct-file customer", "1");
    expect(await savedOrders(page)).toHaveLength(1);
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
});
