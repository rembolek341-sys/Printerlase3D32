```js
const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// KONFIGURACJA
// =====================================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin2137!";
const SESSION_SECRET =
    process.env.SESSION_SECRET || "printerlase3d-super-secret-change-me";

const DATA_FILE = path.join(__dirname, "data.json");

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

app.use(express.static(__dirname));

// =====================================================
// BAZA DANYCH
// =====================================================

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

// =====================================================
// ADMIN SESSION
// =====================================================

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        error: "Brak autoryzacji."
    });
}

// =====================================================
// ADMIN LOGIN
// =====================================================

app.post("/api/admin/login", (req, res) => {
    const password = String(req.body.password || "");

    if (!password) {
        return res.status(400).json({
            error: "Podaj hasło."
        });
    }

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Błędne hasło administratora."
        });
    }

    req.session.isAdmin = true;

    req.session.save((error) => {
        if (error) {
            console.error("Błąd sesji:", error);

            return res.status(500).json({
                error: "Nie udało się utworzyć sesji."
            });
        }

        res.json({
            success: true,
            message: "Zalogowano."
        });
    });
});

// =====================================================
// ADMIN LOGOUT
// =====================================================

app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");

        res.json({
            success: true
        });
    });
});

// =====================================================
// SPRAWDZENIE SESJI
// =====================================================

app.get("/api/admin/me", (req, res) => {
    res.json({
        authenticated:
            req.session &&
            req.session.isAdmin === true
    });
});

// =====================================================
// DASHBOARD
// =====================================================

app.get(
    "/api/admin/dashboard",
    requireAdmin,
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

// =====================================================
// STATUS ZAMÓWIENIA
// =====================================================

app.post(
    "/api/admin/order-status",
    requireAdmin,
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
        order.updatedAt =
            new Date().toISOString();

        saveData(data);

        res.json({
            success: true,
            order
        });
    }
);

// =====================================================
// WYDRUK / WYŁATA - UTWORZENIE ŻĄDANIA
// =====================================================

app.post(
    "/api/admin/withdraw",
    requireAdmin,
    (req, res) => {

        const amount = Number(req.body.amount);
        const method = req.body.method;

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                error: "Nieprawidłowa kwota."
            });
        }

        if (
            !["bank", "blik"].includes(method)
        ) {
            return res.status(400).json({
                error: "Nieprawidłowa metoda."
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

        const available =
            earned - withdrawn - pending;

        if (amount > available) {
            return res.status(400).json({
                error:
                    `Dostępne saldo: ${available.toFixed(2)} zł`
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

        saveData(data);

        res.json({
            success: true,
            withdrawal
        });
    }
);

// =====================================================
// ZAMÓWIENIA ZE SKLEPU
// =====================================================

app.post("/api/orders", (req, res) => {

    const order = req.body;

    if (!order) {
        return res.status(400).json({
            error: "Brak danych."
        });
    }

    if (
        !order.name ||
        !order.email ||
        !order.total
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

// =====================================================
// SPRAWDZENIE ZAMÓWIENIA
// =====================================================

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

// =====================================================
// /admin
// =====================================================

app.get("/admin", (req, res) => {
    res.sendFile(
        path.join(__dirname, "admin.html")
    );
});

// =====================================================
// 404
// =====================================================

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
            <a href="/">← Wróć do sklepu</a>
        </body>
        </html>
    `);
});

// =====================================================
// START
// =====================================================

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("       PRINTERLASE3D");
    console.log("=================================");
    console.log(`Serwer: http://localhost:${PORT}`);
    console.log(`Admin:  http://localhost:${PORT}/admin`);
    console.log(
        ADMIN_PASSWORD
            ? "ADMIN_PASSWORD: ustawione"
            : "ADMIN_PASSWORD: BRAK"
    );
    console.log("");
});
```
