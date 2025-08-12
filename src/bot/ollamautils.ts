import axios from 'axios';
import axiosRetry from 'axios-retry';
import { env } from '../config/env';

axiosRetry(axios, { 
  retries: 3,
  retryDelay: () => {
    return 10 * 60 * 1000; // 10 minutes
  },
  retryCondition: (error: any) => {
    return axiosRetry.isNetworkError(error) || 
           axiosRetry.isRetryableError(error) ||
           error.code === 'ECONNABORTED';
  }
});

export interface OllamaServer {
  host: string;
  model: string;
  name: string;
}

export interface OllamaRequestOptions {
  reasoning?: boolean;
  temperature?: number;
  repeat_penalty?: number;
  top_p?: number;
  top_k?: number;
}

export interface OllamaResponseData {
  response: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  created_at?: string;
  context?: any;
}

export interface ErrorMessages {
  timeout: string;
  network: string;
  server: string;
  general: string;
}

export async function getAvailableOllamaServer(): Promise<OllamaServer> {
  const primaryServer: OllamaServer = {
    host: env.OLLAMA_PRIMARY_HOST,
    model: env.OLLAMA_PRIMARY_MODEL,
    name: 'primary'
  };
  
  const secondaryServer: OllamaServer = {
    host: env.OLLAMA_SECONDARY_HOST,
    model: env.OLLAMA_SECONDARY_MODEL,
    name: 'secondary'
  };

  // Test primary server first
  try {
    console.log('Testing primary Ollama server connectivity...');
    await axios.get(`${primaryServer.host}`, { timeout: 5000 });
    console.log('Primary server is available');
    return primaryServer;
  } catch (error) {
    console.log('Primary server unavailable, testing secondary server...');
    
    // Test secondary server
    try {
      await axios.get(`${secondaryServer.host}`, { timeout: 5000 });
      console.log('Secondary server is available');
      return secondaryServer;
    } catch (secondaryError) {
      console.error('Both servers unavailable, defaulting to primary');
      // Return primary as fallback even if it's down - let the main error handling deal with it
      return primaryServer;
    }
  }
}

/**
 * Makes a request to Ollama with proper error handling and timeout
 */
export async function makeOllamaRequest(
  prompt: string, 
  server: OllamaServer, 
  options: OllamaRequestOptions = {}
): Promise<OllamaResponseData> {
  const defaultOptions: OllamaRequestOptions = {
    reasoning: false,
    temperature: 0.8,
    repeat_penalty: 1.2,
    top_p: 0.9,
    top_k: 40
  };

  const requestOptions = { ...defaultOptions, ...options };

  console.log(`Making Ollama request to ${server.name} server (${server.host}) with model ${server.model}`);
  console.log(`Prompt length: ${prompt.length} characters`);
  
  // Log the complete prompt right before making the API call
  console.log('Final Ollama prompt being sent to ollamautils:', prompt);
  
  const startTime = Date.now();
  const startDate = new Date(startTime).toLocaleString();
  console.log(`Prompt processing started at ${startDate} (epoch ${startTime}) - Length: ${prompt.length} characters`);
  
  const response = await axios.post(`${server.host}/api/generate`, {
    model: server.model,
    prompt: prompt,
    stream: false,
    options: {
      ...requestOptions,
      num_ctx: 24384 // Double the context window from default 4096
    }
  }, {
    timeout: 420000 // 5 minute timeout for complex prompts
  });

  const endTime = Date.now();
  const endDate = new Date(endTime).toLocaleString();
  const durationSec = (endTime - startTime) / 1000;
  const totalTokens = (response.data.eval_count ?? 0) + (response.data.prompt_eval_count ?? 0);
  const tokensPerSec = durationSec > 0 ? (totalTokens / durationSec).toFixed(2) : 'N/A';
  console.log(`Ollama response received at ${endDate} (epoch ${endTime}) - Tokens: ${response.data.eval_count} (eval), ${response.data.prompt_eval_count} (prompt)`);
  console.log(`Tokens per second: ${tokensPerSec}`);
  console.log('Ollama response received successfully');
  
  // Return the response data along with timing information
  // Format the created_at timestamp to something more readable
  const createdAt = response.data.created_at 
    ? new Date(response.data.created_at).toLocaleString() 
    : undefined;

  console.log(`Response created at: ${createdAt}`);

  return {
    response: typeof response.data === 'string' 
      ? response.data 
      : response.data.response,
    total_duration: response.data.total_duration,
    load_duration: response.data.load_duration,
    prompt_eval_count: response.data.prompt_eval_count,
    prompt_eval_duration: response.data.prompt_eval_duration,
    eval_count: response.data.eval_count,
    eval_duration: response.data.eval_duration,
    created_at: createdAt,
    context: response.data.context
  };
}

/**
 * Generates context-specific error messages for Ollama failures
 */
export function getOllamaErrorMessage(err: any, errorMessages: ErrorMessages): string {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED') {
      return errorMessages.timeout;
    } else if (err.response) {
      return errorMessages.server;
    } else if (err.request) {
      return errorMessages.network;
    }
  }
  return errorMessages.general;
}
