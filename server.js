```js
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "data.json");

// =========================
// BAZA DANYCH
// =========================

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initialData = {
                orders: [],
                withdrawals: []
            };

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(initialData, null, 2)
            );

            return initialData;
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
        console.error("Błąd data.json:", error);

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

// =========================
// STRONA GŁÓWNA
// =========================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

// =========================
// ADMIN
// =========================

app.get("/admin", (req, res) => {
    res.sendFile(
        path.join(__dirname, "admin.html")
    );
});

app.get("/admin.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "admin.html")
    );
});

// =========================
// DASHBOARD
// =========================

app.get("/api/admin/dashboard", (req, res) => {

    const data = loadData();

    const orders = data.orders;
    const withdrawals = data.withdrawals;

    const earned = orders
        .filter(order => order.status === "PAID")
        .reduce(
            (sum, order) =>
                sum + Number(order.total || 0),
            0
        );

    const withdrawn = withdrawals
        .filter(item => item.status === "COMPLETED")
        .reduce(
            (sum, item) =>
                sum + Number(item.amount || 0),
            0
        );

    const pendingWithdrawals = withdrawals
        .filter(item => item.status === "PENDING")
        .reduce(
            (sum, item) =>
                sum + Number(item.amount || 0),
            0
        );

    const balance =
        Math.max(
            0,
            earned -
            withdrawn -
            pendingWithdrawals
        );

    res.json({
        success: true,

        balance: Number(balance.toFixed(2)),

        earned: Number(earned.toFixed(2)),

        withdrawn: Number(
            withdrawn.toFixed(2)
        ),

        pendingWithdrawals: Number(
            pendingWithdrawals.toFixed(2)
        ),

        orders,

        withdrawals
    });
});

// =========================
// STATUS ZAMÓWIENIA
// =========================

app.post(
    "/api/admin/order-status",
    (req, res) => {

        const {
            id,
            status
        } = req.body;

        const allowedStatuses = [
            "NEW",
            "PAID",
            "CANCELLED"
        ];

        if (!id) {
            return res.status(400).json({
                error: "Brak ID zamówienia."
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: "Nieprawidłowy status."
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

// =========================
// WYPŁATA
// =========================

app.post(
    "/api/admin/withdraw",
    (req, res) => {

        const amount =
            Number(req.body.amount);

        const method =
            req.body.method;

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                error: "Podaj prawidłową kwotę."
            });
        }

        const allowedMethods = [
            "bank",
            "blik"
        ];

        if (!allowedMethods.includes(method)) {
            return res.status(400).json({
                error: "Nieprawidłowa metoda wypłaty."
            });
        }

        const data = loadData();

        const earned = data.orders
            .filter(
                order =>
                    order.status === "PAID"
            )
            .reduce(
                (sum, order) =>
                    sum +
                    Number(order.total || 0),
                0
            );

        const withdrawn = data.withdrawals
            .filter(
                item =>
                    item.status === "COMPLETED"
            )
            .reduce(
                (sum, item) =>
                    sum +
                    Number(item.amount || 0),
                0
            );

        const pending = data.withdrawals
            .filter(
                item =>
                    item.status === "PENDING"
            )
            .reduce(
                (sum, item) =>
                    sum +
                    Number(item.amount || 0),
                0
            );

        const balance =
            earned -
            withdrawn -
            pending;

        if (amount > balance) {
            return res.status(400).json({
                error:
                    `Brak środków. Dostępne: ${balance.toFixed(2)} zł`
            });
        }

        const withdrawal = {
            id:
                "WD-" +
                Date.now(),

            amount:
                Number(amount.toFixed(2)),

            method,

            status:
                "PENDING",

            createdAt:
                new Date().toISOString()
        };

        data.withdrawals.push(
            withdrawal
        );

        saveData(data);

        res.json({
            success: true,

            message:
                "Żądanie wypłaty utworzone.",

            withdrawal
        });
    }
);

// =========================
// ZAMÓWIENIE ZE SKLEPU
// =========================

app.post(
    "/api/orders",
    (req, res) => {

        const order =
            req.body;

        if (!order) {
            return res.status(400).json({
                error: "Brak danych."
            });
        }

        if (
            !order.name ||
            !order.email ||
            order.total === undefined
        ) {
            return res.status(400).json({
                error:
                    "Brakuje danych zamówienia."
            });
        }

        const data =
            loadData();

        const newOrder = {

            ...order,

            id:
                order.id ||
                "PL-" +
                Date.now(),

            status:
                "NEW",

            createdAt:
                order.createdAt ||
                new Date().toISOString()
        };

        data.orders.push(
            newOrder
        );

        saveData(data);

        console.log(
            "📦 NOWE ZAMÓWIENIE:",
            newOrder.id,
            newOrder.total,
            "zł"
        );

        res.json({
            success: true,
            order: newOrder
        });
    }
);

// =========================
// SPRAWDZENIE ZAMÓWIENIA
// =========================

app.get(
    "/api/orders/:id",
    (req, res) => {

        const data =
            loadData();

        const order =
            data.orders.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res.status(404).json({
                error:
                    "Nie znaleziono zamówienia."
            });
        }

        res.json(order);
    }
);

// =========================
// 404
// =========================

app.use(
    (req, res) => {

        res.status(404).send(`
            <!DOCTYPE html>

            <html lang="pl">

            <head>
                <meta charset="UTF-8">
                <title>404 — Printerlase3D</title>

                <style>
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #030712;
                        color: white;
                        font-family: Arial;
                        text-align: center;
                    }

                    h1 {
                        font-size: 80px;
                        margin: 0;
                        color: #00c8ff;
                    }

                    a {
                        color: #00c8ff;
                        text-decoration: none;
                    }
                </style>
            </head>

            <body>

                <div>
                    <h1>404</h1>

                    <p>
                        Nie znaleziono strony.
                    </p>

                    <a href="/">
                        ← Wróć do Printerlase3D
                    </a>
                </div>

            </body>

            </html>
        `);
    }
);

// =========================
// START
// =========================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "================================="
        );

        console.log(
            "       PRINTERLASE3D"
        );

        console.log(
            "================================="
        );

        console.log(
            `🚀 Port: ${PORT}`
        );

        console.log(
            `🛒 Sklep: /`
        );

        console.log(
            `🔐 Admin: /admin`
        );

        console.log("");
    }
);
```
