const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const dotenv = require("dotenv");
dotenv.config();
const connectToMongo = require('./src/config/db');
const cors = require('cors');
const { initializeWebSocket } = require('./src/websocket');

app.use(cors());
app.use(express.json());

connectToMongo();

app.get("/", (req, res) => { 
    res.send("Welcome to PEI-DATA-API!"); 
});

const dataRouter = require('./src/routes/data.routes');

app.use('/api/data', dataRouter);

// Initialize WebSocket server
const io = initializeWebSocket(server);
app.set('io', io);

server.listen(process.env.PORT || 443, () => {
    console.log("PEI-DATA-API is listening on port 443.....");
});

module.exports = { app, server };