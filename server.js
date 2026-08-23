const express = require("express");
const Stripe = require("stripe");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

const STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY;

const BASE_URL =
    process.env.BASE_URL ||
    "https://printerlase3d32.onrender.com";


/* ==================================================
   STRIPE
================================================== */

let stripe = null;

if (STRIPE_SECRET_KEY) {

    stripe = new Stripe(
        STRIPE_SECRET_KEY
    );

    console.log("[STRIPE] API KEY: OK");

} else {

    console.error(
        "[STRIPE] BRAK STRIPE_SECRET_KEY"
    );

}


/* ==================================================
   MIDDLEWARE
================================================== */

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


/* ==================================================
   STATIC FILES
================================================== */

app.use(
    express.static(
        path.join(__dirname)
    )
);


/* ==================================================
   HEALTH CHECK
================================================== */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            stripe:
                !!STRIPE_SECRET_KEY,

            baseUrl:
                BASE_URL

        });

    }
);


/* ==================================================
   CREATE STRIPE CHECKOUT
================================================== */

app.post(
    "/api/create-checkout-session",
    async (req, res) => {

        try {

            console.log(
                "[CHECKOUT] Nowe żądanie"
            );


            /* ------------------------------------------
               STRIPE KEY
            ------------------------------------------ */

            if (!stripe) {

                return res.status(500).json({

                    success: false,

                    error:
                        "Brak STRIPE_SECRET_KEY na Render."

                });

            }


            /* ------------------------------------------
               DATA
            ------------------------------------------ */

            const {
                items,
                customer,
                delivery,
                deliveryPrice,
                discount
            } = req.body;


            /* ------------------------------------------
               CART
            ------------------------------------------ */

            if (
                !Array.isArray(items) ||
                items.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Koszyk jest pusty."

                });

            }


            /* ------------------------------------------
               CUSTOMER
            ------------------------------------------ */

            const customerEmail =
                customer &&
                customer.email
                    ? String(
                        customer.email
                    ).trim()
                    : undefined;


            /* ------------------------------------------
               LINE ITEMS
            ------------------------------------------ */

            const lineItems = [];


            for (
                const item of items
            ) {

                const name =
                    String(
                        item.name ||
                        "Produkt Printerlase3D"
                    ).slice(0, 250);


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


            /* ------------------------------------------
               DELIVERY
            ------------------------------------------ */

            const shipping =
                Number(
                    deliveryPrice || 0
                );


            if (
                !Number.isFinite(shipping) ||
                shipping < 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Nieprawidłowa cena dostawy."

                });

            }


            if (shipping > 0) {

                lineItems.push({

                    price_data: {

                        currency: "pln",

                        product_data: {

                            name:
                                delivery
                                    ? `Dostawa — ${String(delivery).slice(0, 100)}`
                                    : "Dostawa"

                        },

                        unit_amount:
                            Math.round(
                                shipping * 100
                            )

                    },

                    quantity: 1

                });

            }


            /* ------------------------------------------
               METADATA
            ------------------------------------------ */

            const metadata = {

                name:
                    String(
                        customer?.name || ""
                    ).slice(0, 500),

                phone:
                    String(
                        customer?.phone || ""
                    ).slice(0, 100),

                address:
                    String(
                        customer?.address || ""
                    ).slice(0, 500),

                postcode:
                    String(
                        customer?.postcode || ""
                    ).slice(0, 50),

                city:
                    String(
                        customer?.city || ""
                    ).slice(0, 200),

                delivery:
                    String(
                        delivery || ""
                    ).slice(0, 200),

                paczkomat:
                    String(
                        customer?.paczkomat || ""
                    ).slice(0, 100),

                discount:
                    String(
                        Number(discount || 0)
                    )

            };


            /* ------------------------------------------
               STRIPE SESSION
            ------------------------------------------ */

            const session =
                await stripe.checkout.sessions.create({

                    mode:
                        "payment",

                    line_items:
                        lineItems,

                    customer_email:
                        customerEmail,

                    metadata,

                    billing_address_collection:
                        "auto",

                    phone_number_collection: {
                        enabled: true
                    },

                    success_url:
                        `${BASE_URL}/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,

                    cancel_url:
                        `${BASE_URL}/checkout.html?payment=cancel`,

                    submit_type:
                        "pay"

                });


            console.log(
                "[STRIPE] Checkout utworzony:",
                session.id
            );


            /* ------------------------------------------
               RESPONSE
            ------------------------------------------ */

            return res.json({

                success: true,

                url:
                    session.url,

                sessionId:
                    session.id

            });


        } catch (error) {

            console.error(
                "[STRIPE ERROR]",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Nie udało się utworzyć płatności."

            });

        }

    }
);


/* ==================================================
   CHECKOUT SESSION STATUS
================================================== */

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


            return res.json({

                success: true,

                payment_status:
                    session.payment_status,

                status:
                    session.status,

                amount_total:
                    session.amount_total,

                currency:
                    session.currency,

                customer_email:
                    session.customer_details?.email ||
                    null

            });


        } catch (error) {

            console.error(
                "[SESSION ERROR]",
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


/* ==================================================
   ADMIN
================================================== */

app.get(
    "/admin",
    (req, res) => {

        res.send(`
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Printerlase3D Admin</title>

<style>

body{
    margin:0;
    padding:40px;

    background:#02050c;
    color:white;

    font-family:Arial;
}

h1{
    color:#19dcff;
}

.card{
    padding:20px;
    margin-top:20px;

    border:1px solid #1b3049;
    border-radius:15px;

    background:#071020;
}

.ok{
    color:#00df91;
}

.bad{
    color:#ff4b6e;
}

</style>
</head>

<body>

<h1>Printerlase3D Admin</h1>

<div class="card">

<p>
Stripe:
<strong class="${STRIPE_SECRET_KEY ? "ok" : "bad"}">
${STRIPE_SECRET_KEY ? "OK" : "BRAK KLUCZA"}
</strong>
</p>

<p>
BASE URL:
${BASE_URL}
</p>

<p>
Port:
${PORT}
</p>

</div>

</body>
</html>
        `);

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
   ERROR HANDLER
================================================== */

app.use(
    (err, req, res, next) => {

        console.error(
            "[SERVER ERROR]",
            err
        );

        res.status(500).json({

            success: false,

            error:
                "Błąd serwera."

        });

    }
);


/* ==================================================
   START
================================================== */

app.listen(
    PORT,
    () => {

        console.log(`
======================================

       PRINTERLASE3D ONLINE

======================================

PORT: ${PORT}

ADMIN: /admin

STRIPE:
${STRIPE_SECRET_KEY
    ? "OK"
    : "BRAK KLUCZA"}

BASE URL:
${BASE_URL}

======================================
        `);

    }
);
