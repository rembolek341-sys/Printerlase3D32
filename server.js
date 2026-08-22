```js
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

// ======================================================
// KONFIGURACJA
// ======================================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.error("❌ BRAK ADMIN_PASSWORD!");
    console.error("Ustaw ADMIN_PASSWORD w Render → Environment Variables.");
    process.exit(1);
}

const DATA_FILE = path.join(__dirname, "data.json");

// Sesje trzymane po stronie serwera.
// Restart Rendera wyloguje aktywne sesje — to normalne.
const sessions = new Map();

// Prosty rate limit logowania
const loginAttempts = new Map();

const SESSION_COOKIE = "printerlase_admin";
const SESSION_DURATION = 1000 * 60 * 60 * 8; // 8 godzin

// ======================================================
// EXPRESS
// ======================================================

app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));

// ======================================================
// DATA.JSON
// ======================================================

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initialData = {
                orders: [],
                withdrawals: [],
                labels: []
            };

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(initialData, null, 2),
                "utf8"
            );

            return initialData;
        }

        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        return {
            orders: Array.isArray(data.orders) ? data.orders : [],
            withdrawals: Array.isArray(data.withdrawals)
                ? data.withdrawals
                : [],
            labels: Array.isArray(data.labels)
                ? data.labels
                : []
        };

    } catch (error) {
        console.error("❌ Błąd data.json:", error);

        return {
            orders: [],
            withdrawals: [],
            labels: []
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

// ======================================================
// SESJE
// ======================================================

function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString("hex");
}

function createSession() {
    const sessionId = randomToken(32);

    const session = {
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION,
        csrfToken: randomToken(32)
    };

    sessions.set(sessionId, session);

    return {
        sessionId,
        csrfToken: session.csrfToken
    };
}

function getSession(req) {
    const cookies = req.headers.cookie || "";

    const cookie = cookies
        .split(";")
        .map(x => x.trim())
        .find(x => x.startsWith(`${SESSION_COOKIE}=`));

    if (!cookie) {
        return null;
    }

    const sessionId =
        decodeURIComponent(
            cookie.substring(`${SESSION_COOKIE}=`.length)
        );

    const session = sessions.get(sessionId);

    if (!session) {
        return null;
    }

    if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId);
        return null;
    }

    return {
        sessionId,
        ...session
    };
}

function setSessionCookie(res, sessionId) {
    const secure =
        process.env.NODE_ENV === "production"
            ? " Secure;"
            : "";

    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${SESSION_DURATION / 1000}`
    );
}

