const express = require("express");
const Stripe = require("stripe");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

const BASE_URL = (
    process.env.BASE_URL ||
    "https://printerlase3d32.onrender.com"
).replace(/\/$/, "");

const STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || "";

const STRIPE_WEBHOOK_SECRET =
    process.env.STRIPE_WEBHOOK_SECRET || "";

let stripe = null;

if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY);
    console.log("[STRIPE] API KEY: OK");
} else {
    console.error("[STRIPE] BRAK STRIPE_SECRET_KEY");
}

/* ==================================================
   DATA
================================================== */

const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

/* ==================================================
   HELPERS
================================================== */

function readOrders() {
    try {
        const text = fs.readFileSync(ORDERS_FILE, "utf8");

        if (!text.trim()) {
            return [];
        }

        const data = JSON.parse(text);

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("[ORDERS READ ERROR]", error.message);
        return [];
    }
}

function saveOrders(orders) {
    fs.writeFileSync(
        ORDERS_FILE,
        JSON.stringify(orders, null, 2),
        "utf8"
    );
}

function generateOrderId() {
    return (
        "ORD-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        crypto.randomBytes(4).toString("hex").toUpperCase()
    );
}

/*
 * Zamienia:
 * 15
 * "15"
 * "15,50"
 * "15.50 zł"
 * "15 zł"
 * na poprawną liczbę.
 */
function parseMoney(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : NaN;
    }

    if (typeof value !== "string") {
        return NaN;
    }

    let text = value
        .trim()
        .replace(/\s/g, "")
        .replace(/zł/gi, "")
        .replace(/PLN/gi, "");

    if (text.includes(",") && text.includes(".")) {
        text = text.replace(/\./g, "").replace(",", ".");
    } else {
        text = text.replace(",", ".");
    }

    const number = Number(text);

    return Number.isFinite(number)
        ? number
        : NaN;
}

function parseQuantity(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return NaN;
    }

    return Math.floor(number);
}

/* ==================================================
   WEBHOOK
================================================== */

app.post(
    "/api/stripe/webhook",
    express.raw({
        type: "application/json"
    }),
    (req, res) => {

        if (!stripe) {
            return res.status(500).send("Stripe not configured");
        }

        if (!STRIPE_WEBHOOK_SECRET) {
            return res.status(500).send("Webhook secret missing");
        }

        const signature =
            req.headers["stripe-signature"];

        let event;

        try {
            event =
                stripe.webhooks.constructEvent(
                    req.body,
                    signature,
                    STRIPE_WEBHOOK_SECRET
                );
        } catch (error) {
            console.error("[WEBHOOK ERROR]", error.message);
            return res.status(400).send("Invalid signature");
        }

        try {
            if (
                event.type ===
                "checkout.session.completed"
            ) {

                const session =
                    event.data.object;

                const orderId =
                    session.metadata?.orderId;

                console.log(
                    "[WEBHOOK] Płatność:",
                    session.id
                );

                if (orderId) {

                    const orders = readOrders();

                    const order =
                        orders.find(
                            item =>
                                item.id === orderId
                        );

                    if (
                        order &&
                        order.paymentStatus !== "PAID"
                    ) {

                        order.paymentStatus = "PAID";
                        order.status = "NEW";
                        order.stripeSessionId = session.id;
                        order.paymentIntentId =
                            session.payment_intent || null;
                        order.paidAt =
                            new Date().toISOString();

                        saveOrders(orders);

                        console.log(
                            "[WEBHOOK] Zamówienie opłacone:",
                            orderId
                        );
                    }
                }
            }

            if (
                event.type ===
                "checkout.session.expired"
            ) {

                const session =
                    event.data.object;

                const orderId =
                    session.metadata?.orderId;

                if (orderId) {

                    const orders = readOrders();

                    const order =
                        orders.find(
                            item =>
                                item.id === orderId
                        );

                    if (
                        order &&
                        order.paymentStatus === "PENDING"
                    ) {

                        order.paymentStatus = "EXPIRED";
                        order.status = "CANCELLED";
                        order.updatedAt =
                            new Date().toISOString();

                        saveOrders(orders);
                    }
                }
            }

        } catch (error) {

            console.error(
                "[WEBHOOK PROCESS ERROR]",
                error
            );

            return res
                .status(500)
                .send("Webhook error");
        }

        res.json({
            received: true
        });
    }
);

/* ==================================================
   EXPRESS
================================================== */

app.use(
    express.json({
        limit: "5mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "5mb"
    })
);

app.use(
    express.static(__dirname)
);

