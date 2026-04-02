(function () {
    const CART_KEY = "cart";

    // derive storage key based on login state. when a user is logged in we
    // store their cart under a unique key so that it survives across
    // logouts/logins. guests always use the generic CART_KEY.
    function getCartStorageKey() {
        if (isLoggedIn()) {
            // username may contain unsafe characters so encode it
            const session = window.AuthSession && window.AuthSession.get();
            const user = session && session.username ? String(session.username) : "";
            return `${CART_KEY}_${encodeURIComponent(user)}`;
        }
        return CART_KEY;
    }

    function safeInt(value, fallback = 0) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function safeNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function safeString(value, fallback = "") {
        return typeof value === "string" ? value : fallback;
    }

    function buildItemKey(item) {
        const productId = safeInt(item.product_id, 0);
        if (productId > 0) return `p:${productId}`;

        const name = safeString(item.name, "Item");
        const price = safeNumber(item.price, 0);
        return `n:${name}|${price}`;
    }

    function normalizeCart(rawCart) {
        if (!Array.isArray(rawCart)) return [];

        const grouped = new Map();

        rawCart.forEach((rawItem, index) => {
            if (!rawItem || typeof rawItem !== "object") return;

            const quantity = Math.max(1, safeInt(rawItem.quantity, 1));
            const productId = safeInt(rawItem.product_id ?? rawItem.id, 0);
            const hasProductId = productId > 0;
            const key = hasProductId ? `p:${productId}` : buildItemKey(rawItem);

            if (!grouped.has(key)) {
                grouped.set(key, {
                    id: hasProductId ? productId : Date.now() + index,
                    product_id: hasProductId ? productId : null,
                    name: safeString(rawItem.name, "Item"),
                    price: Math.max(0, safeNumber(rawItem.price, 0)),
                    original_price: Math.max(0, safeNumber(rawItem.original_price ?? rawItem.price, 0)),
                    discount: Math.max(0, safeNumber(rawItem.discount, 0)),
                    image: safeString(rawItem.image, safeString(rawItem.image_url, "")),
                    quantity: 0
                });
            }

            const item = grouped.get(key);
            item.quantity += quantity;
            item.original_price = Math.max(0, safeNumber(rawItem.original_price ?? item.original_price ?? item.price, item.price));
            item.discount = Math.max(item.discount, safeNumber(rawItem.discount, item.discount));
        });

        return Array.from(grouped.values());
    }

    function readRawCart() {
        try {
            const key = getCartStorageKey();
            const parsed = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function getCart() {
        return normalizeCart(readRawCart());
    }

    function writeCart(items) {
        const normalized = normalizeCart(items);
        const key = getCartStorageKey();
        localStorage.setItem(key, JSON.stringify(normalized));
        emitUpdate(normalized);
        return normalized;
    }

    function getSummary(cart = getCart()) {
        const totalItems = cart.reduce((sum, item) => {
            return sum + Math.max(1, safeInt(item.quantity, 1));
        }, 0);

        const subtotal = cart.reduce((sum, item) => {
            const quantity = Math.max(1, safeInt(item.quantity, 1));
            const price = Math.max(0, safeNumber(item.price, 0));
            return sum + (price * quantity);
        }, 0);

        return {
            totalItems,
            subtotal,
            uniqueItems: cart.length
        };
    }

    function emitUpdate(cart = getCart()) {
        window.dispatchEvent(new CustomEvent("cart:updated", {
            detail: {
                cart,
                summary: getSummary(cart)
            }
        }));
    }

    function findIndexByProductId(cart, productId) {
        const id = safeInt(productId, 0);
        return cart.findIndex((item) => safeInt(item.product_id, 0) === id);
    }

    function addProduct(product, quantity = 1, options = {}) {
        // ensure only authenticated users can add items
        if (!isLoggedIn()) {
            showLoginPrompt("Please login to add products to cart.");
            return { added: 0, cart: getCart(), summary: getSummary() };
        }

        if (!product || typeof product !== "object") {
            return { added: 0, cart: getCart(), summary: getSummary() };
        }

        const productId = safeInt(product.id ?? product.product_id, 0);
        if (productId <= 0) {
            return { added: 0, cart: getCart(), summary: getSummary() };
        }

        const requested = Math.max(1, safeInt(quantity, 1));
        const cap = options && Number.isFinite(Number(options.maxQuantity))
            ? Math.max(0, safeInt(options.maxQuantity, 0))
            : Number.POSITIVE_INFINITY;

        const cart = getCart();
        const index = findIndexByProductId(cart, productId);
        const existingQty = index >= 0 ? Math.max(1, safeInt(cart[index].quantity, 1)) : 0;
        const remaining = Number.isFinite(cap) ? Math.max(0, cap - existingQty) : requested;
        const addable = Math.max(0, Math.min(requested, remaining));

        if (addable <= 0) {
            return { added: 0, cart, summary: getSummary(cart) };
        }

        if (index >= 0) {
            cart[index].quantity = existingQty + addable;
            cart[index].name = safeString(product.name, cart[index].name);
            cart[index].price = Math.max(0, safeNumber(product.offer_price ?? product.price, cart[index].price));
            cart[index].original_price = Math.max(0, safeNumber(product.original_price ?? product.price, cart[index].original_price ?? cart[index].price));
            cart[index].discount = Math.max(0, safeNumber(product.discount, cart[index].discount));
            cart[index].image = safeString(product.image_url ?? product.image, cart[index].image);
        } else {
            cart.push({
                id: productId,
                product_id: productId,
                name: safeString(product.name, "Item"),
                price: Math.max(0, safeNumber(product.offer_price ?? product.price, 0)),
                original_price: Math.max(0, safeNumber(product.original_price ?? product.price, product.offer_price ?? product.price ?? 0)),
                discount: Math.max(0, safeNumber(product.discount, 0)),
                image: safeString(product.image_url ?? product.image, ""),
                quantity: addable
            });
        }

        const saved = writeCart(cart);
        return { added: addable, cart: saved, summary: getSummary(saved) };
    }

    function setQuantity(productId, quantity, options = {}) {
        const id = safeInt(productId, 0);
        if (id <= 0) return { updated: false, cart: getCart(), summary: getSummary() };

        const cart = getCart();
        const index = findIndexByProductId(cart, id);
        if (index < 0) return { updated: false, cart, summary: getSummary(cart) };

        const cap = options && Number.isFinite(Number(options.maxQuantity))
            ? Math.max(0, safeInt(options.maxQuantity, 0))
            : Number.POSITIVE_INFINITY;

        const requested = Math.max(0, safeInt(quantity, 0));
        const nextQty = Number.isFinite(cap) ? Math.min(requested, cap) : requested;

        if (nextQty <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = nextQty;
        }

        const saved = writeCart(cart);
        return { updated: true, cart: saved, summary: getSummary(saved) };
    }

    function removeProduct(productId) {
        return setQuantity(productId, 0);
    }

    function clearCart() {
        // clearing always targets the current storage key; when the caller is
        // logged out this clears the guest cart. user-specific carts are left
        // intact so that a user logging back in will see their previous items.
        const saved = writeCart([]);
        return { cart: saved, summary: getSummary(saved) };
    }

    function isLoggedIn() {
        if (window.AuthSession && typeof window.AuthSession.isLoggedIn === "function") {
            return window.AuthSession.isLoggedIn();
        }

        const token = localStorage.getItem("token");
        const username = localStorage.getItem("username");
        return Boolean(token && username);
    }

    function getProductQuantity(productId) {
        const cart = getCart();
        const index = findIndexByProductId(cart, productId);
        if (index < 0) return 0;
        return Math.max(1, safeInt(cart[index].quantity, 1));
    }

function formatCurrency(value) {
    const amount = Math.max(0, safeNumber(value, 0));
    return `\u20B9${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

    function ensureToastStyles() {
        if (document.getElementById("app-toast-style")) return;

        const style = document.createElement("style");
        style.id = "app-toast-style";
        style.textContent = `
            .app-toast-container {
                position: fixed;
                top: 18px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 12000;
                display: grid;
                gap: 10px;
                pointer-events: none;
                width: 90%;
                max-width: 480px;
            }
            .app-toast-container > .app-toast {
                pointer-events: auto;
                font-size: 16px;
                padding: 16px 20px;
                min-width: 300px;
            }
            .app-toast {
                min-width: 240px;
                max-width: 320px;
                border-radius: 12px;
                padding: 12px 14px;
                color: #fff;
                font: 500 13px/1.35 "Poppins", sans-serif;
                box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
                transform: translateY(10px);
                opacity: 0;
                animation: appToastIn 180ms ease forwards;
            }
            .app-toast.success { background: linear-gradient(135deg, #1ca95a, #138347); }
            .app-toast.error { background: linear-gradient(135deg, #d33d3d, #b71f1f); }
            .app-toast.info { background: linear-gradient(135deg, #2d5fd6, #1d43a5); }
            @keyframes appToastIn {
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureLoginPromptStyles() {
        if (document.getElementById("app-login-prompt-style")) return;

        const style = document.createElement("style");
        style.id = "app-login-prompt-style";
        style.textContent = `
            .app-login-prompt-overlay {
                position: fixed;
                inset: 0;
                background: rgba(2, 8, 22, 0.62);
                backdrop-filter: blur(4px);
                z-index: 14000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            .app-login-prompt-overlay.open {
                display: flex;
            }
            .app-login-prompt-card {
                width: min(360px, calc(100% - 12px));
                border-radius: 14px;
                border: 1px solid rgba(164, 191, 235, 0.28);
                background: linear-gradient(160deg, rgba(16, 39, 71, 0.98), rgba(10, 24, 45, 0.98));
                box-shadow: 0 24px 40px rgba(3, 10, 25, 0.52);
                color: #e7f2ff;
                padding: 16px;
                font-family: "Poppins", "Segoe UI", sans-serif;
            }
            .app-login-prompt-title {
                margin: 0 0 8px;
                font-size: 18px;
                font-weight: 700;
                color: #f5faff;
            }
            .app-login-prompt-text {
                margin: 0;
                font-size: 14px;
                line-height: 1.45;
                color: #d5e7ff;
            }
            .app-login-prompt-actions {
                margin-top: 14px;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                flex-wrap: wrap;
            }
            .app-login-prompt-btn {
                min-height: 36px;
                padding: 0 14px;
                border-radius: 10px;
                border: 1px solid transparent;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                font-family: inherit;
            }
            .app-login-prompt-btn.cancel {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(171, 195, 233, 0.32);
                color: #e2efff;
            }
            .app-login-prompt-btn.login {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                border-color: #2563eb;
                color: #ffffff;
                box-shadow: 0 10px 20px rgba(37, 99, 235, 0.28);
            }
            .app-login-prompt-btn:hover {
                filter: brightness(1.06);
            }
        `;
        document.head.appendChild(style);
    }

    function closeLoginPrompt() {
        const overlay = document.getElementById("appLoginPrompt");
        if (!overlay) return;
        overlay.classList.remove("open");
    }

    function ensureLoginPrompt() {
        let overlay = document.getElementById("appLoginPrompt");
        if (overlay) return overlay;

        ensureLoginPromptStyles();

        overlay = document.createElement("div");
        overlay.id = "appLoginPrompt";
        overlay.className = "app-login-prompt-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.innerHTML = `
            <div class="app-login-prompt-card" role="document">
                <h3 class="app-login-prompt-title">Login Required</h3>
                <p class="app-login-prompt-text" id="appLoginPromptText">Please login to add products to cart.</p>
                <div class="app-login-prompt-actions">
                    <button type="button" class="app-login-prompt-btn cancel" id="appLoginPromptCancel">Cancel</button>
                    <button type="button" class="app-login-prompt-btn login" id="appLoginPromptLogin">Login</button>
                </div>
            </div>
        `;

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                closeLoginPrompt();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && overlay.classList.contains("open")) {
                closeLoginPrompt();
            }
        });

        overlay.querySelector("#appLoginPromptCancel")?.addEventListener("click", () => {
            closeLoginPrompt();
        });

        overlay.querySelector("#appLoginPromptLogin")?.addEventListener("click", () => {
            closeLoginPrompt();
            const nextPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
            const loginUrl = `/login.html?next=${encodeURIComponent(nextPath)}`;
            window.location.href = loginUrl;
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function showLoginPrompt(message = "Please login to add products to cart.") {
        const overlay = ensureLoginPrompt();
        const textNode = overlay.querySelector("#appLoginPromptText");
        if (textNode) {
            textNode.textContent = message;
        }
        overlay.classList.add("open");
    }

    function showToast(message, type = "success") {
        ensureToastStyles();

        let container = document.getElementById("appToastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "appToastContainer";
            container.className = "app-toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `app-toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(8px)";
            setTimeout(() => toast.remove(), 180);
        }, 2200);
    }

    window.CartUtils = {
        getCart,
        writeCart,
        getSummary,
        addProduct,
        setQuantity,
        removeProduct,
        clearCart,
        isLoggedIn,
        getProductQuantity,
        formatCurrency,
        showToast,
        showLoginPrompt,
        emitUpdate
    };
})();
