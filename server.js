const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// KONFIGURACJA
// =========================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin2137!";

const DATA_FILE = path.join(__dirname, "data.json");

// =========================
// MIDDLEWARE
// =========================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Pliki publiczne
app.use(express.static(__dirname));

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
                JSON.stringify(initialData, null, 2),
                "utf8"
            );

            return initialData;
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");

        if (!raw.trim()) {
            return {
                orders: [],
                withdrawals: []
            };
        }

        const data = JSON.parse(raw);

        return {
            orders: Array.isArray(data.orders) ? data.orders : [],
            withdrawals: Array.isArray(data.withdrawals)
                ? data.withdrawals
                : []
        };

    } catch (error) {
        console.error("❌ Błąd data.json:", error);

        return {
            orders: [],
            withdrawals: []
        };
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

    const password = req.headers["x-admin-password"];

    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Nieprawidłowe hasło administratora."
        });
    }

    next();
}

// =========================
// STRONA GŁÓWNA
// =========================

app.get("/", (req, res) => {

    const indexPath = path.join(__dirname, "index.html");

    if (!fs.existsSync(indexPath)) {
        return res.status(404).send(`
            <h1>404</h1>
            <p>Brak pliku index.html</p>
        `);
    }

    res.sendFile(indexPath);
});

// =========================
// PANEL ADMINA
// =========================

app.get("/admin", (req, res) => {

    const adminPath = path.join(__dirname, "admin.html");

    if (!fs.existsSync(adminPath)) {
        return res.status(404).send(`
            <h1>404</h1>
            <p>Brak pliku admin.html na serwerze.</p>
            <p>Upewnij się, że admin.html znajduje się obok server.js.</p>
        `);
    }

    res.sendFile(adminPath);
});

// Dodatkowo /admin.html
app.get("/admin.html", (req, res) => {

    const adminPath = path.join(__dirname, "admin.html");

    if (!fs.existsSync(adminPath)) {
        return res.status(404).send("Brak admin.html");
    }

    res.sendFile(adminPath);
});

// =========================
// ADMIN DASHBOARD
// =========================

app.get("/api/admin/dashboard", adminAuth, (req, res) => {

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

    const balance = Math.max(
        0,
        earned - withdrawn - pendingWithdrawals
    );

    res.json({
        success: true,
        balance: Number(balance.toFixed(2)),
        earned: Number(earned.toFixed(2)),
        withdrawn: Number(withdrawn.toFixed(2)),
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

        const order = data.orders.find(
            item => String(item.id) === String(id)
        );

        if (!order) {
            return res.status(404).json({
                error: "Nie znaleziono zamówienia."
            });
        }

        order.status = status;
        order.updatedAt = new Date().toISOString();

        if (!saveData(data)) {
            return res.status(500).json({
                error: "Nie udało się zapisać danych."
            });
        }

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
    adminAuth,
    (req, res) => {

        const amount = Number(req.body.amount);
        const method = req.body.method;

        if (!Number.isFinite(amount) || amount <= 0) {
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
                error: "Nieprawidłowa metoda wypłaty."
            });
        }

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

        const pending = data.withdrawals
            .filter(item => item.status === "PENDING")
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        const balance =
            earned - withdrawn - pending;

        if (amount > balance) {
            return res.status(400).json({
                error:
                    `Brak środków. Dostępne: ${balance.toFixed(2)} zł`
            });
        }

        const withdrawal = {
            id: "WD-" + Date.now(),
            amount: Number(amount.toFixed(2)),
            method,
            status: "PENDING",
            createdAt: new Date().toISOString()
        };

        data.withdrawals.push(withdrawal);

        if (!saveData(data)) {
            return res.status(500).json({
                error: "Nie udało się zapisać wypłaty."
            });
        }

        res.json({
            success: true,
            message: "Żądanie wypłaty utworzone.",
            withdrawal
        });
    }
);

// =========================
// ZMIANA STATUSU WYPŁATY
// =========================

app.post(
    "/api/admin/withdraw-status",
    adminAuth,
    (req, res) => {

        const { id, status } = req.body;

        const allowedStatuses = [
            "PENDING",
            "COMPLETED",
            "CANCELLED"
        ];

        if (!id || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: "Nieprawidłowe dane."
            });
        }

        const data = loadData();

        const withdrawal = data.withdrawals.find(
            item => item.id === id
        );

        if (!withdrawal) {
            return res.status(404).json({
                error: "Nie znaleziono wypłaty."
            });
        }

        withdrawal.status = status;
        withdrawal.updatedAt =
            new Date().toISOString();

        if (!saveData(data)) {
            return res.status(500).json({
                error: "Nie udało się zapisać danych."
            });
        }

        res.json({
            success: true,
            withdrawal
        });
    }
);

// =========================
// NOWE ZAMÓWIENIE
// =========================

app.post("/api/orders", (req, res) => {

    const order = req.body;

    if (!order) {
        return res.status(400).json({
            error: "Brak danych zamówienia."
        });
    }

    if (
        !order.name ||
        !order.email ||
        order.total === undefined
    ) {
        return res.status(400).json({
            error: "Brakuje danych zamówienia."
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

    if (!saveData(data)) {
        return res.status(500).json({
            error: "Nie udało się zapisać zamówienia."
        });
    }

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
});

// =========================
// SPRAWDZENIE ZAMÓWIENIA
// =========================

app.get("/api/orders/:id", (req, res) => {

    const data = loadData();

    const order = data.orders.find(
        item =>
            String(item.id) ===
            String(req.params.id)
    );

    if (!order) {
        return res.status(404).json({
            error: "Nie znaleziono zamówienia."
        });
    }

    res.json(order);
});

// =========================
// 404
// =========================

app.use((req, res) => {

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
                    font-family: Arial, sans-serif;
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
                <p>Nie znaleziono strony.</p>
                <a href="/">← Wróć do sklepu</a>
            </div>
        </body>
        </html>
    `);
});

// =========================
// START
// =========================

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("       PRINTERLASE3D");
    console.log("=================================");
    console.log(
        `🚀 Serwer działa na porcie ${PORT}`
    );
    console.log(
        `🔐 Panel admina: /admin`
    );
    console.log(
        `🔑 ADMIN_PASSWORD: ${
            ADMIN_PASSWORD ? "USTAWIONE" : "BRAK"
        }`
    );
    console.log("");
});
