const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// KONFIGURACJA
// ===============================

// Możesz zmienić hasło tutaj.
// Na Renderze lepiej ustawić ADMIN_PASSWORD
// w Environment Variables.
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "admin123";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));

// Pliki strony
app.use(express.static(__dirname));

// ===============================
// DANE
// ===============================

let orders = [
    {
        id: "PL3D-DEMO001",
        name: "Klient testowy",
        email: "test@example.com",
        phone: "600000000",
        address: "ul. Testowa 1",
        postalCode: "40-001",
        city: "Katowice",
        country: "Polska",
        total: 59.99,
        discount: 0,
        status: "NEW",
        type: "NORMAL",
        items: [
            {
                name: "Brelok 3D",
                quantity: 1,
                price: 59.99
            }
        ],
        createdAt: new Date().toISOString()
    }
];

// ===============================
// FUNKCJE
// ===============================

function checkAdmin(req, res, next) {

    const password =
        req.headers["x-admin-password"];

    if (!password) {
        return res.status(401).json({
            error: "Brak hasła administratora."
        });
    }

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Nieprawidłowe hasło."
        });
    }

    next();
}

function calculateStats() {

    const balance =
        orders.reduce(
            (sum, order) =>
                sum + Number(order.total || 0),
            0
        );

    const earned =
        orders
            .filter(
                order =>
                    order.status === "PAID" ||
                    order.status === "PROCESSING" ||
                    order.status === "SHIPPED" ||
                    order.status === "COMPLETED"
            )
            .reduce(
                (sum, order) =>
                    sum + Number(order.total || 0),
                0
            );

    const customModels =
        orders.filter(
            order =>
                order.type === "CUSTOM_MODEL"
        ).length;

    return {
        balance,
        earned,
        withdrawn: 0,
        customModels
    };
}

// ===============================
// STRONA GŁÓWNA
// ===============================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );

});

// ===============================
// PANEL ADMINA
// ===============================

app.get("/admin", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "admin.html"
        )
    );

});

// ===============================
// TEST LOGOWANIA
// ===============================

app.post("/api/admin/login", (req, res) => {

    const password =
        String(
            req.body?.password || ""
        );

    if (password !== ADMIN_PASSWORD) {

        return res.status(401).json({
            success: false,
            error: "Błędne hasło."
        });

    }

    res.json({
        success: true,
        message: "Zalogowano."
    });

});

// ===============================
// DASHBOARD
// ===============================

app.get(
    "/api/admin/dashboard",
    checkAdmin,
    (req, res) => {

        const stats =
            calculateStats();

        res.json({
            balance: stats.balance,
            earned: stats.earned,
            withdrawn: stats.withdrawn,
            customModels:
                stats.customModels,
            orders
        });

    }
);

// ===============================
// ZMIANA STATUSU
// ===============================

app.post(
    "/api/admin/order-status",
    checkAdmin,
    (req, res) => {

        const {
            id,
            status
        } = req.body;

        if (!id || !status) {

            return res.status(400).json({
                error:
                    "Brak ID zamówienia lub statusu."
            });

        }

        const order =
            orders.find(
                item =>
                    item.id === id
            );

        if (!order) {

            return res.status(404).json({
                error:
                    "Nie znaleziono zamówienia."
            });

        }

        const allowedStatuses = [
            "NEW",
            "PAID",
            "PROCESSING",
            "SHIPPED",
            "COMPLETED",
            "CANCELLED"
        ];

        if (
            !allowedStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({
                error:
                    "Nieprawidłowy status."
            });

        }

        order.status = status;

        res.json({
            success: true,
            order
        });

    }
);

// ===============================
// UTWORZENIE ZAMÓWIENIA
// ===============================

