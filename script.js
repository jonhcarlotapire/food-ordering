// Built-in menu: checkout does not depend on an external database or SDK.
const foods = Object.freeze([
    Object.freeze({ id: 1, food_name: "Classic Burger", price: 120 }),
    Object.freeze({ id: 2, food_name: "Margherita Pizza", price: 245 }),
    Object.freeze({ id: 3, food_name: "Chicken Rice", price: 150 }),
    Object.freeze({ id: 4, food_name: "Spaghetti", price: 130 }),
    Object.freeze({ id: 5, food_name: "Crispy Fries", price: 75 })
]);
const ORDERS_STORAGE_KEY = "jc-kainan.orders.v1";

const orderForm = document.getElementById("orderForm");
const orderFields = document.getElementById("orderFields");
const customerName = document.getElementById("customerName");
const foodSelect = document.getElementById("foodSelect");
const priceInput = document.getElementById("price");
const quantityInput = document.getElementById("quantity");
const totalDisplay = document.getElementById("total");
const message = document.getElementById("message");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderButtonLabel = document.getElementById("orderButtonLabel");
const foodGrid = document.getElementById("foodGrid");
const foodSearch = document.getElementById("foodSearch");
const menuStatus = document.getElementById("menuStatus");
const menuCount = document.getElementById("menuCount");
const decreaseQuantity = document.getElementById("decreaseQuantity");
const increaseQuantity = document.getElementById("increaseQuantity");
const summaryMeal = document.getElementById("summaryMeal");
const summaryQuantity = document.getElementById("summaryQuantity");
const orderCount = document.getElementById("orderCount");
const orderHint = document.querySelector(".order-hint");
const receiptPanel = document.getElementById("receiptPanel");
const savedOrdersSection = document.getElementById("savedOrdersSection");
const savedOrderList = document.getElementById("savedOrderList");
const savedOrderCount = document.getElementById("savedOrderCount");
const ordersStatus = document.getElementById("ordersStatus");

const currency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
});
const MAX_QUANTITY = 99;
let isPlacingOrder = false;

function formatPrice(value) {
    return currency.format(value);
}

function makeIcon(name) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    icon.classList.add("icon");
    icon.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#icon-${name}`);
    icon.appendChild(use);
    return icon;
}

// Illustrations are decorative; names and prices come from the built-in menu.
function getFoodArt(name) {
    const styles = [
        [/burger/i, "🍔", "#f4e9d7"],
        [/pizza/i, "🍕", "#f7e5dc"],
        [/fries|potato/i, "🍟", "#f6ecd6"],
        [/chicken|wings/i, "🍗", "#f2e6da"],
        [/pasta|spaghetti|noodle|pancit/i, "🍝", "#f4e6dd"],
        [/rice|silog|biryani/i, "🍛", "#ececd9"],
        [/salad|vegetable/i, "🥗", "#e9efdf"],
        [/fish|seafood|shrimp/i, "🍤", "#e5eeeb"],
        [/soup|ramen/i, "🍜", "#f1eadf"],
        [/sandwich/i, "🥪", "#e9eedf"],
        [/cake|dessert/i, "🍰", "#f4e5e9"],
        [/coffee/i, "☕", "#ece5df"],
        [/juice|drink|tea/i, "🥤", "#e7eded"]
    ];
    const match = styles.find(([pattern]) => pattern.test(name));
    return match ? { emoji: match[1], color: match[2] } : { emoji: "🍽️", color: "#efecdf" };
}

function getSelectedFood() {
    return foods.find(food => String(food.id) === foodSelect.value);
}

function isValidQuantity(quantity) {
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
}

function syncSelection() {
    foodGrid.querySelectorAll(".food-card").forEach(card => {
        const selected = card.dataset.foodId === foodSelect.value;
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
        card.disabled = isPlacingOrder;
    });
}

