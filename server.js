const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "data.json");

function defaultData() {
    return {
        orders: [],
        withdrawals: []
    };
}

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const data = defaultData();
            saveData(data);
            return data;
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");

        if (!raw.trim()) {
            return defaultData();
        }

        const data = JSON.parse(raw);

        if (!Array.isArray(data.orders)) {
            data.orders = [];
        }

        if (!Array.isArray(data.withdrawals)) {
            data.withdrawals = [];
        }

        return data;
    } catch (error) {
        console.error("Błąd data.json:", error);
        return defaultData();
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error("Nie można zapisać data.json:", error);
        throw error;
    }
}

function makeOrderId() {
    return "PL-" + Date.now() + "-" +
        Math.random().toString(36).substring(2, 7).toUpperCase();
}

function money(value) {
    return Number(value || 0).toFixed(2);
}

/* =========================
   STRONA GŁÓWNA
========================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


/* =========================
   ADMIN
========================= */

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/admin/", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});


/* =========================
   DASHBOARD
========================= */

app.get("/api/admin/dashboard", (req, res) => {

    const data = loadData();

    const orders = data.orders;
    const withdrawals = data.withdrawals;

    const earned = orders
        .filter(order => order.status === "PAID" || order.status === "SHIPPED")
        .reduce((sum, order) => {
            return sum + Number(order.total || 0);
        }, 0);

    const withdrawn = withdrawals
        .filter(item => item.status === "COMPLETED")
        .reduce((sum, item) => {
            return sum + Number(item.amount || 0);
        }, 0);

    const balance = Math.max(0, earned - withdrawn);

    res.json({
        success: true,
        balance: Number(money(balance)),
        earned: Number(money(earned)),
        withdrawn: Number(money(withdrawn)),
        orders: orders.slice().reverse(),
        withdrawals: withdrawals.slice().reverse()
    });
});


/* =========================
   ZAMÓWIENIE
========================= */

app.post("/api/orders", (req, res) => {

    try {

        const body = req.body || {};

        if (!body.name) {
            return res.status(400).json({
                error: "Brak imienia i nazwiska."
            });
        }

        if (!body.email) {
            return res.status(400).json({
                error: "Brak adresu e-mail."
            });
        }

        if (
            body.total === undefined ||
            body.total === null ||
            !Number.isFinite(Number(body.total))
        ) {
            return res.status(400).json({
                error: "Nieprawidłowa kwota zamówienia."
            });
        }

        const data = loadData();

        const order = {
            ...body,

            id: body.id || makeOrderId(),

            total: Number(body.total),

            status: "NEW",

            createdAt:
                body.createdAt ||
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()
        };

        data.orders.push(order);

        saveData(data);

        console.log(
            "NOWE ZAMÓWIENIE:",
            order.id,
            order.total,
            "zł"
        );

        res.json({
            success: true,
            order
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Nie udało się utworzyć zamówienia."
        });
    }
});


/* =========================
   POBIERANIE ZAMÓWIENIA
========================= */

app.get("/api/orders/:id", (req, res) => {

    const data = loadData();

    const order = data.orders.find(
        item => String(item.id) === String(req.params.id)
    );

    if (!order) {
        return res.status(404).json({
            error: "Nie znaleziono zamówienia."
        });
    }

    res.json(order);
});


/* =========================
   STATUS ZAMÓWIENIA
========================= */

app.post("/api/admin/order-status", (req, res) => {

    const { id, status } = req.body || {};

    const allowedStatuses = [
        "NEW",
        "PAID",
        "CANCELLED",
        "READY",
        "SHIPPED"
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

    saveData(data);

    res.json({
        success: true,
        order
    });
});


/* =========================
   USUNIĘCIE ZAMÓWIENIA
========================= */

app.delete("/api/admin/order/:id", (req, res) => {

    const data = loadData();

    const index = data.orders.findIndex(
        item => String(item.id) === String(req.params.id)
    );

    if (index === -1) {
        return res.status(404).json({
            error: "Nie znaleziono zamówienia."
        });
    }

    const deleted = data.orders.splice(index, 1)[0];

    saveData(data);

    res.json({
        success: true,
        order: deleted
    });
});


/* =========================
   WYPOŁATA
========================= */

app.post("/api/admin/withdraw", (req, res) => {

    const amount = Number(req.body.amount);
    const method = req.body.method;

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            error: "Nieprawidłowa kwota."
        });
    }

    if (!["bank", "blik"].includes(method)) {
        return res.status(400).json({
            error: "Nieprawidłowa metoda."
        });
    }

    const data = loadData();

    const earned = data.orders
        .filter(order =>
            order.status === "PAID" ||
            order.status === "SHIPPED"
        )
        .reduce((sum, order) => {
            return sum + Number(order.total || 0);
        }, 0);

    const withdrawn = data.withdrawals
        .filter(item => item.status === "COMPLETED")
        .reduce((sum, item) => {
            return sum + Number(item.amount || 0);
        }, 0);

    const pending = data.withdrawals
        .filter(item => item.status === "PENDING")
        .reduce((sum, item) => {
            return sum + Number(item.amount || 0);
        }, 0);

    const available = earned - withdrawn - pending;

    if (amount > available) {
        return res.status(400).json({
            error:
                `Brak środków. Dostępne: ${money(available)} zł`
        });
    }

    const withdrawal = {
        id: "WD-" + Date.now(),
        amount: Number(money(amount)),
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
});


