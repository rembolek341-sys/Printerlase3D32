const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MODEL_DIR = path.join(UPLOAD_DIR, "models");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

for (const dir of [DATA_DIR, UPLOAD_DIR, MODEL_DIR]) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

function readOrders() {
    try {
        return JSON.parse(
            fs.readFileSync(ORDERS_FILE, "utf8")
        );
    } catch {
        return [];
    }
}

function saveOrders(orders) {
    fs.writeFileSync(
        ORDERS_FILE,
        JSON.stringify(orders, null, 2),
        "utf8"
    );
}

let orders = readOrders();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.use(
    "/uploads",
    express.static(UPLOAD_DIR)
);

/* =========================
   MULTER
========================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, MODEL_DIR);
    },

    filename: (req, file, cb) => {
        const ext = path
            .extname(file.originalname)
            .toLowerCase();

        const safeName =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10) +
            ext;

        cb(null, safeName);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 50 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const ext = path
            .extname(file.originalname)
            .toLowerCase();

        const allowed = [
            ".stl",
            ".obj",
            ".3mf"
        ];

        if (!allowed.includes(ext)) {
            return cb(
                new Error(
                    "Dozwolone formaty: STL, OBJ, 3MF."
                )
            );
        }

        cb(null, true);
    }
});

/* =========================
   ADMIN AUTH
========================= */

function adminAuth(req, res, next) {
    const password =
        req.headers["x-admin-password"];

    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Brak autoryzacji."
        });
    }

    next();
}

/* =========================
   PRODUCTS
========================= */

const products = [
    {
        id: "brelok3d",
        name: "Brelok 3D",
        price: 15,
        category: "Breloki",
        description:
            "Personalizowany brelok drukowany w 3D.",
        time: "1–2 godz.",
        icon: "🔑"
    },
    {
        id: "figurki",
        name: "Figurka 3D",
        price: 35,
        category: "Figurki",
        description:
            "Mała figurka wykonana na zamówienie.",
        time: "3–5 godz.",
        icon: "🗿"
    },
    {
        id: "napis",
        name: "Napis 3D",
        price: 25,
        category: "Dekoracje",
        description:
            "Dekoracyjny napis 3D do pokoju.",
        time: "2–4 godz.",
        icon: "✨"
    },
    {
        id: "uchwyt",
        name: "Uchwyt 3D",
        price: 30,
        category: "Dodatki",
        description:
            "Praktyczny uchwyt drukowany 3D.",
        time: "2–4 godz.",
        icon: "🛠️"
    }
];

app.get("/api/products", (req, res) => {
    res.json(products);
});

/* =========================
   CUSTOM MODEL
========================= */

app.post(
    "/api/custom-model",
    upload.single("model"),
    (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "Nie przesłano modelu 3D."
                });
            }

            const id =
                "CUSTOM-" +
                Date.now()
                    .toString()
                    .slice(-8);

            const order = {
                id,
                type: "CUSTOM_MODEL",

                name:
                    String(req.body.name || "")
                    .trim(),

                email:
                    String(req.body.email || "")
                    .trim(),

                phone:
                    String(req.body.phone || "")
                    .trim(),

                description:
                    String(
                        req.body.description || ""
                    ).trim(),

                originalFileName:
                    req.file.originalname,

                fileName:
                    req.file.filename,

                fileUrl:
                    "/uploads/models/" +
                    req.file.filename,

                total: 0,

                status: "NEW",

                createdAt:
                    new Date().toISOString()
            };

            orders.push(order);
            saveOrders(orders);

            console.log(
                "Nowy model 3D:",
                order.id,
                order.originalFileName
            );

            res.json({
                success: true,
                orderId: order.id
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    error.message ||
                    "Błąd serwera."
            });
        }
    }
);

/* =========================
   NORMAL ORDER
========================= */

app.post("/api/orders", (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            address,
            city,
            postalCode,
            items,
            total,
            discount
        } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                error:
                    "Podaj imię i e-mail."
            });
        }

        const order = {
            id:
                "ORD-" +
                Date.now()
                    .toString()
                    .slice(-8),

            type: "ORDER",

            name,
            email,
            phone: phone || "",
            address: address || "",
            city: city || "",
            postalCode: postalCode || "",

            items:
                Array.isArray(items)
                    ? items
                    : [],

            total:
                Number(total || 0),

            discount:
                Number(discount || 0),

            status: "NEW",

            createdAt:
                new Date().toISOString()
        };

        orders.push(order);
        saveOrders(orders);

        res.json({
            success: true,
            orderId: order.id
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Błąd składania zamówienia."
        });
    }
});

/* =========================
   ADMIN DASHBOARD
========================= */

app.get(
    "/api/admin/dashboard",
    adminAuth,
    (req, res) => {
        const currentOrders = readOrders();

        orders = currentOrders;

        const earned =
            currentOrders
                .filter(
                    o => o.status === "PAID"
                )
                .reduce(
                    (sum, o) =>
                        sum + Number(o.total || 0),
                    0
                );

        const balance =
            currentOrders
                .filter(
                    o =>
                        o.status !==
                        "CANCELLED"
                )
                .reduce(
                    (sum, o) =>
                        sum + Number(o.total || 0),
                    0
                );

        res.json({
            balance,
            earned,
            withdrawn: 0,
            orders: currentOrders
        });
    }
);

/* =========================
   STATUS ORDER
========================= */

app.post(
    "/api/admin/order-status",
    adminAuth,
    (req, res) => {
        const {
            id,
            status
        } = req.body;

        const order =
            orders.find(
                o => o.id === id
            );

        if (!order) {
            return res.status(404).json({
                error:
                    "Nie znaleziono zamówienia."
            });
        }

        const allowed = [
            "NEW",
            "PAID",
            "CANCELLED",
            "PROCESSING",
            "SHIPPED",
            "COMPLETED"
        ];

        if (!allowed.includes(status)) {
            return res.status(400).json({
                error:
                    "Nieprawidłowy status."
            });
        }

        order.status = status;

        saveOrders(orders);

        res.json({
            success: true,
            order
        });
    }
);

/* =========================
   ADMIN FILE DOWNLOAD
========================= */

app.get(
    "/api/admin/model/:id",
    adminAuth,
    (req, res) => {
        const order =
            orders.find(
                o =>
                    o.id ===
                    req.params.id
            );

        if (
            !order ||
            order.type !==
                "CUSTOM_MODEL"
        ) {
            return res.status(404).send(
                "Nie znaleziono modelu."
            );
        }

        const file =
            path.join(
                MODEL_DIR,
                order.fileName
            );

        if (!fs.existsSync(file)) {
            return res.status(404).send(
                "Plik już nie istnieje."
            );
        }

        res.download(
            file,
            order.originalFileName
        );
    }
);

/* =========================
   ADMIN PAGE
========================= */

app.get("/admin", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "admin.html"
        )
    );
});

/* =========================
   ERRORS
========================= */

app.use(
    (error, req, res, next) => {
        console.error(error);

        res.status(400).json({
            error:
                error.message ||
                "Nieprawidłowe żądanie."
        });
    }
);

app.listen(PORT, () => {
    console.log(
        `Printerlase3D działa na porcie ${PORT}`
    );
});
