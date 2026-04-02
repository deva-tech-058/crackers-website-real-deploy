document.addEventListener("DOMContentLoaded", function () {
    loadHeroSlides();
    loadProducts();
    loadCategories();
    if (window.CartUtils) {
        window.addEventListener("cart:updated", updateCartUI);
    }
    updateCartUI();
    bindProductModalEvents();
});

/* ================= STATE ================= */

let currentSlide = 0;
let allProducts = [];
let selectedProduct = null;
let selectedQty = 1;

/* ================= HELPERS ================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toCurrency(value) {
    const amount = Number(value) || 0;
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getStockState(quantity) {
    const qty = Number(quantity) || 0;
    if (qty <= 0) return { status: "out", label: "Out of Stock" };
    if (qty <= 5) return { status: "low", label: "Low Stock" };
    return { status: "in", label: "In Stock" };
}

function getProductById(id) {
    return allProducts.find((item) => Number(item.id) === Number(id)) || null;
}

function goToCategoryProducts(categoryId, categoryName) {
    const idValue = String(categoryId ?? "").trim();
    if (!idValue) return;

    const params = new URLSearchParams();
    params.set("categoryId", idValue);

    const safeName = String(categoryName ?? "").trim();
    if (safeName) {
        params.set("categoryName", safeName);
    }

    window.location.href = `/all-products.html?${params.toString()}`;
}

/* ================= HERO SLIDER ================= */

async function loadHeroSlides() {
    try {
        const res = await fetch("/api/hero");
        const slides = await res.json();

        const container = document.getElementById("heroContainer");
        const dotsContainer = document.getElementById("dots");
        if (!container || !dotsContainer) return;

        container.innerHTML = "";
        dotsContainer.innerHTML = "";

        if (!Array.isArray(slides) || slides.length === 0) {
            return;
        }

        slides.forEach((slide, index) => {
            const fallbackImage = String(slide.image || "").trim();
            const heroImageUrl =
                slide.image_url ||
                (fallbackImage
                    ? (/^[a-z][a-z\d+\-.]*:/i.test(fallbackImage) || fallbackImage.startsWith("//") || fallbackImage.startsWith("/")
                        ? fallbackImage
                        : `/uploads/${fallbackImage}`)
                    : "https://via.placeholder.com/1440x640?text=Hero+Slide");

            container.innerHTML += `
                <div class="slide ${index === 0 ? "active" : ""}" style="background-image:url('${heroImageUrl}')">
                    <div class="overlay"></div>
                    <div class="hero-content">
                        <h1>${slide.title || "Mr.A Crackers"}</h1>
                        <p>${slide.subtitle || "Premium fireworks collection"}</p>
                    </div>
                </div>
            `;

            const dot = document.createElement("div");
            dot.classList.add("dot");
            if (index === 0) dot.classList.add("active");
            dot.onclick = () => showSlide(index);
            dotsContainer.appendChild(dot);
        });

        initSlider();
    } catch (err) {
        console.log("Hero Load Error:", err);
    }
}

function initSlider() {
    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll(".dot");

    if (slides.length === 0) return;

    window.showSlide = function (i) {
        slides.forEach((s) => s.classList.remove("active"));
        dots.forEach((d) => d.classList.remove("active"));

        slides[i].classList.add("active");
        dots[i].classList.add("active");

        currentSlide = i;
    };

    window.nextSlide = function () {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    };

    window.prevSlide = function () {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
    };

    setInterval(window.nextSlide, 5000);
}

/* ================= PRODUCTS ================= */

function loadProducts() {
    fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
            allProducts = Array.isArray(data) ? data : [];
            renderBestSellingProducts();
        })
        .catch((err) => {
            console.log("Product Error:", err);
            allProducts = [];
            renderBestSellingProducts();
        });
}

