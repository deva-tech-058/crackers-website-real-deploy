let selectedProduct = null;
let selectedQty = 1;

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    if (window.CartUtils) {
        window.addEventListener("cart:updated", updateCartCount);
    }
    updateCartCount();
    loadProductDetails();
});

function bindEvents() {
    const qtyMinusBtn = document.getElementById("qtyMinusBtn");
    const qtyPlusBtn = document.getElementById("qtyPlusBtn");
    const qtyInput = document.getElementById("qtyInput");
    const addToCartBtn = document.getElementById("addToCartBtn");
    const buyNowBtn = document.getElementById("buyNowBtn");

    qtyMinusBtn?.addEventListener("click", () => changeQuantity(-1));
    qtyPlusBtn?.addEventListener("click", () => changeQuantity(1));

    qtyInput?.addEventListener("input", handleQuantityInput);

    addToCartBtn?.addEventListener("click", () => addCurrentProductToCart(false));
    buyNowBtn?.addEventListener("click", () => addCurrentProductToCart(true));
}

// **NEW: Stock-aware quantity input handler**
function handleQuantityInput() {
    if (!selectedProduct) return;

    const availableStock = Math.max(0, Number(selectedProduct.quantity) || 0);
    if (availableStock <= 0) {
        selectedQty = 0;
        document.getElementById("qtyInput").value = "0";
        updateQtyUI();
        showStockWarning("Out of stock!");
        return;
    }

    const parsed = Number.parseInt(document.getElementById("qtyInput").value, 10);
    let nextQty;

    if (!Number.isFinite(parsed)) {
        nextQty = 1;
    } else if (parsed > availableStock) {
        nextQty = availableStock;
        showStockWarning(`Only ${availableStock} items available!`);
    } else {
        nextQty = Math.max(1, parsed);
    }

    selectedQty = nextQty;
    document.getElementById("qtyInput").value = String(selectedQty);
    updateQtyUI();
}

async function loadProductDetails() {
    const productId = getProductIdFromQuery();
    if (!productId) {
        showError("Invalid product id. Please open from product list.");
        return;
    }

    try {
        const response = await fetch("/api/products");
        if (!response.ok) {
            throw new Error("Failed to fetch products");
        }

        const products = await response.json();
        const product = Array.isArray(products)
            ? products.find((item) => Number(item.id) === productId)
            : null;

        if (!product) {
            showError("Product not found. It may have been removed.");
            return;
        }

        selectedProduct = product;
        renderProduct(product);
        showProductSection();
    } catch (error) {
        console.error("Product details load error:", error);
        showError("Unable to load product details right now.");
    }
}