function updateOrderTotal(animate = true) {
    const food = getSelectedFood();
    const quantity = Number(quantityInput.value);
    const validQuantity = isValidQuantity(quantity);
    const newTotal = formatPrice(food && validQuantity ? Number(food.price) * quantity : 0);
    const changed = totalDisplay.textContent !== newTotal;

    priceInput.value = formatPrice(food ? Number(food.price) : 0);
    totalDisplay.textContent = newTotal;
    summaryMeal.textContent = food ? food.food_name : "No meal selected yet";
    summaryQuantity.textContent = food
        ? (validQuantity ? `${quantity} ${quantity === 1 ? "meal" : "meals"}` : "Enter a quantity from 1–99")
        : "Choose from the menu";
    orderCount.textContent = food && validQuantity ? String(quantity) : "0";
    decreaseQuantity.disabled = isPlacingOrder || !validQuantity || quantity <= 1;
    increaseQuantity.disabled = isPlacingOrder || !validQuantity || quantity >= MAX_QUANTITY;
    placeOrderBtn.disabled = isPlacingOrder || !food || !validQuantity;
    orderHint.textContent = food ? "Save your checkout locally. No payment is collected." : "Select a meal to get started.";

    if (animate && changed && totalDisplay.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        totalDisplay.animate([
            { opacity: 0.5, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" }
        ], { duration: 220, easing: "ease-out" });
    }
    syncSelection();
}

function selectFood(id) {
    if (isPlacingOrder) return;
    foodSelect.value = String(id);
    showMessage("", "");
    updateOrderTotal();
}

function renderFoods() {
    const query = foodSearch.value.trim().toLocaleLowerCase();
    const visibleFoods = foods.filter(food => food.food_name.toLocaleLowerCase().includes(query));
    const fragment = document.createDocumentFragment();

    visibleFoods.forEach((food, index) => {
        const art = getFoodArt(food.food_name);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "food-card";
        card.dataset.foodId = String(food.id);
        card.style.setProperty("--delay", `${Math.min(index, 5) * 45}ms`);
        card.style.setProperty("--food-color", art.color);
        card.setAttribute("aria-label", `${food.food_name}, ${formatPrice(Number(food.price))}, select meal`);

        const illustration = document.createElement("span");
        illustration.className = "food-art";
        illustration.setAttribute("aria-hidden", "true");
        const emoji = document.createElement("span");
        emoji.className = "food-emoji";
        emoji.textContent = art.emoji;
        illustration.appendChild(emoji);

        const indicator = document.createElement("span");
        indicator.className = "selection-indicator";
        indicator.appendChild(makeIcon("check"));

        const name = document.createElement("span");
        name.className = "food-name";
        name.textContent = food.food_name;
        const bottom = document.createElement("span");
        bottom.className = "food-card-bottom";
        const price = document.createElement("span");
        price.className = "food-price";
        price.textContent = formatPrice(Number(food.price));
        const add = document.createElement("span");
        add.className = "food-add";
        add.appendChild(makeIcon("plus"));
        bottom.append(price, add);
        card.append(illustration, indicator, name, bottom);
        card.addEventListener("click", () => selectFood(food.id));
        fragment.appendChild(card);
    });

    foodGrid.replaceChildren(fragment);
    menuCount.textContent = `${foods.length} ${foods.length === 1 ? "meal" : "meals"}`;
    menuStatus.textContent = !foods.length
        ? "The menu is empty for now. Please check back soon."
        : (!visibleFoods.length ? "No meals match your search. Try another name." : (query ? `${visibleFoods.length} matching ${visibleFoods.length === 1 ? "meal" : "meals"}.` : ""));
    syncSelection();
}

function setFoodPlaceholder(text) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = text;
    foodSelect.replaceChildren(option);
}

function loadFoods() {
    setFoodPlaceholder("Choose your meal");
    foods.forEach(food => {
        const option = document.createElement("option");
        option.value = String(food.id);
        option.textContent = `${food.food_name} — ${formatPrice(food.price)}`;
        foodSelect.appendChild(option);
    });
    foodSelect.disabled = false;
    foodSearch.disabled = false;
    renderFoods();
    foodGrid.setAttribute("aria-busy", "false");
    updateOrderTotal(false);
}

function readSavedOrders() {
    const stored = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (stored === null) return [];
    const orders = JSON.parse(stored);
    const validOrder = order => order && typeof order.id === "string" && order.id.length > 0
        && typeof order.created_at === "string" && Number.isFinite(Date.parse(order.created_at))
        && typeof order.customer_name === "string" && order.customer_name.trim().length > 0
        && typeof order.food_name === "string" && order.food_name.trim().length > 0
        && isValidQuantity(order.quantity)
        && Number.isFinite(order.price) && order.price >= 0
        && Number.isFinite(order.total) && order.total === order.price * order.quantity
        && order.status === "saved-locally";
    if (!Array.isArray(orders) || !orders.every(validOrder)) {
        throw new Error("Saved order data is invalid. Existing data has not been changed.");
    }
    return orders;
}

function renderReceipt(order, focus = false) {
    const values = {
        receiptId: order.id,
        receiptDate: new Date(order.created_at).toLocaleString("en-PH"),
        receiptName: order.customer_name,
        receiptFood: order.food_name,
        receiptQuantity: String(order.quantity),
        receiptPrice: formatPrice(order.price),
        receiptTotal: formatPrice(order.total)
    };
    Object.entries(values).forEach(([id, text]) => {
        document.getElementById(id).textContent = text;
    });
    receiptPanel.hidden = false;
    if (focus) receiptPanel.focus();
}

