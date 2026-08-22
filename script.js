/* =========================================================
   PRINTERLASE3D — SCRIPT.JS
   Koszyk + produkty + checkout
========================================================= */

"use strict";

/* =========================================================
   PRODUKTY
========================================================= */

const PRODUCTS = [
    {
        id: "brelok-friendz",
        name: "Brelok FRIENDZ",
        price: 12,
        category: "Breloki",
        image: "images/brelok.svg",
        description: "Personalizowany brelok wykonany w technologii FDM.",
        printTime: "około 45 minut"
    },
    {
        id: "brelok-custom",
        name: "Brelok CUSTOM",
        price: 15,
        category: "Breloki",
        image: "images/brelok.svg",
        description: "Brelok z własnym napisem lub nazwą.",
        printTime: "około 50 minut"
    },
    {
        id: "uchwyt-gaming",
        name: "Uchwyt gamingowy",
        price: 25,
        category: "Dodatki",
        image: "images/gaming.svg",
        description: "Praktyczny uchwyt do organizacji stanowiska.",
        printTime: "około 1 godz. 20 min"
    },
    {
        id: "creeper",
        name: "Creeper 3D",
        price: 18,
        category: "Figurki",
        image: "images/figurki.svg",
        description: "Dekoracyjny model inspirowany Minecraftem.",
        printTime: "około 1 godz."
    },
    {
        id: "mini-figurka",
        name: "Mini figurka",
        price: 30,
        category: "Figurki",
        image: "images/figurki.svg",
        description: "Mała figurka kolekcjonerska.",
        printTime: "około 2 godz."
    },
    {
        id: "napis-3d",
        name: "Napis 3D",
        price: 25,
        category: "Dekoracje",
        image: "images/dekoracja.svg",
        description: "Dekoracyjny napis wykonany na zamówienie.",
        printTime: "około 1 godz. 30 min"
    }
];


/* =========================================================
   KOSZYK
========================================================= */

let cart = JSON.parse(
    localStorage.getItem("printerlase3d_cart")
) || [];


/* =========================================================
   ZAPIS KOSZYKA
========================================================= */

function saveCart() {
    localStorage.setItem(
        "printerlase3d_cart",
        JSON.stringify(cart)
    );

    updateCartCounter();
}


/* =========================================================
   LICZNIK KOSZYKA
========================================================= */

function updateCartCounter() {

    const counters =
        document.querySelectorAll(".cart-count");

    const amount = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    counters.forEach(counter => {
        counter.textContent = amount;
    });
}


/* =========================================================
   DODAJ DO KOSZYKA
========================================================= */

function addToCart(productId, quantity = 1) {

    const product =
        PRODUCTS.find(
            item => item.id === productId
        );

    if (!product) {
        console.error(
            "Nie znaleziono produktu:",
            productId
        );

        return;
    }

    const existing =
        cart.find(
            item => item.id === productId
        );

    if (existing) {

        existing.quantity += quantity;

    } else {

        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity
        });

    }

    saveCart();

    showNotification(
        `${product.name} dodano do koszyka`
    );
}


/* =========================================================
   USUŃ PRODUKT
========================================================= */

function removeFromCart(productId) {

    cart = cart.filter(
        item => item.id !== productId
    );

    saveCart();

    renderCart();
}


/* =========================================================
   ZMIEŃ ILOŚĆ
========================================================= */

function changeQuantity(productId, amount) {

    const item =
        cart.find(
            product => product.id === productId
        );

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }

    saveCart();

    renderCart();
}


/* =========================================================
   CENA KOSZYKA
========================================================= */

function getCartTotal() {

    return cart.reduce(
        (sum, item) =>
            sum + item.price * item.quantity,
        0
    );
}


/* =========================================================
   ILOŚĆ PRODUKTÓW
========================================================= */

function getCartQuantity() {

    return cart.reduce(
        (sum, item) =>
            sum + item.quantity,
        0
    );
}


/* =========================================================
   FORMATOWANIE CENY
========================================================= */

function formatPrice(price) {

    return price
        .toFixed(2)
        .replace(".", ",") + " zł";
}


/* =========================================================
   RENDER KOSZYKA
========================================================= */

