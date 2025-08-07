"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.get('/list', async (_req, res) => {
    res.status(410).json({
        error: 'This endpoint has been removed. Use /gdrive-upload, /getebook, or /getaudiobook commands instead.',
        message: 'The listdownloads functionality has been consolidated into the unified upload system.'
    });
});
router.get('/file/:filename', async (_req, res) => {
    res.status(410).json({
        error: 'This endpoint has been removed. Use /gdrive-upload, /getebook, or /getaudiobook commands instead.',
        message: 'The listdownloads functionality has been consolidated into the unified upload system.'
    });
});
exports.default = router;
//# sourceMappingURL=downloads.js.map