"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const env_1 = require("../config/env");
class Logger {
    static prefix = '[BookBot]';
    static info(message, ...args) {
        if (env_1.env.NODE_ENV === 'production')
            return;
        console.info(this.prefix, message, ...args);
    }
    static error(message, ...args) {
        console.error(this.prefix, message, ...args);
    }
    static warn(message, ...args) {
        if (env_1.env.NODE_ENV === 'production')
            return;
        console.warn(this.prefix, message, ...args);
    }
    static debug(message, ...args) {
        if (env_1.env.NODE_ENV !== 'development')
            return;
        console.debug(this.prefix, message, ...args);
    }
}
exports.Logger = Logger;
exports.default = Logger;
//# sourceMappingURL=logger.js.map