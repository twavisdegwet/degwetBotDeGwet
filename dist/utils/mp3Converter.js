"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertMp3ToM4b = convertMp3ToM4b;
exports.convertFromMamDownload = convertFromMamDownload;
exports.hasMP3Files = hasMP3Files;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function convertMp3ToM4b(sourceDirectory, options = {}) {
    const startTime = Date.now();
    try {
        const args = [];
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
        const scriptPath = path_1.default.join(process.cwd(), 'samplefiles/mp3tom4b.sh');
        const command = `cd "${sourceDirectory}" && "${scriptPath}" ${args.join(' ')}`;
        logger_1.Logger.info(`Starting MP3 to M4B conversion in: ${sourceDirectory}`);
        logger_1.Logger.info(`Command: ${command}`);
        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024 * 100,
            timeout: 90 * 60 * 1000,
        });
        const duration = Date.now() - startTime;
        let outputFilename;
        if (options.outputFilename) {
            outputFilename = `${options.outputFilename}.m4b`;
        }
        else if (options.title) {
            outputFilename = `${options.title}.m4b`;
        }
        else {
            outputFilename = `${path_1.default.basename(sourceDirectory)}.m4b`;
        }
        const outputPath = path_1.default.join(sourceDirectory, outputFilename);
        logger_1.Logger.info(`MP3 to M4B conversion completed successfully in ${duration}ms`);
        logger_1.Logger.info(`Output file: ${outputPath}`);
        if (stderr) {
            logger_1.Logger.warn(`Conversion warnings: ${stderr}`);
        }
        if (stdout) {
            logger_1.Logger.info(`Conversion output: ${stdout}`);
        }
        return {
            success: true,
            outputPath,
            duration,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.Logger.error(`MP3 to M4B conversion failed after ${duration}ms: ${errorMessage}`);
        return {
            success: false,
            error: errorMessage,
            duration,
        };
    }
}
async function convertFromMamDownload(sourceDirectory, mamMetadata) {
    logger_1.Logger.info(`Converting MAM download: ${sourceDirectory}`);
    logger_1.Logger.info(`Metadata:`, mamMetadata);
    try {
        const hasFiles = await hasMP3Files(sourceDirectory);
        if (!hasFiles) {
            throw new Error('No MP3 files found in download directory');
        }
    }
    catch (error) {
        logger_1.Logger.error('MP3 validation failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'MP3 file validation failed',
            duration: 0
        };
    }
    const options = {
        title: mamMetadata.title,
        author: mamMetadata.author,
        autoApprove: true,
    };
    if (options.title) {
        const cleanTitle = options.title.replace(/[<>:"/\\|?*]/g, '-');
        options.outputFilename = cleanTitle;
    }
    return convertMp3ToM4b(sourceDirectory, options);
}
async function hasMP3Files(directory) {
    try {
        const { stdout } = await execAsync(`find "${directory}" -iname "*.mp3" -type f | head -1`);
        return stdout.trim().length > 0;
    }
    catch (error) {
        logger_1.Logger.error(`Error checking for MP3 files in ${directory}:`, error);
        throw error;
    }
}
