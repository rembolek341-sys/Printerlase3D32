```js
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "Admin2137!";

const FREE_DELIVERY_FROM = 50;
const DISCOUNT_CODE = "START10";
const DISCOUNT_PERCENT = 10;

/*
========================================
PLIKI DANYCH
========================================
*/

const DATA_DIR = path.join(__dirname, "data");

const ORDERS_FILE = path.join(
    DATA_DIR,
    "orders.json"
);

const MODELS_FILE = path.join(
    DATA_DIR,
    "custom-models.json"
);

const TOKENS_FILE = path.join(
    DATA_DIR,
    "tokens.json"
);

const BALANCE_FILE = path.join(
    DATA_DIR,
    "balance.json"
);

const WITHDRAWALS_FILE = path.join(
    DATA_DIR,
    "withdrawals.json"
);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

/*
========================================
TWORZENIE PLIKÓW
========================================
*/

function createFile(file, data) {
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
    MODELS_FILE,
    []
);

createFile(
    TOKENS_FILE,
    []
);

createFile(
    BALANCE_FILE,
    {
        balance: 0
    }
);

createFile(
    WITHDRAWALS_FILE,
    []
);

/*
========================================
JSON
========================================
*/

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }

        const data =
            fs.readFileSync(
                file,
                "utf8"
            );

        if (!data.trim()) {
            return fallback;
        }

        return JSON.parse(data);
    } catch (error) {
        console.error(
            "JSON ERROR:",
            file,
            error.message
        );

        return fallback;
    }
}

function writeJSON(file, data) {
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

/*
========================================
EXPRESS
========================================
*/

app.use(
    express.json({
        limit: "25mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "25mb"
    })
);

app.use(
    express.static(__dirname)
);

/*
========================================
ID / TOKEN
========================================
*/

function generateId(prefix) {
    return (
        prefix +
        "-" +
        Date.now().toString(36) +
        "-" +
        crypto
            .randomBytes(4)
            .toString("hex")
    ).toUpperCase();
}

function generateToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function getToken(req) {
    const auth =
        req.headers.authorization ||
        "";

    if (
        !auth.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    return auth.substring(7);
}

/*
========================================
ADMIN AUTH
========================================
*/

function requireAdmin(
    req,
    res,
    next
) {
    const token =
        getToken(req);

    if (!token) {
        return res
            .status(401)
            .json({
                success: false,
                error:
                    "Brak autoryzacji."
            });
    }

    const tokens =
        readJSON(
            TOKENS_FILE,
            []
        );

    const session =
        tokens.find(
            function (item) {
                return (
                    item.token ===
                    token
                );
            }
        );

    if (!session) {
        return res
            .status(401)
            .json({
                success: false,
                error:
                    "Sesja wygasła."
            });
    }

    next();
}

/*
========================================
SALDO
========================================
*/

function getBalance() {
    const data =
        readJSON(
            BALANCE_FILE,
            {
                balance: 0
            }
        );

    const balance =
        Number(
            data.balance || 0
        );

    return Number(
        balance.toFixed(2)
    );
}

function setBalance(
    amount
) {
    const safeAmount =
        Math.max(
            0,
            Number(amount || 0)
        );

    writeJSON(
        BALANCE_FILE,
        {
            balance:
                Number(
                    safeAmount.toFixed(
                        2
                    )
                )
        }
    );

    return getBalance();
}

function addBalance(
    amount
) {
    const current =
        getBalance();

    const add =
        Math.max(
            0,
            Number(amount || 0)
        );

    return setBalance(
        current + add
    );
}

function subtractBalance(
    amount
) {
    const current =
        getBalance();

    const subtract =
        Math.max(
            0,
            Number(amount || 0)
        );

    if (
        subtract >
        current
    ) {
        return null;
    }

    return setBalance(
        current - subtract
    );
}

/*
========================================
LOGIN
========================================
*/

app.post(
    "/api/admin/login",
    function (
        req,
        res
    ) {
        const login =
            String(
                req.body.login ||
                    ""
            ).trim();

        const password =
            String(
                req.body.password ||
                    ""
            );

        if (
            login !==
                ADMIN_LOGIN ||
            password !==
                ADMIN_PASSWORD
        ) {
            return res
                .status(401)
                .json({
                    success: false,
                    error:
                        "Nieprawidłowy login lub hasło."
                });
        }

        const token =
            generateToken();

        const tokens =
            readJSON(
                TOKENS_FILE,
                []
            );

        tokens.push({
            token:
                token,
            createdAt:
                new Date().toISOString()
        });

        writeJSON(
            TOKENS_FILE,
            tokens
        );

        console.log(
            "[ADMIN] Zalogowano"
        );

        res.json({
            success: true,
            token:
                token
        });
    }
);

/*
========================================
LOGOUT
========================================
*/

app.post(
    "/api/admin/logout",
    requireAdmin,
    function (
        req,
        res
    ) {
        const token =
            getToken(req);

        let tokens =
            readJSON(
                TOKENS_FILE,
                []
            );

        tokens =
            tokens.filter(
                function (
                    item
                ) {
                    return (
                        item.token !==
                        token
                    );
                }
            );

        writeJSON(
            TOKENS_FILE,
            tokens
        );

        res.json({
            success: true
        });
    }
);

/*
========================================
HEALTH
========================================
*/

app.get(
    "/api/health",
    function (
        req,
        res
    ) {
        res.json({
            success: true,
            online: true,
            service:
                "Printerlase3D",
            node:
                process.version
        });
    }
);

/*
========================================
ADMIN DATA
========================================
*/

app.get(
    "/api/admin/data",
    requireAdmin,
    function (
        req,
        res
    ) {
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

        let revenue =
            0;

        orders.forEach(
            function (
                order
            ) {
                revenue +=
                    Number(
                        order.total ||
                            0
                    );
            }
        );

        res.json({
            success: true,

            orders:
                orders,

            customOrders:
                models,

            withdrawals:
                withdrawals,

            balance:
                getBalance(),

            stats: {
                orders:
                    orders.length,

                models:
                    models.length,

                revenue:
                    Number(
                        revenue.toFixed(
                            2
                        )
                    ),

                balance:
                    getBalance()
            }
        });
    }
);

/*
========================================
WYPŁATA
========================================

Możesz wypłacić dowolną kwotę,
ale nie większą niż aktualne saldo.

2000 -> 1000 -> 1000
2000 -> 2000 -> 0
2000 -> 2500 -> odmowa
========================================
*/

app.post(
    "/api/admin/withdraw",
    requireAdmin,
    function (
        req,
        res
    ) {
        const amount =
            Number(
                req.body.amount
            );

        if (
            !Number.isFinite(
                amount
            ) ||
            amount <= 0
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Podaj prawidłową kwotę wypłaty."
                });
        }

        const roundedAmount =
            Number(
                amount.toFixed(
                    2
                )
            );

        const currentBalance =
            getBalance();

        if (
            roundedAmount >
            currentBalance
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Nie masz wystarczającego salda.",
                    balance:
                        currentBalance
                });
        }

        const newBalance =
            subtractBalance(
                roundedAmount
            );

        if (
            newBalance ===
            null
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Nie można wykonać wypłaty."
                });
        }

        const withdrawal = {
            id:
                generateId(
                    "PAY"
                ),

            amount:
                roundedAmount,

            balanceBefore:
                currentBalance,

            balanceAfter:
                newBalance,

            status:
                "PAID",

            createdAt:
                new Date().toISOString()
        };

        const withdrawals =
            readJSON(
                WITHDRAWALS_FILE,
                []
            );

        withdrawals.unshift(
            withdrawal
        );

        writeJSON(
            WITHDRAWALS_FILE,
            withdrawals
        );

        console.log(
            "[WITHDRAWAL] " +
                roundedAmount +
                " PLN | SALDO: " +
                newBalance +
                " PLN"
        );

        res.json({
            success: true,

            withdrawal:
                withdrawal,

            balance:
                newBalance
        });
    }
);

/*
========================================
CALCULATOR
========================================
*/

function calculateOrder(
    items,
    discountCode,
    delivery
) {
    if (
        !Array.isArray(
            items
        )
    ) {
        items = [];
    }

    let subtotal =
        0;

    const normalized =
        items.map(
            function (
                item
            ) {
                const price =
                    Math.max(
                        0,
                        Number(
                            item.price ||
                                0
                        )
                    );

                const quantity =
                    Math.max(
                        1,
                        Number(
                            item.quantity ||
                                item.qty ||
                                1
                        )
                    );

                const total =
                    price *
                    quantity;

                subtotal +=
                    total;

                return {
                    name:
                        String(
                            item.name ||
                                "Produkt"
                        ),

                    price:
                        Number(
                            price.toFixed(
                                2
                            )
                        ),

                    quantity:
                        quantity,

                    total:
                        Number(
                            total.toFixed(
                                2
                            )
                        )
                };
            }
        );

    const code =
        String(
            discountCode ||
                ""
        )
            .trim()
            .toUpperCase();

    let discount =
        0;

    if (
        code ===
        DISCOUNT_CODE
    ) {
        discount =
            (subtotal *
                DISCOUNT_PERCENT) /
            100;
    }

    const afterDiscount =
        Math.max(
            0,
            subtotal -
                discount
        );

    let deliveryPrice =
        9.99;

    if (
        delivery ===
        "pickup"
    ) {
        deliveryPrice =
            0;
    } else if (
        afterDiscount >=
        FREE_DELIVERY_FROM
    ) {
        deliveryPrice =
            0;
    }

    const total =
        afterDiscount +
        deliveryPrice;

    return {
        items:
            normalized,

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
            )
    };
}

app.post(
    "/api/calculate",
    function (
        req,
        res
    ) {
        const result =
            calculateOrder(
                req.body.items,
                req.body.discountCode,
                req.body.delivery
            );

        res.json({
            success: true,
            ...result
        });
    }
);

/*
========================================
ZAMÓWIENIA
========================================
*/

app.post(
    "/api/orders",
    function (
        req,
        res
    ) {
        const body =
            req.body || {};

        if (
            !body.name ||
            !body.email
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Imię i e-mail są wymagane."
                });
        }

        const calculated =
            calculateOrder(
                body.items,
                body.discountCode,
                body.delivery
            );

        const order = {
            id:
                generateId(
                    "ORD"
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

            address:
                String(
                    body.address ||
                        ""
                ).trim(),

            delivery:
                body.delivery ===
                "pickup"
                    ? "Odbiór osobisty"
                    : "Dostawa",

            items:
                calculated.items,

            subtotal:
                calculated.subtotal,

            discount:
                calculated.discount,

            discountCode:
                String(
                    body.discountCode ||
                        ""
                )
                    .trim()
                    .toUpperCase(),

            deliveryPrice:
                calculated.deliveryPrice,

            total:
                calculated.total,

            status:
                "NEW",

            note:
                String(
                    body.note ||
                        ""
                ).trim(),

            createdAt:
                new Date().toISOString()
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

        /*
        ========================================
        DODANIE PIENIĘDZY DO SALDA
        ========================================
        */

        const newBalance =
            addBalance(
                order.total
            );

        console.log(
            "[ORDER] " +
                order.id +
                " | " +
                order.total +
                " PLN"
        );

        console.log(
            "[BALANCE] +" +
                order.total +
                " PLN | SALDO: " +
                newBalance +
                " PLN"
        );

        res.status(201).json({
            success: true,

            order:
                order,

            balance:
                newBalance
        });
    }
);

/*
========================================
WŁASNY MODEL 3D
========================================
*/

app.post(
    "/api/custom-model",
    function (
        req,
        res
    ) {
        const body =
            req.body || {};

        if (
            !body.name ||
            !body.email
        ) {
            return res
                .status(400)
                .json({
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
                new Date().toISOString()
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

        console.log(
            "[MODEL] " +
                model.id
        );

        res.status(201).json({
            success: true,
            model:
                model
        });
    }
);

/*
========================================
STATUS ZAMÓWIENIA
========================================
*/

app.patch(
    "/api/admin/orders/:id/status",
    requireAdmin,
    function (
        req,
        res
    ) {
        const status =
            String(
                req.body.status ||
                    ""
            )
                .trim()
                .toUpperCase();

        const allowed = [
            "NEW",
            "IN_PROGRESS",
            "READY",
            "COMPLETED",
            "CANCELLED"
        ];

        if (
            !allowed.includes(
                status
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Nieprawidłowy status."
                });
        }

        const orders =
            readJSON(
                ORDERS_FILE,
                []
            );

        const order =
            orders.find(
                function (
                    item
                ) {
                    return (
                        String(
                            item.id
                        ) ===
                        String(
                            req.params
                                .id
                        )
                    );
                }
            );

        if (!order) {
            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        "Nie znaleziono zamówienia."
                });
        }

        order.status =
            status;

        order.updatedAt =
            new Date().toISOString();

        writeJSON(
            ORDERS_FILE,
            orders
        );

        res.json({
            success: true,
            order:
                order
        });
    }
);

/*
========================================
STATUS MODELU
========================================
*/

app.patch(
    "/api/admin/custom/:id/status",
    requireAdmin,
    function (
        req,
        res
    ) {
        const status =
            String(
                req.body.status ||
                    ""
            )
                .trim()
                .toUpperCase();

        const allowed = [
            "NEW",
            "IN_PROGRESS",
            "READY",
            "COMPLETED",
            "CANCELLED"
        ];

        if (
            !allowed.includes(
                status
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Nieprawidłowy status."
                });
        }

        const models =
            readJSON(
                MODELS_FILE,
                []
            );

        const model =
            models.find(
                function (
                    item
                ) {
                    return (
                        String(
                            item.id
                        ) ===
                        String(
                            req.params
                                .id
                        )
                    );
                }
            );

        if (!model) {
            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        "Nie znaleziono modelu."
                });
        }

        model.status =
            status;

        model.updatedAt =
            new Date().toISOString();

        writeJSON(
            MODELS_FILE,
            models
        );

        res.json({
            success: true,
            model:
                model
        });
    }
);

/*
========================================
USUWANIE ZAMÓWIENIA
========================================
*/

app.delete(
    "/api/admin/orders/:id",
    requireAdmin,
    function (
        req,
        res
    ) {
        const orders =
            readJSON(
                ORDERS_FILE,
                []
            );

        const filtered =
            orders.filter(
                function (
                    order
                ) {
                    return (
                        String(
                            order.id
                        ) !==
                        String(
                            req.params
                                .id
                        )
                    );
                }
            );

        if (
            filtered.length ===
            orders.length
        ) {
            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        "Nie znaleziono zamówienia."
                });
        }

        writeJSON(
            ORDERS_FILE,
            filtered
        );

        res.json({
            success: true
        });
    }
);

/*
========================================
USUWANIE MODELU
========================================
*/

app.delete(
    "/api/admin/custom/:id",
    requireAdmin,
    function (
        req,
        res
    ) {
        const models =
            readJSON(
                MODELS_FILE,
                []
            );

        const filtered =
            models.filter(
                function (
                    model
                ) {
                    return (
                        String(
                            model.id
                        ) !==
                        String(
                            req.params
                                .id
                        )
                    );
                }
            );

        if (
            filtered.length ===
            models.length
        ) {
            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        "Nie znaleziono modelu."
                });
        }

        writeJSON(
            MODELS_FILE,
            filtered
        );

        res.json({
            success: true
        });
    }
);

/*
========================================
STRONA ADMINA
========================================
*/

app.get(
    "/admin",
    function (
        req,
        res
    ) {
        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );
    }
);

/*
========================================
STRONA GŁÓWNA
========================================
*/

app.get(
    "/",
    function (
        req,
        res
    ) {
        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );
    }
);

/*
========================================
API 404
========================================
*/

app.use(
    "/api",
    function (
        req,
        res
    ) {
        res
            .status(404)
            .json({
                success: false,
                error:
                    "Nie znaleziono API."
            });
    }
);

/*
========================================
ERROR
========================================
*/

app.use(
    function (
        error,
        req,
        res,
        next
    ) {
        console.error(
            "SERVER ERROR:",
            error
        );

        res
            .status(500)
            .json({
                success: false,
                error:
                    "Wewnętrzny błąd serwera."
            });
    }
);

/*
========================================
START
========================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    function () {
        console.log(
            "================================"
        );

        console.log(
            "      PRINTERLASE3D ONLINE"
        );

        console.log(
            "================================"
        );

        console.log(
            "PORT: " +
                PORT
        );

        console.log(
            "ADMIN: /admin"
        );

        console.log(
            "SALDO: BEZ LIMITU"
        );

        console.log(
            "WYPŁATA: DO WYSOKOŚCI SALDA"
        );

        console.log(
            "DISCOUNT: " +
                DISCOUNT_CODE +
                " -" +
                DISCOUNT_PERCENT +
                "%"
        );

        console.log(
            "FREE DELIVERY: " +
                FREE_DELIVERY_FROM +
                " PLN"
        );

        console.log(
            "================================"
        );
    }
);
```
