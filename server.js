```html
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Printerlase3D — Admin</title>

<style>
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: Arial, sans-serif;
    min-height: 100vh;
    color: white;
    background:
        radial-gradient(circle at 10% 0%, #008cff22, transparent 30%),
        radial-gradient(circle at 90% 10%, #713cff22, transparent 30%),
        #030712;
}

button,
input,
select {
    font: inherit;
}

button {
    cursor: pointer;
}

.top {
    height: 70px;
    padding: 0 5%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ffffff12;
    background: #030712dd;
    backdrop-filter: blur(15px);
}

.logo {
    font-size: 20px;
    font-weight: 900;
}

.logo span {
    color: #00c8ff;
}

.back {
    padding: 10px 15px;
    color: white;
    text-decoration: none;
    border: 1px solid #ffffff15;
    border-radius: 10px;
    background: #091527;
}

.login {
    width: min(420px, 90%);
    margin: 100px auto;
    padding: 30px;
    border: 1px solid #ffffff12;
    border-radius: 22px;
    background: #071120;
    box-shadow: 0 30px 100px #0008;
}

.login h1 {
    margin-bottom: 10px;
}

.muted {
    color: #8190a5;
    font-size: 12px;
    line-height: 1.6;
}

.field {
    margin-top: 18px;
}

.field label {
    display: block;
    margin-bottom: 7px;
    color: #9aa8ba;
    font-size: 10px;
    font-weight: 900;
}

.field input,
.field select {
    width: 100%;
    padding: 13px;
    color: white;
    outline: none;
    background: #030a14;
    border: 1px solid #ffffff15;
    border-radius: 10px;
}

.btn {
    padding: 13px 18px;
    color: white;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(100deg, #008cff, #713cff);
    font-size: 11px;
    font-weight: 900;
}

.login .btn {
    width: 100%;
    margin-top: 20px;
}

.error {
    margin-top: 12px;
    color: #ff5577;
    font-size: 11px;
}

.dashboard {
    display: none;
}

.container {
    width: min(1200px, 92%);
    margin: 35px auto 80px;
}

.heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 20px;
    margin-bottom: 25px;
}

.heading h1 {
    font-size: 34px;
}

.cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
}

.card {
    padding: 22px;
    border: 1px solid #ffffff10;
    border-radius: 18px;
    background: linear-gradient(145deg, #081426, #050c18);
}

.card small {
    color: #8190a5;
    font-size: 10px;
    font-weight: 900;
}

.card strong {
    display: block;
    margin-top: 10px;
    font-size: 25px;
}

.green {
    color: #42e6a4;
}

.blue {
    color: #00c8ff;
}

.red {
    color: #ff5577;
}

.withdrawBox {
    margin-top: 22px;
    padding: 25px;
    border: 1px solid #42e6a422;
    border-radius: 20px;
    background: #071120;
}

.withdrawBox h2 {
    margin-bottom: 5px;
}

.withdrawGrid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 12px;
    align-items: end;
    margin-top: 18px;
}

.withdrawGrid .field {
    margin: 0;
}

.orders {
    margin-top: 25px;
    overflow: hidden;
    border: 1px solid #ffffff12;
    border-radius: 18px;
    background: #071120;
}

.ordersHeader {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ffffff12;
}

.order {
    padding: 20px;
    display: grid;
    grid-template-columns: 1fr 150px 120px 260px;
    gap: 15px;
    align-items: center;
    border-bottom: 1px solid #ffffff10;
}

.order:last-child {
    border-bottom: 0;
}

.order strong {
    font-size: 12px;
}

.order span {
    display: block;
    margin-top: 5px;
    color: #8190a5;
    font-size: 10px;
}

.status {
    display: inline-block;
    padding: 7px 9px;
    border-radius: 8px;
    background: #132238;
    color: #9eafc5;
    font-size: 9px;
    font-weight: 900;
}

.status.PAID {
    color: #42e6a4;
    background: #42e6a415;
}

.status.NEW {
    color: #5edcff;
    background: #00c8ff12;
}

.status.CANCELLED {
    color: #ff6c85;
    background: #ff557712;
}

.actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.smallBtn {
    padding: 8px 10px;
    color: white;
    background: #0b182a;
    border: 1px solid #ffffff15;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 900;
}

.smallBtn:hover {
    background: #14243b;
}

.empty {
    padding: 50px;
    text-align: center;
    color: #8190a5;
}

.toast {
    position: fixed;
    left: 50%;
    bottom: 25px;
    padding: 14px 20px;
    color: white;
    background: #102038;
    border: 1px solid #00c8ff33;
    border-radius: 12px;
    transform: translate(-50%, 30px);
    opacity: 0;
    pointer-events: none;
    transition: .25s;
    z-index: 100;
}

.toast.show {
    opacity: 1;
    transform: translate(-50%, 0);
}

@media(max-width: 950px) {
    .cards {
        grid-template-columns: repeat(2, 1fr);
    }

    .order {
        grid-template-columns: 1fr;
    }

    .withdrawGrid {
        grid-template-columns: 1fr;
    }
}

@media(max-width: 500px) {
    .cards {
        grid-template-columns: 1fr;
    }

    .heading {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
</head>

<body>

<header class="top">
    <div class="logo">
        Printerlase<span>3D</span> ADMIN
    </div>

    <a href="/" class="back">← SKLEP</a>
</header>

<div id="loginScreen" class="login">

    <h1>🔐 Panel Admin</h1>

    <p class="muted">
        Zaloguj się do panelu administratora.
    </p>

    <div class="field">
        <label>HASŁO</label>

        <input
            id="adminPassword"
            type="password"
            placeholder="Hasło administratora"
            autocomplete="current-password"
        >
    </div>

    <button class="btn" onclick="login()">
        ZALOGUJ
    </button>

    <div id="loginError" class="error"></div>

</div>

<main id="dashboard" class="dashboard">

<div class="container">

    <div class="heading">

        <div>
            <h1>📊 Dashboard</h1>

            <p class="muted">
                Zarządzanie Printerlase3D
            </p>
        </div>

        <button class="btn" onclick="loadDashboard()">
            ↻ ODŚWIEŻ
        </button>

    </div>

    <section class="cards">

        <div class="card">
            <small>💰 SALDO</small>
            <strong id="balance" class="green">0,00 zł</strong>
        </div>

        <div class="card">
            <small>📦 ZAMÓWIENIA</small>
            <strong id="ordersCount">0</strong>
        </div>

        <div class="card">
            <small>💵 ZAROBIONE</small>
            <strong id="earned" class="blue">0,00 zł</strong>
        </div>

        <div class="card">
            <small>💸 WYPŁACONO</small>
            <strong id="withdrawn" class="red">0,00 zł</strong>
        </div>

    </section>

    <section class="withdrawBox">

        <h2>💸 Wypłata</h2>

        <p class="muted">
            Utwórz żądanie wypłaty środków.
        </p>

        <div class="withdrawGrid">

            <div class="field">
                <label>KWOTA</label>

                <input
                    id="withdrawAmount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="25.00"
                >
            </div>

            <div class="field">
                <label>METODA</label>

                <select id="withdrawMethod">
                    <option value="bank">🏦 Konto bankowe</option>
                    <option value="blik">📱 BLIK</option>
                </select>
            </div>

            <button class="btn" onclick="withdraw()">
                💸 WYPŁAĆ
            </button>

        </div>

    </section>

    <section class="orders">

        <div class="ordersHeader">

            <h2>📦 Zamówienia</h2>

            <span id="lastUpdate" class="muted"></span>

        </div>

        <div id="ordersList"></div>

    </section>

</div>

</main>

<div id="toast" class="toast"></div>

<script>

let adminPassword = "";

function money(value) {
    return Number(value || 0)
        .toFixed(2)
        .replace(".", ",") + " zł";
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function login() {

    const password =
        document.getElementById("adminPassword").value.trim();

    if (!password) {
        document.getElementById("loginError").textContent =
            "Podaj hasło.";
        return;
    }

    adminPassword = password;

    try {

        const response = await fetch("/api/admin/dashboard", {
            headers: {
                "x-admin-password": adminPassword
            }
        });

        if (!response.ok) {
            throw new Error("Błędne hasło");
        }

        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("dashboard").style.display = "block";

        renderDashboard(await response.json());

    } catch {

        adminPassword = "";

        document.getElementById("loginError").textContent =
            "❌ Błędne hasło administratora.";

    }
}

async function loadDashboard() {

    try {

        const response = await fetch("/api/admin/dashboard", {
            headers: {
                "x-admin-password": adminPassword
            }
        });

        if (response.status === 401) {
            location.reload();
            return;
        }

        if (!response.ok) {
            throw new Error();
        }

        renderDashboard(await response.json());

    } catch {

        showToast("❌ Nie udało się pobrać danych.");

    }
}

function renderDashboard(data) {

    const orders = Array.isArray(data.orders)
        ? data.orders
        : [];

    document.getElementById("balance").textContent =
        money(data.balance);

    document.getElementById("ordersCount").textContent =
        orders.length;

    document.getElementById("earned").textContent =
        money(data.earned);

    document.getElementById("withdrawn").textContent =
        money(data.withdrawn);

    document.getElementById("lastUpdate").textContent =
        "Aktualizacja: " +
        new Date().toLocaleTimeString("pl-PL");

    renderOrders(orders);
}

function renderOrders(orders) {

    const box = document.getElementById("ordersList");

    if (!orders.length) {

        box.innerHTML = `
            <div class="empty">
                📦 Brak zamówień.
            </div>
        `;

        return;
    }

    box.innerHTML = orders
        .slice()
        .reverse()
        .map(order => {

            const status = order.status || "NEW";

            return `
                <div class="order">

                    <div>

                        <strong>
                            ${escapeHTML(order.id)}
                        </strong>

                        <span>
                            👤 ${escapeHTML(order.name)}
                        </span>

                        <span>
                            ✉️ ${escapeHTML(order.email)}
                        </span>

                        ${
                            order.address
                            ? `
                            <span>
                                📍 ${escapeHTML(order.address)}
                            </span>
                            `
                            : ""
                        }

                    </div>

                    <div>

                        <strong>
                            ${money(order.total)}
                        </strong>

                        <span>
                            ${
                                order.createdAt
                                ? new Date(order.createdAt)
                                    .toLocaleString("pl-PL")
                                : ""
                            }
                        </span>

                    </div>

                    <div>

                        <span class="status ${escapeHTML(status)}">
                            ${escapeHTML(status)}
                        </span>

                    </div>

                    <div class="actions">

                        ${
                            status !== "PAID"
                            ? `
                            <button
                                class="smallBtn"
                                onclick="setOrderStatus('${escapeHTML(order.id)}','PAID')"
                            >
                                ✓ OPŁACONE
                            </button>
                            `
                            : ""
                        }

                        ${
                            status !== "CANCELLED"
                            ? `
                            <button
                                class="smallBtn"
                                onclick="setOrderStatus('${escapeHTML(order.id)}','CANCELLED')"
                            >
                                ✕ ANULUJ
                            </button>
                            `
                            : ""
                        }

                        <button
                            class="smallBtn"
                            onclick="generateLabel('${escapeHTML(order.id)}')"
                        >
                            🏷️ ETYKIETA
                        </button>

                    </div>

                </div>
            `;

        })
        .join("");
}

async function setOrderStatus(id, status) {

    try {

        const response = await fetch(
            "/api/admin/order-status",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": adminPassword
                },

                body: JSON.stringify({
                    id,
                    status
                })
            }
        );

        if (!response.ok) {
            throw new Error();
        }

        showToast(
            status === "PAID"
                ? "✓ Zamówienie opłacone."
                : "✓ Zamówienie anulowane."
        );

        loadDashboard();

    } catch {

        showToast(
            "❌ Nie udało się zmienić statusu."
        );

    }
}

async function withdraw() {

    const amount = Number(
        document.getElementById("withdrawAmount").value
    );

    const method =
        document.getElementById("withdrawMethod").value;

    if (!amount || amount <= 0) {

        showToast("❌ Podaj prawidłową kwotę.");

        return;
    }

    try {

        const response = await fetch(
            "/api/admin/withdraw",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": adminPassword
                },

                body: JSON.stringify({
                    amount,
                    method
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Błąd wypłaty"
            );
        }

        document.getElementById("withdrawAmount").value = "";

        showToast(
            "✓ Żądanie wypłaty utworzone."
        );

        loadDashboard();

    } catch (error) {

        showToast(
            "❌ " + error.message
        );

    }
}

async function generateLabel(orderId) {

    try {

        const response = await fetch(
            "/api/orders/" +
            encodeURIComponent(orderId)
        );

        if (!response.ok) {
            throw new Error(
                "Nie znaleziono zamówienia."
            );
        }

        const order = await response.json();

        const label = `

