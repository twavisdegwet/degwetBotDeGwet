import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { env } from '../config/env';
import DelugeClientManager from '../api/clients/delugeClientManager';
import { DownloadManager } from '../api/clients/downloadManagement';

const execAsync = promisify(exec);

export interface KindleEmailResult {
  success: boolean;
  message: string;
  sentFiles: string[];
  convertedFiles?: string[];
  error?: string;
}

/**
 * Send ebook files to Kindle via email
 * Automatically converts to EPUB format if needed
 */
export async function sendToKindle(
  torrentId: string,
  kindleEmail: string,
  progressCallback?: (message: string) => Promise<void>
): Promise<KindleEmailResult> {
  try {
    // Validate email configuration
    if (!env.GOOGLE_SERVICE_ACCOUNT_PATH || !env.KINDLE_BOT_EMAIL) {
      throw new Error('Email configuration missing. Please set GOOGLE_SERVICE_ACCOUNT_PATH and KINDLE_BOT_EMAIL in .env.local');
    }

    // Log progress
    if (progressCallback) {
      await progressCallback('📧 Preparing to send to Kindle...');
    }

    // Get torrent files
    const clientManager = DelugeClientManager.getInstance();
    const delugeClient = await clientManager.getClient();
    const downloadManager = new DownloadManager(delugeClient);
    const torrents = await downloadManager.listCompletedTorrents();
    const selectedTorrent = torrents.find(t => t.id === torrentId);

    if (!selectedTorrent) {
      throw new Error('Torrent not found');
    }

    const torrentFiles = await downloadManager.getTorrentFiles(torrentId);
    const torrentPath = env.DOWNLOADS_DIRECTORY;

    // Find ebook files (EPUB, PDF, MOBI)
    const ebookExtensions = ['.epub', '.pdf', '.mobi'];
    const ebookFiles = torrentFiles.filter(file => {
      const ext = path.extname(file.path).toLowerCase();
      return ebookExtensions.includes(ext);
    });

    if (ebookFiles.length === 0) {
      throw new Error('No ebook files found in this torrent');
    }

    // Convert files to EPUB if needed
    const filesToSend: string[] = [];
    const convertedFiles: string[] = [];

    for (const file of ebookFiles) {
      const filePath = path.join(torrentPath, file.path);
      const ext = path.extname(file.path).toLowerCase();

      if (ext === '.epub') {
        // Already EPUB, use as-is
        filesToSend.push(filePath);
      } else {
        // Convert to EPUB using ebookconvert.sh
        if (progressCallback) {
          await progressCallback(`📝 Converting ${path.basename(file.path)} to EPUB...`);
        }

        const convertedPath = await convertToEpub(filePath);
        filesToSend.push(convertedPath);
        convertedFiles.push(convertedPath);
      }
    }

    // Calculate total attachment size
    const totalSize = filesToSend.reduce((sum, filePath) => {
      return sum + fs.statSync(filePath).size;
    }, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    // Check size limit (Amazon has a 50MB limit for Send to Kindle)
    if (totalSize > 50 * 1024 * 1024) {
      throw new Error(`Total file size (${totalSizeMB}MB) exceeds Amazon's 50MB limit for Send to Kindle. Please upload to Google Drive instead.`);
    }

    if (progressCallback) {
      await progressCallback(`📧 Sending ${filesToSend.length} file(s) (${totalSizeMB}MB) to Kindle...`);
    }

    // Set up Gmail API with service account
    const auth = new google.auth.GoogleAuth({
      keyFile: env.GOOGLE_SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      clientOptions: {
        subject: env.KINDLE_BOT_EMAIL, // Domain-wide delegation: send as this user
      },
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Create raw RFC822 email with attachments
    const boundary = `boundary_${Date.now()}`;
    const messageParts: string[] = [];

    // Email headers
    messageParts.push(`From: ${env.KINDLE_BOT_EMAIL}`);
    messageParts.push(`To: ${kindleEmail}`);
    messageParts.push(`Subject: ${selectedTorrent.name}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    messageParts.push('');

    // Email body (text)
    messageParts.push(`--${boundary}`);
    messageParts.push('Content-Type: text/plain; charset=UTF-8');
    messageParts.push('');
    messageParts.push(`Ebook: ${selectedTorrent.name}`);
    messageParts.push('');
    messageParts.push('Sent from Discord Bot');
    messageParts.push('');

    // Add attachments
    for (const filePath of filesToSend) {
      const fileName = path.basename(filePath);
      const fileData = fs.readFileSync(filePath);
      const base64Data = fileData.toString('base64');

      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: application/epub+zip; name="${fileName}"`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(`Content-Disposition: attachment; filename="${fileName}"`);
      messageParts.push('');
      messageParts.push(base64Data);
      messageParts.push('');
    }

    messageParts.push(`--${boundary}--`);

    // Encode the entire message in base64url
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email via Gmail API
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log('Email sent via Gmail API:', result.data.id);

    // Clean up converted files
    for (const convertedFile of convertedFiles) {
      try {
        fs.unlinkSync(convertedFile);
        console.log('Cleaned up converted file:', convertedFile);
      } catch (error) {
        console.error('Error cleaning up converted file:', error);
      }
    }

    const sentFileNames = filesToSend.map(f => path.basename(f));
    return {
      success: true,
      message: `✅ Successfully sent ${sentFileNames.length} file(s) to Kindle! Check your Kindle library in a few minutes.`,
      sentFiles: sentFileNames,
      convertedFiles: convertedFiles.length > 0 ? convertedFiles.map(f => path.basename(f)) : undefined,
    };

  } catch (error: any) {
    console.error('Error sending to Kindle:', error);
    return {
      success: false,
      message: `❌ Failed to send to Kindle: ${error.message}`,
      sentFiles: [],
      error: error.message,
    };
  }
}

/**
 * Convert an ebook file to EPUB format using ebookconvert.sh
 */
async function convertToEpub(inputFilePath: string): Promise<string> {
  const ext = path.extname(inputFilePath).toLowerCase();
  const basename = path.basename(inputFilePath, ext);
  const dirname = path.dirname(inputFilePath);
  const outputPath = path.join(dirname, `${basename}.epub`);

  // Check if EPUB already exists
  if (fs.existsSync(outputPath)) {
    console.log('EPUB file already exists:', outputPath);
    return outputPath;
  }

  // Get the path to ebookconvert.sh
  const scriptPath = path.join(__dirname, '../../samplefiles/ebookconvert.sh');

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`ebookconvert.sh script not found at ${scriptPath}`);
  }

  // Run conversion script with auto-approve flag
  const command = `bash "${scriptPath}" -i "${inputFilePath}" -y`;

  console.log('Running conversion command:', command);

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });

    console.log('Conversion output:', stdout);
    if (stderr) {
      console.error('Conversion stderr:', stderr);
    }

    // Verify the output file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Conversion completed but output file not found: ${outputPath}`);
    }

    return outputPath;
  } catch (error: any) {
    console.error('Conversion error:', error);
    throw new Error(`Failed to convert to EPUB: ${error.message}`);
  }
}

/**
 * Check if torrent contains ebook files suitable for Kindle
 */
export async function hasKindleCompatibleFiles(torrentId: string): Promise<boolean> {
  try {
    const clientManager = DelugeClientManager.getInstance();
    const delugeClient = await clientManager.getClient();
    const downloadManager = new DownloadManager(delugeClient);
    const torrentFiles = await downloadManager.getTorrentFiles(torrentId);

    const ebookExtensions = ['.epub', '.pdf', '.mobi'];
    return torrentFiles.some(file => {
      const ext = path.extname(file.path).toLowerCase();
      return ebookExtensions.includes(ext);
    });
  } catch (error) {
    console.error('Error checking for Kindle-compatible files:', error);
    return false;
  }
}