function renderBestSellingProducts() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    grid.innerHTML = "";

    const bestSelling = allProducts.filter((p) => p && p.is_best_selling === true);
    if (bestSelling.length === 0) {
        grid.innerHTML = "<p style='text-align:center;'>No Best Selling Products</p>";
        return;
    }

    grid.innerHTML = bestSelling
        .map((p) => {
            const productId = Number.isFinite(Number(p.id)) ? Number(p.id) : 0;
            const quantity = Math.max(0, Number(p.quantity) || 0);
            const stock = getStockState(quantity);
            const isOutOfStock = stock.status === "out";
            const stockClass = stock.status === "low" ? "low" : stock.status === "out" ? "out" : "";

            const safeName = escapeHtml(p.name || "Unnamed Product");
            const safeCategory = escapeHtml(p.category_name || "Festival Collection");
            const imageUrl = p.image_url || `https://via.placeholder.com/300?text=${encodeURIComponent(p.name || "Product")}`;
            const discount = Math.max(0, Number(p.discount) || 0);
            const offerPrice = Number(p.offer_price) || 0;
            const originalPrice = Number(p.original_price) || 0;

            return `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${imageUrl}" alt="${safeName}" onerror="this.src='https://via.placeholder.com/300?text=Product';">
                        <div class="badge discount">${discount}% OFF</div>
                        <div class="badge stock ${stockClass}">${stock.label}</div>
                    </div>

                    <div class="product-info">
                        <h4>${safeName}</h4>
                        <p class="category-name">${safeCategory}</p>

                        <div class="price-section">
                            <span class="offer-price">${toCurrency(offerPrice)}</span>
                            <span class="original-price">${toCurrency(originalPrice)}</span>
                        </div>

                        <div class="per-box">Available: ${quantity}</div>

                        <div class="buttons-row">
                            <button class="view-btn" type="button" onclick="viewProduct(${productId})">
                                View
                            </button>

                            <button class="add-cart-btn" type="button"
                                ${isOutOfStock ? "disabled style='opacity:0.5;cursor:not-allowed;'" : ""}
                                onclick="${isOutOfStock ? "" : `addToCart(${productId}, 1)`}">
                                ${isOutOfStock ? "Out of Stock" : "Add to Cart"}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
}

/* ================= CATEGORIES ================= */

function loadCategories() {
    fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
            const grid = document.getElementById("categoryGrid");
            if (!grid) return;

            grid.innerHTML = "";

            if (!Array.isArray(data) || data.length === 0) {
                grid.innerHTML = "<p>No categories found</p>";
                return;
            }

            data.forEach((cat) => {
                const categoryId = String(cat?.id ?? "").trim();
                if (!categoryId) return;

                const categoryName = String(cat?.name ?? "Category").trim() || "Category";

                const card = document.createElement("button");
                card.type = "button";
                card.className = "category-card";
                card.textContent = categoryName;
                card.setAttribute("aria-label", `View ${categoryName} products`);
                card.addEventListener("click", () => {
                    goToCategoryProducts(categoryId, categoryName);
                });

                grid.appendChild(card);
            });
        })
        .catch((err) => console.log("Category Error:", err));
}

/* ================= CART ================= */

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

function updateCartUI() {
    const cart = getCart();
    const count = document.getElementById("cartCount");
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");

    const totalItems = window.CartUtils
        ? window.CartUtils.getSummary(cart).totalItems
        : cart.reduce((sum, item) => {
            const qty = Number(item.quantity);
            return sum + (qty > 0 ? qty : 1);
        }, 0);

    if (count) count.textContent = String(totalItems);

    if (cartItems && cartTotal) {
        cartItems.innerHTML = "";
        let total = 0;

        cart.forEach((item) => {
            const qty = Number(item.quantity);
            const safeQty = qty > 0 ? qty : 1;
            const price = Number(item.price) || 0;
            total += price * safeQty;

            cartItems.innerHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; gap:8px;">
                    <span>${escapeHtml(item.name || "Item")}${safeQty > 1 ? ` x${safeQty}` : ""}</span>
                    <span>${toCurrency(price * safeQty)}</span>
                </div>
            `;
        });

        cartTotal.textContent = toCurrency(total);
    }
}

function showCartMessage(message, type = "success") {
    if (window.CartUtils) {
        window.CartUtils.showToast(message, type);
        return;
    }

    alert(message);
}

function addToCart(productId, quantity = 1, options = {}) {
    // require login before modifying cart
    if (window.CartUtils && !window.CartUtils.isLoggedIn()) {
        if (typeof window.CartUtils.showLoginPrompt === "function") {
            window.CartUtils.showLoginPrompt("Please login to add products to cart.");
        } else {
            showCartMessage("Please login to add products to cart", "info");
        }
        return { added: 0 };
    }

    const product = getProductById(productId);
    if (!product) return { added: 0 };

    const available = Math.max(0, Number(product.quantity) || 0);
    if (available <= 0) {
        showCartMessage("This product is out of stock.", "error");
        return { added: 0 };
    }

    const requested = Number.parseInt(quantity, 10);
    const unitsToAdd = clamp(Number.isFinite(requested) ? requested : 1, 1, Math.max(available, 1));

    if (window.CartUtils) {
        const result = window.CartUtils.addProduct(product, unitsToAdd, { maxQuantity: available });
        updateCartUI();

        if (result.added <= 0) {
            // nothing added; do not display additional information here
            return result;
        }

        if (!options.silent) {
            showCartMessage(
                result.added > 1
                    ? `${result.added} items added to cart!`
                    : `${product.name} added to cart!`
            );
        }

        return result;
    }

    const cart = getCart();
    for (let i = 0; i < unitsToAdd; i += 1) {
        cart.push({
            id: Date.now() + i,
            product_id: product.id,
            name: product.name,
            price: Number(product.offer_price) || 0,
            original_price: Number(product.original_price) || Number(product.offer_price) || 0,
            discount: Number(product.discount) || 0,
            image: product.image_url,
            quantity: 1
        });
    }
    saveCart(cart);
    updateCartUI();
    if (!options.silent) {
        showCartMessage(unitsToAdd > 1 ? `${unitsToAdd} items added to cart!` : `${product.name} added to cart!`);
    }
    return { added: unitsToAdd, cart };
}


