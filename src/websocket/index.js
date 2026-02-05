const { Server } = require('socket.io');
const authMiddleware = require('./middleware/auth.middleware');
const connectionHandler = require('./handlers/connection.handler');
const heartbeatHandler = require('./handlers/heartbeat.handler');
const webHandler = require('./handlers/web.handler');
const namespaceRegistry = require('./namespaceRegistry');

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
        pingTimeout: 30000,      // 30 seconds before considering disconnected
        pingInterval: 10000      // Send ping every 10 seconds
    });

    // Namespace for desktop clients
    const desktopNamespace = io.of('/api/data/desktop');

    // Apply authentication middleware
    desktopNamespace.use(authMiddleware);

    // Handle desktop connections
    desktopNamespace.on('connection', (socket) => {
        connectionHandler.onConnect(socket, desktopNamespace);

        socket.on('heartbeat', (data) => heartbeatHandler.onHeartbeat(socket, data));
        socket.on('status_update', (data) => connectionHandler.onStatusUpdate(socket, data));
        socket.on('disconnect', (reason) => connectionHandler.onDisconnect(socket, reason));
    });

    // Namespace for web clients
    const webNamespace = io.of('/api/data/web');
    namespaceRegistry.setWebNamespace(webNamespace);

    // Handle web client connections
    webNamespace.on('connection', (socket) => {
        webHandler.onConnect(socket);

        socket.on('subscribe_tenant', (data) => webHandler.onSubscribeTenant(socket, data));
        socket.on('unsubscribe_tenant', (data) => webHandler.onUnsubscribeTenant(socket, data));
        socket.on('disconnect', (reason) => webHandler.onDisconnect(socket, reason));
    });

    console.log('WebSocket server initialized on /api/data/desktop and /api/data/web namespaces');

    return io;
}

module.exports = { initializeWebSocket };
