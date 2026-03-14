# Discord Media Bot - Setup Guide

This guide covers all installation, configuration, and setup requirements for the Discord Media Bot.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [External Service Dependencies](#external-service-dependencies)
- [Configuration](#configuration)
- [Running the Bot](#running-the-bot)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)

---

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **FFmpeg**: Required for MP3→M4B audiobook conversion
- **Calibre**: Required for ebook format conversion (PDF/MOBI→EPUB)
- **Disk Space**: At least 50GB free space for torrent downloads and temporary processing

### Installation Commands

**FFmpeg:**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

**Calibre:**
```bash
# Ubuntu/Debian
sudo apt install calibre

# Fedora
sudo dnf install calibre
```

---

## Installation

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd discordBot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Copy Environment Template

```bash
cp .env.example .env.local
```

### Step 4: Place Setup Files

Ensure these files exist in the `samplefiles/` directory:

- `mp3tom4b.sh` - MP3 to M4B conversion script (requires FFmpeg)
- `ebookconvert.sh` - Ebook format conversion script (requires Calibre)

**Google Service Account Credentials:**

Minify your service account JSON file:
```bash
jq -c . service-account.json > service-account-min.json
```

Then copy the content into `.env.local` as `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

## External Service Dependencies

### Required Services

#### 1. Discord Bot Platform

**Setup:**
1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Navigate to the "Bot" section
4. Click "Add Bot"
5. Under "Token", click "Reset Token" to generate your bot token
6. Copy the token - this is your `DISCORD_TOKEN`
7. Under "Application ID", copy the numeric ID - this is your `DISCORD_CLIENT_ID`

**Permissions Needed:**
- Send Messages
- Use Slash Commands
- Embed Links
- Add Reactions
- Attach Files
- Read Message History

**Invite Bot to Server:**
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Administrator` (or select specific permissions above)
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to

**Required Environment Variables:**
- `DISCORD_TOKEN` - Your bot token
- `DISCORD_CLIENT_ID` - Your application ID
- `DISCORD_GUILD_ID` - Your server ID (found in Discord Developer Portal or by right-clicking your server icon)

---

#### 2. MyAnonaMouse (MAM) Private Tracker

**Setup:**
1. Create an account at https://www.myanonamouse.net (if you don't have one)
2. Log in to your account
3. Go to your profile → Preferences → API
4. Generate or copy your API key
5. **Important**: You'll need your session cookie (`mam_id`)

**Getting the `mam_id` Cookie:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Log in to MAM
4. Look for a request to `https://www.myanonamouse.net`
5. Find the `Cookie` header and extract the `mam_id` value
6. This value is what you need for `MAM_ID`

**Required Environment Variables:**
- `MAM_ID` - Your mam_id session cookie value
- `TORRENT_BASE_URL` - Set to `https://www.myanonamouse.net`

---

#### 3. Deluge BitTorrent Client

**Setup:**
1. Install Deluge on your server:
   ```bash
   # Ubuntu/Debian
   sudo apt install deluged deluge-web

   # Fedora
   sudo dnf install deluge deluge-web
   ```

2. Start Deluge daemon:
   ```bash
   deluged
   ```

3. Start Deluge Web UI:
   ```bash
   deluge-web
   ```

4. Configure Deluge Web UI:
   - Open http://localhost:8112 in your browser
   - Default password is usually "deluge"
   - Change the password in Preferences → Web Interface
   - Set your download directory in Preferences → Downloads
   - Ensure "Enable RPC" is checked

**Required Environment Variables:**
- `DELUGE_URL` - Full URL to Deluge Web UI (e.g., `http://192.168.2.124:8112/json`)
- `DELUGE_HOST` - Hostname or IP (e.g., `192.168.2.124`)
- `DELUGE_PORT` - Port number (e.g., `8112`)
- `DELUGE_PASSWORD` - Your Deluge Web UI password
- `DELUGE_RPC_URL` - RPC endpoint URL

---

#### 4. Google Drive

**Setup:**
1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Enable Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Fill in service account details
   - Click "Create and Continue"
   - Skip granting roles (can be added later)
   - Click "Done"
5. Generate JSON Key:
   - Find your service account in the credentials list
   - Click the three dots → "Manage keys"
   - Click "Add key" → "Create new key"
   - Select JSON format
   - Click "Create"
   - Save the downloaded JSON file

**Configure Shared Drive:**
1. Create a shared drive in Google Drive
2. Share the drive with your service account email (found in the JSON key file under `client_email`)
3. Give the service account "Manager" or "Content Manager" access

**Required Environment Variables:**
- `GOOGLE_SERVICE_ACCOUNT_JSON` - The entire service account JSON as a single-line string
- `GOOGLE_DRIVE_FOLDER_ID` - The ID of your shared drive (found in the URL: `https://drive.google.com/drive/u/0/folders/FOLDER_ID`)

**Minifying the JSON:**
```bash
# Using jq
jq -c . discord-service-account.json

# Using node
node -e "console.log(JSON.stringify(require('./discord-service-account.json')))"
```

---

#### 5. Gmail API (Send to Kindle)

**Setup:**
1. **Enable Gmail API:**
   - In the same Google Cloud project as Drive
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

2. **Create Bot User Account:**
   - Go to Google Workspace Admin Console
   - Navigate to Users → Add new user
   - Create a dedicated bot account (e.g., `bot@yourdomain.com`)
   - This account will be used to send emails

3. **Configure Domain-Wide Delegation:**
   - In Google Workspace Admin Console
   - Go to Security → API Controls → Domain-wide Delegation
   - Click "Add new"
   - **Client ID**: Enter your service account's Client ID (from the JSON key file)
   - **OAuth Scopes**: Enter `https://www.googleapis.com/auth/gmail.send`
   - Click "Authorize"

4. **Configure Amazon Kindle:**
   - Go to https://www.amazon.com/sendtokindle
   - Sign in to your Amazon account
   - Navigate to "Personal Document Settings"
   - Scroll to "Approved Personal Document E-mail List"
   - Click "Add a new e-mail address"
   - Enter your bot's email address (e.g., `bot@yourdomain.com`)
   - Click "Add Address"

**Required Environment Variables:**
- `KINDLE_BOT_EMAIL` - The bot user's email address (e.g., `bot@yourdomain.com`)

**Note**: The Gmail API uses the same service account as Google Drive via domain-wide delegation. No additional credentials are needed.

---

### Optional Services

#### AI Integration (Choose One or Both)

**1. Ollama (Local LLM):**

Setup:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Run Ollama
ollama serve
```

**Required Environment Variables:**
- `OLLAMA_PRIMARY_HOST` - Ollama server URL (e.g., `http://localhost:11434`)
- `OLLAMA_PRIMARY_MODEL` - Model name (e.g., `llama3.1`)
- `OLLAMA_PRIMARY_TYPE` - Server type (`'ollama'` for native Ollama)

**2. OpenAI-Compatible Server (llama-swap, llama.cpp, vLLM):**

**Required Environment Variables:**
- `OLLAMA_PRIMARY_HOST` - Server URL
- `OLLAMA_PRIMARY_MODEL` - Model name
- `OLLAMA_PRIMARY_TYPE` - Set to `'openai'`

**3. NVIDIA API (Optional Fallback):**

Get a key at https://build.nvidia.com and set:
- `NVIDIA_API_KEY` - Your NVIDIA API key

---

### Optional: Usenet Integration

**NZBHydra2:**

1. Install NZBHydra2
2. Configure API key in Settings → General
3. Set up your indexers

**Required Environment Variables:**
- `NZBH_YDRA2_URL` - NZBHydra2 URL (e.g., `http://localhost:5076`)
- `NZBH_YDRA2_API_KEY` - Your API key

**SABnzbd:**

1. Install SABnzbd
2. Configure API key in Settings → General

**Required Environment Variables:**
- `SABNZBD_URL` - SABnzbd URL
- `SABNZBD_API_KEY` - Your API key

---

### Optional: Bluesky Integration

**Setup:**
1. Go to https://bsky.app
2. Navigate to Settings → App Passwords
3. Create a new app password
4. Use this password for bot authentication

**Required Environment Variables:**
- `BLUESKY_HANDLE` - Your Bluesky handle
- `BLUESKY_PASSWORD` - Your app password

---

## Configuration

### Environment Variables (.env.local)

Copy the template and fill in your values:

```bash
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# MyAnonaMouse
MAM_ID=your_mam_cookie_value
TORRENT_BASE_URL=https://www.myanonamouse.net

# Deluge Configuration
DELUGE_URL=http://192.168.x.x:8112/json
DELUGE_HOST=192.168.x.x
DELUGE_PORT=8112
DELUGE_PASSWORD=your_deluge_password
DELUGE_RPC_URL=http://192.168.x.x:8112/json

# Google Drive (paste entire service account JSON as a single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}
GOOGLE_DRIVE_FOLDER_ID=your_shared_drive_id

# Send to Kindle (Gmail API - uses same service account)
KINDLE_BOT_EMAIL=bot@yourdomain.com

# File System
DOWNLOADS_DIRECTORY=/mnt/nas/nzbget/nzb/completed/torrent

# Ollama Primary (AI)
OLLAMA_PRIMARY_HOST=http://localhost:11434
OLLAMA_PRIMARY_MODEL=llama3.1
OLLAMA_PRIMARY_TYPE=ollama

# Ollama Secondary (Optional Fallback)
OLLAMA_SECONDARY_HOST=http://secondary-host:11434
OLLAMA_SECONDARY_MODEL=llama3.1
OLLAMA_SECONDARY_TYPE=ollama

# API Server
HTTP_PORT=3000

# Optional: NVIDIA API
NVIDIA_API_KEY=nvu_xxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Bluesky
BLUESKY_HANDLE=yourhandle.bsky.social
BLUESKY_PASSWORD=your-app-password
```

### Download Directory Configuration

The bot uses `DOWNLOADS_DIRECTORY` to monitor for completed downloads. Make sure:

1. The directory exists
2. Deluge is configured to download to this location
3. The bot process has read/write permissions

```bash
# Create directory if needed
sudo mkdir -p /mnt/nas/nzbget/nzb/completed/torrent

# Set permissions
sudo chown -R $(whoami):$(whoami) /mnt/nas/nzbget/nzb/completed/torrent
```

---

## Running the Bot

### Development Mode

Runs both the API server and Discord bot in watch mode:

```bash
npm run dev
```

### Production Mode

Build and run:

```bash
# Build TypeScript
npm run build

# Run production build
npm start
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start dist/index.js --name "discord-media-bot"

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Systemd Service (Alternative)

Create `/etc/systemd/system/discord-media-bot.service`:

```ini
[Unit]
Description=Discord Media Bot
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/discordBot
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl enable discord-media-bot
sudo systemctl start discord-media-bot
sudo systemctl status discord-media-bot
```

---

## Troubleshooting

### Discord Commands Not Appearing

**Symptoms:** Slash commands don't show up in Discord

**Solutions:**
1. Verify `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID` are correct
2. Check bot has proper permissions in server
3. Look for "Successfully reloaded application (/) commands" in startup logs
4. Try deleting and re-adding bot to server
5. Wait up to 1 hour for commands to register (Discord limitation)

### MAM Authentication Fails

**Symptoms:** "Authentication failed", "Invalid credentials"

**Solutions:**
1. Verify `MAM_ID` cookie is current and valid
2. Check if your session has expired - get a fresh `mam_id` cookie
3. Ensure MAM account has API access
4. Check your IP isn't blocked by MAM

### Deluge Connection Issues

**Symptoms:** "Connection refused", "Timeout", "Authentication failed"

**Solutions:**
1. Verify `DELUGE_URL`, `DELUGE_HOST`, `DELUGE_PORT`, and `DELUGE_PASSWORD`
2. Check Deluge Web UI is accessible from bot server:
   ```bash
   curl http://192.168.x.x:8112/json
   ```
3. Ensure Deluge daemon is running:
   ```bash
   systemctl status deluged
   systemctl status deluge-web
   ```
4. Check firewall allows connections to Deluge port
5. Verify Deluge Web UI password is correct

### Google Drive Upload Fails

**Symptoms:** "Permission denied", "Invalid API key", "File too large"

**Solutions:**
1. Verify service account JSON file is valid:
   ```bash
   node -e "console.log(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON))"
   ```
2. Check shared drive permissions - service account needs Manager access
3. Ensure shared drive ID is correct
4. Check if file exceeds Google Drive size limits
5. Verify Drive API is enabled in Google Cloud Console

### MP3→M4B Conversion Fails

**Symptoms:** "Conversion failed", "ffmpeg not found"

**Solutions:**
1. Verify FFmpeg is installed:
   ```bash
   ffmpeg --version
   ```
2. Check `mp3tom4b.sh` script exists and is executable:
   ```bash
   ls -la samplefiles/mp3tom4b.sh
   chmod +x samplefiles/mp3tom4b.sh
   ```
3. Ensure sufficient disk space for conversion
4. Check conversion logs for specific errors

### Ebook Conversion Fails

**Symptoms:** "ebook-convert not found", "Conversion failed"

**Solutions:**
1. Verify Calibre is installed:
   ```bash
   ebook-convert --version
   ```
2. Installation:
   ```bash
   # Fedora
   sudo dnf install calibre

   # Ubuntu/Debian
   sudo apt install calibre
   ```
3. Check `ebookconvert.sh` script exists and is executable:
   ```bash
   ls -la samplefiles/ebookconvert.sh
   chmod +x samplefiles/ebookconvert.sh
   ```
4. Ensure sufficient disk space

### Send to Kindle Fails

**Symptoms:** "unauthorized_client", "Email failed to send", "File too large"

**Solutions:**
1. Verify `KINDLE_BOT_EMAIL` is set in `.env.local`
2. Check Gmail API is enabled in Google Cloud Console
3. Verify domain-wide delegation is configured:
   - Client ID matches service account JSON
   - OAuth scope is `https://www.googleapis.com/auth/gmail.send`
4. Ensure bot email is on Amazon Kindle's approved list
5. Check file size is under 50MB (Amazon's limit)
6. Common error: "unauthorized_client" means domain-wide delegation not configured correctly

**Debug Domain-Wide Delegation:**
```bash
# Check service account client ID
cat discord-service-account.json | jq .client_id

# Verify in Google Workspace Admin Console
# Security → API Controls → Domain-wide Delegation
# Should show your Client ID with gmail.send scope
```

### Ollama/AI Connection Issues

**Symptoms:** "Connection refused", "Model not found"

**Solutions:**
1. Verify Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```
2. Check model is pulled:
   ```bash
   ollama list
   ollama pull llama3.1
   ```
3. Verify `OLLAMA_PRIMARY_HOST` and `OLLAMA_PRIMARY_MODEL` are correct
4. Check firewall allows connections to Ollama port

### General Debugging

**Check Service Status:**
```bash
curl http://localhost:3000/api/health
```

**View Logs:**
```bash
# Development mode
npm run dev

# PM2
pm2 logs discord-media-bot

# Systemd
sudo journalctl -u discord-media-bot -f
```

**Test Individual Services:**
```bash
# Test MAM connection
node test-mam-connection.js

# Test Deluge connection
node test-deluge-connection.js

# Test complete workflow
node test-mam-deluge-download.js
```

---

## Testing

### Build and Test

```bash
# Build project
npm run build

# Run Jest test suite
npm test
```

### Service Connection Tests

```bash
# Test MAM API connectivity
node test-mam-connection.js

# Test Deluge connectivity
node test-deluge-connection.js

# Test complete download workflow
node test-mam-deluge-download.js
```

### Test Coverage

- MAM API authentication and search
- Deluge torrent management
- End-to-end download workflow
- Google Drive upload functionality
- Discord bot command handling

---

## Performance Monitoring

### Target Performance Metrics

- **Search Response**: < 5 seconds
- **Download Initiation**: < 10 seconds
- **Upload Success Rate**: > 95%
- **Conversion Success Rate**: > 90%
- **User Command Response**: < 30 seconds

### Monitoring Tips

- Enable detailed logging in development mode
- Watch for webhook timeout warnings
- Monitor disk space usage
- Track conversion success/failure rates
- Check for rate limiting from external services

---

## Security Notes

### Environment Variables

**NEVER commit `.env.local` to version control!**

The `.env.local` file contains sensitive credentials and should be kept private. The `.gitignore` file should exclude it:

```bash
# Verify .env.local is ignored
cat .gitignore

# Should include: .env.local
```

### Service Account Security

- Keep service account JSON files secure
- Use minimal required permissions for service accounts
- Regularly rotate service account keys
- Monitor service account usage in Google Cloud Console

### Deluge Security

- Use strong passwords for Deluge Web UI
- Don't expose Deluge Web UI to the public internet
- Use firewall rules to restrict access
- Consider using SSH tunneling for remote access

### Discord Bot Security

- Keep bot token secret
- Use environment variables for all credentials
- Implement rate limiting for commands
- Validate user input before processing

---

## Support

For issues, questions, or feature requests:

- **GitHub Issues**: Use the issue tracker for bug reports and feature requests
- **Documentation**: Check this SETUP.md and inline code comments
- **Testing**: Use provided test scripts to verify functionality

---

## License

This project is licensed under the GNU General Public License v3.0 (GPLv3). See the [LICENSE](LICENSE) file for details.

---

**Last Updated**: March 2026