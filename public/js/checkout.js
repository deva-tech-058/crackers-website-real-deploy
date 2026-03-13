let currentCart = [];

document.addEventListener("DOMContentLoaded", async () => {
    bindCartEvents();

    if (window.CartUtils) {
        window.addEventListener("cart:updated", renderCartPage);
    }

    // Fetch user-specific orders from database on load
    await fetchUserOrdersFromDB();

    hydrateCartPricing().finally(renderCartPage);
});

// Helper function to get user-specific storage key (CART + ADDRESSES + ORDERS)
function getUserStorageKey(baseKey) {
    const userId = localStorage.getItem('userId');
    return userId ? `${baseKey}_${userId}` : baseKey;
}

// Fetch user orders from DATABASE
async function fetchUserOrdersFromDB() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
        const response = await fetch(`/api/orders/user/${userId}`);
        if (response.ok) {
            const orders = await response.json();
            const userOrdersKey = getUserStorageKey('orders');
            localStorage.setItem(userOrdersKey, JSON.stringify(orders));
        }
    } catch (error) {
        console.warn('Failed to fetch orders from DB:', error);
    }
}

function bindCartEvents() {
    const cartList = document.getElementById("cartList");
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    const cartBtn = document.getElementById("cartBtn");

    cartList?.addEventListener("click", handleCartListClick);
    cartList?.addEventListener("change", handleQuantityInputChange);
    cartList?.addEventListener("input", handleQuantityInputValidation);
    cartList?.addEventListener("blur", handleQuantityInputBlur, true);

    if (placeOrderBtn) {
        if (window.location.pathname.endsWith("/payment.html")) {
            placeOrderBtn.addEventListener("click", completeOrder);
        } else {
            placeOrderBtn.addEventListener("click", placeOrder);
        }
    }

    cartBtn?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// âœ… FIXED: getUserAddresses() - USER SPECIFIC ADDRESSES ONLY
function getUserAddresses() {
    const userAddressesKey = getUserStorageKey('savedAddresses');
    try {
        const parsed = JSON.parse(localStorage.getItem(userAddressesKey) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// âœ… FIXED: saveUserAddresses() - USER SPECIFIC ONLY
function saveUserAddresses(addresses) {
    const userAddressesKey = getUserStorageKey('savedAddresses');
    localStorage.setItem(userAddressesKey, JSON.stringify(addresses));
}

function getCart() {
    if (window.CartUtils) {
        return window.CartUtils.getCart();
    }

    const userCartKey = getUserStorageKey('cart');
    try {
        const parsed = JSON.parse(localStorage.getItem(userCartKey) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

let productStockMap = new Map();

async function hydrateCartPricing() {
    try {
        const response = await fetch("/api/products");
        if (!response.ok) return;

        const products = await response.json();
        if (!Array.isArray(products) || products.length === 0) return;

        const productMap = new Map();
        productStockMap.clear();

        products.forEach((product) => {
            const id = Number.parseInt(product?.id, 10);
            if (Number.isFinite(id) && id > 0) {
                productMap.set(id, product);
                productStockMap.set(id, {
                    quantity: Number(product?.quantity) || 0,
                    name: product?.name || 'Product'
                });
            }
        });

        const cart = getCart();
        if (!Array.isArray(cart) || cart.length === 0) return;

        let changed = false;
        const enriched = cart.map((item) => {
            const id = Number.parseInt(item?.product_id, 10);
            if (!Number.isFinite(id) || id <= 0 || !productMap.has(id)) return item;

            const product = productMap.get(id);
            const next = { ...item };

            const offerPrice = Number(product?.offer_price);
            if ((!Number.isFinite(Number(next.price)) || Number(next.price) <= 0) && Number.isFinite(offerPrice) && offerPrice > 0) {
                next.price = offerPrice;
                changed = true;
            }

            const originalPrice = Number(product?.original_price);
            if ((!Number.isFinite(Number(next.original_price)) || Number(next.original_price) <= 0) && Number.isFinite(originalPrice) && originalPrice > 0) {
                next.original_price = originalPrice;
                changed = true;
            }

            const discount = Number(product?.discount);
            if ((!Number.isFinite(Number(next.discount)) || Number(next.discount) <= 0) && Number.isFinite(discount) && discount > 0) {
                next.discount = discount;
                changed = true;
            }

            if ((!next.image || next.image === "https://via.placeholder.com/240?text=Product") && product?.image_url) {
                next.image = product.image_url;
                changed = true;
            }

            const currentQty = Number(next.quantity) || 1;
            const availableStock = Number(product?.quantity) || 0;

            if (availableStock > 0 && currentQty > availableStock) {
                next.quantity = availableStock;
                changed = true;
                showCartMessage(`Only ${availableStock} unit(s) of ${product?.name || 'this product'} are available in stock. Quantity has been adjusted.`, "warning");
            }

            return next;
        });

        if (changed) {
            saveCart(enriched);
        }
    } catch {
        // Non-blocking
    }
}

function getAvailableStock(productId) {
    const stockInfo = productStockMap.get(productId);
    return stockInfo ? stockInfo.quantity : Infinity;
}

function saveCart(items) {
    if (window.CartUtils) {
        window.CartUtils.writeCart(items);
        return;
    }

    const userCartKey = getUserStorageKey('cart');
    localStorage.setItem(userCartKey, JSON.stringify(items));
}

function formatCurrency(value) {
    if (window.CartUtils) {
        return window.CartUtils.formatCurrency(value);
    }

    const amount = Number(value) || 0;
    return `\u20B9${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function showCartMessage(message, type = "info") {
    if (window.CartUtils) {
        window.CartUtils.showToast(message, type);
        return;
    }
    alert(message);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getItemKey(item) {
    const productId = Number.parseInt(item?.product_id, 10);
    if (Number.isFinite(productId) && productId > 0) {
        return `p:${productId}`;
    }

    const name = String(item?.name ?? "Item");
    const price = Number(item?.price) || 0;
    return `n:${name}|${price}`;
}

function getItemByKey(key) {
    return currentCart.find((item) => getItemKey(item) === key) || null;
}

function getOriginalUnitPrice(item) {
    const explicitOriginal = Number(item?.original_price);
    if (Number.isFinite(explicitOriginal) && explicitOriginal > 0) {
        return explicitOriginal;
    }

    const offerPrice = Number(item?.price) || 0;
    const discountPercent = Number(item?.discount) || 0;
    if (offerPrice > 0 && discountPercent > 0 && discountPercent < 100) {
        return offerPrice / (1 - (discountPercent / 100));
    }

    return offerPrice;
}

function getItemDiscountPercent(item) {
    const explicit = Number(item?.discount);
    if (Number.isFinite(explicit) && explicit > 0) {
        return Math.round(explicit);
    }

    const offerPrice = Number(item?.price) || 0;
    const originalPrice = getOriginalUnitPrice(item);
    if (originalPrice <= offerPrice || originalPrice <= 0) return 0;

    return Math.round(((originalPrice - offerPrice) / originalPrice) * 100);
}

function calculateSummary(cart) {
    const summary = window.CartUtils
        ? window.CartUtils.getSummary(cart)
        : cart.reduce((acc, item) => {
            const qty = Math.max(1, Number(item.quantity) || 1);
            const price = Number(item.price) || 0;
            acc.totalItems += qty;
            acc.subtotal += price * qty;
            return acc;
        }, { totalItems: 0, subtotal: 0, uniqueItems: cart.length });

    const originalSubtotal = cart.reduce((sum, item) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        return sum + (getOriginalUnitPrice(item) * qty);
    }, 0);

    const finalPrice = summary.subtotal;
    const discountAmount = Math.max(0, originalSubtotal - finalPrice);
    const discountPercent = originalSubtotal > 0
        ? Math.round((discountAmount / originalSubtotal) * 100)
        : 0;

    return {
        ...summary,
        originalSubtotal,
        discountAmount,
        discountPercent,
        finalPrice
    };
}

function renderCartPage() {
    currentCart = getCart();
    const summary = calculateSummary(currentCart);

    const cartList = document.getElementById("cartList");
    const emptyState = document.getElementById("emptyState");
    const summaryCard = document.getElementById("summaryCard");
    const placeOrderBtn = document.getElementById("placeOrderBtn");

    if (document.getElementById("headerCartCount")) document.getElementById("headerCartCount").textContent = String(summary.totalItems);
    if (document.getElementById("cartMeta")) document.getElementById("cartMeta").textContent = `${summary.totalItems} item(s)`;
    if (document.getElementById("summaryItems")) document.getElementById("summaryItems").textContent = String(summary.totalItems);
    if (document.getElementById("summaryOriginal")) document.getElementById("summaryOriginal").textContent = formatCurrency(summary.originalSubtotal);
    if (document.getElementById("summaryDiscountPercent")) document.getElementById("summaryDiscountPercent").textContent = `${summary.discountPercent}%`;
    if (document.getElementById("summaryDiscount")) document.getElementById("summaryDiscount").textContent = `-${formatCurrency(summary.discountAmount)}`;
    if (document.getElementById("summaryFinal")) document.getElementById("summaryFinal").textContent = formatCurrency(summary.finalPrice);

    const hasItems = summary.totalItems > 0;
    if (emptyState) emptyState.hidden = hasItems;
    if (summaryCard) summaryCard.hidden = !hasItems;
    if (placeOrderBtn) placeOrderBtn.disabled = !hasItems;

    if (!hasItems || !cartList) {
        if (cartList) cartList.innerHTML = "";
        return;
    }

    cartList.innerHTML = currentCart.map((item) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const price = Number(item.price) || 0;
        const originalPrice = getOriginalUnitPrice(item);
        const discountPercent = getItemDiscountPercent(item);
        const key = escapeHtml(getItemKey(item));
        const name = escapeHtml(item.name || "Product");
        const image = item.image || "https://via.placeholder.com/240?text=Product";
        const lineTotal = price * qty;

        const productId = Number.parseInt(item?.product_id, 10);
        const availableStock = Number.isFinite(productId) && productId > 0
            ? getAvailableStock(productId)
            : Infinity;

        const maxQty = Math.min(99, availableStock);
        const isLowStock = availableStock > 0 && availableStock <= 5;
        const isOutOfStock = availableStock === 0;

        return `
            <article class="cart-item ${isOutOfStock ? 'out-of-stock' : ''}" data-item-key="${key}" data-product-id="${productId}">
                <div class="item-image">
                    <img src="${image}" alt="${name}" onerror="this.src='https://via.placeholder.com/240?text=Product';">
                    ${isOutOfStock ? '<div class="stock-badge out">Out of Stock</div>' : ''}
                    ${isLowStock && !isOutOfStock ? `<div class="stock-badge low">Only ${availableStock} left</div>` : ''}
                </div>
                <div class="item-info">
                    <h3 class="item-title">${name}</h3>
                    <p class="item-meta">Festival stock verified</p>
                    <div class="item-price">${formatCurrency(price)}</div>
                    <div class="item-original-line">
                        MRP <span class="item-original">${formatCurrency(originalPrice)}</span>
                        ${discountPercent > 0 ? `<span class="item-off">${discountPercent}% OFF</span>` : ""}
                    </div>
                    ${isOutOfStock ?
                '<p class="stock-warning">This product is currently out of stock. Please remove it from your cart.</p>' :
                availableStock < qty && availableStock > 0 ?
                    `<p class="stock-warning">Only ${availableStock} units available. Quantity has been adjusted.</p>` : ''
            }
                    <div class="item-actions">
                        <div class="qty-control">
                            <button type="button" class="qty-btn" data-action="decrease" ${qty <= 1 || isOutOfStock ? 'disabled' : ''}>-</button>
                            <input class="qty-input" type="number" min="1" max="${maxQty}" value="${isOutOfStock ? 0 : qty}" ${isOutOfStock ? 'disabled' : ''}>
                            <button type="button" class="qty-btn" data-action="increase" ${qty >= maxQty || isOutOfStock ? 'disabled' : ''}>+</button>
                        </div>
                        <button type="button" class="remove-btn" data-action="remove">Remove</button>
                    </div>
                </div>
                <div class="line-total">
                    <p>Line Total</p>
                    <strong>${isOutOfStock ? 'N/A' : formatCurrency(lineTotal)}</strong>
                </div>
            </article>
        `;
    }).join("");

    const hasOutOfStock = currentCart.some(item => {
        const productId = Number.parseInt(item?.product_id, 10);
        if (!Number.isFinite(productId) || productId <= 0) return false;
        return getAvailableStock(productId) === 0;
    });

    if (hasOutOfStock && placeOrderBtn) {
        placeOrderBtn.disabled = true;
        placeOrderBtn.title = "Please remove out of stock items to place order";
    }
}

function handleCartListClick(event) {
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;

    const cartItem = event.target.closest(".cart-item");
    if (!cartItem) return;

    const itemKey = cartItem.dataset.itemKey;
    const item = getItemByKey(itemKey);
    if (!item) return;

    const productId = Number.parseInt(item?.product_id, 10);
    const availableStock = Number.isFinite(productId) && productId > 0
        ? getAvailableStock(productId)
        : Infinity;

    const qty = Math.max(1, Number(item.quantity) || 1);
    const action = actionNode.dataset.action;

    if (action === "remove") {
        updateItemQuantity(item, 0);
        showCartMessage("Item removed from cart.", "info");
        return;
    }

    if (action === "increase") {
        if (availableStock > 0 && qty >= availableStock) {
            showCartMessage(`Only ${availableStock} units available in stock.`, "warning");
            return;
        }
        updateItemQuantity(item, Math.min(99, availableStock, qty + 1));
        return;
    }

    if (action === "decrease") {
        if (qty <= 1) return;
        updateItemQuantity(item, qty - 1);
    }
}

function handleQuantityInputChange(event) {
    const input = event.target.closest(".qty-input");
    if (!input) return;

    const cartItem = event.target.closest(".cart-item");
    if (!cartItem) return;

    const item = getItemByKey(cartItem.dataset.itemKey);
    if (!item) return;

    const productId = Number.parseInt(item?.product_id, 10);
    const availableStock = Number.isFinite(productId) && productId > 0
        ? getAvailableStock(productId)
        : Infinity;

    let requested = Number.parseInt(input.value, 10);

    if (availableStock > 0 && requested > availableStock) {
        requested = availableStock;
        showCartMessage(`Only ${availableStock} units available in stock. Quantity has been adjusted.`, "warning");
    }

    const nextQuantity = Number.isFinite(requested) ? Math.min(99, availableStock, Math.max(1, requested)) : 1;
    input.value = String(nextQuantity);
    updateItemQuantity(item, nextQuantity);
}

function handleQuantityInputValidation(event) {
    const input = event.target.closest(".qty-input");
    if (!input) return;

    const cartItem = event.target.closest(".cart-item");
    if (!cartItem) return;

    const item = getItemByKey(cartItem.dataset.itemKey);
    if (!item) return;

    const productId = Number.parseInt(item?.product_id, 10);
    const availableStock = Number.isFinite(productId) && productId > 0
        ? getAvailableStock(productId)
        : Infinity;

    let value = Number.parseInt(input.value, 10);

    if (isNaN(value) || value < 1) {
        input.value = 1;
    } else if (availableStock > 0 && value > availableStock) {
        input.value = availableStock;
        showCartMessage(`Maximum available stock is ${availableStock}.`, "warning");
    } else if (value > 99) {
        input.value = 99;
    }
}

function handleQuantityInputBlur(event) {
    const input = event.target.closest(".qty-input");
    if (!input) return;

    const cartItem = event.target.closest(".cart-item");
    if (!cartItem) return;

    const item = getItemByKey(cartItem.dataset.itemKey);
    if (!item) return;

    const currentValue = Number.parseInt(input.value, 10);
    const itemQuantity = Number(item.quantity) || 1;

    if (currentValue !== itemQuantity) {
        const productId = Number.parseInt(item?.product_id, 10);
        const availableStock = Number.isFinite(productId) && productId > 0
            ? getAvailableStock(productId)
            : Infinity;

        const validQuantity = Number.isFinite(currentValue)
            ? Math.min(99, availableStock, Math.max(1, currentValue))
            : 1;

        updateItemQuantity(item, validQuantity);
    }
}

function updateItemQuantity(item, quantity) {
    const productId = Number.parseInt(item.product_id, 10);
    const hasProductId = Number.isFinite(productId) && productId > 0;

    if (hasProductId) {
        const availableStock = getAvailableStock(productId);
        if (availableStock > 0 && quantity > availableStock) {
            showCartMessage(`Only ${availableStock} units available in stock.`, "warning");
            quantity = availableStock;
        }
    }

    if (window.CartUtils && hasProductId) {
        window.CartUtils.setQuantity(productId, quantity);
        return;
    }

    const key = getItemKey(item);
    const nextCart = getCart().map((entry) => ({ ...entry }));
    const index = nextCart.findIndex((entry) => getItemKey(entry) === key);
    if (index < 0) return;

    if (quantity <= 0) {
        nextCart.splice(index, 1);
    } else {
        nextCart[index].quantity = Math.max(1, Math.min(99, Number(quantity) || 1));
    }

    saveCart(nextCart);
    renderCartPage();
}

async function placeOrder() {
    const cart = getCart();
    const summary = calculateSummary(cart);

    if (summary.totalItems <= 0) {
        showCartMessage("Add products to place your order.", "info");
        return;
    }

    for (const item of cart) {
        const productId = Number.parseInt(item?.product_id, 10);
        if (Number.isFinite(productId) && productId > 0) {
            const availableStock = getAvailableStock(productId);
            if (availableStock === 0) {
                showCartMessage(`${item.name || 'Some items'} are out of stock. Please remove them to continue.`, "error");
                return;
            }
            if (availableStock > 0 && (item.quantity || 1) > availableStock) {
                showCartMessage(`Only ${availableStock} units of ${item.name || 'some items'} are available. Please adjust quantity.`, "error");
                return;
            }
        }
    }

    window.location.href = "/payment.html";
}

async function completeOrder(orderDetails = {}) {
    currentCart = getCart();
    const summary = calculateSummary(currentCart);

    if (summary.totalItems <= 0) {
        showCartMessage("Add products to place your order.", "info");
        return;
    }

    // Double-check stock
    for (const item of currentCart) {
        const productId = Number.parseInt(item?.product_id, 10);
        if (Number.isFinite(productId) && productId > 0) {
            const availableStock = getAvailableStock(productId);
            if (availableStock === 0) {
                showCartMessage(`${item.name || 'Some items'} are now out of stock. Please update your cart.`, "error");
                return;
            }
            if (availableStock > 0 && (item.quantity || 1) > availableStock) {
                showCartMessage(`Only ${availableStock} units of ${item.name || 'some items'} are now available. Please update your cart.`, "error");
                return;
            }
        }
    }

    const orderId = `MRA${Date.now().toString().slice(-8)}`;
    const orderedAt = new Date();
    const userId = localStorage.getItem('userId') || null;

    // âœ… NEW: Save address to DB if logged in + new address
    if (userId && orderDetails.address && document.getElementById('saveAddressCheckbox')?.checked) {
        try {
            await fetch('/api/user/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    address: orderDetails.address
                })
            });
            console.log('âœ… Address saved to database');
        } catch (error) {
            console.warn('Address save failed:', error);
        }
    }

    // Save to DATABASE FIRST (PRIMARY)
    let dbSaveSuccess = false;
    try {
        const orderData = {
            order_id: orderId,
            user_id: userId,
            customer_name: orderDetails.address?.name || '',
            mobile: orderDetails.address?.mobile || '',
            address_line1: orderDetails.address?.line1 || '',
            address_line2: orderDetails.address?.line2 || '',
            city: orderDetails.address?.city || '',
            state: orderDetails.address?.state || '',
            pin_code: orderDetails.address?.pin || '',
            payment_method: orderDetails.paymentMethod || 'upi',
            total_amount: summary.finalPrice,
            items: currentCart.map(item => ({
                product_id: item.product_id || null,
                name: item.name || 'Product',
                quantity: item.quantity || 1,
                price: item.price || 0
            }))
        };

        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            dbSaveSuccess = true;
            console.log('âœ… Order saved to DATABASE');

            // Refresh orders from DB
            await fetchUserOrdersFromDB();
        }
    } catch (error) {
        console.warn('âŒ Database save failed:', error);
    }

    // LocalStorage BACKUP only if DB fails
    if (!dbSaveSuccess) {
        const userOrdersKey = getUserStorageKey('orders');
        let orders = [];
        try {
            const parsed = JSON.parse(localStorage.getItem(userOrdersKey) || "[]");
            orders = Array.isArray(parsed) ? parsed : [];
        } catch {
            orders = [];
        }

        orders.push({
            id: orderId,
            date: orderedAt.toISOString(),
            items: currentCart,
            total: summary.finalPrice,
            address: orderDetails.address || null,
            paymentMethod: orderDetails.paymentMethod || null
        });

        localStorage.setItem(userOrdersKey, JSON.stringify(orders));
    }

    // Clear cart
    if (window.CartUtils) {
        window.CartUtils.clearCart();
    } else {
        const userCartKey = getUserStorageKey('cart');
        localStorage.removeItem(userCartKey);
        renderCartPage();
    }

    // Success UI
    const success = document.getElementById("orderSuccess");
    const successMessage = document.getElementById("orderSuccessMessage");
    if (success && successMessage) {
        successMessage.textContent = `Order ${orderId} confirmed on ${orderedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`;
        success.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    showCartMessage("âœ… Order confirmed. Thank you for shopping!", "success");
    setTimeout(() => {
        window.location.href = "/order-details.html";
    }, 800);
}

async function reduceStock(cart) {
    // Stock updates are now handled by backend transaction in order creation.
    return cart;
}

// âœ… EXPOSE ALL FUNCTIONS FOR payment.html - GLOBAL ACCESS
window.getUserStorageKey = getUserStorageKey;
window.getCart = getCart;
window.getUserAddresses = getUserAddresses;
window.saveUserAddresses = saveUserAddresses;
window.showCartMessage = showCartMessage;
window.formatCurrency = formatCurrency;
window.calculateSummary = calculateSummary;
window.completeOrder = completeOrder;
window.escapeHtml = escapeHtml;

// âœ… NEW: Address save function for payment.html
window.saveAddressToStorage = async function (addr) {
    const userId = localStorage.getItem('userId');
    const addresses = getUserAddresses();

    // Check for duplicate
    const isDuplicate = addresses.some(a =>
        a.name === addr.name &&
        a.mobile === addr.mobile &&
        a.line1 === addr.line1 &&
        a.city === addr.city &&
        a.pin === addr.pin
    );

    if (!isDuplicate) {
        // Add as FIRST (DEFAULT) address
        const newAddresses = [{ ...addr, is_default: true }, ...addresses.map(a => ({ ...a, is_default: false }))];
        saveUserAddresses(newAddresses);
        showCartMessage('Address saved successfully!', 'success');

        // Save to DB if logged in
        if (userId) {
            try {
                await fetch('/api/user/addresses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, address: addr })
                });
            } catch (error) {
                console.warn('DB save failed:', error);
            }
        }
    }
};