function renderCart() {

    const container =
        document.querySelector("#cart-items");

    if (!container) return;


    /* PUSTY KOSZYK */

    if (cart.length === 0) {

        container.innerHTML = `
            <div class="info-box" style="text-align:center;padding:45px;">
                <div style="font-size:55px;margin-bottom:15px;">
                    🛒
                </div>

                <h2>Koszyk jest pusty</h2>

                <p style="color:#8190a6;margin:12px 0 25px;">
                    Dodaj jakiś zajebisty wydruk 3D.
                </p>

                <a href="index.html"
                   class="btn btn-primary">
                    Przejdź do sklepu
                </a>
            </div>
        `;

        updateCartSummary();

        return;
    }


    container.innerHTML =
        cart.map(item => `

            <div class="cart-item">

                <img
                    src="${item.image}"
                    alt="${escapeHTML(item.name)}"
                >

                <div>

                    <h3>
                        ${escapeHTML(item.name)}
                    </h3>

                    <p style="color:#8190a6;font-size:12px;margin-top:6px;">
                        ${formatPrice(item.price)} / szt.
                    </p>

                </div>


                <div class="qty">

                    <button
                        onclick="changeQuantity('${item.id}', -1)"
                    >
                        −
                    </button>

                    <strong>
                        ${item.quantity}
                    </strong>

                    <button
                        onclick="changeQuantity('${item.id}', 1)"
                    >
                        +
                    </button>

                </div>


                <div style="text-align:right;">

                    <strong>
                        ${formatPrice(
                            item.price * item.quantity
                        )}
                    </strong>

                    <br>

                    <button
                        onclick="removeFromCart('${item.id}')"
                        style="
                            margin-top:8px;
                            border:0;
                            background:none;
                            color:#ff5577;
                            font-size:11px;
                        "
                    >
                        Usuń
                    </button>

                </div>

            </div>

        `).join("");


    updateCartSummary();
}


/* =========================================================
   PODSUMOWANIE
========================================================= */

function updateCartSummary() {

    const total =
        document.querySelector("#cart-total");

    const quantity =
        document.querySelector("#cart-quantity");

    if (total) {
        total.textContent =
            formatPrice(getCartTotal());
    }

    if (quantity) {
        quantity.textContent =
            getCartQuantity();
    }


    const checkoutButtons =
        document.querySelectorAll(
            "[data-checkout]"
        );


    checkoutButtons.forEach(button => {

        if (cart.length === 0) {

            button.disabled = true;

            button.style.opacity = ".5";

        } else {

            button.disabled = false;

            button.style.opacity = "1";
        }

    });
}


/* =========================================================
   PRODUKTY NA STRONIE
========================================================= */

function renderProducts() {

    const containers =
        document.querySelectorAll(
            "[data-products]"
        );

    containers.forEach(container => {

        const category =
            container.dataset.products;


        let products = PRODUCTS;


        if (
            category &&
            category !== "all"
        ) {

            products =
                PRODUCTS.filter(
                    product =>
                        product.category === category
                );

        }


        container.innerHTML =
            products.map(product => `

                <div class="product-card">

                    <a href="produkt.html?id=${product.id}">

                        <div class="product-img">

                            <img
                                src="${product.image}"
                                alt="${escapeHTML(product.name)}"
                            >

                        </div>

                    </a>


                    <div class="product-content">

                        <small
                            style="
                                color:#38d8ff;
                                font-size:10px;
                                font-weight:800;
                            "
                        >
                            ${escapeHTML(product.category)}
                        </small>


                        <h3>
                            ${escapeHTML(product.name)}
                        </h3>


                        <p class="product-description">
                            ${escapeHTML(product.description)}
                        </p>


                        <div class="product-bottom">

                            <span class="price">
                                ${formatPrice(product.price)}
                            </span>


                            <button
                                class="add-cart"
                                onclick="addToCart('${product.id}')"
                            >
                                + Koszyk
                            </button>

                        </div>

                    </div>

                </div>

            `).join("");

    });
}


/* =========================================================
   STRONA PRODUKTU
========================================================= */

