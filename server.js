const express = require("express");
const Stripe = require("stripe");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

/* =========================================================
   KONFIGURACJA
========================================================= */

const PORT = Number(process.env.PORT) || 10000;

const BASE_URL = (
    process.env.BASE_URL ||
    "https://printerlase3d32.onrender.com"
).trim().replace(/\/+$/, "");

const STRIPE_SECRET_KEY =
    String(
        process.env.STRIPE_SECRET_KEY || ""
    ).trim();

const STRIPE_WEBHOOK_SECRET =
    String(
        process.env.STRIPE_WEBHOOK_SECRET || ""
    ).trim();

const ADMIN_LOGIN =
    String(
        process.env.ADMIN_LOGIN || "admin"
    );

const ADMIN_PASSWORD =
    String(
        process.env.ADMIN_PASSWORD || "Admin2137!"
    );


/* =========================================================
   STRIPE
========================================================= */

let stripe = null;

if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(
        STRIPE_SECRET_KEY
    );

    console.log(
        "[STRIPE] API KEY: OK"
    );
} else {
    console.error(
        "[STRIPE] BRAK STRIPE_SECRET_KEY"
    );
}

console.log(
    "[WEBHOOK SECRET]:",
    STRIPE_WEBHOOK_SECRET
        ? "JEST"
        : "BRAK"
);


/* =========================================================
   PLIKI
========================================================= */

const DATA_DIR =
    path.join(
        __dirname,
        "data"
    );

const ORDERS_FILE =
    path.join(
        DATA_DIR,
        "orders.json"
    );

const TOKENS_FILE =
    path.join(
        DATA_DIR,
        "tokens.json"
    );

const MODELS_FILE =
    path.join(
        DATA_DIR,
        "custom-models.json"
    );

const BALANCE_FILE =
    path.join(
        DATA_DIR,
        "balance.json"
    );

const WITHDRAWALS_FILE =
    path.join(
        DATA_DIR,
        "withdrawals.json"
    );


if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );
}


/* =========================================================
   TWORZENIE PLIKÓW
========================================================= */

function createFile(
    file,
    data
) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );
    }
}

createFile(
    ORDERS_FILE,
    []
);

createFile(
    TOKENS_FILE,
    []
);

createFile(
    MODELS_FILE,
    []
);

createFile(
    BALANCE_FILE,
    {
        balance: 0,
        totalRevenue: 0
    }
);

createFile(
    WITHDRAWALS_FILE,
    []
);


/* =========================================================
   JSON
========================================================= */

function readJSON(
    file,
    fallback
) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }

        const text =
            fs.readFileSync(
                file,
                "utf8"
            );

        if (!text.trim()) {
            return fallback;
        }

        const data =
            JSON.parse(text);

        return data;

    } catch (error) {

        console.error(
            "[JSON ERROR]",
            file,
            error.message
        );

        return fallback;
    }
}


function writeJSON(
    file,
    data
) {
    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );
}


/* =========================================================
   ID
========================================================= */

function generateId(
    prefix
) {
    return (
        String(prefix) +
        "-" +
        Date.now()
            .toString(36)
            .toUpperCase() +
        "-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()
    );
}


/* =========================================================
   TOKEN
========================================================= */

function generateToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function getToken(req) {

    const auth =
        req.headers.authorization || "";

    if (
        !auth.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    return auth.substring(7);
}

function requireAdmin(
    req,
    res,
    next
) {

    const token =
        getToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Brak autoryzacji."
        });
    }

    const tokens =
        readJSON(
            TOKENS_FILE,
            []
        );

    const session =
        tokens.find(
            item =>
                item.token === token
        );

    if (!session) {
        return res.status(401).json({
            success: false,
            error: "Sesja wygasła."
        });
    }

    next();
}


/* =========================================================
   MONEY
========================================================= */

