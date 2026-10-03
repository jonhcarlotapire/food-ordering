// Keep the existing Supabase tables and public browser configuration.
const SUPABASE_URL = "https://dmssiqklrhlkygfakaob.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zpeH_CGSNOGrTqaRF1zSXw_6spivvqY";

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
const retryFoodsBtn = document.getElementById("retryFoodsBtn");
const decreaseQuantity = document.getElementById("decreaseQuantity");
const increaseQuantity = document.getElementById("increaseQuantity");
const summaryMeal = document.getElementById("summaryMeal");
const summaryQuantity = document.getElementById("summaryQuantity");
const orderCount = document.getElementById("orderCount");
const orderHint = document.querySelector(".order-hint");

const currency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
});
const MAX_QUANTITY = 99;
let foods = [];
let isLoadingFoods = false;
let isPlacingOrder = false;
let menuLoaded = false;
let supabaseClient;

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

// Illustrations are decorative; food names and prices always come from Supabase.
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
    orderHint.textContent = food ? "Review your details, then place your order." : "Select a meal to get started.";

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

async function loadFoods() {
    if (isLoadingFoods || isPlacingOrder) return;
    isLoadingFoods = true;
    menuLoaded = false;
    foodSelect.disabled = true;
    foodSearch.disabled = true;
    placeOrderBtn.disabled = true;
    retryFoodsBtn.hidden = true;
    foodGrid.setAttribute("aria-busy", "true");
    menuStatus.textContent = "Getting the menu ready…";
    setFoodPlaceholder("Loading the menu…");
    foodGrid.replaceChildren();
    for (let index = 0; index < 3; index++) {
        const skeleton = document.createElement("div");
        skeleton.className = "food-skeleton";
        skeleton.setAttribute("aria-hidden", "true");
        foodGrid.appendChild(skeleton);
    }

    try {
        if (!supabaseClient) {
            if (!window.supabase?.createClient) throw new Error("Supabase library is unavailable.");
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        const { data, error } = await supabaseClient
            .from("foods")
            .select("id, food_name, price")
            .order("id", { ascending: true });
        if (error) throw error;

        // Do not allow malformed records to result in invalid order totals.
        foods = (data || []).filter(food => food.id != null
            && typeof food.food_name === "string" && food.food_name.trim()
            && food.price != null && String(food.price).trim() !== ""
            && Number.isFinite(Number(food.price)) && Number(food.price) >= 0);
        menuLoaded = true;
        setFoodPlaceholder(foods.length ? "Choose your meal" : "No meals available");
        foods.forEach(food => {
            const option = document.createElement("option");
            option.value = String(food.id);
            option.textContent = `${food.food_name} — ${formatPrice(Number(food.price))}`;
            foodSelect.appendChild(option);
        });
        foodSelect.disabled = !foods.length;
        renderFoods();
    } catch (error) {
        console.error("Error loading foods:", error);
        foods = [];
        foodGrid.replaceChildren();
        setFoodPlaceholder("Menu unavailable");
        menuCount.textContent = "Unavailable";
        menuStatus.textContent = "We couldn’t load the menu. Check your connection and try again.";
        retryFoodsBtn.hidden = false;
    } finally {
        isLoadingFoods = false;
        foodSearch.disabled = !menuLoaded || !foods.length;
        foodGrid.setAttribute("aria-busy", "false");
        updateOrderTotal(false);
    }
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
    orderButtonLabel.textContent = busy ? "Placing your order…" : "Place order";
    updateOrderTotal(false);
}

foodSelect.addEventListener("change", () => selectFood(foodSelect.value));
foodSearch.addEventListener("input", () => { if (menuLoaded) renderFoods(); });
retryFoodsBtn.addEventListener("click", loadFoods);
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

    if (!name) {
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
        // Preserve the original orders schema. Never submit orders for a preview.
        const { error } = await supabaseClient.from("orders").insert([{
            customer_name: name,
            food_id: food.id,
            quantity,
            price: Number(food.price)
        }]);
        if (error) throw error;

        orderForm.reset();
        quantityInput.value = "1";
        showMessage(`Order placed! Thanks, ${name}. Your ${food.food_name} order has been received.`, "success");
    } catch (error) {
        console.error("Error placing order:", error);
        showMessage("We couldn’t place your order. Your details are still here — please try again.", "error");
    } finally {
        setOrderBusy(false);
    }
});

loadFoods();
