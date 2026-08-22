const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================
// KONFIGURACJA
// =====================================

// Hasło admina:
// jeśli Render ma ADMIN_PASSWORD → użyje jego,
// jeśli nie → użyje Admin2137!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin2137!";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Pliki strony
app.use(express.static(__dirname));

// =====================================
// DATA.JSON
// =====================================

const DATA_FILE = path.join(__dirname, "data.json");

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

// =====================================
// ADMIN AUTH
// =====================================

function adminAuth(req, res, next) {
    const password = req.headers["x-admin-password"];

    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Nieprawidłowe hasło administratora."
        });
    }

    next();
}

// =====================================
// STRONA GŁÓWNA
// =====================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// =====================================
// ADMIN
// =====================================

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});

// =====================================
// DASHBOARD
// =====================================

app.get(
    "/api/admin/dashboard",
    adminAuth,
    (req, res) => {

        const data = loadData();

        const orders = data.orders;
        const withdrawals = data.withdrawals;

        // Zarobione tylko z PAID
        const earned = orders
            .filter(order => order.status === "PAID")
            .reduce(
                (sum, order) =>
                    sum + Number(order.total || 0),
                0
            );

        // Wypłacone
        const withdrawn = withdrawals
            .filter(item => item.status === "COMPLETED")
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        // Wypłaty oczekujące również blokują pieniądze
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
    }
);

// =====================================
// ZMIANA STATUSU ZAMÓWIENIA
// =====================================

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
            item => item.id === id
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

// =====================================
// UTWORZENIE WYPŁATY
// =====================================

app.post(
    "/api/admin/withdraw",
    adminAuth,
    (req, res) => {

        const amount = Number(req.body.amount);
        const method = req.body.method;

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                error: "Podaj prawidłową kwotę."
            });
        }

        if (amount < 1) {
            return res.status(400).json({
                error: "Minimalna wypłata to 1 zł."
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

        // PAID
        const earned = data.orders
            .filter(order => order.status === "PAID")
            .reduce(
                (sum, order) =>
                    sum + Number(order.total || 0),
                0
            );

        // COMPLETED
        const withdrawn = data.withdrawals
            .filter(item => item.status === "COMPLETED")
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        // PENDING
        const pending = data.withdrawals
            .filter(item => item.status === "PENDING")
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
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

        console.log(
            "💸 NOWA WYPŁATA:",
            withdrawal.id,
            withdrawal.amount,
            withdrawal.method
        );

        res.json({
            success: true,
            message: "Żądanie wypłaty utworzone.",
            withdrawal
        });
    }
);

// =====================================
// STATUS WYPŁATY
// =====================================

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

        const withdrawal =
            data.withdrawals.find(
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
                error: "Nie udało się zapisać."
            });
        }

        res.json({
            success: true,
            withdrawal
        });
    }
);

// =====================================
// ZAMÓWIENIE ZE SKLEPU
// =====================================

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

    const total = Number(order.total);

    if (!Number.isFinite(total) || total <= 0) {
        return res.status(400).json({
            error: "Nieprawidłowa cena."
        });
    }

    const data = loadData();

    const newOrder = {
        ...order,

        id:
            order.id ||
            "PL-" + Date.now(),

        total: Number(total.toFixed(2)),

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

// =====================================
// SPRAWDZANIE ZAMÓWIENIA
// =====================================

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

// =====================================
// HEALTH CHECK
// =====================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        server: "Printerlase3D",
        status: "online"
    });
});

// =====================================
// 404
// =====================================

app.use((req, res) => {

    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <title>404 — Printerlase3D</title>
            <style>
                body {
                    background:#030712;
                    color:white;
                    font-family:Arial;
                    text-align:center;
                    padding-top:100px;
                }

                a {
                    color:#00c8ff;
                }
            </style>
        </head>

        <body>
            <h1>404</h1>
            <p>Nie znaleziono strony.</p>
            <a href="/">← Wróć do Printerlase3D</a>
        </body>
        </html>
    `);
});

// =====================================
// START
// =====================================

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("       PRINTERLASE3D");
    console.log("=================================");
    console.log(`🚀 Port: ${PORT}`);
    console.log("🔐 Admin: aktywny");
    console.log("=================================");
    console.log("");
});