function parseMoney(value) {

    if (
        typeof value ===
        "number"
    ) {
        return Number.isFinite(value)
            ? value
            : NaN;
    }

    if (
        typeof value !==
        "string"
    ) {
        return NaN;
    }

    let text =
        value
            .trim()
            .replace(/\s/g, "")
            .replace(/zł/gi, "")
            .replace(/pln/gi, "");

    if (
        text.includes(",") &&
        text.includes(".")
    ) {
        text =
            text
                .replace(/\./g, "")
                .replace(",", ".");
    } else {
        text =
            text.replace(
                ",",
                "."
            );
    }

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : NaN;
}


/* =========================================================
   SALDO
========================================================= */

function getBalanceData() {

    const data =
        readJSON(
            BALANCE_FILE,
            {
                balance: 0,
                totalRevenue: 0
            }
        );

    return {
        balance:
            Math.max(
                0,
                Number(
                    data.balance || 0
                )
            ),

        totalRevenue:
            Math.max(
                0,
                Number(
                    data.totalRevenue || 0
                )
            )
    };
}


function saveBalanceData(
    data
) {

    let balance =
        Number(
            data.balance || 0
        );

    let totalRevenue =
        Number(
            data.totalRevenue || 0
        );

    if (
        !Number.isFinite(balance)
    ) {
        balance = 0;
    }

    if (
        !Number.isFinite(
            totalRevenue
        )
    ) {
        totalRevenue = 0;
    }

    writeJSON(
        BALANCE_FILE,
        {
            balance:
                Number(
                    Math.max(
                        0,
                        balance
                    ).toFixed(2)
                ),

            totalRevenue:
                Number(
                    Math.max(
                        0,
                        totalRevenue
                    ).toFixed(2)
                )
        }
    );
}


function addMoney(
    amount
) {

    const value =
        Number(amount);

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return getBalanceData();
    }

    const data =
        getBalanceData();

    data.balance += value;
    data.totalRevenue += value;

    saveBalanceData(
        data
    );

    return getBalanceData();
}


/* =========================================================
   WEBHOOK
   WAŻNE:
   webhook przed express.json()
========================================================= */

app.post(
    "/api/stripe/webhook",
    express.raw({
        type: "application/json"
    }),
    (req, res) => {

        console.log(
            "[WEBHOOK] Otrzymano request"
        );


        if (!stripe) {

            console.error(
                "[WEBHOOK] Stripe nie skonfigurowany"
            );

            return res
                .status(500)
                .send(
                    "Stripe not configured"
                );
        }


        if (
            !STRIPE_WEBHOOK_SECRET
        ) {

            console.error(
                "[WEBHOOK] BRAK STRIPE_WEBHOOK_SECRET"
            );

            return res
                .status(500)
                .send(
                    "Webhook secret missing"
                );
        }


        const signature =
            req.headers[
                "stripe-signature"
            ];


        if (!signature) {

            console.error(
                "[WEBHOOK] Brak stripe-signature"
            );

            return res
                .status(400)
                .send(
                    "Missing stripe-signature"
                );
        }


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
                "[WEBHOOK SIGNATURE ERROR]",
                error.message
            );

            return res
                .status(400)
                .send(
                    "Invalid webhook signature"
                );
        }


        console.log(
            "[WEBHOOK EVENT]",
            event.type
        );


        try {

            /* -----------------------------------------
               checkout.session.completed
            ----------------------------------------- */

            if (
                event.type ===
                "checkout.session.completed"
            ) {

                const session =
                    event.data.object;

                const orderId =
                    session.metadata?.orderId;


                console.log(
                    "[WEBHOOK] Session:",
                    session.id
                );

                console.log(
                    "[WEBHOOK] Order:",
                    orderId || "BRAK"
                );


                if (!orderId) {

                    return res.json({
                        received: true
                    });
                }


                const orders =
                    readJSON(
                        ORDERS_FILE,
                        []
                    );


                const order =
                    orders.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                orderId
                            )
                    );


                if (!order) {

                    console.error(
                        "[WEBHOOK] Nie znaleziono zamówienia:",
                        orderId
                    );

                    return res.json({
                        received: true
                    });
                }


                /*
                 * Zabezpieczenie przed
                 * podwójnym zaksięgowaniem.
                 */

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


                    writeJSON(
                        ORDERS_FILE,
                        orders
                    );


                    addMoney(
                        order.total
                    );


                    console.log(
                        "[WEBHOOK] OPŁACONO:",
                        order.id
                    );

                }

            }


            /* -----------------------------------------
               checkout.session.expired
            ----------------------------------------- */

            if (
                event.type ===
                "checkout.session.expired"
            ) {

                const session =
                    event.data.object;

                const orderId =
                    session.metadata?.orderId;


                if (orderId) {

                    const orders =
                        readJSON(
                            ORDERS_FILE,
                            []
                        );


                    const order =
                        orders.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    orderId
                                )
                        );


                    if (
                        order &&
                        order.paymentStatus ===
                        "PENDING"
                    ) {

                        order.paymentStatus =
                            "EXPIRED";

                        order.status =
                            "CANCELLED";

                        order.updatedAt =
                            new Date()
                                .toISOString();


                        writeJSON(
                            ORDERS_FILE,
                            orders
                        );
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
                .send(
                    "Webhook processing error"
                );
        }


        return res.json({
            received: true
        });
    }
);


