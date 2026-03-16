import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { Logger } from '../shared/logger';

const execAsync = promisify(exec);

export interface EbookConversionOptions {
  title?: string;
  author?: string;
  autoApprove?: boolean;
}

export interface EbookConversionResult {
  success: boolean;
  epubPath?: string;
  mobiPath?: string;
  error?: string;
  duration?: number;
}

/**
 * Convert an ebook to both EPUB and MOBI formats
 * @param sourceFile - Path to source ebook file (PDF/EPUB/MOBI)
 * @param options - Conversion options
 * @returns Promise<EbookConversionResult>
 */
export async function convertEbook(
  sourceFile: string,
  options: EbookConversionOptions = {}
): Promise<EbookConversionResult> {
  const startTime = Date.now();

  try {
    // Build command arguments
    const args: string[] = [];

    args.push('-i', `"${sourceFile}"`);

    if (options.title) {
      args.push('-t', `"${options.title}"`);
    }

    if (options.author) {
      args.push('-a', `"${options.author}"`);
    }

    if (options.autoApprove !== false) {
      args.push('-y');
    }

    // Path to the conversion script
    const scriptPath = path.join(process.cwd(), 'src/converters/scripts/ebookconvert.sh');

    // Build the full command
    const command = `"${scriptPath}" ${args.join(' ')}`;

    Logger.info(`Starting ebook conversion: ${sourceFile}`);
    Logger.info(`Command: ${command}`);

    // Execute the conversion
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
      timeout: 30 * 60 * 1000, // 30 minute timeout for large ebooks
    });

    const duration = Date.now() - startTime;

    // Determine output filenames
    const sourceDir = path.dirname(sourceFile);
    const sourceName = path.basename(sourceFile, path.extname(sourceFile));

    // The script creates files based on the title if provided, otherwise uses source filename
    let baseName = sourceName;
    if (options.title) {
      // Clean title for filename (same logic as bash script)
      baseName = options.title.replace(/[<>:"/\\|?*]/g, '-');
    }

    const epubPath = path.join(sourceDir, `${baseName}.epub`);
    const mobiPath = path.join(sourceDir, `${baseName}.mobi`);

    // Log the full script output for debugging
    if (stdout) {
      Logger.info(`Script stdout:\n${stdout}`);
    }
    if (stderr) {
      Logger.warn(`Script stderr:\n${stderr}`);
    }

    // Verify files actually exist before returning them
    const epubExists = fs.existsSync(epubPath);
    const mobiExists = fs.existsSync(mobiPath);

    Logger.info(`Ebook conversion completed in ${duration}ms`);
    Logger.info(`  Expected EPUB path: ${epubPath}`);
    Logger.info(`  Expected MOBI path: ${mobiPath}`);
    if (epubExists) {
      Logger.info(`  ✅ EPUB exists: ${epubPath}`);
    } else {
      Logger.warn(`  ⚠️  EPUB NOT FOUND: ${epubPath}`);
    }
    if (mobiExists) {
      Logger.info(`  ✅ MOBI exists: ${mobiPath}`);
    } else {
      Logger.warn(`  ⚠️  MOBI NOT FOUND: ${mobiPath}`);
    }

    // Only return paths for files that actually exist
    return {
      success: true,
      epubPath: epubExists ? epubPath : undefined,
      mobiPath: mobiExists ? mobiPath : undefined,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    Logger.error(`Ebook conversion failed after ${duration}ms: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Utility function to check if a directory contains convertible ebooks
 * Returns true if there are PDF files or ebooks that could benefit from conversion
 * @param directory - Directory to check
 * @returns Promise<{ hasConvertible: boolean, files: string[] }>
 */
export async function hasConvertibleEbooks(directory: string): Promise<{
  hasConvertible: boolean;
  files: string[];
  reason?: string;
}> {
  try {
    // Find all ebook files
    const { stdout: pdfFiles } = await execAsync(`find "${directory}" -iname "*.pdf" -type f`);
    const { stdout: epubFiles } = await execAsync(`find "${directory}" -iname "*.epub" -type f`);
    const { stdout: mobiFiles } = await execAsync(`find "${directory}" -iname "*.mobi" -type f`);

    const pdfs = pdfFiles.trim().split('\n').filter(f => f);
    const epubs = epubFiles.trim().split('\n').filter(f => f);
    const mobis = mobiFiles.trim().split('\n').filter(f => f);

    // If we have PDFs, we should convert them
    if (pdfs.length > 0) {
      return {
        hasConvertible: true,
        files: pdfs,
        reason: 'PDF files found that can be converted to EPUB + MOBI'
      };
    }

    // If we have EPUB but no MOBI, we should convert
    if (epubs.length > 0 && mobis.length === 0) {
      return {
        hasConvertible: true,
        files: epubs,
        reason: 'EPUB files found without matching MOBI files'
      };
    }

    // If we have MOBI but no EPUB, we should convert
    if (mobis.length > 0 && epubs.length === 0) {
      return {
        hasConvertible: true,
        files: mobis,
        reason: 'MOBI files found without matching EPUB files'
      };
    }

    // If we have both EPUB and MOBI, no conversion needed
    if (epubs.length > 0 && mobis.length > 0) {
      return {
        hasConvertible: false,
        files: [...epubs, ...mobis],
        reason: 'Already have both EPUB and MOBI formats'
      };
    }

    return {
      hasConvertible: false,
      files: [],
      reason: 'No ebook files found'
    };

  } catch (error) {
    Logger.error(`Error checking for convertible ebooks in ${directory}:`, error);
    throw error;
  }
}

/**
 * Convert ebooks from a download with MAM metadata
 * @param directory - Directory containing ebook files
 * @param mamMetadata - Metadata from MAM (title, author, etc.)
 * @returns Promise<EbookConversionResult[]>
 */
export async function convertFromMamDownload(
  directory: string,
  mamMetadata: {
    title?: string;
    author?: string;
    [key: string]: any;
  }
): Promise<EbookConversionResult[]> {
  Logger.info(`Converting ebooks from MAM download: ${directory}`);
  Logger.info(`Metadata:`, mamMetadata);

  // Check for convertible ebooks
  const ebookCheck = await hasConvertibleEbooks(directory);

  if (!ebookCheck.hasConvertible) {
    Logger.info(`No conversion needed: ${ebookCheck.reason}`);
    return [{
      success: true,
      duration: 0
    }];
  }

  Logger.info(`Found ${ebookCheck.files.length} ebook(s) to convert: ${ebookCheck.reason}`);

  const options: EbookConversionOptions = {
    title: mamMetadata.title,
    author: mamMetadata.author,
    autoApprove: true, // Always auto-approve for automated downloads
  };

  // Convert all found ebooks
  const results: EbookConversionResult[] = [];

  for (const file of ebookCheck.files) {
    const result = await convertEbook(file, options);
    results.push(result);
  }

  return results;
}
