import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { Logger } from '../shared/logger';

const execAsync = promisify(exec);

export interface ConversionOptions {
  title?: string;
  author?: string;
  outputFilename?: string;
  autoApprove?: boolean;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration?: number;
}

/**
 * Convert MP3 files in a directory to M4B audiobook format
 * @param sourceDirectory - Directory containing MP3 files
 * @param options - Conversion options
 * @returns Promise<ConversionResult>
 */
export async function convertMp3ToM4b(
  sourceDirectory: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const startTime = Date.now();
  
  try {
    // Build command arguments
    const args: string[] = [];
    
    if (options.title) {
      args.push('-t', `"${options.title}"`);
    }
    
    if (options.author) {
      args.push('-a', `"${options.author}"`);
    }
    
    if (options.outputFilename) {
      args.push('-o', `"${options.outputFilename}"`);
    }
    
    if (options.autoApprove !== false) {
      args.push('-y');
    }
    
    // Path to the conversion script
    const scriptPath = path.join(process.cwd(), 'src/converters/scripts/mp3tom4b.sh');
    
    // Build the full command
    const command = `cd "${sourceDirectory}" && "${scriptPath}" ${args.join(' ')}`;
    
    Logger.info(`Starting MP3 to M4B conversion in: ${sourceDirectory}`);
    Logger.info(`Command: ${command}`);
    
    // Execute the conversion
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer for large audiobooks with verbose ffmpeg output
      timeout: 90 * 60 * 1000, // 90 minute timeout for large audiobooks
    });
    
    const duration = Date.now() - startTime;
    
    // Determine output filename
    let outputFilename: string;
    if (options.outputFilename) {
      outputFilename = `${options.outputFilename}.m4b`;
    } else if (options.title) {
      outputFilename = `${options.title}.m4b`;
    } else {
      outputFilename = `${path.basename(sourceDirectory)}.m4b`;
    }
    
    const outputPath = path.join(sourceDirectory, outputFilename);
    
    Logger.info(`MP3 to M4B conversion completed successfully in ${duration}ms`);
    Logger.info(`Output file: ${outputPath}`);
    
    if (stderr) {
      Logger.warn(`Conversion warnings: ${stderr}`);
    }

    if (stdout) {
      Logger.info(`Conversion output: ${stdout}`);
    }
    
    return {
      success: true,
      outputPath,
      duration,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    Logger.error(`MP3 to M4B conversion failed after ${duration}ms: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Extract metadata from MAM/Deluge and convert to M4B
 * This function can be called from your Discord bot or other automation
 * @param sourceDirectory - Directory containing downloaded MP3 files
 * @param mamMetadata - Metadata from MAM (title, author, etc.)
 * @returns Promise<ConversionResult>
 */
export async function convertFromMamDownload(
  sourceDirectory: string,
  mamMetadata: {
    title?: string;
    author?: string;
    [key: string]: any;
  }
): Promise<ConversionResult> {
  Logger.info(`Converting MAM download: ${sourceDirectory}`);
  Logger.info(`Metadata:`, mamMetadata);

  // Validate MP3 files exist first
  try {
    const hasFiles = await hasMP3Files(sourceDirectory);
    if (!hasFiles) {
      throw new Error('No MP3 files found in download directory');
    }
  } catch (error) {
    Logger.error('MP3 validation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'MP3 file validation failed',
      duration: 0
    };
  }
  
  const options: ConversionOptions = {
    title: mamMetadata.title,
    author: mamMetadata.author,
    autoApprove: true, // Always auto-approve for automated downloads
  };
  
  // Clean up the title for filename if provided
  if (options.title) {
    // Remove invalid filename characters
    const cleanTitle = options.title.replace(/[<>:"/\\|?*]/g, '-');
    options.outputFilename = cleanTitle;
  }
  
  return convertMp3ToM4b(sourceDirectory, options);
}

/**
 * Utility function to validate if a directory contains MP3 files
 * @param directory - Directory to check
 * @returns Promise<boolean>
 */
export async function hasMP3Files(directory: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`find "${directory}" -iname "*.mp3" -type f | head -1`);
    return stdout.trim().length > 0;
  } catch (error) {
    Logger.error(`Error checking for MP3 files in ${directory}:`, error);
    throw error;
  }
}