/* =========================================================
   EXPRESS JSON
========================================================= */

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);


/* =========================================================
   STATIC FILES
========================================================= */

app.use(
    express.static(
        __dirname
    )
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            stripe:
                Boolean(
                    STRIPE_SECRET_KEY
                ),

            webhook:
                Boolean(
                    STRIPE_WEBHOOK_SECRET
                ),

            baseUrl:
                BASE_URL,

            node:
                process.version

        });

    }
);


/* =========================================================
   WEBHOOK DIAGNOSTIC
========================================================= */

app.get(
    "/api/webhook-status",
    (req, res) => {

        res.json({

            success: true,

            stripeConfigured:
                Boolean(
                    STRIPE_SECRET_KEY
                ),

            webhookSecretConfigured:
                Boolean(
                    STRIPE_WEBHOOK_SECRET
                ),

            endpoint:
                `${BASE_URL}/api/stripe/webhook`

        });

    }
);


/* =========================================================
   STRIPE ACCOUNT TEST
========================================================= */

app.get(
    "/api/stripe-test",
    async (req, res) => {

        try {

            if (!stripe) {

                return res.status(500).json({

                    success: false,

                    error:
                        "Brak STRIPE_SECRET_KEY"

                });
            }


            const account =
                await stripe.accounts.retrieve();


            return res.json({

                success: true,

                stripe: true,

                accountId:
                    account.id,

                chargesEnabled:
                    Boolean(
                        account.charges_enabled
                    ),

                payoutsEnabled:
                    Boolean(
                        account.payouts_enabled
                    ),

                detailsSubmitted:
                    Boolean(
                        account.details_submitted
                    )

            });

        } catch (error) {

            console.error(
                "[STRIPE TEST]",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    error.message

            });
        }

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
            "======================================"
        );
        console.log(
            "[CHECKOUT] Nowe żądanie"
        );
        console.log(
            "======================================"
        );


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
                "[CHECKOUT] Produkty:",
                items.length
            );


            if (
                items.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Koszyk jest pusty."

                });
            }


            /* -----------------------------------------
               EMAIL
            ----------------------------------------- */

            const email =
                String(
                    customer.email || ""
                ).trim();


            if (
                !email ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(email)
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Nieprawidłowy e-mail."

                });
            }


            /* -----------------------------------------
               PRODUCTS
            ----------------------------------------- */

            let subtotal = 0;

            const cleanItems = [];


            for (
                const item
                of items
            ) {

                const name =
                    String(
                        item.name ||
                        item.title ||
                        "Produkt Printerlase3D"
                    )
                        .trim()
                        .slice(
                            0,
                            250
                        );


                const price =
                    parseMoney(
                        item.price ??
                        item.pricePLN ??
                        item.cena ??
                        item.cost
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
                        rawPrice:
                            item.price,
                        parsedPrice:
                            price,
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
                    !Number.isInteger(
                        quantity
                    ) ||
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
                    price *
                    quantity;


                cleanItems.push({

                    name,

                    price,

                    quantity

                });

            }


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


            /* -----------------------------------------
               DELIVERY
            ----------------------------------------- */

            let deliveryPrice =
                parseMoney(
                    delivery.price ||
                    0
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
                afterDiscount >=
                50
            ) {

                deliveryPrice = 0;

            }


            /* -----------------------------------------
               STRIPE LINE ITEMS
            ----------------------------------------- */

            const lineItems = [];


            for (
                const item
                of cleanItems
            ) {

                const finalPrice =
                    discount > 0
                        ? item.price * 0.90
                        : item.price;


                const unitAmount =
                    Math.round(
                        finalPrice *
                        100
                    );


                if (
                    unitAmount <= 0
                ) {

                    continue;

                }


                lineItems.push({

                    price_data: {

                        currency:
                            "pln",

                        product_data: {

                            name:
                                item.name

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

                        currency:
                            "pln",

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


            const total =
                afterDiscount +
                deliveryPrice;


            console.log(
                "[CHECKOUT] Subtotal:",
                subtotal
            );

            console.log(
                "[CHECKOUT] Rabat:",
                discount
            );

            console.log(
                "[CHECKOUT] Dostawa:",
                deliveryPrice
            );

            console.log(
                "[CHECKOUT] Razem:",
                total
            );


            if (
                !Number.isFinite(total) ||
                total <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Nieprawidłowa kwota."

                });
            }


            if (
                lineItems.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Brak produktów do zapłaty."

                });
            }


            /* -----------------------------------------
               ORDER
            ----------------------------------------- */

            const orderId =
                generateId(
                    "ORD"
                );


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

                items:
                    cleanItems,

                subtotal:
                    Number(
                        subtotal.toFixed(
                            2
                        )
                    ),

                discount:
                    Number(
                        discount.toFixed(
                            2
                        )
                    ),

                deliveryPrice:
                    Number(
                        deliveryPrice.toFixed(
                            2
                        )
                    ),

                total:
                    Number(
                        total.toFixed(
                            2
                        )
                    ),

                discountCode,

                paymentStatus:
                    "PENDING",

                status:
                    "AWAITING_PAYMENT",

                createdAt:
                    new Date()
                        .toISOString()

            };


            const orders =
                readJSON(
                    ORDERS_FILE,
                    []
                );


            orders.unshift(
                order
            );


            writeJSON(
                ORDERS_FILE,
                orders
            );


            console.log(
                "[ORDER] Utworzono:",
                orderId
            );


            /* -----------------------------------------
               STRIPE SESSION
            ----------------------------------------- */

            console.log(
                "[STRIPE] Przed sessions.create"
            );


            const session =
                await stripe.checkout.sessions.create({

                    mode:
                        "payment",

                    line_items:
                        lineItems,

                    customer_email:
                        email,

                    phone_number_collection: {

                        enabled:
                            true

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


            order.stripeSessionId =
                session.id;


            writeJSON(
                ORDERS_FILE,
                orders
            );


            console.log(
                "[STRIPE] Checkout utworzony:",
                session.id
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
                "param:",
                error?.param
            );
            console.error(
                "=================================="
            );
            console.error("");

            return res.status(500).json({

                success: false,

                error:
                    error?.message ||
                    "Stripe error"

            });
        }

    }
);


/* =========================================================
   VERIFY CHECKOUT
========================================================= */

app.get(
    "/api/checkout-session/:id",
    async (req, res) => {

        try {

            if (!stripe) {

                return res.status(500).json({

                    success: false,

                    error:
                        "Brak STRIPE_SECRET_KEY."

                });
            }


            const session =
                await stripe.checkout.sessions.retrieve(
                    req.params.id
                );


            const orders =
                readJSON(
                    ORDERS_FILE,
                    []
                );


            const orderId =
                session.metadata?.orderId;


            const order =
                orderId
                    ? orders.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                orderId
                            )
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
                        ? session.amount_total /
                          100
                        : 0,

                currency:
                    session.currency ||
                    "pln",

                email:
                    session.customer_details
                        ?.email ||
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
                    "Verify error"

            });

        }

    }
);


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
    "/api/admin/login",
    (req, res) => {

        const login =
            String(
                req.body.login || ""
            );

        const password =
            String(
                req.body.password || ""
            );


        if (
            login !==
                ADMIN_LOGIN ||
            password !==
                ADMIN_PASSWORD
        ) {

            return res.status(401).json({

                success: false,

                error:
                    "Nieprawidłowy login lub hasło."

            });

        }


        const token =
            generateToken();


        let tokens =
            readJSON(
                TOKENS_FILE,
                []
            );


        tokens.push({

            token,

            createdAt:
                new Date()
                    .toISOString()

        });


        tokens =
            tokens.slice(-20);


        writeJSON(
            TOKENS_FILE,
            tokens
        );


        res.json({

            success: true,

            token

        });

    }
);


