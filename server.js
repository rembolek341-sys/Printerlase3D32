const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// =========================
// KONFIGURACJA
// =========================

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "data.json");

// =========================
// BAZA DANYCH
// =========================

function createEmptyData() {
    return {
        orders: [],
        withdrawals: []
    };
}

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const data = createEmptyData();

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(data, null, 2),
                "utf8"
            );

            return data;
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");

        if (!raw.trim()) {
            return createEmptyData();
        }

        const data = JSON.parse(raw);

        return {
            orders: Array.isArray(data.orders)
                ? data.orders
                : [],

            withdrawals: Array.isArray(data.withdrawals)
                ? data.withdrawals
                : []
        };

    } catch (error) {
        console.error("❌ Błąd data.json:", error);

        return createEmptyData();
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error("❌ Nie można zapisać data.json:", error);
        return false;
    }
}

// =========================
// ADMIN AUTH
// =========================

function adminAuth(req, res, next) {

    if (!ADMIN_PASSWORD) {
        return res.status(500).json({
            error: "ADMIN_PASSWORD nie jest ustawione na Render."
        });
    }

    const password =
        req.headers["x-admin-password"];

    if (
        typeof password !== "string" ||
        password.length === 0
    ) {
        return res.status(401).json({
            error: "Brak hasła administratora."
        });
    }

    // Bezpieczniejsze porównanie
    const a = Buffer.from(password);
    const b = Buffer.from(ADMIN_PASSWORD);

    if (
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
    ) {
        return res.status(401).json({
            error: "Nieprawidłowe hasło administratora."
        });
    }

    next();
}

// =========================
// FUNKCJE FINANSOWE
// =========================

function calculateStats(data) {

    const orders = Array.isArray(data.orders)
        ? data.orders
        : [];

    const withdrawals = Array.isArray(data.withdrawals)
        ? data.withdrawals
        : [];

    const earned = orders
        .filter(order => order.status === "PAID")
        .reduce(
            (sum, order) =>
                sum + Number(order.total || 0),
            0
        );

    const completedWithdrawals = withdrawals
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
        earned -
        completedWithdrawals -
        pendingWithdrawals;

    return {
        earned: Number(earned.toFixed(2)),

        withdrawn:
            Number(
                completedWithdrawals.toFixed(2)
            ),

        pending:
            Number(
                pendingWithdrawals.toFixed(2)
            ),

        balance:
            Number(
                Math.max(0, balance).toFixed(2)
            )
    };
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
// ADMIN — DASHBOARD
// =========================

app.get(
    "/api/admin/dashboard",
    adminAuth,
    (req, res) => {

        const data = loadData();

        const stats =
            calculateStats(data);

        const orders =
            data.orders
                .slice()
                .sort(
                    (a, b) =>
                        new Date(b.createdAt || 0) -
                        new Date(a.createdAt || 0)
                );

        const withdrawals =
            data.withdrawals
                .slice()
                .sort(
                    (a, b) =>
                        new Date(b.createdAt || 0) -
                        new Date(a.createdAt || 0)
                );

        res.json({

            success: true,

            ...stats,

            orders,

            withdrawals,

            serverTime:
                new Date().toISOString()

        });

    }
);

// =========================
// ADMIN — ZMIANA STATUSU ZAMÓWIENIA
// =========================

app.post(
    "/api/admin/order-status",
    adminAuth,
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

        if (
            typeof id !== "string" ||
            !id.trim()
        ) {
            return res.status(400).json({
                error: "Brak ID zamówienia."
            });
        }

        if (
            !allowedStatuses.includes(status)
        ) {
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
                error:
                    "Nie znaleziono zamówienia."
            });
        }

        order.status = status;

        order.updatedAt =
            new Date().toISOString();

        if (!saveData(data)) {
            return res.status(500).json({
                error:
                    "Nie udało się zapisać zamówienia."
            });
        }

        res.json({
            success: true,
            order
        });

    }
);

// =========================
// ADMIN — UTWORZENIE WYPŁATY
// =========================

