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

/* =========================================================
   DATA
========================================================= */

const DATA_DIR =
    path.join(__dirname, "data");

const ORDERS_FILE =
    path.join(DATA_DIR, "orders.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(
        ORDERS_FILE,
        "[]",
        "utf8"
    );
}

/* =========================================================
   HELPERS
========================================================= */

function readOrders() {
    try {
        const text =
            fs.readFileSync(
                ORDERS_FILE,
                "utf8"
            );

        if (!text.trim()) {
            return [];
        }

        const data =
            JSON.parse(text);

        return Array.isArray(data)
            ? data
            : [];
    } catch (error) {
        console.error(
            "[ORDERS READ ERROR]",
            error.message
        );

        return [];
    }
}

function saveOrders(orders) {
    fs.writeFileSync(
        ORDERS_FILE,
        JSON.stringify(
            orders,
            null,
            2
        ),
        "utf8"
    );
}

function generateOrderId() {
    return (
        "ORD-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()
    );
}

/* =========================================================
   WEBHOOK
   MUSI BYĆ PRZED express.json()
========================================================= */

app.post(
    "/api/stripe/webhook",
    express.raw({
        type: "application/json"
    }),
    (req, res) => {

        if (!stripe) {
            return res
                .status(500)
                .send("Stripe not configured");
        }

        if (!STRIPE_WEBHOOK_SECRET) {
            return res
                .status(500)
                .send("Webhook secret missing");
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

            console.error(
                "[WEBHOOK ERROR]",
                error.message
            );

            return res
                .status(400)
                .send("Invalid signature");
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
                    "[WEBHOOK] checkout.session.completed:",
                    session.id
                );

                if (orderId) {

                    const orders =
                        readOrders();

                    const order =
                        orders.find(
                            item =>
                                item.id ===
                                orderId
                        );

                    if (order) {

                        if (
                            order.paymentStatus !==
                            "PAID"
                        ) {

                            order.paymentStatus =
                                "PAID";

                            order.status =
                                "NEW";

                            order.stripeSessionId =
                                session.id;

                            order.paymentIntentId =
                                session.payment_intent ||
                                null;

                            order.paidAt =
                                new Date()
                                    .toISOString();

                            saveOrders(
                                orders
                            );
                        }
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

/* =========================================================
   MIDDLEWARE
========================================================= */

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

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            stripe: Boolean(stripe),
            webhook:
                Boolean(
                    STRIPE_WEBHOOK_SECRET
                ),
            baseUrl: BASE_URL,
            node: process.version
        });
    }
);

/* =========================================================
   CREATE CHECKOUT
========================================================= */