/* =========================
   ZAKOŃCZENIE WYPŁATY
========================= */

app.post("/api/admin/withdraw/:id/complete", (req, res) => {

    const data = loadData();

    const withdrawal = data.withdrawals.find(
        item => item.id === req.params.id
    );

    if (!withdrawal) {
        return res.status(404).json({
            error: "Nie znaleziono wypłaty."
        });
    }

    withdrawal.status = "COMPLETED";
    withdrawal.completedAt = new Date().toISOString();

    saveData(data);

    res.json({
        success: true,
        withdrawal
    });
});


/* =========================
   ETYKIETA - DANE
========================= */

app.get("/api/admin/label/:id", (req, res) => {

    const data = loadData();

    const order = data.orders.find(
        item => String(item.id) === String(req.params.id)
    );

    if (!order) {
        return res.status(404).json({
            error: "Nie znaleziono zamówienia."
        });
    }

    res.json({
        success: true,
        order
    });
});


/* =========================
   STRONA ETYKIETY
========================= */

app.get("/admin/label/:id", (req, res) => {

    const data = loadData();

    const order = data.orders.find(
        item => String(item.id) === String(req.params.id)
    );

    if (!order) {
        return res.status(404).send("Nie znaleziono zamówienia.");
    }

    const esc = value =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    const shipping =
        order.shipping ||
        order.address ||
        {};

    const street =
        shipping.street ||
        order.street ||
        order.addressLine1 ||
        "";

    const postalCode =
        shipping.postalCode ||
        order.postalCode ||
        order.zip ||
        "";

    const city =
        shipping.city ||
        order.city ||
        "";

    const country =
        shipping.country ||
        order.country ||
        "Polska";

    const phone =
        shipping.phone ||
        order.phone ||
        "";

    const name =
        shipping.name ||
        order.name ||
        "";

    res.send(`
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Etykieta ${esc(order.id)}</title>

<style>

*{
    box-sizing:border-box;
}

body{
    margin:0;
    padding:30px;
    background:#eee;
    font-family:Arial,Helvetica,sans-serif;
}

.toolbar{
    width:800px;
    max-width:100%;
    margin:0 auto 20px;
    display:flex;
    gap:10px;
}

button{
    border:0;
    padding:13px 18px;
    border-radius:8px;
    background:#111;
    color:white;
    font-weight:bold;
    cursor:pointer;
}

.label{
    width:800px;
    max-width:100%;
    min-height:500px;
    margin:auto;
    padding:28px;
    background:white;
    color:#000;
    border:3px solid #000;
}

.header{
    display:flex;
    justify-content:space-between;
    border-bottom:3px solid #000;
    padding-bottom:18px;
}

.brand{
    font-size:30px;
    font-weight:900;
}

.order{
    text-align:right;
    font-size:16px;
}

.receiver{
    margin-top:25px;
    border:2px solid #000;
    padding:20px;
}

.receiver h2{
    margin:0 0 15px;
    font-size:18px;
}

.name{
    font-size:27px;
    font-weight:900;
    margin-bottom:12px;
}

.address{
    font-size:21px;
    line-height:1.5;
}

.phone{
    margin-top:12px;
    font-size:15px;
}

.bottom{
    margin-top:25px;
    padding-top:20px;
    border-top:3px solid #000;
    display:flex;
    justify-content:space-between;
    align-items:end;
}

.barcode{
    font-family:monospace;
    font-size:31px;
    letter-spacing:3px;
}

.price{
    font-size:25px;
    font-weight:900;
}

@media print{

    body{
        padding:0;
        background:white;
    }

    .toolbar{
        display:none;
    }

    .label{
        width:100%;
        min-height:100vh;
        border:3px solid #000;
    }

}

</style>
</head>

<body>

<div class="toolbar">
    <button onclick="window.print()">
        🖨️ DRUKUJ / ZAPISZ PDF
    </button>

    <button onclick="window.close()">
        ✕ ZAMKNIJ
    </button>
</div>

<div class="label">

    <div class="header">

        <div class="brand">
            PRINTERLASE3D
        </div>

        <div class="order">
            ZAMÓWIENIE<br>
            <strong>${esc(order.id)}</strong>
        </div>

    </div>

    <div class="receiver">

        <h2>ODBIORCA</h2>

        <div class="name">
            ${esc(name)}
        </div>

        <div class="address">

            ${esc(street)}<br>

            ${esc(postalCode)}
            ${esc(city)}<br>

            ${esc(country)}

        </div>

        ${
            phone
            ? `
            <div class="phone">
                📞 ${esc(phone)}
            </div>
            `
            : ""
        }

    </div>

    <div class="bottom">

        <div>

            <div class="barcode">
                || ${esc(order.id)} ||
            </div>

            <small>
                Numer zamówienia
            </small>

        </div>

        <div class="price">
            ${money(order.total)} zł
        </div>

    </div>

</div>

</body>
</html>
    `);
});


/* =========================
   404
========================= */

app.use((req, res) => {

    res.status(404).send(`
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>404</title>
<style>
body{
    background:#030712;
    color:white;
    font-family:Arial;
    text-align:center;
    padding:100px 20px;
}
a{
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


/* =========================
   START
========================= */

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("        PRINTERLASE3D");
    console.log("=================================");
    console.log(`🚀 PORT: ${PORT}`);
    console.log(`🌐 ADMIN: /admin`);
    console.log("");
});