/* ================= PRODUCT MODAL ================= */

function bindProductModalEvents() {
    const modal = document.getElementById("productModal");
    const qtyMinusBtn = document.getElementById("qtyMinusBtn");
    const qtyPlusBtn = document.getElementById("qtyPlusBtn");
    const qtyInput = document.getElementById("modalQtyInput");
    const addCartBtn = document.getElementById("modalAddToCartBtn");
    const buyNowBtn = document.getElementById("modalBuyNowBtn");

    if (!modal || !qtyMinusBtn || !qtyPlusBtn || !qtyInput || !addCartBtn || !buyNowBtn) return;

    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeProductModal();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("open")) {
            closeProductModal();
        }
    });

    qtyMinusBtn.addEventListener("click", () => changeModalQuantity(-1));
    qtyPlusBtn.addEventListener("click", () => changeModalQuantity(1));

    qtyInput.addEventListener("input", () => {
        if (!selectedProduct) return;

        const available = Number(selectedProduct.quantity) || 0;
        if (available <= 0) {
            selectedQty = 0;
            qtyInput.value = "0";
            updateModalQuantityUI();
            return;
        }

        const parsed = Number.parseInt(qtyInput.value, 10);
        selectedQty = Number.isFinite(parsed) ? clamp(parsed, 1, available) : 1;
        qtyInput.value = String(selectedQty);
        updateModalQuantityUI();
    });

    addCartBtn.addEventListener("click", () => {
        if (!selectedProduct) return;
        addToCart(selectedProduct.id, selectedQty);
    });

    buyNowBtn.addEventListener("click", () => {
        if (!selectedProduct) return;
        const result = addToCart(selectedProduct.id, selectedQty, { silent: true });
        if (result && result.added > 0) {
            closeProductModal();
            window.location.href = "/checkout.html";
        }
    });
}

function viewProduct(productId) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id) || id <= 0) return;
    window.location.href = `/product-details.html?id=${id}`;
}

function closeProductModal() {
    const modal = document.getElementById("productModal");
    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function changeModalQuantity(step) {
    if (!selectedProduct) return;

    const available = Math.max(0, Number(selectedProduct.quantity) || 0);
    if (available <= 0) return;

    selectedQty = clamp((selectedQty || 1) + step, 1, available);
    document.getElementById("modalQtyInput").value = String(selectedQty);
    updateModalQuantityUI();
}

function updateModalQuantityUI() {
    if (!selectedProduct) return;

    const available = Math.max(0, Number(selectedProduct.quantity) || 0);
    const qtyInput = document.getElementById("modalQtyInput");
    const minusBtn = document.getElementById("qtyMinusBtn");
    const plusBtn = document.getElementById("qtyPlusBtn");

    if (!qtyInput || !minusBtn || !plusBtn) return;

    if (available <= 0) {
        selectedQty = 0;
        qtyInput.value = "0";
        qtyInput.disabled = true;
        minusBtn.disabled = true;
        plusBtn.disabled = true;
        updateModalSubtotal();
        return;
    }

    qtyInput.disabled = false;
    selectedQty = clamp(Number.parseInt(qtyInput.value, 10) || selectedQty || 1, 1, available);
    qtyInput.value = String(selectedQty);
    minusBtn.disabled = selectedQty <= 1;
    plusBtn.disabled = selectedQty >= available;

    updateModalSubtotal();
}

function updateModalSubtotal() {
    if (!selectedProduct) return;
    const offerPrice = Number(selectedProduct.offer_price) || 0;
    const subtotal = offerPrice * (selectedQty || 0);
    const subtotalEl = document.getElementById("modalSubtotal");
    if (subtotalEl) subtotalEl.textContent = toCurrency(subtotal);
}

/* ================= CART MODAL ================= */

function toggleCart() {
    window.location.href = "/checkout.html";
}

function closeCart() {
    const modal = document.getElementById("cartModal");
    if (modal) modal.style.display = "none";
}

function goToCheckout() {
    window.location.href = "/checkout.html";
}
