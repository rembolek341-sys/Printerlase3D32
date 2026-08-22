const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_PASSWORD) {
    console.error("❌ BRAK ADMIN_PASSWORD W RENDER ENVIRONMENT VARIABLES");
}

if (!SESSION_SECRET) {
    console.error("❌ BRAK SESSION_SECRET W RENDER ENVIRONMENT VARIABLES");
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: SESSION_SECRET || "CHANGE_THIS_SECRET",
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

const DATA_FILE = path.join(__dirname, "data.json");

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
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

function adminAuth(req, res, next) {
    if (!req.session || req.session.admin !== true) {
        return res.status(401).json({
            error: "Brak autoryzacji."
        });
    }

    next();
}

/* =========================
   STRONA GŁÓWNA
========================= */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {

    const password = String(
        req.body.password || ""
    );

    if (!ADMIN_PASSWORD) {
        return res.status(500).json({
            error: "ADMIN_PASSWORD nie jest ustawione na Render."
        });
    }

    if (
        password.length !== ADMIN_PASSWORD.length ||
        !crypto.timingSafeEqual(
            Buffer.from(password),
            Buffer.from(ADMIN_PASSWORD)
        )
    ) {
        return res.status(401).json({
            error: "Błędne hasło administratora."
        });
    }

    req.session.admin = true;

    res.json({
        success: true
    });
});

/* =========================
   ADMIN LOGOUT
========================= */

app.post(
    "/api/admin/logout",
    adminAuth,
    (req, res) => {

        req.session.destroy(() => {
            res.json({
                success: true
            });
        });

    }
);

/* =========================
   SPRAWDZENIE SESJI
========================= */

app.get(
    "/api/admin/me",
    (req, res) => {

        res.json({
            authenticated:
                req.session?.admin === true
        });

    }
);

/* =========================
   ADMIN PANEL
========================= */

app.get("/admin", (req, res) => {
    res.sendFile(
        path.join(__dirname, "admin.html")
    );
});

/* =========================
   DASHBOARD
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
            .filter(item =>
                item.status === "COMPLETED"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        const pendingWithdrawals =
            withdrawals
                .filter(item =>
                    item.status === "PENDING"
                )
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
                Number(
                    pendingWithdrawals.toFixed(2)
                ),
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
   WYPŁATA
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

        if (
            !["bank", "blik"].includes(method)
        ) {
            return res.status(400).json({
                error: "Nieprawidłowa metoda."
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

        const withdrawn = data.withdrawals
            .filter(item =>
                item.status === "COMPLETED"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        const pending = data.withdrawals
            .filter(item =>
                item.status === "PENDING"
            )
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
                    `Dostępne saldo: ${balance.toFixed(2)} zł`
            });
        }

        const withdrawal = {
            id:
                "WD-" +
                Date.now(),

            amount:
                Number(amount.toFixed(2)),

            method,

            status: "PENDING",

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

/* =========================
   STATUS WYPŁATY
========================= */

app.post(
    "/api/admin/withdraw-status",
    adminAuth,
    (req, res) => {

        const { id, status } =
            req.body;

        const allowed = [
            "PENDING",
            "COMPLETED",
            "CANCELLED"
        ];

        if (
            !id ||
            !allowed.includes(status)
        ) {
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

        saveData(data);

        res.json({
            success: true,
            withdrawal
        });
    }
);

/* =========================
   ZAMÓWIENIE ZE SKLEPU
========================= */

app.post(
    "/api/orders",
    (req, res) => {

        const order = req.body;

        if (
            !order ||
            !order.name ||
            !order.email ||
            !Number.isFinite(
                Number(order.total)
            )
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

            status: "NEW",

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
            newOrder.id
        );

        res.json({
            success: true,
            order: newOrder
        });
    }
);

/* =========================
   SPRAWDZENIE ZAMÓWIENIA
========================= */

app.get(
    "/api/orders/:id",
    (req, res) => {

        const data = loadData();

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

/* =========================
   PLIKI PUBLICZNE
========================= */

app.use(
    express.static(__dirname)
);

/* =========================
   404
========================= */

app.use(
    (req, res) => {

        res.status(404).send(`
            <h1>404</h1>
            <p>Nie znaleziono strony.</p>
            <a href="/">Wróć do sklepu</a>
        `);
    }
);

/* =========================
   START
========================= */

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "==============================="
        );
        console.log(
            "      PRINTERLASE3D"
        );
        console.log(
            "==============================="
        );

        console.log(
            `🚀 Port: ${PORT}`
        );

        console.log(
            ADMIN_PASSWORD
                ? "🔐 Hasło admina: ustawione"
                : "❌ Brak ADMIN_PASSWORD"
        );

        console.log("");
    }
);