app.post(
    "/api/orders",
    (req, res) => {

        const body = req.body || {};

        const id =
            "PL3D-" +
            crypto
                .randomBytes(5)
                .toString("hex")
                .toUpperCase();

        const order = {

            id,

            name:
                String(
                    body.name || ""
                ),

            email:
                String(
                    body.email || ""
                ),

            phone:
                String(
                    body.phone || ""
                ),

            address:
                String(
                    body.address || ""
                ),

            postalCode:
                String(
                    body.postalCode || ""
                ),

            city:
                String(
                    body.city || ""
                ),

            country:
                String(
                    body.country ||
                    "Polska"
                ),

            total:
                Number(
                    body.total || 0
                ),

            discount:
                Number(
                    body.discount || 0
                ),

            status: "NEW",

            type:
                body.type ===
                "CUSTOM_MODEL"
                    ? "CUSTOM_MODEL"
                    : "NORMAL",

            description:
                String(
                    body.description || ""
                ),

            originalFileName:
                String(
                    body.originalFileName ||
                    ""
                ),

            items:
                Array.isArray(
                    body.items
                )
                    ? body.items
                    : [],

            createdAt:
                new Date().toISOString()

        };

        orders.push(order);

        console.log(
            "NOWE ZAMÓWIENIE:",
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

        const body = req.body || {};

        const id =
            "MODEL-" +
            crypto
                .randomBytes(5)
                .toString("hex")
                .toUpperCase();

        const order = {

            id,

            name:
                String(
                    body.name || ""
                ),

            email:
                String(
                    body.email || ""
                ),

            phone:
                String(
                    body.phone || ""
                ),

            address:
                String(
                    body.address || ""
                ),

            postalCode:
                String(
                    body.postalCode || ""
                ),

            city:
                String(
                    body.city || ""
                ),

            country:
                String(
                    body.country ||
                    "Polska"
                ),

            total:
                Number(
                    body.total || 0
                ),

            discount:
                Number(
                    body.discount || 0
                ),

            status: "NEW",

            type: "CUSTOM_MODEL",

            description:
                String(
                    body.description || ""
                ),

            originalFileName:
                String(
                    body.originalFileName ||
                    ""
                ),

            modelData:
                body.modelData || null,

            items: [],

            createdAt:
                new Date().toISOString()

        };

        orders.push(order);

        console.log(
            "NOWY WŁASNY MODEL:",
            order.id
        );

        res.status(201).json({
            success: true,
            orderId: id
        });

    }
);

// ===============================
// POBIERANIE MODELU
// ===============================

app.get(
    "/api/admin/model/:id",
    checkAdmin,
    (req, res) => {

        const order =
            orders.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {

            return res.status(404).send(
                "Nie znaleziono modelu."
            );

        }

        if (
            order.type !==
            "CUSTOM_MODEL"
        ) {

            return res.status(400).send(
                "To nie jest własny model."
            );

        }

        if (!order.modelData) {

            return res.status(404).send(
                "Model nie zawiera pliku."
            );

        }

        try {

            const match =
                String(
                    order.modelData
                ).match(
                    /^data:([^;]+);base64,(.+)$/
                );

            if (!match) {

                return res.status(400).send(
                    "Nieprawidłowy plik."
                );

            }

            const mime =
                match[1];

            const data =
                Buffer.from(
                    match[2],
                    "base64"
                );

            res.setHeader(
                "Content-Type",
                mime
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${(
                    order.originalFileName ||
                    "model-3d"
                ).replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                )}"`
            );

            res.send(data);

        }
        catch {

            res.status(500).send(
                "Nie udało się pobrać modelu."
            );

        }

    }
);

// ===============================
// START
// ===============================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "================================"
        );
        console.log(
            "   Printerlase3D SERVER"
        );
        console.log(
            "================================"
        );
        console.log(
            `Serwer działa na porcie ${PORT}`
        );
        console.log(
            "Panel admina: /admin"
        );
        console.log(
            "Domyślne hasło: admin123"
        );
        console.log(
            "================================"
        );
        console.log("");

    }
);