app.post(
    "/api/admin/withdraw",
    adminAuth,
    (req, res) => {

        const amount =
            Number(req.body.amount);

        const method =
            req.body.method;

        const allowedMethods = [
            "bank",
            "blik"
        ];

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                error:
                    "Podaj prawidłową kwotę."
            });
        }

        if (amount < 1) {
            return res.status(400).json({
                error:
                    "Minimalna wypłata to 1 zł."
            });
        }

        if (
            !allowedMethods.includes(method)
        ) {
            return res.status(400).json({
                error:
                    "Nieprawidłowa metoda wypłaty."
            });
        }

        const data = loadData();

        const stats =
            calculateStats(data);

        if (amount > stats.balance) {
            return res.status(400).json({
                error:
                    `Brak wystarczających środków. Dostępne: ${stats.balance.toFixed(2)} zł`
            });
        }

        const withdrawal = {

            id:
                "WD-" +
                Date.now() +
                "-" +
                Math.floor(
                    Math.random() * 1000
                ),

            amount:
                Number(
                    amount.toFixed(2)
                ),

            method,

            status: "PENDING",

            createdAt:
                new Date().toISOString()

        };

        data.withdrawals.push(
            withdrawal
        );

        if (!saveData(data)) {
            return res.status(500).json({
                error:
                    "Nie udało się utworzyć wypłaty."
            });
        }

        res.json({

            success: true,

            message:
                "Żądanie wypłaty zostało utworzone.",

            withdrawal

        });

    }
);

// =========================
// ADMIN — STATUS WYPŁATY
// =========================

app.post(
    "/api/admin/withdraw-status",
    adminAuth,
    (req, res) => {

        const {
            id,
            status
        } = req.body;

        const allowedStatuses = [
            "PENDING",
            "COMPLETED",
            "CANCELLED"
        ];

        if (!id || !status) {
            return res.status(400).json({
                error:
                    "Brak ID lub statusu."
            });
        }

        if (
            !allowedStatuses.includes(status)
        ) {
            return res.status(400).json({
                error:
                    "Nieprawidłowy status wypłaty."
            });
        }

        const data = loadData();

        const withdrawal =
            data.withdrawals.find(
                item => item.id === id
            );

        if (!withdrawal) {
            return res.status(404).json({
                error:
                    "Nie znaleziono wypłaty."
            });
        }

        withdrawal.status =
            status;

        withdrawal.updatedAt =
            new Date().toISOString();

        if (!saveData(data)) {
            return res.status(500).json({
                error:
                    "Nie udało się zapisać wypłaty."
            });
        }

        res.json({
            success: true,
            withdrawal
        });

    }
);

// =========================
// TWORZENIE ZAMÓWIENIA
// =========================

app.post(
    "/api/orders",
    (req, res) => {

        const body =
            req.body || {};

        const name =
            typeof body.name === "string"
                ? body.name.trim()
                : "";

        const email =
            typeof body.email === "string"
                ? body.email.trim()
                : "";

        const total =
            Number(body.total);

        if (!name) {
            return res.status(400).json({
                error:
                    "Brak imienia."
            });
        }

        if (!email) {
            return res.status(400).json({
                error:
                    "Brak adresu email."
            });
        }

        if (
            !Number.isFinite(total) ||
            total <= 0
        ) {
            return res.status(400).json({
                error:
                    "Nieprawidłowa kwota zamówienia."
            });
        }

        const data =
            loadData();

        const newOrder = {

            ...body,

            id:
                typeof body.id === "string" &&
                body.id.trim()
                    ? body.id.trim()
                    : "PL-" + Date.now(),

            name,

            email,

            total:
                Number(
                    total.toFixed(2)
                ),

            status: "NEW",

            createdAt:
                body.createdAt ||
                new Date().toISOString()

        };

        data.orders.push(
            newOrder
        );

        if (!saveData(data)) {
            return res.status(500).json({
                error:
                    "Nie udało się zapisać zamówienia."
            });
        }

        console.log(
            "📦 NOWE ZAMÓWIENIE:",
            newOrder.id,
            newOrder.total,
            "zł"
        );

        res.status(201).json({

            success: true,

            order:
                newOrder

        });

    }
);

// =========================
// SPRAWDZANIE ZAMÓWIENIA
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
// HEALTH CHECK
// =========================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            online: true,
            service: "Printerlase3D",
            time:
                new Date().toISOString()
        });

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
                        margin:0;
                        min-height:100vh;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#030712;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                    }

                    a {
                        color:#00c8ff;
                        text-decoration:none;
                    }
                </style>
            </head>

            <body>

                <div>
                    <h1>404 💀</h1>

                    <p>
                        Nie znaleziono tej strony.
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
            "        PRINTERLASE3D"
        );

        console.log(
            "================================="
        );

        console.log(
            `🚀 Serwer działa na porcie ${PORT}`
        );

        if (ADMIN_PASSWORD) {

            console.log(
                "🔐 ADMIN_PASSWORD: ustawione"
            );

        } else {

            console.log(
                "❌ ADMIN_PASSWORD: BRAK!"
            );

        }

        console.log("");

    }
);
