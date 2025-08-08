"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.local' });
const envSchema = zod_1.z.object({
    DISCORD_TOKEN: zod_1.z.string().min(1),
    DISCORD_CLIENT_ID: zod_1.z.string().min(1),
    DISCORD_GUILD_ID: zod_1.z.string().min(1),
    DELUGE_HOST: zod_1.z.string().min(1),
    DELUGE_PORT: zod_1.z.number(),
    DELUGE_RPC_URL: zod_1.z.string().min(1),
    DELUGE_PASSWORD: zod_1.z.string().min(1),
    DELUGE_URL: zod_1.z.string().min(1),
    MAM_ID: zod_1.z.string().min(1),
    MAM_USERNAME: zod_1.z.string().min(1),
    MAM_PASSWORD: zod_1.z.string().min(1),
    MAM_COOKIE: zod_1.z.string().min(1),
    MAM_BASE_URL: zod_1.z.string().url().default('https://www.myanonamouse.net'),
    DOWNLOADS_DIRECTORY: zod_1.z.string().min(1).default('/mnt/nas/nzbget/nzb/completed/torrent'),
    HTTP_PORT: zod_1.z.number().default(3000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    GOOGLE_SERVICE_ACCOUNT_PATH: zod_1.z.string().min(1),
    GOOGLE_DRIVE_FOLDER_ID: zod_1.z.string().min(1),
    OLLAMA_PRIMARY_HOST: zod_1.z.string().min(1),
    OLLAMA_PRIMARY_MODEL: zod_1.z.string().min(1),
    OLLAMA_SECONDARY_HOST: zod_1.z.string().min(1),
    OLLAMA_SECONDARY_MODEL: zod_1.z.string().min(1),
});
const envWithNumbers = {
    ...process.env,
    DELUGE_PORT: process.env.DELUGE_PORT ? parseInt(process.env.DELUGE_PORT, 10) : undefined,
    HTTP_PORT: process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT, 10) : 3000
};
const parsedEnv = envSchema.safeParse(envWithNumbers);
if (!parsedEnv.success) {
    console.error('Invalid environment variables:', parsedEnv.error.flatten());
    throw new Error('Invalid environment variables');
}
exports.env = parsedEnv.data;
//# sourceMappingURL=env.js.map