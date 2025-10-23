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

  // NZB Configuration
  NZBHYDRA_URL: z.string().url(),
  NZBHYDRA_API_KEY: z.string(),
  SABNZBD_URL: z.string().url(),
  SABNZBD_API_KEY: z.string(),

  // Google Drive Configuration (Service Account)
  GOOGLE_SERVICE_ACCOUNT_PATH: z.string().min(1),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
  
  // Ollama Configuration
  OLLAMA_PRIMARY_HOST: z.string().min(1),
  OLLAMA_PRIMARY_MODEL: z.string().min(1),
  OLLAMA_SECONDARY_HOST: z.string().min(1),
  OLLAMA_SECONDARY_MODEL: z.string().min(1),
  
  // Hardcover API Configuration
  HARDCOVER_API_URL: z.string().url().default('https://api.hardcover.app/v1/graphql'),
  HARDCOVER_API_TOKEN: z.string().min(1),
  
  // Comic Image Path Configuration
  COMIC_IMAGE_PATH: z.string().min(1).default('/home/twavisdegwet/heathcliff project/comics'),

  // Email Configuration (for Send to Kindle via Gmail API)
  // Uses the same service account as Google Drive with domain-wide delegation
  // Create a dedicated Google Workspace user (e.g., bot@yourdomain.com) for sending emails
  // This user must be authorized in Amazon Kindle's approved email list
  KINDLE_BOT_EMAIL: z.string().email().optional(), // The Google Workspace bot user to send emails as

  // Kindle Email Mappings (Discord ID to Kindle Email)
  // JSON string mapping Discord user IDs to their Kindle email addresses
  // Example: '{"214899404627378176":"travistreed_cf4fc8@kindle.com"}'
  KINDLE_EMAIL_MAPPINGS: z.string().optional(),
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

// Parse and export Kindle email mappings
export const kindleEmailMappings: Record<string, string> = (() => {
  if (!env.KINDLE_EMAIL_MAPPINGS) {
    return {};
  }

  try {
    const mappings = JSON.parse(env.KINDLE_EMAIL_MAPPINGS);

    // Validate that it's an object with string keys and values
    if (typeof mappings !== 'object' || mappings === null || Array.isArray(mappings)) {
      console.error('KINDLE_EMAIL_MAPPINGS must be a JSON object');
      return {};
    }

    // Validate all entries are strings
    for (const [key, value] of Object.entries(mappings)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        console.error('KINDLE_EMAIL_MAPPINGS must have string keys and values');
        return {};
      }
    }

    return mappings as Record<string, string>;
  } catch (error) {
    console.error('Failed to parse KINDLE_EMAIL_MAPPINGS:', error);
    return {};
  }
})();
