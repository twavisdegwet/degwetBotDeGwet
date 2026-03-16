"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("../config/env");
require("../discord/index");
const app = (0, express_1.default)();
exports.app = app;
const PORT = env_1.env.HTTP_PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (_, res) => {
    res.json({
        message: 'Welcome to the Discord BookBot API',
        status: 'OK'
    });
});
app.get('/health', (_, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/mam', require('./routes/mam').default);
app.use('/api/downloads', require('./routes/downloads').default);
app.use('/api/uploads', require('./routes/uploads').default);
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
exports.server = server;