function clearSessionCookie(res) {
    const secure =
        process.env.NODE_ENV === "production"
            ? " Secure;"
            : "";

    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`
    );
}

// ======================================================
// ADMIN AUTH
// ======================================================

function requireAdmin(req, res, next) {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            error: "Brak aktywnej sesji."
        });
    }

    req.adminSession = session;

    next();
}

function requireCSRF(req, res, next) {
    const session = req.adminSession || getSession(req);

    if (!session) {
        return res.status(401).json({
            error: "Brak aktywnej sesji."
        });
    }

    const token =
        req.headers["x-csrf-token"];

    if (
        !token ||
        token !== session.csrfToken
    ) {
        return res.status(403).json({
            error: "Nieprawidłowy token bezpieczeństwa."
        });
    }

    next();
}

// ======================================================
// LOGOWANIE
// ======================================================

app.post("/api/admin/login", (req, res) => {
    const ip =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "unknown";

    const now = Date.now();

    const previous =
        loginAttempts.get(ip) || {
            count: 0,
            firstAttempt: now,
            blockedUntil: 0
        };

    // Reset po 15 minutach
    if (now - previous.firstAttempt > 15 * 60 * 1000) {
        previous.count = 0;
        previous.firstAttempt = now;
        previous.blockedUntil = 0;
    }

    if (previous.blockedUntil > now) {
        return res.status(429).json({
            error: "Za dużo prób logowania. Spróbuj później."
        });
    }

    const password =
        typeof req.body.password === "string"
            ? req.body.password
            : "";

    const passwordBuffer =
        Buffer.from(password);

    const correctBuffer =
        Buffer.from(ADMIN_PASSWORD);

    let correct = false;

    if (
        passwordBuffer.length ===
        correctBuffer.length
    ) {
        correct =
            crypto.timingSafeEqual(
                passwordBuffer,
                correctBuffer
            );
    }

    if (!correct) {
        previous.count++;

        if (previous.count >= 5) {
            previous.blockedUntil =
                now + 10 * 60 * 1000;
        }

        loginAttempts.set(ip, previous);

        return res.status(401).json({
            error: "Błędne hasło administratora."
        });
    }

    loginAttempts.delete(ip);

    // Jeśli ktoś miał starą sesję z tego cookie,
    // nie używamy jej ponownie.
    const oldSession = getSession(req);

    if (oldSession) {
        sessions.delete(oldSession.sessionId);
    }

    const session = createSession();

    setSessionCookie(
        res,
        session.sessionId
    );

    res.json({
        success: true,
        csrfToken: session.csrfToken
    });
});

// ======================================================
// SPRAWDZENIE SESJI
// ======================================================

app.get(
    "/api/admin/session",
    requireAdmin,
    (req, res) => {
        res.json({
            authenticated: true,
            csrfToken:
                req.adminSession.csrfToken,
            expiresAt:
                req.adminSession.expiresAt
        });
    }
);

// ======================================================
// WYLOGOWANIE
// ======================================================

app.post(
    "/api/admin/logout",
    requireAdmin,
    requireCSRF,
    (req, res) => {

        sessions.delete(
            req.adminSession.sessionId
        );

        clearSessionCookie(res);

        res.json({
            success: true
        });
    }
);

// ======================================================
// DASHBOARD
// ======================================================

app.get(
    "/api/admin/dashboard",
    requireAdmin,
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
                        Number(order.total || 0),
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
                        Number(item.amount || 0),
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
                        Number(item.amount || 0),
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

// ======================================================
// ZMIANA STATUSU ZAMÓWIENIA
// ======================================================

app.post(
    "/api/admin/order-status",
    requireAdmin,
    requireCSRF,
    (req, res) => {

        const { id, status } =
            req.body;

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

        saveData(data);

        res.json({
            success: true,
            order
        });
    }
);

// ======================================================
// WYPLATA
// ======================================================

app.post(
    "/api/admin/withdraw",
    requireAdmin,
    requireCSRF,
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
                        Number(order.total || 0),
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
                    `Brak środków. Dostępne: ${balance.toFixed(2)} zł`
            });
        }

        const withdrawal = {
            id:
                "WD-" +
                Date.now() +
                "-" +
                crypto
                    .randomBytes(3)
                    .toString("hex"),

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

// ======================================================
// ZATWIERDZENIE WYPŁATY
// ======================================================

app.post(
    "/api/admin/withdraw-status",
    requireAdmin,
    requireCSRF,
    (req, res) => {

        const { id, status } =
            req.body;

        if (
            !["PENDING", "COMPLETED", "CANCELLED"]
                .includes(status)
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

// ======================================================
// UTWORZENIE ZAMÓWIENIA
// ======================================================

app.post(
    "/api/orders",
    (req, res) => {

        const order = req.body;

        if (!order) {
            return res.status(400).json({
                error:
                    "Brak danych zamówienia."
            });
        }

        if (
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

// ======================================================
// SPRAWDZENIE ZAMÓWIENIA
// ======================================================

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

// ======================================================
// ADMIN
// ======================================================

app.get(
    "/admin",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );
    }
);

// ======================================================
// PLIKI SKLEPU
// ======================================================

app.use(
    express.static(__dirname, {
        index: "index.html"
    })
);

// ======================================================
// 404
// ======================================================

app.use(
    (req, res) => {

        res.status(404).send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>404 - Printerlase3D</title>
                <style>
                    body{
                        margin:0;
                        min-height:100vh;
                        display:grid;
                        place-items:center;
                        background:#030712;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                    }

                    a{
                        color:#00c8ff;
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

// ======================================================
// START
// ======================================================

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
            "🔐 ADMIN_PASSWORD: ustawione"
        );

        console.log(
            "🌐 /admin: aktywne"
        );

        console.log("");
    }
);
```
