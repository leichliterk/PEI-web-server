const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const dotenv = require("dotenv");
dotenv.config();
const connectToMongo = require('./src/config/db');
const cors = require('cors');
const { initializeWebSocket } = require('./src/websocket');
const Tenant = require('./src/models/tenant.model');
const ConnectionSession = require('./src/models/connectionSession.model');

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Welcome to PEI-DATA-API!");
});

const dataRouter = require('./src/routes/data.routes');
app.use('/api/data', dataRouter);

// Initialize WebSocket server
const io = initializeWebSocket(server);
app.set('io', io);

async function startServer() {
    await connectToMongo();

    // Reset all site connection statuses on startup — the in-memory
    // connection manager is empty at this point, so MongoDB must match.
    try {
        const result = await Tenant.updateMany(
            {},
            { $set: { 'sites.$[].connection_status': false } }
        );
        console.log(`Startup: reset connection_status to false for ${result.modifiedCount} tenant(s)`);
    } catch (error) {
        console.error('Startup: failed to reset connection statuses:', error);
    }

    // Close any sessions that were still open when the server last crashed.
    // Uses an aggregation-pipeline update so duration_ms is computed per-document.
    try {
        const now = new Date();
        const result = await ConnectionSession.updateMany(
            { disconnected_at: null },
            [{ $set: {
                disconnected_at: now,
                duration_ms: { $subtract: [now, '$connected_at'] },
                disconnect_reason: 'server_crash'
            }}]
        );
        if (result.modifiedCount > 0) {
            console.log(`Startup: closed ${result.modifiedCount} orphaned session(s) from previous crash`);
        }
    } catch (error) {
        console.error('Startup: failed to close orphaned sessions:', error);
    }

    server.listen(process.env.PORT || 443, () => {
        console.log("PEI-DATA-API is listening on port 443.....");
    });
}

startServer();

module.exports = { app, server };