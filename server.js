```js
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

// ======================================================
// KONFIGURACJA
// ======================================================

const PORT = process.env.PORT || 3000;

const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "Admin2137!";

const FREE_DELIVERY_FROM = 50;
const DISCOUNT_CODE = "START10";
const DISCOUNT_PERCENT = 10;

// ======================================================
// PLIKI DANYCH
// ======================================================

const DATA_DIR = path.join(__dirname, "data");

const ORDERS_FILE =
    path.join(DATA_DIR, "orders.json");

const CUSTOM_MODELS_FILE =
    path.join(DATA_DIR, "custom-models.json");

const TOKENS_FILE =
    path.join(DATA_DIR, "tokens.json");

// ======================================================
// TWORZENIE FOLDERU DATA
// ======================================================

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

// ======================================================
// TWORZENIE PLIKÓW
// ======================================================

function createFileIfMissing(file, data) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2),
            "utf8"
        );
    }
}

createFileIfMissing(
    ORDERS_FILE,
    []
);

createFileIfMissing(
    CUSTOM_MODELS_FILE,
    []
);

createFileIfMissing(
    TOKENS_FILE,
    []
);

// ======================================================
// JSON
// ======================================================

function readJSON(file, fallback = []) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }

        const content =
            fs.readFileSync(
                file,
                "utf8"
            );

        if (!content.trim()) {
            return fallback;
        }

        return JSON.parse(content);
    } catch (error) {
        console.error(
            "Błąd odczytu:",
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

// ======================================================
// MIDDLEWARE
// ======================================================

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

// ======================================================
// FRONTEND
// ======================================================

app.use(
    express.static(__dirname)
);

// ======================================================
// ID
// ======================================================

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

// ======================================================
// TOKEN ADMINA
// ======================================================

function generateToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function getToken(req) {
    const header =
        req.headers.authorization || "";

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    return header.slice(7);
}

function requireAdmin(req, res, next) {
    const token =
        getToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            error:
                "Brak tokenu administratora."
        });
    }

    const tokens =
        readJSON(
            TOKENS_FILE,
            []
        );

    const found =
        tokens.find(
            item =>
                item.token === token
        );

    if (!found) {
        return res.status(401).json({
            success: false,
            error:
                "Sesja administratora wygasła."
        });
    }

    next();
}

// ======================================================
// LOGOWANIE ADMINA
// ======================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        const login =
            String(
                req.body?.login || ""
            ).trim();

        const password =
            String(
                req.body?.password || ""
            );

        if (
            login !== ADMIN_LOGIN ||
            password !== ADMIN_PASSWORD
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
                new Date().toISOString()
        });

        // Tokeny starsze niż 7 dni
        const sevenDaysAgo =
            Date.now() -
            7 *
                24 *
                60 *
                60 *
                1000;

        tokens =
            tokens.filter(
                item => {

                    const time =
                        new Date(
                            item.createdAt
                        ).getTime();

                    return (
                        !Number.isNaN(
                            time
                        ) &&
                        time >
                            sevenDaysAgo
                    );
                }
            );

        writeJSON(
            TOKENS_FILE,
            tokens
        );

        console.log(
            "[ADMIN] Zalogowano"
        );

        res.json({
            success: true,
            token
        });
    }
);

// ======================================================
// WYLOGOWANIE
// ======================================================

app.post(
    "/api/admin/logout",
    requireAdmin,
    (req, res) => {

        const token =
            getToken(req);

        let tokens =
            readJSON(
                TOKENS_FILE,
                []
            );

        tokens =
            tokens.filter(
                item =>
                    item.token !== token
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

// ======================================================
// HEALTH CHECK — RENDER
// ======================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            online: true,
            service:
                "Printerlase3D",
            node:
                process.version,
            time:
                new Date().toISOString()
        });
    }
);

// ======================================================
// ADMIN DATA
// ======================================================

app.get(
    "/api/admin/data",
    requireAdmin,
    (req, res) => {

        let orders =
            readJSON(
                ORDERS_FILE,
                []
            );

        let customModels =
            readJSON(
                CUSTOM_MODELS_FILE,
                []
            );

        orders.sort(
            (a, b) =>
                new Date(
                    b.createdAt
                ) -
                new Date(
                    a.createdAt
                )
        );

        customModels.sort(
            (a, b) =>
                new Date(
                    b.createdAt
                ) -
                new Date(
                    a.createdAt
                )
        );

        const revenue =
            orders.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.total || 0
                    ),
                0
            );

        res.json({
            success: true,

            orders,

            customOrders:
                customModels,

            stats: {
                orders:
                    orders.length,

                customModels:
                    customModels.length,

                revenue:
                    Number(
                        revenue.toFixed(
                            2
                        )
                    )
            }
        });
    }
);

// ======================================================
// KALKULACJA ZAMÓWIENIA
// ======================================================

function calculateOrder(
    items,
    discountCode,
    delivery
) {

    if (
        !Array.isArray(items)
    ) {
        items = [];
    }

    let subtotal = 0;

    const normalizedItems =
        items.map(item => {

            const price =
                Math.max(
                    0,
                    Number(
                        item.price || 0
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
                price * quantity;

            subtotal += total;

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

                quantity,

                total:
                    Number(
                        total.toFixed(
                            2
                        )
                    )
            };
        });

    const normalizedCode =
        String(
            discountCode || ""
        )
        .trim()
        .toUpperCase();

    let discount = 0;

    if (
        normalizedCode ===
        DISCOUNT_CODE
    ) {
        discount =
            subtotal *
            (
                DISCOUNT_PERCENT /
                100
            );
    }

    const afterDiscount =
        Math.max(
            0,
            subtotal - discount
        );

    let deliveryPrice;

    if (
        delivery ===
        "pickup"
    ) {
        deliveryPrice = 0;
    } else if (
        afterDiscount >=
        FREE_DELIVERY_FROM
    ) {
        deliveryPrice = 0;
    } else {
        deliveryPrice = 9.99;
    }

    const total =
        afterDiscount +
        deliveryPrice;

    return {
        items:
            normalizedItems,

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

        freeDelivery:
            deliveryPrice === 0
    };
}

// ======================================================
// API — KALKULATOR
// ======================================================

app.post(
    "/api/calculate",
    (req, res) => {

        const result =
            calculateOrder(
                req.body?.items,
                req.body?.discountCode,
                req.body?.delivery
            );

        res.json({
            success: true,
            ...result
        });
    }
);

// ======================================================
// NOWE ZAMÓWIENIE
// ======================================================

app.post(
    "/api/orders",
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
                    "Podaj imię i e-mail."
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
                    body.phone || ""
                ).trim(),

            address:
                String(
                    body.address || ""
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
                    body.note || ""
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

        console.log(
            `[ORDER] ${order.id} | ${order.total} PLN`
        );

        res.status(201).json({
            success: true,
            order
        });
    }
);

// ======================================================
// WŁASNY MODEL 3D
// ======================================================

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
                    "Podaj imię i e-mail."
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
                    body.phone || ""
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
                CUSTOM_MODELS_FILE,
                []
            );

        models.unshift(
            model
        );

        writeJSON(
            CUSTOM_MODELS_FILE,
            models
        );

        console.log(
            `[MODEL] ${model.id} | ${model.fileName || "brak pliku"}`
        );

        res.status(201).json({
            success: true,
            model
        });
    }
);

// ======================================================
// ZMIANA STATUSU ZAMÓWIENIA
// ======================================================

app.patch(
    "/api/admin/orders/:id/status",
    requireAdmin,
    (req, res) => {

        const status =
            String(
                req.body?.status || ""
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
            return res.status(400).json({
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
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        req.params.id
                    )
            );

        if (!order) {
            return res.status(404).json({
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
            order
        });
    }
);

// ======================================================
// ZMIANA STATUSU MODELU
// ======================================================

app.patch(
    "/api/admin/custom/:id/status",
    requireAdmin,
    (req, res) => {

        const status =
            String(
                req.body?.status || ""
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
            return res.status(400).json({
                success: false,
                error:
                    "Nieprawidłowy status."
            });
        }

        const models =
            readJSON(
                CUSTOM_MODELS_FILE,
                []
            );

        const model =
            models.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        req.params.id
                    )
            );

        if (!model) {
            return res.status(404).json({
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
            CUSTOM_MODELS_FILE,
            models
        );

        res.json({
            success: true,
            model
        });
    }
);

// ======================================================
// USUWANIE ZAMÓWIENIA
// ======================================================

app.delete(
    "/api/admin/orders/:id",
    requireAdmin,
    (req, res) => {

        const orders =
            readJSON(
                ORDERS_FILE,
                []
            );

        const filtered =
            orders.filter(
                order =>
                    String(
                        order.id
                    ) !==
                    String(
                        req.params.id
                    )
            );

        if (
            filtered.length ===
            orders.length
        ) {
            return res.status(404).json({
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

// ======================================================
// USUWANIE MODELU
// ======================================================

app.delete(
    "/api/admin/custom/:id",
    requireAdmin,
    (req, res) => {

        const models =
            readJSON(
                CUSTOM_MODELS_FILE,
                []
            );

        const filtered =
            models.filter(
                model =>
                    String(
                        model.id
                    ) !==
                    String(
                        req.params.id
                    )
            );

        if (
            filtered.length ===
            models.length
        ) {
            return res.status(404).json({
                success: false,
                error:
                    "Nie znaleziono modelu."
            });
        }

        writeJSON(
            CUSTOM_MODELS_FILE,
            filtered
        );

        res.json({
            success: true
        });
    }
);

// ======================================================
// ADMIN
// ======================================================

app.get(
    "/admin",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );
    }
);

// ======================================================
// API 404
// ======================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            success: false,
            error:
                "Nie znaleziono endpointu API."
        });
    }
);

// ======================================================
// BŁĘDY
// ======================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            error:
                "Wewnętrzny błąd serwera."
        });
    }
);

// ======================================================
// START SERWERA
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "        PRINTERLASE3D ONLINE"
        );
        console.log(
            "========================================"
        );

        console.log(
            `Port: ${PORT}`
        );

        console.log(
            `Darmowa dostawa od: ${FREE_DELIVERY_FROM} PLN`
        );

        console.log(
            `Kod rabatowy: ${DISCOUNT_CODE}`
        );

        console.log(
            `Rabat: ${DISCOUNT_PERCENT}%`
        );

        console.log(
            "========================================"
        );

    }
);
```
