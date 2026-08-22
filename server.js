```js
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

// ===============================
// USTAWIENIA ADMINA
// ===============================

const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "Admin2137!";

// ===============================
// PLIKI DANYCH
// ===============================

const DATA_DIR = path.join(__dirname, "data");

const ORDERS_FILE = path.join(
    DATA_DIR,
    "orders.json"
);

const CUSTOM_FILE = path.join(
    DATA_DIR,
    "custom-models.json"
);

const TOKENS_FILE = path.join(
    DATA_DIR,
    "tokens.json"
);

// Tworzymy folder data
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}


// ===============================
// FUNKCJE PLIKÓW
// ===============================

function ensureFile(file, defaultValue) {

    if (!fs.existsSync(file)) {

        fs.writeFileSync(
            file,
            JSON.stringify(
                defaultValue,
                null,
                2
            ),
            "utf8"
        );

    }

}


function readJSON(file, fallback) {

    try {

        ensureFile(
            file,
            fallback
        );

        const content =
            fs.readFileSync(
                file,
                "utf8"
            );

        return JSON.parse(content);

    } catch (error) {

        console.error(
            "Błąd odczytu:",
            file,
            error
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


ensureFile(
    ORDERS_FILE,
    []
);

ensureFile(
    CUSTOM_FILE,
    []
);

ensureFile(
    TOKENS_FILE,
    []
);


// ===============================
// MIDDLEWARE
// ===============================

app.use(
    express.json({
        limit: "20mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb"
    })
);


// ===============================
// FRONTEND
// ===============================

app.use(
    express.static(__dirname)
);


// ===============================
// GENEROWANIE ID
// ===============================

function generateId(prefix) {

    return (
        prefix +
        "-" +
        Date.now().toString(36) +
        "-" +
        crypto
            .randomBytes(3)
            .toString("hex")
    ).toUpperCase();

}


// ===============================
// TOKEN
// ===============================

function createToken() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}


function requireAdmin(
    req,
    res,
    next
) {

    const header =
        req.headers.authorization || "";

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {

        return res.status(401).json({
            error: "Brak autoryzacji."
        });

    }


    const token =
        header.substring(7);

    const tokens =
        readJSON(
            TOKENS_FILE,
            []
        );


    const exists =
        tokens.find(
            item =>
                item.token === token
        );


    if (!exists) {

        return res.status(401).json({
            error: "Nieprawidłowa sesja."
        });

    }


    next();

}


// ===============================
// LOGIN ADMINA
// ===============================

app.post(
    "/api/admin/login",
    (req, res) => {

        const {
            login,
            password
        } = req.body || {};


        if (
            login !== ADMIN_LOGIN ||
            password !== ADMIN_PASSWORD
        ) {

            return res.status(401).json({
                error:
                    "Nieprawidłowy login lub hasło."
            });

        }


        const token =
            createToken();


        const tokens =
            readJSON(
                TOKENS_FILE,
                []
            );


        tokens.push({
            token,
            createdAt:
                new Date().toISOString()
        });


        // Czyścimy bardzo stare tokeny
        const day =
            1000 *
            60 *
            60 *
            24;


        const now =
            Date.now();


        const freshTokens =
            tokens.filter(
                item => {

                    const time =
                        new Date(
                            item.createdAt
                        ).getTime();

                    return (
                        now - time
                        < day * 7
                    );

                }
            );


        writeJSON(
            TOKENS_FILE,
            freshTokens
        );


        res.json({
            success: true,
            token
        });

    }
);


// ===============================
// WYLOGOWANIE
// ===============================

app.post(
    "/api/admin/logout",
    requireAdmin,
    (req, res) => {

        const header =
            req.headers.authorization || "";

        const token =
            header.substring(7);

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


// ===============================
// DANE PANELU ADMINA
// ===============================

app.get(
    "/api/admin/data",
    requireAdmin,
    (req, res) => {

        const orders =
            readJSON(
                ORDERS_FILE,
                []
            );

        const customOrders =
            readJSON(
                CUSTOM_FILE,
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


        customOrders.sort(
            (a, b) =>
                new Date(
                    b.createdAt
                ) -
                new Date(
                    a.createdAt
                )
        );


        res.json({
            success: true,
            orders,
            customOrders
        });

    }
);


// ===============================
// NOWE ZAMÓWIENIE
// ===============================

app.post(
    "/api/orders",
    (req, res) => {

        const body =
            req.body || {};


        const orders =
            readJSON(
                ORDERS_FILE,
                []
            );


        const order = {

            id:
                generateId("ORD"),

            name:
                body.name ||
                body.customerName ||
                "",

            email:
                body.email ||
                "",

            phone:
                body.phone ||
                "",

            address:
                body.address ||
                "",

            items:
                Array.isArray(body.items)
                    ? body.items
                    : [],

            total:
                Number(
                    body.total || 0
                ),

            delivery:
                body.delivery ||
                "",

            discountCode:
                body.discountCode ||
                "",

            discount:
                Number(
                    body.discount || 0
                ),

            status:
                "NEW",

            note:
                body.note ||
                "",

            createdAt:
                new Date().toISOString()

        };


        orders.unshift(
            order
        );


        writeJSON(
            ORDERS_FILE,
            orders
        );


        console.log(
            "Nowe zamówienie:",
            order.id
        );


        res.status(201).json({
            success: true,
            order
        });

    }
);


// ===============================
// WŁASNY MODEL 3D
// ===============================

app.post(
    "/api/custom-model",
    (req, res) => {

        const body =
            req.body || {};


        const customModels =
            readJSON(
                CUSTOM_FILE,
                []
            );


        const model = {

            id:
                generateId("MODEL"),

            name:
                body.name ||
                body.customerName ||
                "",

            email:
                body.email ||
                "",

            phone:
                body.phone ||
                "",

            fileName:
                body.fileName ||
                body.filename ||
                "",

            fileUrl:
                body.fileUrl ||
                body.url ||
                "",

            material:
                body.material ||
                "PLA",

            color:
                body.color ||
                "",

            quantity:
                Number(
                    body.quantity || 1
                ),

            dimensions:
                body.dimensions ||
                "",

            description:
                body.description ||
                "",

            estimatedPrice:
                Number(
                    body.estimatedPrice ||
                    0
                ),

            status:
                "NEW",

            createdAt:
                new Date().toISOString()

        };


        customModels.unshift(
            model
        );


        writeJSON(
            CUSTOM_FILE,
            customModels
        );


        console.log(
            "Nowy własny model:",
            model.id
        );


        res.status(201).json({
            success: true,
            model
        });

    }
);


// ===============================
// ZMIANA STATUSU ZAMÓWIENIA
// ===============================

app.patch(
    "/api/admin/orders/:id/status",
    requireAdmin,
    (req, res) => {

        const {
            status
        } = req.body || {};


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
                    String(item.id) ===
                    String(req.params.id)
            );


        if (!order) {

            return res.status(404).json({
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


// ===============================
// ZMIANA STATUSU MODELU
// ===============================

app.patch(
    "/api/admin/custom/:id/status",
    requireAdmin,
    (req, res) => {

        const {
            status
        } = req.body || {};


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
                error:
                    "Nieprawidłowy status."
            });

        }


        const models =
            readJSON(
                CUSTOM_FILE,
                []
            );


        const model =
            models.find(
                item =>
                    String(item.id) ===
                    String(req.params.id)
            );


        if (!model) {

            return res.status(404).json({
                error:
                    "Nie znaleziono modelu."
            });

        }


        model.status =
            status;

        model.updatedAt =
            new Date().toISOString();


        writeJSON(
            CUSTOM_FILE,
            models
        );


        res.json({
            success: true,
            model
        });

    }
);


// ===============================
// USUWANIE WŁASNEGO MODELU
// ===============================

app.delete(
    "/api/admin/custom/:id",
    requireAdmin,
    (req, res) => {

        const models =
            readJSON(
                CUSTOM_FILE,
                []
            );


        const before =
            models.length;


        const filtered =
            models.filter(
                item =>
                    String(item.id) !==
                    String(req.params.id)
            );


        if (
            filtered.length ===
            before
        ) {

            return res.status(404).json({
                error:
                    "Nie znaleziono modelu."
            });

        }


        writeJSON(
            CUSTOM_FILE,
            filtered
        );


        res.json({
            success: true
        });

    }
);


// ===============================
// HEALTH CHECK
// ===============================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            online: true,
            service:
                "Printerlase3D",
            time:
                new Date().toISOString()
        });

    }
);


// ===============================
// STRONA ADMINA
// ===============================

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


// ===============================
// START
// ===============================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "================================"
        );

        console.log(
            "   Printerlase3D ONLINE"
        );

        console.log(
            "================================"
        );

        console.log(
            `Sklep: http://localhost:${PORT}`
        );

        console.log(
            `Admin: http://localhost:${PORT}/admin`
        );

        console.log(
            "Login: admin"
        );

        console.log(
            "Hasło: Admin2137!"
        );

        console.log(
            "================================"
        );

        console.log("");

    }
);
```