<!DOCTYPE html>
<html lang="pl">

<head>

<meta charset="UTF-8">

<title>
Etykieta ${escapeHTML(order.id)}
</title>

<style>

body {
    margin: 0;
    padding: 20px;
    font-family: Arial, sans-serif;
    background: white;
    color: black;
}

.label {

    width: 100mm;
    min-height: 150mm;

    padding: 10mm;

    box-sizing: border-box;

    border: 2px solid black;

}

.logo {

    font-size: 25px;
    font-weight: 900;
    margin-bottom: 20px;

}

.logo span {
    color: #008cff;
}

.line {

    border-top: 1px solid black;
    margin: 15px 0;

}

.title {

    font-size: 18px;
    font-weight: 900;
    margin-bottom: 10px;

}

.info {

    font-size: 14px;
    line-height: 1.7;

}

.orderNumber {

    margin-top: 20px;

    font-size: 20px;

    font-weight: 900;

}

.barcode {

    margin-top: 25px;

    height: 45px;

    border: 3px solid black;

    background:
        repeating-linear-gradient(
            90deg,
            black 0,
            black 2px,
            white 2px,
            white 5px
        );

}

@media print {

    body {
        padding: 0;
    }

    .label {
        border: 2px solid black;
    }

}

</style>

</head>