function getProductIdFromQuery() {
    const query = new URLSearchParams(window.location.search);
    const id = Number.parseInt(query.get("id"), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

// **ENHANCED: Stock-aware product rendering**
function renderProduct(product) {
    const quantity = Math.max(0, Number(product.quantity) || 0);
    const stock = getStockState(quantity);
    const offerPrice = Number(product.offer_price) || 0;
    const originalPrice = Number(product.original_price) || 0;
    const discount = Math.max(0, Number(product.discount) || 0);
    const savings = Math.max(0, originalPrice - offerPrice);

    // Image handling
    const detailImage = document.getElementById("detailImage");
    const imageUrl = product.image_url || `https://via.placeholder.com/720?text=${encodeURIComponent(product.name || "Product")}`;
    detailImage.src = imageUrl;
    detailImage.alt = product.name || "Product image";
    detailImage.onerror = function () {
        this.onerror = null;
        this.src = "https://via.placeholder.com/720?text=Product";
    };

    // Update all UI elements
    document.getElementById("detailDiscount").textContent = `${discount}% OFF`;
    document.getElementById("detailName").textContent = product.name || "Product";
    document.getElementById("detailCategory").textContent = product.category_name || "Festival Collection";
    document.getElementById("detailOfferPrice").textContent = toCurrency(offerPrice);
    document.getElementById("detailOriginalPrice").textContent = toCurrency(originalPrice);
    document.getElementById("detailSavings").textContent = `You save ${toCurrency(savings)} on this deal`;
    document.getElementById("detailQuantity").textContent = `${quantity}`;
    document.getElementById("detailProductId").textContent = `#${product.id}`;

    // Video handling
    const videoSection = document.getElementById("detailVideoSection");
    const videoPlayer = document.getElementById("detailVideoPlayer");
    if (product.video_url) {
        videoPlayer.src = product.video_url;
        videoPlayer.load();
        videoSection.hidden = false;
    } else {
        videoPlayer.pause();
        videoPlayer.removeAttribute("src");
        videoPlayer.load();
        videoSection.hidden = true;
    }

    // **STOCK STATUS UI**
    const stockTag = document.getElementById("detailStock");
    stockTag.className = `tag stock ${stock.status}`;
    stockTag.textContent = stock.label;

    const qtyHint = document.getElementById("qtyHint");
    if (quantity === 0) {
        qtyHint.textContent = "🛑 Out of Stock - Cannot add to cart";
        qtyHint.className = "stock-warning";
    } else if (quantity <= 3) {
        qtyHint.innerHTML = `⚡ Hurry! Only <strong>${quantity}</strong> left in stock`;
        qtyHint.className = "stock-low";
    } else {
        qtyHint.textContent = "Quantity can be adjusted before checkout";
        qtyHint.className = "stock-info";
    }

    // **STOCK-AWARE QUANTITY CONTROLS**
    selectedQty = quantity > 0 ? 1 : 0;
    const qtyInput = document.getElementById("qtyInput");
    qtyInput.min = "1";
    qtyInput.max = String(quantity || 1);
    qtyInput.value = String(selectedQty);
    qtyInput.disabled = quantity === 0;

    const disableActions = quantity <= 0;
    document.getElementById("addToCartBtn").disabled = disableActions;
    document.getElementById("buyNowBtn").disabled = disableActions;
    document.getElementById("qtyMinusBtn").disabled = disableActions;
    document.getElementById("qtyPlusBtn").disabled = disableActions;

    updateQtyUI();
}

// **ENHANCED: Stock-aware quantity change**
function changeQuantity(step) {
    if (!selectedProduct) return;

    const availableStock = Math.max(0, Number(selectedProduct.quantity) || 0);
    if (availableStock <= 0) {
        showStockWarning("Out of stock!");
        return;
    }

    const currentQty = Number.parseInt(document.getElementById("qtyInput").value, 10) || 1;
    let newQty = currentQty + step;

    // Enforce stock limits
    newQty = Math.max(1, Math.min(newQty, availableStock));

    selectedQty = newQty;
    document.getElementById("qtyInput").value = String(selectedQty);
    updateQtyUI();
}

// **ENHANCED: Stock-aware UI updates**
function updateQtyUI() {
    if (!selectedProduct) return;

    const availableStock = Math.max(0, Number(selectedProduct.quantity) || 0);
    const qtyInput = document.getElementById("qtyInput");
    const minusBtn = document.getElementById("qtyMinusBtn");
    const plusBtn = document.getElementById("qtyPlusBtn");

    if (availableStock <= 0) {
        selectedQty = 0;
        qtyInput.value = "0";
        qtyInput.disabled = true;
        minusBtn.disabled = true;
        plusBtn.disabled = true;
        updateSubtotal();
        return;
    }

    qtyInput.disabled = false;
    selectedQty = clamp(Number.parseInt(qtyInput.value, 10) || 1, 1, availableStock);
    qtyInput.value = String(selectedQty);

    minusBtn.disabled = selectedQty <= 1;
    plusBtn.disabled = selectedQty >= availableStock;
    minusBtn.title = selectedQty <= 1 ? "Minimum quantity" : "";
    plusBtn.title = selectedQty >= availableStock ? `Only ${availableStock} available` : "";

    updateSubtotal();
}

// **NEW: Stock warning helper**
function showStockWarning(message) {
    const qtyHint = document.getElementById("qtyHint");
    qtyHint.textContent = message;
    qtyHint.className = "stock-warning";
    setTimeout(() => {
        if (selectedProduct && selectedProduct.quantity > 0) {
            renderProduct(selectedProduct); // Reset hint
        }
    }, 3000);
}

function updateSubtotal() {
    if (!selectedProduct) return;
    const offerPrice = Number(selectedProduct.offer_price) || 0;
    const subtotal = offerPrice * (selectedQty || 0);
    document.getElementById("subtotalValue").textContent = toCurrency(subtotal);
}

function showCartMessage(message, type = "success") {
    if (window.CartUtils) {
        window.CartUtils.showToast(message, type);
        return;
    }
    alert(message);
}

// **ENHANCED: Stock-aware cart addition**
function addCurrentProductToCart(redirectToCheckout) {
    if (!selectedProduct) return;

    if (window.CartUtils && !window.CartUtils.isLoggedIn()) {
        showCartMessage("Please login to add products to cart", "info");
        return { added: 0 };
    }

    const availableStock = Math.max(0, Number(selectedProduct.quantity) || 0);
    if (availableStock <= 0) {
        showStockWarning("This product is out of stock!");
        return { added: 0 };
    }

    const unitsToAdd = clamp(Number.parseInt(selectedQty, 10) || 1, 1, availableStock);

    // **CART STOCK VALIDATION** - Check existing cart quantity
    const existingCartQty = getExistingCartQuantity(selectedProduct.id);
    const totalQtyAfterAdd = existingCartQty + unitsToAdd;

    if (totalQtyAfterAdd > availableStock) {
        const canAdd = Math.max(0, availableStock - existingCartQty);
        showStockWarning(`Only ${canAdd} more can be added (Total ${availableStock} available)`);
        return { added: 0 };
    }

    let result = { added: 0 };
    if (window.CartUtils) {
        result = window.CartUtils.addProduct(selectedProduct, unitsToAdd, { maxQuantity: availableStock });
    } else {
        const cart = getCart();
        const existingIndex = cart.findIndex(item => Number(item.product_id) === Number(selectedProduct.id));

        if (existingIndex >= 0) {
            // Update existing item
            cart[existingIndex].quantity = totalQtyAfterAdd;
        } else {
            // Add new item
            cart.push({
                product_id: selectedProduct.id,
                name: selectedProduct.name,
                price: Number(selectedProduct.offer_price) || 0,
                original_price: Number(selectedProduct.original_price) || 0,
                discount: Number(selectedProduct.discount) || 0,
                image: selectedProduct.image_url,
                quantity: unitsToAdd,
                stock: availableStock // Store stock info
            });
        }
        saveCart(cart);
        result = { added: unitsToAdd };
    }

    updateCartCount();

    if (result.added <= 0) {
        return result;
    }

    const message = result.added > 1
        ? `${result.added} items added to cart!`
        : `${selectedProduct.name} added to cart!`;

    showCartMessage(message, "success");

    if (redirectToCheckout) {
        window.location.href = "/checkout.html";
    }

    return result;
}

// **NEW: Check existing quantity in cart for this product**
function getExistingCartQuantity(productId) {
    const cart = getCart();
    const existingItem = cart.find(item => Number(item.product_id) === Number(productId));
    return existingItem ? Math.max(0, Number(existingItem.quantity) || 0) : 0;
}

function getCart() {
    if (window.CartUtils) {
        return window.CartUtils.getCart();
    }
    try {
        const parsed = JSON.parse(localStorage.getItem("cart") || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    if (window.CartUtils) {
        window.CartUtils.writeCart(cart);
        return;
    }
    localStorage.setItem("cart", JSON.stringify(cart));
}

function updateCartCount() {
    const cart = getCart();
    const totalItems = window.CartUtils
        ? window.CartUtils.getSummary(cart).totalItems
        : cart.reduce((sum, item) => {
            const qty = Number(item.quantity);
            return sum + (qty > 0 ? qty : 1);
        }, 0);

    const count = document.getElementById("cartCount");
    if (count) count.textContent = String(totalItems);
}

function getStockState(quantity) {
    if (quantity <= 0) return { status: "out", label: "Out of Stock" };
    if (quantity <= 3) return { status: "low", label: `Low Stock (${quantity} left)` };
    return { status: "in", label: `In Stock (${quantity})` };
}

function toCurrency(value) {
    const amount = Number(value) || 0;
    return `\u20B9${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function showProductSection() {
    document.getElementById("loadingState").hidden = true;
    document.getElementById("errorState").hidden = true;
    document.getElementById("productDetails").hidden = false;
}

function showError(message) {
    document.getElementById("loadingState").hidden = true;
    document.getElementById("productDetails").hidden = true;
    document.getElementById("errorState").hidden = false;
    document.getElementById("errorMessage").textContent = message;
}

function goToCheckout() {
    window.location.href = "/checkout.html";
}

function goBackToProducts() {
    if (document.referrer && document.referrer.includes(window.location.host)) {
        window.history.back();
        return;
    }
    window.location.href = "/all-products.html";
}

