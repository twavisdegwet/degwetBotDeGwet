import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env.local file
dotenv.config({ path: '.env.local' });

// Define the environment variable schema
const envSchema = z.object({
  // Discord Bot Configuration
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  
  // Deluge Configuration
  DELUGE_HOST: z.string().min(1),
  DELUGE_PORT: z.number(),
  DELUGE_RPC_URL: z.string().min(1),
  DELUGE_PASSWORD: z.string().min(1),
  DELUGE_URL: z.string().min(1),
  
  // MyAnonaMouse Configuration
  MAM_ID: z.string().min(1),
  MAM_USERNAME: z.string().min(1),
  MAM_PASSWORD: z.string().min(1),
  MAM_COOKIE: z.string().min(1),
  MAM_BASE_URL: z.string().url().default('https://www.myanonamouse.net'),
  
  // Download Directory Configuration
  DOWNLOADS_DIRECTORY: z.string().min(1).default('/mnt/nas/nzbget/nzb/completed/torrent'),
  
  // HTTP Server Configuration (for local dev)
  HTTP_PORT: z.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Google Drive Configuration (Service Account)
  GOOGLE_SERVICE_ACCOUNT_PATH: z.string().min(1),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
  
  // Ollama Configuration
  OLLAMA_HOST: z.string().min(1),
  OLLAMA_MODEL: z.string().min(1),
});

// Define the type for our environment variables
export type Env = z.infer<typeof envSchema>;

// Validate and parse the environment variables
// Convert numeric environment variables to numbers before validation
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

export const env = parsedEnv.data;
