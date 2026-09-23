// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "https://dmssiqklrhlkygfakaob.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zpeH_CGSNOGrTqaRF1zSXw_6spivvqY";

const { createClient } = window.supabase;

const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ==========================================
// GET HTML ELEMENTS
// ==========================================

const orderForm = document.getElementById("orderForm");
const customerName = document.getElementById("customerName");
const foodSelect = document.getElementById("foodSelect");
const priceInput = document.getElementById("price");
const quantityInput = document.getElementById("quantity");
const totalDisplay = document.getElementById("total");
const message = document.getElementById("message");
const placeOrderBtn = document.getElementById("placeOrderBtn");


// ==========================================
// STORE FOODS
// ==========================================

let foods = [];


// ==========================================
// LOAD FOODS FROM SUPABASE
// ==========================================

async function loadFoods() {

    foodSelect.innerHTML = `
        <option value="">Loading food...</option>
    `;

    const { data, error } = await supabaseClient
        .from("foods")
        .select("id, food_name, price")
        .order("id", { ascending: true });

    if (error) {
        console.error("Error loading foods:", error);

        foodSelect.innerHTML = `
            <option value="">Unable to load food</option>
        `;

        showMessage(
            "Failed to load food items.",
            "error"
        );

        return;
    }

    foods = data || [];

    if (foods.length === 0) {
        foodSelect.innerHTML = `
            <option value="">No food items found</option>
        `;

        return;
    }

    foodSelect.innerHTML = `
        <option value="">Select a food</option>
    `;

    foods.forEach(food => {

        const option = document.createElement("option");

        option.value = food.id;

        option.textContent =
            `${food.food_name} - ₱${Number(food.price).toFixed(2)}`;

        foodSelect.appendChild(option);
    });
}


// ==========================================
// GET SELECTED FOOD
// ==========================================

function getSelectedFood() {

    const foodId = Number(foodSelect.value);

    return foods.find(food => food.id === foodId);
}


// ==========================================
// UPDATE PRICE AND TOTAL
// ==========================================

function updateOrderTotal() {

    const selectedFood = getSelectedFood();

    const quantity = Number(quantityInput.value) || 0;

    if (!selectedFood) {

        priceInput.value = "₱0.00";
        totalDisplay.textContent = "₱0.00";

        return;
    }

    const price = Number(selectedFood.price);

    const total = price * quantity;

    priceInput.value =
        `₱${price.toFixed(2)}`;

    totalDisplay.textContent =
        `₱${total.toFixed(2)}`;
}


// ==========================================
// FOOD CHANGE
// ==========================================

foodSelect.addEventListener("change", () => {
    updateOrderTotal();
});


// ==========================================
// QUANTITY CHANGE
// ==========================================

quantityInput.addEventListener("input", () => {

    let quantity = Number(quantityInput.value);

    if (quantity < 1 || isNaN(quantity)) {
        quantityInput.value = 1;
    }

    updateOrderTotal();
});


// ==========================================
// SHOW MESSAGE
// ==========================================

function showMessage(text, type) {

    message.textContent = text;

    message.className = type;
}


// ==========================================
// PLACE ORDER
// ==========================================

orderForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    showMessage("", "");

    const name = customerName.value.trim();
    const selectedFood = getSelectedFood();
    const quantity = Number(quantityInput.value);

    // Validation
    if (!name) {

        showMessage(
            "Please enter the customer name.",
            "error"
        );

        customerName.focus();

        return;
    }

    if (!selectedFood) {

        showMessage(
            "Please choose a food item.",
            "error"
        );

        foodSelect.focus();

        return;
    }

    if (!quantity || quantity < 1) {

        showMessage(
            "Please enter a valid quantity.",
            "error"
        );

        quantityInput.focus();

        return;
    }

    // Disable button while saving
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "PLACING ORDER...";

    try {

        const price = Number(selectedFood.price);

        // Insert order into Supabase
        const { data, error } = await supabaseClient
            .from("orders")
            .insert([
                {
                    customer_name: name,
                    food_id: selectedFood.id,
                    quantity: quantity,
                    price: price
                }
            ])
            .select();

        if (error) {

            console.error("Order error:", error);

            showMessage(
                "Failed to place order. Please try again.",
                "error"
            );

            return;
        }

        console.log("Order successfully saved:", data);

        // Success message
        showMessage(
            "Order successfully placed!",
            "success"
        );

        // Reset form
        orderForm.reset();

        priceInput.value = "₱0.00";
        totalDisplay.textContent = "₱0.00";
        quantityInput.value = 1;

    } catch (error) {

        console.error("Unexpected error:", error);

        showMessage(
            "Something went wrong. Please try again.",
            "error"
        );

    } finally {

        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "PLACE ORDER";
    }
});


// ==========================================
// START
// ==========================================

loadFoods();