function renderProductPage() {

    const container =
        document.querySelector(
            "#product-detail"
        );

    if (!container) return;


    const params =
        new URLSearchParams(
            window.location.search
        );

    const id =
        params.get("id");


    const product =
        PRODUCTS.find(
            item => item.id === id
        );


    if (!product) {

        container.innerHTML = `
            <div class="info-box">
                <h2>Nie znaleziono produktu</h2>

                <p style="color:#8190a6;margin:10px 0 20px;">
                    Ten produkt chyba uciekł z drukarki 💀
                </p>

                <a
                    href="index.html"
                    class="btn btn-primary"
                >
                    Wróć do sklepu
                </a>
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="product-big-image">

            <img
                src="${product.image}"
                alt="${escapeHTML(product.name)}"
            >

        </div>


        <div>

            <small class="section-label">
                ${escapeHTML(product.category)}
            </small>


            <h1>
                ${escapeHTML(product.name)}
            </h1>


            <p style="
                color:#8190a6;
                line-height:1.8;
            ">
                ${escapeHTML(product.description)}
            </p>


            <div class="product-price">
                ${formatPrice(product.price)}
            </div>


            <div class="info-box">

                <strong>
                    ⏱ Czas druku
                </strong>

                <span>
                    ${escapeHTML(product.printTime)}
                </span>

            </div>


            <div class="info-box">

                <strong>
                    🖨️ Jak powstaje?
                </strong>

                <span>
                    Model jest przygotowywany,
                    ustawiany w slicerze i następnie
                    drukowany warstwa po warstwie.
                    Po wydruku element jest sprawdzany
                    i przygotowywany do wysyłki.
                </span>

            </div>


            <div style="
                display:flex;
                gap:10px;
                align-items:center;
                margin-top:25px;
            ">

                <input
                    id="product-quantity"
                    type="number"
                    value="1"
                    min="1"
                    max="99"
                    style="
                        width:70px;
                        padding:13px;
                        color:white;
                        background:#091222;
                        border:1px solid rgba(255,255,255,.1);
                        border-radius:10px;
                    "
                >


                <button
                    class="btn btn-primary"
                    id="product-add"
                >
                    Dodaj do koszyka
                </button>

            </div>

        </div>

    `;


    document
        .querySelector("#product-add")
        .addEventListener(
            "click",
            () => {

                let quantity =
                    Number(
                        document.querySelector(
                            "#product-quantity"
                        ).value
                    );

                if (
                    !Number.isInteger(quantity) ||
                    quantity < 1
                ) {
                    quantity = 1;
                }

                addToCart(
                    product.id,
                    quantity
                );

            }
        );
}


/* =========================================================
   CHECKOUT
========================================================= */

function renderCheckout() {

    const total =
        document.querySelector(
            "#checkout-total"
        );

    const quantity =
        document.querySelector(
            "#checkout-quantity"
        );


    if (total) {

        total.textContent =
            formatPrice(getCartTotal());

    }


    if (quantity) {

        quantity.textContent =
            getCartQuantity();

    }


    const checkoutForm =
        document.querySelector(
            "#checkout-form"
        );


    if (!checkoutForm) return;


    checkoutForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            if (cart.length === 0) {

                showNotification(
                    "Koszyk jest pusty."
                );

                return;
            }


            const formData =
                new FormData(
                    checkoutForm
                );


            const order = {

                id:
                    "PL3D-" +
                    Date.now(),

                customer: {

                    firstName:
                        formData.get(
                            "firstName"
                        ),

                    lastName:
                        formData.get(
                            "lastName"
                        ),

                    email:
                        formData.get(
                            "email"
                        ),

                    phone:
                        formData.get(
                            "phone"
                        ),

                    address:
                        formData.get(
                            "address"
                        ),

                    city:
                        formData.get(
                            "city"
                        ),

                    postalCode:
                        formData.get(
                            "postalCode"
                        )

                },

                items: [...cart],

                total:
                    getCartTotal(),

                created:
                    new Date().toISOString()

            };


            /*
             * Na razie zapisujemy zamówienie lokalnie.
             *
             * PRAWDZIWE P24 NIE POWINNO BYĆ
             * ROBIONE W TYM PLIKU.
             *
             * Backend będzie później wysyłał
             * zamówienie do Przelewy24.
             */

            localStorage.setItem(
                "printerlase3d_last_order",
                JSON.stringify(order)
            );


            /*
             * Czyścimy koszyk
             */

            cart = [];

            saveCart();


            /*
             * Przechodzimy do strony
             * oczekiwania na płatność.
             */

            window.location.href =
                "sukces.html?order=" +
                encodeURIComponent(
                    order.id
                );

        }
    );
}


/* =========================================================
   POWIADOMIENIE
========================================================= */

function showNotification(message) {

    const old =
        document.querySelector(
            ".printer-notification"
        );

    if (old) old.remove();


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "printer-notification";


    notification.innerHTML = `
        <strong>✓</strong>
        <span>${escapeHTML(message)}</span>
    `;


    Object.assign(
        notification.style,
        {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "9999",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            borderRadius: "12px",
            color: "white",
            background: "#0c1729",
            border: "1px solid rgba(0,191,255,.3)",
            boxShadow: "0 15px 50px rgba(0,0,0,.5)",
            animation: "notificationIn .25s ease"
        }
    );


    document.body.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        2200
    );
}


/* =========================================================
   BEZPIECZNY TEKST HTML
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   LINKI DO PRODUKTÓW
========================================================= */

document.addEventListener(
    "click",
    event => {

        const productLink =
            event.target.closest(
                "[data-product-id]"
            );


        if (!productLink) return;


        const id =
            productLink.dataset.productId;


        window.location.href =
            "produkt.html?id=" +
            encodeURIComponent(id);

    }
);


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateCartCounter();

        renderProducts();

        renderProductPage();

        renderCart();

        renderCheckout();

    }
);


/* =========================================================
   ANIMACJA POWIADOMIENIA
========================================================= */

const notificationStyle =
document.createElement("style");

notificationStyle.textContent = `

@keyframes notificationIn {

    from {
        opacity:0;
        transform:translateY(15px);
    }

    to {
        opacity:1;
        transform:translateY(0);
    }

}

`;

document.head.appendChild(
    notificationStyle
);