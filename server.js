const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   KONFIGURACJA
========================= */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.error("❌ BRAK ADMIN_PASSWORD W RENDER ENVIRONMENT!");
} else {
    console.log("🔐 ADMIN_PASSWORD ustawione");
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   PLIKI
========================= */

app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "data.json");

/* =========================
   BAZA DANYCH
========================= */

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
        console.error("❌ Błąd loadData:", error.message);

        return createEmptyData();
    }
}

function saveData(data) {
    try {
        const tempFile = DATA_FILE + ".tmp";

        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(tempFile, DATA_FILE);

        return true;

    } catch (error) {
        console.error("❌ Błąd saveData:", error.message);
        return false;
    }
}

/* =========================
   ADMIN AUTH
========================= */

function adminAuth(req, res, next) {

    if (!ADMIN_PASSWORD) {
        return res.status(500).json({
            error: "ADMIN_PASSWORD nie jest ustawione na serwerze."
        });
    }

    const password = req.headers["x-admin-password"];

    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Nieprawidłowe hasło administratora."
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
   ADMIN HTML
========================= */

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});

/* =========================
   DASHBOARD ADMINA
========================= */

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

        const balance = Math.max(
            0,
            earned - withdrawn - pendingWithdrawals
        );

        res.json({
            success: true,

            balance: Number(balance.toFixed(2)),

            earned: Number(earned.toFixed(2)),

            withdrawn: Number(withdrawn.toFixed(2)),

            pendingWithdrawals:
                Number(pendingWithdrawals.toFixed(2)),

            orders,

            withdrawals
        });
    }
);

/* =========================
   ZMIANA STATUSU ZAMÓWIENIA
========================= */

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
        order.updatedAt =
            new Date().toISOString();

        if (!saveData(data)) {
            return res.status(500).json({
                error: "Nie udało się zapisać zmian."
            });
        }

        console.log(
            `📦 ${order.id} → ${status}`
        );

        res.json({
            success: true,
            order
        });
    }
);

/* =========================
   UTWORZENIE WYPŁATY
========================= */

app.post(
    "/api/admin/withdraw",
    adminAuth,
    (req, res) => {

        const amount =
            Number(req.body.amount);

        const method =
            String(req.body.method || "");

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                error: "Nieprawidłowa kwota."
            });
        }

        if (amount > 1000000) {
            return res.status(400).json({
                error: "Kwota jest za duża."
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
            .filter(order =>
                order.status === "PAID"
            )
            .reduce(
                (sum, order) =>
                    sum + Number(order.total || 0),
                0
            );

        const completedWithdrawals =
            data.withdrawals
                .filter(item =>
                    item.status === "COMPLETED"
                )
                .reduce(
                    (sum, item) =>
                        sum + Number(item.amount || 0),
                    0
                );

        const pendingWithdrawals =
            data.withdrawals
                .filter(item =>
                    item.status === "PENDING"
                )
                .reduce(
                    (sum, item) =>
                        sum + Number(item.amount || 0),
                    0
                );

        const available =
            earned -
            completedWithdrawals -
            pendingWithdrawals;

        if (amount > available) {
            return res.status(400).json({
                error:
                    `Brak środków. Dostępne: ` +
                    `${Math.max(0, available).toFixed(2)} zł`
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

        if (!saveData(data)) {
            return res.status(500).json({
                error:
                    "Nie udało się zapisać wypłaty."
            });
        }

        console.log(
            `💸 NOWA WYPŁATA: ${withdrawal.id} ` +
            `${withdrawal.amount} zł`
        );

        res.json({
            success: true,

            message:
                "Żądanie wypłaty zostało utworzone.",

            withdrawal
        });
    }
);

/* =========================
   STATUS WYPŁATY
========================= */

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

        const withdrawal =
            data.withdrawals.find(
                item =>
                    String(item.id) === String(id)
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
                error:
                    "Nie udało się zapisać zmian."
            });
        }

        res.json({
            success: true,
            withdrawal
        });
    }
);

/* =========================
   NOWE ZAMÓWIENIE
========================= */

app.post(
    "/api/orders",
    (req, res) => {

        const order = req.body;

        if (!order || typeof order !== "object") {
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
                error:
                    "Brakuje danych zamówienia."
            });
        }

        const total =
            Number(order.total);

        if (
            !Number.isFinite(total) ||
            total <= 0
        ) {
            return res.status(400).json({
                error:
                    "Nieprawidłowa cena zamówienia."
            });
        }

        const data = loadData();

        const newOrder = {
            ...order,

            id:
                order.id ||
                "PL-" + Date.now(),

            total:
                Number(total.toFixed(2)),

            status:
                "NEW",

            createdAt:
                order.createdAt ||
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
            order: newOrder
        });
    }
);

/* =========================
   SPRAWDZANIE ZAMÓWIENIA
========================= */

app.get(
    "/api/orders/:id",
    (req, res) => {

        const data = loadData();

        const order =
            data.orders.find(
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

        res.json(order);
    }
);

/* =========================
   HEALTH CHECK
========================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            status: "ok",
            service: "Printerlase3D",
            time: new Date().toISOString()
        });
    }
);

/* =========================
   404
========================= */

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
                        font-family: Arial, sans-serif;
                        text-align: center;
                    }

                    h1 {
                        font-size: 70px;
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
                        Tej strony tutaj nie ma 💀
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

/* =========================
   START
========================= */

app.listen(
    PORT,
    "0.0.0.0",
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
            `🚀 Port: ${PORT}`
        );

        console.log(
            `🌐 URL: http://localhost:${PORT}`
        );

        if (ADMIN_PASSWORD) {
            console.log(
                "🔐 ADMIN_PASSWORD: OK"
            );
        } else {
            console.log(
                "❌ ADMIN_PASSWORD: BRAK"
            );
        }

        console.log("");
    }
);