function renderSavedOrders(orders) {
    savedOrdersSection.hidden = !orders.length;
    savedOrderCount.textContent = `${orders.length} saved`;
    ordersStatus.textContent = "";
    const fragment = document.createDocumentFragment();
    [...orders].reverse().slice(0, 5).forEach(order => {
        const item = document.createElement("li");
        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = `${order.quantity} × ${order.food_name}`;
        const info = document.createElement("small");
        info.textContent = `${order.customer_name} · ${new Date(order.created_at).toLocaleString("en-PH")}`;
        details.append(name, info);
        const price = document.createElement("span");
        price.className = "saved-order-price";
        price.textContent = formatPrice(order.total);
        const view = document.createElement("button");
        view.type = "button";
        view.className = "receipt-button";
        view.textContent = "View receipt";
        view.setAttribute("aria-label", `View receipt for ${order.quantity} ${order.food_name}, ${order.customer_name}`);
        view.addEventListener("click", () => renderReceipt(order, true));
        item.append(details, price, view);
        fragment.appendChild(item);
    });
    savedOrderList.replaceChildren(fragment);
}

function loadSavedOrders() {
    try {
        const orders = readSavedOrders();
        renderSavedOrders(orders);
        if (orders.length) renderReceipt(orders[orders.length - 1]);
        else receiptPanel.hidden = true;
    } catch (error) {
        console.error("Unable to read saved orders:", error);
        savedOrdersSection.hidden = false;
        savedOrderList.replaceChildren();
        savedOrderCount.textContent = "Unavailable";
        ordersStatus.textContent = "Saved receipts couldn’t be read. Enable browser storage or use another browser. Existing data has not been changed.";
        receiptPanel.hidden = true;
    }
}

async function saveOrder(order) {
    const persist = () => {
        // Read the latest records before writing, including orders from other tabs.
        const orders = readSavedOrders();
        orders.push(order);
        window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
        return orders;
    };
    // Serialize checkouts across tabs when Web Locks are available.
    if (window.navigator.locks?.request) {
        return window.navigator.locks.request(ORDERS_STORAGE_KEY, persist);
    }
    return Promise.resolve().then(persist);
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
}

function setOrderBusy(busy) {
    isPlacingOrder = busy;
    orderFields.disabled = busy;
    orderForm.setAttribute("aria-busy", String(busy));
    placeOrderBtn.classList.toggle("is-loading", busy);
    orderButtonLabel.textContent = busy ? "Saving checkout…" : "Check out";
    updateOrderTotal(false);
}

foodSelect.addEventListener("change", () => selectFood(foodSelect.value));
foodSearch.addEventListener("input", renderFoods);
quantityInput.addEventListener("input", () => updateOrderTotal());
quantityInput.addEventListener("change", () => {
    if (!isValidQuantity(Number(quantityInput.value))) quantityInput.value = "1";
    updateOrderTotal();
});
decreaseQuantity.addEventListener("click", () => {
    if (isPlacingOrder) return;
    quantityInput.value = String(Math.max(1, (Number(quantityInput.value) || 1) - 1));
    updateOrderTotal();
});
increaseQuantity.addEventListener("click", () => {
    if (isPlacingOrder) return;
    quantityInput.value = String(Math.min(MAX_QUANTITY, (Number(quantityInput.value) || 1) + 1));
    updateOrderTotal();
});

orderForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (isPlacingOrder) return;
    showMessage("", "");
    const name = customerName.value.trim();
    const food = getSelectedFood();
    const quantity = Number(quantityInput.value);

    if (!name || name.length > 100) {
        showMessage("Please enter your name so we know who the order is for.", "error");
        customerName.focus();
        return;
    }
    if (!food) {
        showMessage("Choose a meal from the menu to get started.", "error");
        foodSelect.focus();
        return;
    }
    if (!isValidQuantity(quantity)) {
        showMessage("Please enter a whole-number quantity from 1 to 99.", "error");
        quantityInput.focus();
        return;
    }

    setOrderBusy(true);
    try {
        const uniqueId = window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        const order = {
            id: `JC-${uniqueId}`,
            created_at: new Date().toISOString(),
            customer_name: name,
            food_id: food.id,
            food_name: food.food_name,
            quantity,
            price: food.price,
            total: food.price * quantity,
            status: "saved-locally"
        };
        const orders = await saveOrder(order);

        orderForm.reset();
        quantityInput.value = "1";
        renderSavedOrders(orders);
        renderReceipt(order, true);
        showMessage(`Checkout saved, ${name}! Your receipt is on this device only. No payment was collected or order sent to a restaurant.`, "success");
    } catch (error) {
        console.error("Error placing order:", error);
        showMessage("Checkout wasn’t saved. Enable browser storage and check that saved data is valid. Your details are still here; no payment was collected.", "error");
    } finally {
        setOrderBusy(false);
    }
});

document.getElementById("printReceiptBtn").addEventListener("click", () => window.print());
window.addEventListener("storage", event => {
    if (event.key === ORDERS_STORAGE_KEY || event.key === null) loadSavedOrders();
});

loadFoods();
loadSavedOrders();