/* =========================================================
   ADMIN DATA
========================================================= */

app.get(
    "/api/admin/data",
    requireAdmin,
    (req, res) => {

        const orders =
            readJSON(
                ORDERS_FILE,
                []
            );

        const models =
            readJSON(
                MODELS_FILE,
                []
            );

        const withdrawals =
            readJSON(
                WITHDRAWALS_FILE,
                []
            );

        const balance =
            getBalanceData();


        res.json({

            success: true,

            orders,

            customOrders:
                models,

            withdrawals,

            balance:
                Number(
                    balance.balance.toFixed(2)
                ),

            totalRevenue:
                Number(
                    balance.totalRevenue.toFixed(2)
                )

        });

    }
);


/* =========================================================
   CUSTOM MODEL
========================================================= */

app.post(
    "/api/custom-model",
    (req, res) => {

        const body =
            req.body || {};


        if (
            !body.name ||
            !body.email
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Imię i e-mail są wymagane."

            });

        }


        const model = {

            id:
                generateId(
                    "MODEL"
                ),

            name:
                String(
                    body.name
                ).trim(),

            email:
                String(
                    body.email
                ).trim(),

            phone:
                String(
                    body.phone ||
                    ""
                ).trim(),

            fileName:
                String(
                    body.fileName ||
                    body.filename ||
                    ""
                ).trim(),

            fileUrl:
                String(
                    body.fileUrl ||
                    body.url ||
                    ""
                ).trim(),

            material:
                String(
                    body.material ||
                    "PLA"
                ).trim(),

            color:
                String(
                    body.color ||
                    ""
                ).trim(),

            quantity:
                Math.max(
                    1,
                    Number(
                        body.quantity ||
                        1
                    )
                ),

            dimensions:
                String(
                    body.dimensions ||
                    ""
                ).trim(),

            description:
                String(
                    body.description ||
                    ""
                ).trim(),

            estimatedPrice:
                Math.max(
                    0,
                    Number(
                        body.estimatedPrice ||
                        0
                    )
                ),

            status:
                "NEW",

            createdAt:
                new Date()
                    .toISOString()

        };


        const models =
            readJSON(
                MODELS_FILE,
                []
            );


        models.unshift(
            model
        );


        writeJSON(
            MODELS_FILE,
            models
        );


        res.status(201).json({

            success: true,

            model

        });

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
   ADMIN
========================================================= */

app.get(
    "/admin",
    (req, res) => {

        const adminPath =
            path.join(
                __dirname,
                "admin.html"
            );


        if (
            fs.existsSync(
                adminPath
            )
        ) {

            return res.sendFile(
                adminPath
            );

        }


        return res
            .status(404)
            .send(
                "Brak admin.html"
            );

    }
);


/* =========================================================
   ROOT
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
   ERROR
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "[SERVER ERROR]",
            error
        );


        res.status(500).json({

            success: false,

            error:
                "Wewnętrzny błąd serwera."

        });

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
            "WEBHOOK:",
            STRIPE_WEBHOOK_SECRET
                ? "OK"
                : "BRAK SEKRETU"
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
