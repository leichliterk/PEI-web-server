const express = require('express');
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const connectToMongo = require('./src/config/db');
const cors = require('cors');

app.use(cors());
app.use(express.json());

connectToMongo();

app.get("/", (req, res) => { 
    res.send("Welcome to PEI-DATA-API!"); 
});

const dataRouter = require('./src/routes/data.routes');

app.use('/api/data', dataRouter);

app.listen(process.env.PORT || 443, () => {
    console.log("PEI-DATA-API is listening on port 443.....");
});

module.exports = app;