<body>

<div class="label">

    <div class="logo">
        Printerlase<span>3D</span>
    </div>

    <div class="line"></div>

    <div class="title">
        ODBIORCA
    </div>

    <div class="info">

        <strong>
            ${escapeHTML(order.name)}
        </strong>

        <br>

        ${escapeHTML(order.address || "")}

        <br>

        ${escapeHTML(order.postalCode || "")}
        ${escapeHTML(order.city || "")}

        <br>

        ${escapeHTML(order.email)}

    </div>

    <div class="line"></div>

    <div class="title">
        ZAMÓWIENIE
    </div>

    <div class="info">

        Numer:
        ${escapeHTML(order.id)}

        <br>

        Kwota:
        ${money(order.total)}

        <br>

        Status:
        ${escapeHTML(order.status || "NEW")}

    </div>

    <div class="orderNumber">

        📦 PRZESYŁKA

    </div>

    <div class="barcode"></div>

</div>

<script>

window.onload = function() {
    window.print();
};

<\/script>

</body>

</html>

`;

        const win = window.open(
            "",
            "_blank",
            "width=800,height=900"
        );

        if (!win) {

            showToast(
                "❌ Przeglądarka zablokowała okno."
            );

            return;
        }

        win.document.open();

        win.document.write(label);

        win.document.close();

    } catch (error) {

        showToast(
            "❌ " + error.message
        );

    }
}

function showToast(text) {

    const toast =
        document.getElementById("toast");

    toast.textContent = text;

    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer =
        setTimeout(
            () => toast.classList.remove("show"),
            3000
        );
}

document
    .getElementById("adminPassword")
    .addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {
                login();
            }

        }
    );

</script>

</body>
</html>
```