app.post(
    "/api/create-checkout-session",
    async (req, res) => {

        console.log("");
        console.log(
            "========== CHECKOUT REQUEST =========="
        );
        console.log(
            "[CHECKOUT] Nowe żądanie"
        );

        try {

            /* -----------------------------------------
               STRIPE
            ----------------------------------------- */

            if (!stripe) {

                console.error(
                    "[STRIPE] stripe == null"
                );

                return res
                    .status(500)
                    .json({
                        success: false,
                        error:
                            "Brak STRIPE_SECRET_KEY."
                    });
            }

            console.log(
                "[STRIPE] Obiekt Stripe: OK"
            );

            /* -----------------------------------------
               BODY
            ----------------------------------------- */

            const body =
                req.body || {};

            console.log(
                "[CHECKOUT] Body keys:",
                Object.keys(body)
            );

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
                "[CHECKOUT] Liczba produktów:",
                items.length
            );

            /* -----------------------------------------
               BASIC VALIDATION
            ----------------------------------------- */

            if (
                items.length === 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            "Koszyk jest pusty."
                    });
            }

            const email =
                String(
                    customer.email || ""
                ).trim();

            console.log(
                "[CHECKOUT] Email:",
                email
            );

            if (
                !email ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(email)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            "Nieprawidłowy e-mail."
                    });
            }

            /* -----------------------------------------
               PRODUCTS
            ----------------------------------------- */

            const lineItems = [];

            let subtotal = 0;

            for (
                const item
                of items
            ) {

                const name =
                    String(
                        item.name ||
                        "Produkt Printerlase3D"
                    )
                        .trim()
                        .slice(0, 250);

                const price =
                    Number(
                        item.price
                    );

                const quantity =
                    Number(
                        item.quantity ??
                        item.qty ??
                        1
                    );

                console.log(
                    "[PRODUCT]",
                    {
                        name,
                        price,
                        quantity
                    }
                );

                if (
                    !Number.isFinite(
                        price
                    ) ||
                    price <= 0
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            error:
                                `Nieprawidłowa cena: ${name}`
                        });
                }

                if (
                    !Number.isInteger(
                        quantity
                    ) ||
                    quantity < 1 ||
                    quantity > 100
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            error:
                                `Nieprawidłowa ilość: ${name}`
                        });
                }

                subtotal +=
                    price *
                    quantity;

                lineItems.push({
                    price_data: {
                        currency: "pln",

                        product_data: {
                            name
                        },

                        unit_amount:
                            Math.round(
                                price * 100
                            )
                    },

                    quantity
                });
            }

            console.log(
                "[CHECKOUT] Subtotal:",
                subtotal
            );

            /* -----------------------------------------
               DISCOUNT
            ----------------------------------------- */

            let discount = 0;

            if (
                discountCode ===
                "START10"
            ) {

                discount =
                    subtotal * 0.10;
            }

            const afterDiscount =
                Math.max(
                    0,
                    subtotal -
                    discount
                );

            console.log(
                "[CHECKOUT] Rabat:",
                discount
            );

            /* -----------------------------------------
               DELIVERY
            ----------------------------------------- */

            let deliveryPrice =
                Number(
                    delivery.price || 0
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

            console.log(
                "[CHECKOUT] Dostawa:",
                deliveryPrice
            );

            /*
             * Dodajemy dostawę jako osobny item.
             */

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
                                    ).slice(
                                        0,
                                        100
                                    )
                                }`
                        },

                        unit_amount:
                            Math.round(
                                deliveryPrice *
                                100
                            )
                    },

                    quantity: 1
                });
            }

            /* -----------------------------------------
               TOTAL
            ----------------------------------------- */

            const total =
                afterDiscount +
                deliveryPrice;

            console.log(
                "[CHECKOUT] TOTAL:",
                total
            );

            if (
                !Number.isFinite(
                    total
                ) ||
                total <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            "Nieprawidłowa kwota."
                    });
            }

            /* -----------------------------------------
               ORDER
            ----------------------------------------- */

            const orderId =
                generateOrderId();

            const order = {

                id:
                    orderId,

                name:
                    String(
                        customer.name ||
                        ""
                    ).trim(),

                email,

                phone:
                    String(
                        customer.phone ||
                        ""
                    ).trim(),

                address:
                    String(
                        customer.address ||
                        ""
                    ).trim(),

                postcode:
                    String(
                        customer.postcode ||
                        ""
                    ).trim(),

                city:
                    String(
                        customer.city ||
                        ""
                    ).trim(),

                paczkomat:
                    String(
                        customer.paczkomat ||
                        ""
                    ).trim(),

                delivery:
                    String(
                        delivery.method ||
                        ""
                    ).trim(),

                items,

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
                    new Date()
                        .toISOString()
            };

            const orders =
                readOrders();

            orders.unshift(
                order
            );

            saveOrders(
                orders
            );

            console.log(
                "[ORDER] Utworzono:",
                orderId
            );

            /* -----------------------------------------
               STRIPE DEBUG
            ----------------------------------------- */

            console.log(
                "[STRIPE DEBUG]",
                JSON.stringify(
                    {
                        mode: "payment",
                        lineItemsCount:
                            lineItems.length,
                        email: email,
                        total: total,
                        currency: "pln",
                        baseUrl: BASE_URL,
                        secretKeyPresent:
                            Boolean(
                                STRIPE_SECRET_KEY
                            )
                    },
                    null,
                    2
                )
            );

            console.log(
                "[STRIPE] Przed sessions.create"
            );

            /* -----------------------------------------
               STRIPE SESSION
            ----------------------------------------- */

            const session =
                await stripe.checkout.sessions.create({

                    mode:
                        "payment",

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

                        discountCode,

                        delivery:
                            String(
                                delivery.method ||
                                ""
                            ).slice(
                                0,
                                100
                            )
                    },

                    success_url:
                        `${BASE_URL}/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,

                    cancel_url:
                        `${BASE_URL}/checkout.html?payment=cancelled`
                });

            console.log(
                "[STRIPE] Po sessions.create:",
                session.id
            );

            order.stripeSessionId =
                session.id;

            saveOrders(
                orders
            );

            console.log(
                "[CHECKOUT] Sukces!"
            );

            console.log(
                "======================================"
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
                "name:",
                error?.name
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
                "raw:",
                error?.raw?.message
            );
            console.error(
                "=================================="
            );
            console.error("");

            return res
                .status(500)
                .json({
                    success: false,
                    error:
                        error?.message ||
                        "Stripe error"
                });
        }
    }
);

/* =========================================================
   VERIFY SESSION
========================================================= */

app.get(
    "/api/checkout-session/:id",
    async (req, res) => {

        try {

            if (!stripe) {
                return res
                    .status(500)
                    .json({
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
                            item.id ===
                            orderId
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
                    session.currency ||
                    "pln",

                email:
                    session.customer_details?.email ||
                    session.customer_email ||
                    null,

                order:
                    order
                        ? {
                            id:
                                order.id,

                            status:
                                order.status,

                            paymentStatus:
                                order.paymentStatus,

                            total:
                                order.total
                        }
                        : null
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
                    "Verify error"
            });
        }
    }
);

/* =========================================================
   API 404
========================================================= */

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

/* =========================================================
   FRONTEND
========================================================= */

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

/* =========================================================
   START
========================================================= */

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