/* ==================================================
   HEALTH
================================================== */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            stripe: Boolean(stripe),
            webhook: Boolean(STRIPE_WEBHOOK_SECRET),
            baseUrl: BASE_URL,
            node: process.version
        });

    }
);

/* ==================================================
   CREATE CHECKOUT SESSION
================================================== */

app.post(
    "/api/create-checkout-session",
    async (req, res) => {

        console.log("");
        console.log("========== CHECKOUT ==========");
        console.log("[CHECKOUT] Nowe żądanie");

        try {

            if (!stripe) {
                return res.status(500).json({
                    success: false,
                    error:
                        "Brak STRIPE_SECRET_KEY."
                });
            }

            const body =
                req.body || {};

            const items =
                Array.isArray(body.items)
                    ? body.items
                    : [];

            const customer =
                body.customer || {};

            const delivery =
                body.delivery || {};

            const discountCode =
                String(
                    body.discountCode || ""
                )
                    .trim()
                    .toUpperCase();

            console.log(
                "[CHECKOUT] products:",
                items.length
            );

            if (items.length === 0) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Koszyk jest pusty."
                });

            }

            const email =
                String(
                    customer.email || ""
                ).trim();

            if (
                !email ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Nieprawidłowy e-mail."
                });

            }

            /* ==========================================
               PRODUCTS
            ========================================== */

            const lineItems = [];

            let subtotal = 0;

            const cleanItems = [];

            for (const item of items) {

                const name =
                    String(
                        item.name ||
                        item.title ||
                        "Produkt Printerlase3D"
                    )
                        .trim()
                        .slice(0, 250);

                const price =
                    parseMoney(
                        item.price ??
                        item.pricePLN ??
                        item.cena
                    );

                const quantity =
                    parseQuantity(
                        item.quantity ??
                        item.qty ??
                        1
                    );

                console.log(
                    "[PRODUCT]",
                    {
                        name,
                        rawPrice: item.price,
                        parsedPrice: price,
                        quantity
                    }
                );

                if (
                    !Number.isFinite(price) ||
                    price <= 0
                ) {

                    return res.status(400).json({
                        success: false,
                        error:
                            `Nieprawidłowa cena produktu: ${name}`
                    });

                }

                if (
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > 100
                ) {

                    return res.status(400).json({
                        success: false,
                        error:
                            `Nieprawidłowa ilość produktu: ${name}`
                    });

                }

                subtotal +=
                    price * quantity;

                cleanItems.push({
                    name,
                    price,
                    quantity
                });
            }

            /* ==========================================
               DISCOUNT
            ========================================== */

            let discount = 0;

            if (
                discountCode === "START10"
            ) {
                discount =
                    subtotal * 0.10;
            }

            const afterDiscount =
                Math.max(
                    0,
                    subtotal - discount
                );

            /* ==========================================
               DELIVERY
            ========================================== */

            let deliveryPrice =
                parseMoney(
                    delivery.price
                );

            if (
                !Number.isFinite(
                    deliveryPrice
                ) ||
                deliveryPrice < 0
            ) {
                deliveryPrice = 0;
            }

            if (
                afterDiscount >= 50
            ) {
                deliveryPrice = 0;
            }

            /* ==========================================
               STRIPE ITEMS
            ========================================== */

            for (const item of cleanItems) {

                const finalPrice =
                    discount > 0
                        ? item.price * 0.90
                        : item.price;

                const unitAmount =
                    Math.round(
                        finalPrice * 100
                    );

                if (unitAmount <= 0) {
                    continue;
                }

                lineItems.push({

                    price_data: {

                        currency: "pln",

                        product_data: {
                            name: item.name
                        },

                        unit_amount:
                            unitAmount
                    },

                    quantity:
                        item.quantity
                });
            }

            if (
                deliveryPrice > 0
            ) {

                lineItems.push({

                    price_data: {

                        currency: "pln",

                        product_data: {
                            name:
                                `Dostawa - ${
                                    String(
                                        delivery.method ||
                                        "Dostawa"
                                    ).slice(0, 100)
                                }`
                        },

                        unit_amount:
                            Math.round(
                                deliveryPrice * 100
                            )
                    },

                    quantity: 1
                });
            }

            const total =
                afterDiscount +
                deliveryPrice;

            console.log(
                "[CHECKOUT] subtotal:",
                subtotal
            );

            console.log(
                "[CHECKOUT] discount:",
                discount
            );

            console.log(
                "[CHECKOUT] delivery:",
                deliveryPrice
            );

            console.log(
                "[CHECKOUT] total:",
                total
            );

            /* ==========================================
               ORDER
            ========================================== */

            const orderId =
                generateOrderId();

            const order = {

                id:
                    orderId,

                name:
                    String(
                        customer.name || ""
                    ).trim(),

                email,

                phone:
                    String(
                        customer.phone || ""
                    ).trim(),

                address:
                    String(
                        customer.address || ""
                    ).trim(),

                postcode:
                    String(
                        customer.postcode || ""
                    ).trim(),

                city:
                    String(
                        customer.city || ""
                    ).trim(),

                paczkomat:
                    String(
                        customer.paczkomat || ""
                    ).trim(),

                delivery:
                    String(
                        delivery.method || ""
                    ).trim(),

                items:
                    cleanItems,

                subtotal:
                    Number(
                        subtotal.toFixed(2)
                    ),

                discount:
                    Number(
                        discount.toFixed(2)
                    ),

                deliveryPrice:
                    Number(
                        deliveryPrice.toFixed(2)
                    ),

                total:
                    Number(
                        total.toFixed(2)
                    ),

                paymentStatus:
                    "PENDING",

                status:
                    "AWAITING_PAYMENT",

                createdAt:
                    new Date().toISOString()
            };

            const orders =
                readOrders();

            orders.unshift(order);

            saveOrders(orders);

            console.log(
                "[ORDER] Utworzono:",
                orderId
            );

            /* ==========================================
               STRIPE
            ========================================== */

            console.log(
                "[STRIPE] Przed sessions.create"
            );

            const session =
                await stripe.checkout.sessions.create({

                    mode: "payment",

                    line_items:
                        lineItems,

                    customer_email:
                        email,

                    phone_number_collection: {
                        enabled: true
                    },

                    billing_address_collection:
                        "auto",

                    metadata: {

                        orderId,

                        delivery:
                            String(
                                delivery.method || ""
                            ).slice(0, 100),

                        discountCode
                    },

                    success_url:
                        `${BASE_URL}/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,

                    cancel_url:
                        `${BASE_URL}/checkout.html?payment=cancelled`
                });

            order.stripeSessionId =
                session.id;

            saveOrders(orders);

            console.log(
                "[STRIPE] Checkout utworzony:",
                session.id
            );

            console.log(
                "================================"
            );

            return res.json({

                success: true,

                url:
                    session.url,

                sessionId:
                    session.id,

                orderId
            });

        } catch (error) {

            console.error("");
            console.error(
                "========== STRIPE ERROR =========="
            );
            console.error(
                "message:",
                error?.message
            );
            console.error(
                "type:",
                error?.type
            );
            console.error(
                "code:",
                error?.code
            );
            console.error(
                "statusCode:",
                error?.statusCode
            );
            console.error(
                "=================================="
            );

            return res.status(500).json({

                success: false,

                error:
                    error?.message ||
                    "Stripe error"
            });
        }
    }
);

/* ==================================================
   VERIFY SESSION
================================================== */

app.get(
    "/api/checkout-session/:id",
    async (req, res) => {

        try {

            if (!stripe) {

                return res.status(500).json({
                    success: false,
                    error:
                        "Stripe nie jest skonfigurowany."
                });

            }

            const session =
                await stripe.checkout.sessions.retrieve(
                    req.params.id
                );

            const orders =
                readOrders();

            const orderId =
                session.metadata?.orderId;

            const order =
                orderId
                    ? orders.find(
                        item =>
                            item.id === orderId
                    )
                    : null;

            res.json({

                success: true,

                paid:
                    session.payment_status ===
                    "paid",

                paymentStatus:
                    session.payment_status,

                sessionStatus:
                    session.status,

                sessionId:
                    session.id,

                orderId:
                    orderId || null,

                amount:
                    session.amount_total
                        ? session.amount_total / 100
                        : 0,

                currency:
                    session.currency || "pln",

                email:
                    session.customer_details?.email ||
                    session.customer_email ||
                    null,

                order:
                    order || null
            });

        } catch (error) {

            console.error(
                "[VERIFY ERROR]",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    error?.message ||
                    "Błąd weryfikacji."
            });
        }
    }
);

/* ==================================================
   API 404
================================================== */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            success: false,
            error:
                "Nie znaleziono API."
        });

    }
);

/* ==================================================
   ROOT
================================================== */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);

/* ==================================================
   START
================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "       PRINTERLASE3D ONLINE"
        );
        console.log(
            "======================================"
        );
        console.log(
            "PORT:",
            PORT
        );
        console.log(
            "STRIPE:",
            stripe
                ? "OK"
                : "BRAK KLUCZA"
        );
        console.log(
            "BASE URL:",
            BASE_URL
        );
        console.log(
            "======================================"
        );
        console.log("");

    }
);
