```js
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// KONFIGURACJA
// ==========================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "data.json");

// ==========================================
// HASŁO ADMINA
// ==========================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin2137!";

// ==========================================
// BAZA DANYCH
// ==========================================

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const data = {
                orders: [],
                withdrawals: []
            };

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(data, null, 2),
                "utf8"
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
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// ==========================================
// ADMIN AUTH
// ==========================================

function adminAuth(req, res, next) {

    const password =
        req.headers["x-admin-password"];

    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Nieprawidłowe hasło administratora."
        });
    }

    next();
}

// ==========================================
// STRONA GŁÓWNA
// ==========================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});

// ==========================================
// PANEL ADMINA
// /admin
// ==========================================

app.get("/admin", (req, res) => {

    const adminFile =
        path.join(__dirname, "admin.html");

    if (!fs.existsSync(adminFile)) {
        return res.status(500).send(`
            <h1>Błąd</h1>
            <p>Nie znaleziono pliku admin.html.</p>
        `);
    }

    res.sendFile(adminFile);

});

// ==========================================
// ADMIN DASHBOARD
// ==========================================

app.get(
    "/api/admin/dashboard",
    adminAuth,
    (req, res) => {

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

            balance: Number(
                balance.toFixed(2)
            ),

            earned: Number(
                earned.toFixed(2)
            ),

            withdrawn: Number(
                withdrawn.toFixed(2)
            ),

            pendingWithdrawals: Number(
                pendingWithdrawals.toFixed(2)
            ),

            orders,
            withdrawals
        });

    }
);

// ==========================================
// ZMIANA STATUSU ZAMÓWIENIA
// ==========================================

app.post(
    "/api/admin/order-status",
    adminAuth,
    (req, res) => {

        const { id, status } = req.body;

        const allowedStatuses = [
            "NEW",
            "PAID",
            "CANCELLED"
        ];

        if (!id || !status) {
            return res.status(400).json({
                error: "Brak ID lub statusu."
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: "Nieprawidłowy status."
            });
        }

        const data = loadData();

        const order =
            data.orders.find(
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

// ==========================================
// UTWORZENIE WYPŁATY
// ==========================================

app.post(
    "/api/admin/withdraw",
    adminAuth,
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
                error: "Nieprawidłowa kwota."
            });
        }

        const allowedMethods = [
            "bank",
            "blik"
        ];

        if (!allowedMethods.includes(method)) {
            return res.status(400).json({
                error: "Nieprawidłowa metoda."
            });
        }

        const data = loadData();

        const earned =
            data.orders
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

        const withdrawn =
            data.withdrawals
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

        const pending =
            data.withdrawals
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
                    `Brak środków. Dostępne: ` +
                    `${balance.toFixed(2)} zł`
            });
        }

        const withdrawal = {

            id:
                "WD-" +
                Date.now(),

            amount:
                Number(
                    amount.toFixed(2)
                ),

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
            withdrawal
        });

    }
);

// ==========================================
// ZATWIERDZENIE WYPŁATY
// ==========================================

app.post(
    "/api/admin/withdraw/:id/complete",
    adminAuth,
    (req, res) => {

        const data = loadData();

        const withdrawal =
            data.withdrawals.find(
                item =>
                    item.id === req.params.id
            );

        if (!withdrawal) {
            return res.status(404).json({
                error:
                    "Nie znaleziono wypłaty."
            });
        }

        withdrawal.status =
            "COMPLETED";

        withdrawal.completedAt =
            new Date().toISOString();

        saveData(data);

        res.json({
            success: true,
            withdrawal
        });

    }
);

// ==========================================
// ANULOWANIE WYPŁATY
// ==========================================

app.post(
    "/api/admin/withdraw/:id/cancel",
    adminAuth,
    (req, res) => {

        const data = loadData();

        const withdrawal =
            data.withdrawals.find(
                item =>
                    item.id === req.params.id
            );

        if (!withdrawal) {
            return res.status(404).json({
                error:
                    "Nie znaleziono wypłaty."
            });
        }

        withdrawal.status =
            "CANCELLED";

        withdrawal.cancelledAt =
            new Date().toISOString();

        saveData(data);

        res.json({
            success: true,
            withdrawal
        });

    }
);

// ==========================================
// NOWE ZAMÓWIENIE ZE SKLEPU
// ==========================================

app.post(
    "/api/orders",
    (req, res) => {

        const order =
            req.body;

        if (!order) {
            return res.status(400).json({
                error:
                    "Brak danych zamówienia."
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

        const data = loadData();

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
            "NOWE ZAMÓWIENIE:",
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

// ==========================================
// SPRAWDZENIE ZAMÓWIENIA
// ==========================================

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

// ==========================================
// 404
// ==========================================

app.use(
    (req, res) => {

        res.status(404).send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>404 — Printerlase3D</title>
                <style>
                    body{
                        margin:0;
                        min-height:100vh;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#050914;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                    }

                    a{
                        color:#00c8ff;
                        text-decoration:none;
                    }
                </style>
            </head>

            <body>
                <div>
                    <h1>404</h1>
                    <p>Nie znaleziono strony.</p>
                    <a href="/">← Wróć do sklepu</a>
                </div>
            </body>
            </html>
        `);

    }
);

// ==========================================
// START
// ==========================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

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
            `Serwer działa na porcie ${PORT}`
        );

        console.log(
            `Admin: /admin`
        );

        console.log(
            `Hasło admina: ${
                ADMIN_PASSWORD
                    ? "ustawione"
                    : "brak"
            }`
        );

        console.log(
            "================================="
        );

    }
);
```
