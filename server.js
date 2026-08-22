```js
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "data.json");

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "Admin2137!";

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const data = {
                orders: [],
                withdrawals: []
            };

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(data, null, 2)
            );

            return data;
        }

        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        return {
            orders: Array.isArray(data.orders)
                ? data.orders
                : [],
            withdrawals: Array.isArray(data.withdrawals)
                ? data.withdrawals
                : []
        };
    } catch (error) {
        console.error("DATA ERROR:", error);

        return {
            orders: [],
            withdrawals: []
        };
    }
}

function saveData(data) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

function adminAuth(req, res, next) {
    const password = req.headers["x-admin-password"];

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Błędne hasło administratora."
        });
    }

    next();
}

/* =========================
   STRONA GŁÓWNA
========================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   ADMIN
========================= */

app.get("/admin", (req, res) => {
    const file = path.join(__dirname, "admin.html");

    if (!fs.existsSync(file)) {
        return res.status(500).send(
            "Brak pliku admin.html na serwerze."
        );
    }

    res.sendFile(file);
});

/* =========================
   DASHBOARD
========================= */

app.get(
    "/api/admin/dashboard",
    adminAuth,
    (req, res) => {
        const data = loadData();

        const earned = data.orders
            .filter(order => order.status === "PAID")
            .reduce(
                (sum, order) =>
                    sum + Number(order.total || 0),
                0
            );

        const withdrawn = data.withdrawals
            .filter(item => item.status === "COMPLETED")
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        res.json({
            balance: Math.max(
                0,
                Number((earned - withdrawn).toFixed(2))
            ),
            earned: Number(earned.toFixed(2)),
            withdrawn: Number(withdrawn.toFixed(2)),
            orders: data.orders,
            withdrawals: data.withdrawals
        });
    }
);

/* =========================
   STATUS ZAMÓWIENIA
========================= */

app.post(
    "/api/admin/order-status",
    adminAuth,
    (req, res) => {
        const { id, status } = req.body;

        const allowed = [
            "NEW",
            "PAID",
            "CANCELLED"
        ];

        if (!id || !allowed.includes(status)) {
            return res.status(400).json({
                error: "Nieprawidłowe dane."
            });
        }

        const data = loadData();

        const order = data.orders.find(
            item => item.id === id
        );

        if (!order) {
            return res.status(404).json({
                error: "Nie znaleziono zamówienia."
            });
        }

        order.status = status;
        order.updatedAt =
            new Date().toISOString();

        saveData(data);

        res.json({
            success: true,
            order
        });
    }
);

/* =========================
   NOWE ZAMÓWIENIE
========================= */

app.post("/api/orders", (req, res) => {
    const order = req.body;

    if (!order || !order.name || !order.email) {
        return res.status(400).json({
            error: "Brak danych zamówienia."
        });
    }

    const data = loadData();

    const newOrder = {
        ...order,
        id:
            order.id ||
            "PL-" + Date.now(),
        status: "NEW",
        createdAt:
            order.createdAt ||
            new Date().toISOString()
    };

    data.orders.push(newOrder);

    saveData(data);

    console.log(
        "NOWE ZAMÓWIENIE:",
        newOrder.id
    );

    res.json({
        success: true,
        order: newOrder
    });
});

/* =========================
   PODGLĄD ZAMÓWIENIA
========================= */

app.get("/api/orders/:id", (req, res) => {
    const data = loadData();

    const order = data.orders.find(
        item => item.id === req.params.id
    );

    if (!order) {
        return res.status(404).json({
            error: "Nie znaleziono zamówienia."
        });
    }

    res.json(order);
});

/* =========================
   404
========================= */

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <title>404</title>
        </head>
        <body style="
            background:#050914;
            color:white;
            font-family:Arial;
            text-align:center;
            padding-top:100px;
        ">
            <h1>404</h1>
            <p>Nie znaleziono strony.</p>
            <a href="/" style="color:#00c8ff">
                ← Wróć do sklepu
            </a>
        </body>
        </html>
    `);
});

/* =========================
   START
========================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log("==============================");
    console.log("      PRINTERLASE3D");
    console.log("==============================");
    console.log("PORT:", PORT);
    console.log("ADMIN: /admin");
    console.log("ADMIN PASSWORD: ustawione");
    console.log("==============================");
});
```
