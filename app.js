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
    res.send("Welcome to CMM-API!"); 
});

const cmmRouter = require('./src/routes/cmm.routes');

app.use('/api/sam', cmmRouter);

app.listen(process.env.PORT || 443, () => {
    console.log("CMM-API is listening on port 443.....");
});

module.exports = app;