"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kindleEmailMappings = exports.env = void 0;
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
    MAM_BASE_URL: zod_1.z.string().url().default('https://www.myanonamouse.net'),
    DOWNLOADS_DIRECTORY: zod_1.z.string().min(1).default('/mnt/nas/nzbget/nzb/completed/torrent'),
    HTTP_PORT: zod_1.z.number().default(3000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    NZBHYDRA_URL: zod_1.z.string().url(),
    NZBHYDRA_API_KEY: zod_1.z.string(),
    SABNZBD_URL: zod_1.z.string().url(),
    SABNZBD_API_KEY: zod_1.z.string(),
    GOOGLE_SERVICE_ACCOUNT_PATH: zod_1.z.string().min(1),
    GOOGLE_DRIVE_FOLDER_ID: zod_1.z.string().min(1),
    OLLAMA_PRIMARY_HOST: zod_1.z.string().min(1),
    OLLAMA_PRIMARY_MODEL: zod_1.z.string().min(1),
    OLLAMA_SECONDARY_HOST: zod_1.z.string().min(1),
    OLLAMA_SECONDARY_MODEL: zod_1.z.string().min(1),
    HARDCOVER_API_URL: zod_1.z.string().url().default('https://api.hardcover.app/v1/graphql'),
    HARDCOVER_API_TOKEN: zod_1.z.string().min(1),
    COMIC_IMAGE_PATH: zod_1.z.string().min(1).default('/home/twavisdegwet/heathcliff project/comics'),
    KINDLE_BOT_EMAIL: zod_1.z.string().email().optional(),
    KINDLE_EMAIL_MAPPINGS: zod_1.z.string().optional(),
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
exports.kindleEmailMappings = (() => {
    if (!exports.env.KINDLE_EMAIL_MAPPINGS) {
        return {};
    }
    try {
        const mappings = JSON.parse(exports.env.KINDLE_EMAIL_MAPPINGS);
        if (typeof mappings !== 'object' || mappings === null || Array.isArray(mappings)) {
            console.error('KINDLE_EMAIL_MAPPINGS must be a JSON object');
            return {};
        }
        for (const [key, value] of Object.entries(mappings)) {
            if (typeof key !== 'string' || typeof value !== 'string') {
                console.error('KINDLE_EMAIL_MAPPINGS must have string keys and values');
                return {};
            }
        }
        return mappings;
    }
    catch (error) {
        console.error('Failed to parse KINDLE_EMAIL_MAPPINGS:', error);
        return {};
    }
})();
