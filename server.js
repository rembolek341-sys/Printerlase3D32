const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "ZMIEN_TO_HASLO";

const DATA_FILE =
    path.join(__dirname, "store-data.json");

app.use(express.json({
    limit: "2mb"
}));

app.use(express.static(__dirname));


function loadData(){

    if(!fs.existsSync(DATA_FILE)){

        const data = {
            orders: [],
            withdrawals: []
        };

        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data,null,2)
        );

        return data;
    }

    try{

        return JSON.parse(
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            )
        );

    }catch{

        return {
            orders: [],
            withdrawals: []
        };

    }

}


function saveData(data){

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data,null,2)
    );

}


function adminOnly(req,res,next){

    const password =
        req.headers["x-admin-password"];

    if(
        !password ||
        password !== ADMIN_PASSWORD
    ){

        return res.status(401).json({
            error:"Brak autoryzacji."
        });

    }

    next();

}


app.get("/",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );

});


/*
==================================================
  UTWORZENIE ZAMÓWIENIA
==================================================
*/

app.post("/api/orders",(req,res)=>{

    const {
        name,
        email,
        shippingMethod,
        products,
        subtotal,
        discount,
        shipping,
        total
    } = req.body;

    if(
        !name ||
        !email ||
        !Array.isArray(products) ||
        products.length === 0
    ){

        return res.status(400).json({
            error:"Nieprawidłowe zamówienie."
        });

    }


    const data = loadData();

    const order = {

        id:
            "PL-" +
            Date.now(),

        name:
            String(name),

        email:
            String(email),

        shippingMethod:
            String(shippingMethod || ""),

        products,

        subtotal:
            Number(subtotal || 0),

        discount:
            Number(discount || 0),

        shipping:
            Number(shipping || 0),

        total:
            Number(total || 0),

        /*
          NOWE = zamówienie jeszcze
          niepotwierdzone jako opłacone.
        */

        status:
            "NEW",

        createdAt:
            new Date().toISOString()

    };


    data.orders.push(order);

    saveData(data);


    res.json({

        success:true,

        orderId:
            order.id

    });

});


/*
==================================================
  ADMIN DASHBOARD
==================================================
*/

app.get(
    "/api/admin/dashboard",
    adminOnly,
    (req,res)=>{

        const data =
            loadData();

        const paidOrders =
            data.orders.filter(
                order =>
                    order.status === "PAID"
            );


        const earned =
            paidOrders.reduce(
                (sum,order)=>
                    sum +
                    Number(order.total || 0),
                0
            );


        const withdrawn =
            data.withdrawals.reduce(
                (sum,item)=>
                    sum +
                    Number(item.amount || 0),
                0
            );


        const balance =
            Math.max(
                0,
                earned - withdrawn
            );


        res.json({

            balance:
                Number(balance.toFixed(2)),

            earned:
                Number(earned.toFixed(2)),

            withdrawn:
                Number(withdrawn.toFixed(2)),

            orders:
                data.orders

        });

    }
);


/*
==================================================
  ZMIANA STATUSU ZAMÓWIENIA
==================================================
*/

app.post(
    "/api/admin/order-status",
    adminOnly,
    (req,res)=>{

        const {
            id,
            status
        } = req.body;


        const allowed =
            [
                "NEW",
                "PAID",
                "CANCELLED"
            ];


        if(
            !id ||
            !allowed.includes(status)
        ){

            return res.status(400).json({
                error:"Nieprawidłowe dane."
            });

        }


        const data =
            loadData();


        const order =
            data.orders.find(
                item =>
                    item.id === id
            );


        if(!order){

            return res.status(404).json({
                error:"Nie znaleziono zamówienia."
            });

        }


        order.status =
            status;


        order.updatedAt =
            new Date().toISOString();


        saveData(data);


        res.json({
            success:true
        });

    }
);


/*
==================================================
  WYPŁATA
==================================================
*/

app.post(
    "/api/admin/withdraw",
    adminOnly,
    (req,res)=>{

        const amount =
            Number(req.body.amount);

        const method =
            String(req.body.method || "bank");


        if(
            !Number.isFinite(amount) ||
            amount <= 0
        ){

            return res.status(400).json({
                error:"Nieprawidłowa kwota."
            });

        }


        const data =
            loadData();


        const earned =
            data.orders
                .filter(
                    order =>
                        order.status === "PAID"
                )
                .reduce(
                    (sum,order)=>
                        sum +
                        Number(order.total || 0),
                    0
                );


        const withdrawn =
            data.withdrawals
                .reduce(
                    (sum,item)=>
                        sum +
                        Number(item.amount || 0),
                    0
                );


        const balance =
            earned - withdrawn;


        if(amount > balance){

            return res.status(400).json({
                error:
                    `Masz tylko ${balance.toFixed(2)} zł dostępnego salda.`
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
                "REQUESTED",

            createdAt:
                new Date().toISOString()

        };


        data.withdrawals.push(
            withdrawal
        );


        saveData(data);


        res.json({

            success:true,

            withdrawal

        });

    }
);


/*
==================================================
  404
==================================================
*/

app.use((req,res)=>{

    res.status(404).send(`
        <h1>404</h1>
        <p>Nie znaleziono strony.</p>
        <a href="/">Wróć do sklepu</a>
    `);

});


app.listen(PORT,()=>{

    console.log("");
    console.log("=================================");
    console.log("       PRINTERLASE3D");
    console.log("=================================");
    console.log(
        `Sklep działa na porcie ${PORT}`
    );
    console.log("");

});
