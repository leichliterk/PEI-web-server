const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { Redis } = require('ioredis');
const authMiddleware = require('./middleware/auth.middleware');
const connectionHandler = require('./handlers/connection.handler');
const webHandler = require('./handlers/web.handler');
const fileHandler = require('./handlers/file.handler');
const otaHandler = require('./handlers/ota.handler');
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
        pingTimeout: 30000,         // 30 seconds before considering disconnected
        pingInterval: 10000,        // Send ping every 10 seconds
        maxHttpBufferSize: 50 * 1024 * 1024  // 50MB max message size
    });

    // Enable Redis adapter for multi-instance support if REDIS_URL is set
    if (process.env.REDIS_URL) {
        const pubClient = new Redis(process.env.REDIS_URL);
        const subClient = pubClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        console.log('Socket.io Redis adapter enabled');
    } else {
        console.log('Socket.io running in single-instance mode (no REDIS_URL set)');
    }

    // Namespace for desktop clients
    const desktopNamespace = io.of('/api/data/desktop');
    namespaceRegistry.setDesktopNamespace(desktopNamespace);

    // Apply authentication middleware
    desktopNamespace.use(authMiddleware);

    // Handle desktop connections
    desktopNamespace.on('connection', (socket) => {
        connectionHandler.onConnect(socket, desktopNamespace);

        socket.on('ftp:file',      (data) => fileHandler.onFileUpload(socket, data));
        socket.on('ota:response',  (data) => otaHandler.onOtaResponse(socket, data));
        socket.on('ota:installed', (data) => otaHandler.onOtaInstalled(socket, data));
        socket.on('disconnect',    (reason) => connectionHandler.onDisconnect(socket, reason));
    });

    // Namespace for web clients
    const webNamespace = io.of('/api/data/web');
    namespaceRegistry.setWebNamespace(webNamespace);

    // Handle web client connections
    webNamespace.on('connection', (socket) => {
        webHandler.onConnect(socket);

        socket.on('subscribe_tenant', (data) => webHandler.onSubscribeTenant(socket, data));
        socket.on('unsubscribe_tenant', (data) => webHandler.onUnsubscribeTenant(socket, data));
        socket.on('user:identify', (data) => webHandler.onUserIdentify(socket, data));
        socket.on('notification:read', (data) => webHandler.onNotificationRead(socket, data));
        socket.on('disconnect', (reason) => webHandler.onDisconnect(socket, reason));
    });

    console.log('WebSocket server initialized on /api/data/desktop and /api/data/web namespaces');

    return io;
}

module.exports = { initializeWebSocket };
