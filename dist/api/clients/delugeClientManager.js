"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const delugeClient_1 = require("./delugeClient");
class DelugeClientManager {
    static instance;
    delugeClient = null;
    baseUrl = '';
    password = '';
    constructor() { }
    static getInstance() {
        if (!DelugeClientManager.instance) {
            DelugeClientManager.instance = new DelugeClientManager();
        }
        return DelugeClientManager.instance;
    }
    initialize(baseUrl, password) {
        this.baseUrl = baseUrl;
        this.password = password;
        this.delugeClient = null;
    }
    async getClient() {
        if (!this.delugeClient) {
            if (!this.baseUrl || !this.password) {
                console.warn('DelugeClientManager not initialized with baseUrl or password, attempting to use environment variables as fallback.');
                try {
                    const { env } = await Promise.resolve().then(() => __importStar(require('../../config/env')));
                    this.baseUrl = this.baseUrl || env.DELUGE_URL;
                    this.password = this.password || env.DELUGE_PASSWORD;
                    console.log(`Using Deluge URL from environment: ${this.baseUrl}`);
                }
                catch (error) {
                    console.error('Failed to load environment variables for Deluge fallback:', error);
                    throw new Error('DelugeClientManager not initialized and failed to load environment fallback. Please check configuration.');
                }
            }
            if (!this.baseUrl || !this.password) {
                throw new Error('DelugeClientManager not initialized with valid baseUrl or password, and no fallback available.');
            }
            console.log(`Initializing DelugeClient with base URL: ${this.baseUrl}`);
            this.delugeClient = new delugeClient_1.DelugeClient(this.baseUrl, this.password);
            await this.delugeClient.login();
        }
        return this.delugeClient;
    }
    reset() {
        this.delugeClient = null;
    }
}
exports.default = DelugeClientManager;
