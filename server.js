```js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "models");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CUSTOM_FILE =
    path.join(DATA_DIR, "custom-models.json");

if (!fs.existsSync(CUSTOM_FILE)) {
    fs.writeFileSync(
        CUSTOM_FILE,
        "[]",
        "utf8"
    );
}

const storage = multer.diskStorage({

    destination(req, file, cb) {

        cb(null, UPLOAD_DIR);

    },

    filename(req, file, cb) {

        const safe =
            file.originalname
                .replace(/[^a-zA-Z0-9._-]/g, "_");

        cb(
            null,
            Date.now() + "-" + safe
        );

    }

});

const upload = multer({

    storage,

    limits:{
        fileSize:50 * 1024 * 1024
    },

    fileFilter(req,file,cb){

        const allowed = [
            ".stl",
            ".obj",
            ".3mf"
        ];

        const ext =
            path.extname(
                file.originalname
            ).toLowerCase();

        if(allowed.includes(ext)){

            cb(null,true);

        }else{

            cb(
                new Error(
                    "Dozwolone są tylko STL, OBJ i 3MF."
                )
            );

        }

    }

});


app.use(express.json());

app.use(
    express.urlencoded({
        extended:true
    })
);

app.use(
    express.static(__dirname)
);


/* =========================
   WŁASNY MODEL 3D
========================= */

app.post(
    "/api/custom-model",
    upload.single("model"),
    (req,res) => {

        try{

            const {
                name,
                email,
                title,
                description,
                quantity
            } = req.body;

            if(
                !name ||
                !email ||
                !title ||
                !description
            ){

                return res.status(400).json({
                    error:
                        "Uzupełnij wymagane pola."
                });

            }

            let requests = [];

            try{

                requests =
                    JSON.parse(
                        fs.readFileSync(
                            CUSTOM_FILE,
                            "utf8"
                        )
                    );

            }catch{

                requests = [];

            }

            const request = {

                id:
                    "CUSTOM-" +
                    Date.now(),

                name:
                    String(name),

                email:
                    String(email),

                title:
                    String(title),

                description:
                    String(description),

                quantity:
                    Number(quantity) || 1,

                status:
                    "NOWE",

                createdAt:
                    new Date().toISOString(),

                file:
                    req.file
                        ? {
                            originalName:
                                req.file.originalname,

                            filename:
                                req.file.filename,

                            size:
                                req.file.size
                        }
                        : null

            };

            requests.push(request);

            fs.writeFileSync(
                CUSTOM_FILE,
                JSON.stringify(
                    requests,
                    null,
                    2
                ),
                "utf8"
            );

            return res.json({

                success:true,

                message:
                    "Projekt został wysłany.",

                id:
                    request.id

            });

        }catch(error){

            console.error(error);

            return res.status(500).json({

                error:
                    error.message ||
                    "Błąd serwera."

            });

        }

    }
);


/* =========================
   API DLA ADMINA
========================= */

app.get(
    "/api/admin/custom-models",
    (req,res) => {

        try{

            const requests =
                JSON.parse(
                    fs.readFileSync(
                        CUSTOM_FILE,
                        "utf8"
                    )
                );

            res.json(requests);

        }catch{

            res.json([]);

        }

    }
);


/* =========================
   PLIK MODELU
========================= */

app.get(
    "/api/admin/custom-model/:filename",
    (req,res) => {

        const filename =
            path.basename(
                req.params.filename
            );

        const filePath =
            path.join(
                UPLOAD_DIR,
                filename
            );

        if(!fs.existsSync(filePath)){

            return res
                .status(404)
                .send("Nie znaleziono pliku.");

        }

        res.download(filePath);

    }
);


/* =========================
   START
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Printerlase3D działa na porcie ${PORT}`
        );

    }
);
```
