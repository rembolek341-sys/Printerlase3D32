const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// KONFIGURACJA
// =========================

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "Admin2137!";

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "printerlase3d-session-secret-change-me";

// Render działa za proxy HTTPS
app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));

// =========================
// SESJA
// =========================

app.use(
    session({
        name: "printerlase3d_admin",
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",

            // 30 dni
            maxAge: 1000 * 60 * 60 * 24 * 30
        }
    })
);

// =========================
// BAZA
// =========================

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initial = {
                orders: [],
                withdrawals: []
            };

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(initial, null, 2)
            );

            return initial;
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

        console.error(
            "Błąd odczytu data.json:",
            error
        );

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
// ADMIN AUTH
// =========================

function requireAdmin(req, res, next) {

    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        error: "Brak autoryzacji."
    });
}

// =========================
// LOGOWANIE
// =========================

app.post("/api/admin/login", (req, res) => {

    const password = String(
        req.body.password || ""
    );

    if (password !== ADMIN_PASSWORD) {

        return res.status(401).json({
            error: "Błędne hasło administratora."
        });
    }

    // Nowa sesja po zalogowaniu
    req.session.regenerate((err) => {

        if (err) {

            console.error(
                "Błąd tworzenia sesji:",
                err
            );

            return res.status(500).json({
                error: "Nie udało się utworzyć sesji."
            });
        }

        req.session.isAdmin = true;

        req.session.save((err) => {

            if (err) {

                console.error(
                    "Błąd zapisu sesji:",
                    err
                );

                return res.status(500).json({
                    error: "Nie udało się zapisać sesji."
                });
            }

            res.json({
                success: true
            });
        });
    });
});

// =========================
// SPRAWDZENIE SESJI
// =========================

app.get(
    "/api/admin/session",
    (req, res) => {

        res.json({
            authenticated:
                req.session?.isAdmin === true
        });
    }
);

// =========================
// WYLOGOWANIE
// =========================

app.post(
    "/api/admin/logout",
    requireAdmin,
    (req, res) => {

        req.session.destroy((err) => {

            if (err) {

                return res.status(500).json({
                    error: "Nie udało się wylogować."
                });
            }

            res.clearCookie(
                "printerlase3d_admin"
            );

            res.json({
                success: true
            });
        });
    }
);

// =========================
// /admin
// =========================

app.get("/admin", (req, res) => {

    res.sendFile(
        path.join(__dirname, "admin.html")
    );
});

// =========================
// DASHBOARD
// =========================

app.get(
    "/api/admin/dashboard",
    requireAdmin,
    (req, res) => {

        const data = loadData();

        const orders = data.orders;
        const withdrawals = data.withdrawals;

        const earned = orders
            .filter(
                order =>
                    order.status === "PAID"
            )
            .reduce(
                (sum, order) =>
                    sum + Number(order.total || 0),
                0
            );

        const withdrawn = withdrawals
            .filter(
                item =>
                    item.status === "COMPLETED"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        const pendingWithdrawals =
            withdrawals
                .filter(
                    item =>
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

            balance:
                Number(balance.toFixed(2)),

            earned:
                Number(earned.toFixed(2)),

            withdrawn:
                Number(withdrawn.toFixed(2)),

            pendingWithdrawals:
                Number(
                    pendingWithdrawals.toFixed(2)
                ),

            orders,
            withdrawals
        });
    }
);

// =========================
// STATUS ZAMÓWIENIA
// =========================

app.post(
    "/api/admin/order-status",
    requireAdmin,
    (req, res) => {

        const {
            id,
            status
        } = req.body;

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
    requireAdmin,
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
                error:
                    "Nieprawidłowa kwota."
            });
        }

        if (
            !["bank", "blik"]
                .includes(method)
        ) {

            return res.status(400).json({
                error:
                    "Nieprawidłowa metoda."
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
                        Number(
                            order.total || 0
                        ),
                    0
                );

        const withdrawn =
            data.withdrawals
                .filter(
                    item =>
                        item.status ===
                        "COMPLETED"
                )
                .reduce(
                    (sum, item) =>
                        sum +
                        Number(
                            item.amount || 0
                        ),
                    0
                );

        const pending =
            data.withdrawals
                .filter(
                    item =>
                        item.status ===
                        "PENDING"
                )
                .reduce(
                    (sum, item) =>
                        sum +
                        Number(
                            item.amount || 0
                        ),
                    0
                );

        const available =
            earned -
            withdrawn -
            pending;

        if (amount > available) {

            return res.status(400).json({
                error:
                    `Dostępne środki: ${available.toFixed(2)} zł`
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

// =========================
// ZAMÓWIENIE
// =========================

app.post(
    "/api/orders",
    (req, res) => {

        const order = req.body;

        if (
            !order ||
            !order.name ||
            !order.email ||
            !order.total
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

// =========================
// PLIKI PUBLICZNE
// =========================

app.use(
    express.static(__dirname)
);

// =========================
// 404
// =========================

app.use(
    (req, res) => {

        res.status(404).send(`
            <h1>404</h1>
            <p>Nie znaleziono strony.</p>
            <a href="/">← Wróć do sklepu</a>
        `);
    }
);

// =========================
// START
// =========================

app.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            "      PRINTERLASE3D"
        );

        console.log(
            "================================="
        );

        console.log(
            `🚀 Port: ${PORT}`
        );

        console.log(
            "🔐 System sesji administratora: ON"
        );

        console.log(
            "================================="
        );
    }
);
