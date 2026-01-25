const { Server } = require('socket.io');
const authMiddleware = require('./middleware/auth.middleware');
const connectionHandler = require('./handlers/connection.handler');
const heartbeatHandler = require('./handlers/heartbeat.handler');

/**
 * Initialize WebSocket server with Socket.io
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
function initializeWebSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        pingTimeout: 60000,      // 60 seconds before considering disconnected
        pingInterval: 25000      // Send ping every 25 seconds
    });

    // Namespace for desktop clients
    const desktopNamespace = io.of('/api/data/desktop');

    // Apply authentication middleware
    desktopNamespace.use(authMiddleware);

    // Handle connections
    desktopNamespace.on('connection', (socket) => {
        connectionHandler.onConnect(socket, desktopNamespace);

        socket.on('heartbeat', (data) => heartbeatHandler.onHeartbeat(socket, data));
        socket.on('status_update', (data) => connectionHandler.onStatusUpdate(socket, data));
        socket.on('disconnect', (reason) => connectionHandler.onDisconnect(socket, reason));
    });

    console.log('WebSocket server initialized on /api/data/desktop namespace');

    return io;
}

module.exports = { initializeWebSocket };
