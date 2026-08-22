const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// KONFIGURACJA
// =====================================================

// TAJNY ADRES PANELU
// ZMIENIAJ GO, JEŚLI CHCESZ
const ADMIN_PATH = "/printerlase-admin-7Kx92mQ4";

// Losowy token sesji administratora
const ADMIN_SESSION_TOKEN =
    process.env.ADMIN_SESSION_TOKEN ||
    crypto.randomBytes(32).toString("hex");

// =====================================================
// PODSTAWOWE USTAWIENIA
// =====================================================

app.use(express.json({ limit: "10mb" }));

// =====================================================
// BAZA DANYCH
// =====================================================

const DATA_FILE = path.join(__dirname, "data.json");

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

        console.error(
            "❌ Błąd odczytu data.json:",
            error
        );

        return createEmptyData();
    }
}

function saveData(data) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// =====================================================
// ADMIN SESSION
// =====================================================

function adminAuth(req, res, next) {

    const token = req.cookies?.printerlase_admin;

    if (!token || token !== ADMIN_SESSION_TOKEN) {
        return res.status(403).json({
            error: "Brak dostępu."
        });
    }

    next();
}

// =====================================================
// PROSTE COOKIE PARSOWANIE
// Nie potrzebujemy cookie-parser.
// =====================================================

app.use((req, res, next) => {

    req.cookies = {};

    const cookieHeader = req.headers.cookie;

    if (cookieHeader) {

        cookieHeader
            .split(";")
            .forEach(cookie => {

                const index = cookie.indexOf("=");

                if (index === -1) return;

                const name =
                    cookie
                        .slice(0, index)
                        .trim();

                const value =
                    cookie
                        .slice(index + 1)
                        .trim();

                req.cookies[name] =
                    decodeURIComponent(value);
            });
    }

    next();
});

// =====================================================
// TAJNY PANEL ADMINA
// =====================================================

app.get(ADMIN_PATH, (req, res) => {

    res.setHeader(
        "Set-Cookie",
        `printerlase_admin=${encodeURIComponent(
            ADMIN_SESSION_TOKEN
        )}; HttpOnly; Path=/; SameSite=Strict; Secure`
    );

    res.sendFile(
        path.join(__dirname, "admin.html")
    );
});

// =====================================================
// BLOKADA BEZPOŚREDNIEGO admin.html
// =====================================================

app.get("/admin.html", (req, res) => {

    res.status(404).send(`
        <h1>404</h1>
        <p>Nie znaleziono strony.</p>
        <a href="/">Wróć do sklepu</a>
    `);
});

// =====================================================
// PLIKI SKLEPU
// =====================================================

app.use(
    express.static(__dirname, {
        index: "index.html"
    })
);

// =====================================================
// STRONA GŁÓWNA
// =====================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

// =====================================================
// ADMIN DASHBOARD
// =====================================================

app.get(
    "/api/admin/dashboard",
    adminAuth,
    (req, res) => {

        const data = loadData();

        const orders = data.orders;
        const withdrawals = data.withdrawals;

        const earned =
            orders
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
            withdrawals
                .filter(
                    item =>
                        item.status === "COMPLETED"
                )
                .reduce(
                    (sum, item) =>
                        sum +
                        Number(
                            item.amount || 0
                        ),
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
                        sum +
                        Number(
                            item.amount || 0
                        ),
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
                Number(
                    balance.toFixed(2)
                ),

            earned:
                Number(
                    earned.toFixed(2)
                ),

            withdrawn:
                Number(
                    withdrawn.toFixed(2)
                ),

            pendingWithdrawals:
                Number(
                    pendingWithdrawals.toFixed(2)
                ),

            orders,

            withdrawals
        });
    }
);

// =====================================================
// ZMIANA STATUSU ZAMÓWIENIA
// =====================================================

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
                    "Nieprawidłowy status."
            });
        }

        const data = loadData();

        const order =
            data.orders.find(
                item =>
                    String(item.id) ===
                    String(id)
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

        console.log(
            `📦 Zamówienie ${order.id}: ${status}`
        );

        res.json({
            success: true,
            order
        });
    }
);

// =====================================================
// WYPIŁATA
// =====================================================

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
                error:
                    "Nieprawidłowa kwota."
            });
        }

        if (
            amount > 100000
        ) {

            return res.status(400).json({
                error:
                    "Za duża kwota."
            });
        }

        const allowedMethods = [
            "bank",
            "blik"
        ];

        if (
            !allowedMethods.includes(method)
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

        const balance =
            earned -
            withdrawn -
            pending;

        if (amount > balance) {

            return res.status(400).json({
                error:
                    `Brak wystarczających środków. Dostępne: ${balance.toFixed(2)} zł`
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

        console.log(
            "💸 NOWA WYPŁATA:",
            withdrawal.id,
            withdrawal.amount,
            "zł"
        );

        res.json({

            success: true,

            message:
                "Żądanie wypłaty utworzone.",

            withdrawal
        });
    }
);

// =====================================================
// ANULOWANIE / USUNIĘCIE WYPŁATY
// =====================================================

app.post(
    "/api/admin/withdraw-cancel",
    adminAuth,
    (req, res) => {

        const {
            id
        } = req.body;

        const data = loadData();

        const withdrawal =
            data.withdrawals.find(
                item =>
                    item.id === id
            );

        if (!withdrawal) {

            return res.status(404).json({
                error:
                    "Nie znaleziono wypłaty."
            });
        }

        if (
            withdrawal.status !==
            "PENDING"
        ) {

            return res.status(400).json({
                error:
                    "Tej wypłaty nie można anulować."
            });
        }

        withdrawal.status =
            "CANCELLED";

        withdrawal.updatedAt =
            new Date().toISOString();

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

app.post(
    "/api/orders",
    (req, res) => {

        const order = req.body;

        if (
            !order ||
            typeof order !== "object"
        ) {

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

        const total =
            Number(order.total);

        if (
            !Number.isFinite(total) ||
            total <= 0
        ) {

            return res.status(400).json({
                error:
                    "Nieprawidłowa kwota zamówienia."
            });
        }

        const data = loadData();

        const newOrder = {

            ...order,

            id:
                order.id ||
                "PL-" +
                Date.now(),

            total:
                Number(
                    total.toFixed(2)
                ),

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

            order:
                newOrder
        });
    }
);

// =====================================================
// SPRAWDZENIE ZAMÓWIENIA
// =====================================================

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

// =====================================================
// WYLOGOWANIE
// =====================================================

app.post(
    "/api/admin/logout",
    adminAuth,
    (req, res) => {

        res.setHeader(
            "Set-Cookie",
            "printerlase_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure"
        );

        res.json({
            success: true
        });
    }
);

// =====================================================
// 403 ADMIN API
// =====================================================

app.use(
    "/api/admin",
    (req, res) => {

        res.status(403).json({
            error:
                "Brak dostępu."
        });
    }
);

// =====================================================
// 404
// =====================================================

app.use(
    (req, res) => {

        res.status(404).send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>404</title>
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

                <p>
                    Nie znaleziono strony.
                </p>

                <a href="/">
                    ← Wróć do Printerlase3D
                </a>

            </body>
            </html>
        `);
    }
);

// =====================================================
// START
// =====================================================

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
            `🔐 Panel: ${ADMIN_PATH}`
        );

        console.log("");
    }
);
