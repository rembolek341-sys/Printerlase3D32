const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Obsługa JSON
app.use(express.json());

// Udostępnianie wszystkich plików sklepu
app.use(express.static(__dirname));

// Strona główna
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Obsługa błędów
app.use((req, res) => {
    res.status(404).send(`
        <h1>404</h1>
        <p>Nie znaleziono strony.</p>
        <a href="/">Wróć do sklepu</a>
    `);
});

app.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log("   PRINTERLASE3D");
    console.log("=================================");
    console.log(`Sklep działa: http://localhost:${PORT}`);
    console.log("");
});