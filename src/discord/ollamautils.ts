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
  type: 'ollama' | 'openai' | 'nvidia';
  apiKey?: string;
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
  // Check if NVIDIA is configured - try it first
  if (env.NVIDIA_API_KEY) {
    const nvidiaServer: OllamaServer = {
      host: 'https://integrate.api.nvidia.com',
      model: env.NVIDIA_MODEL,
      name: 'nvidia',
      type: 'nvidia',
      apiKey: env.NVIDIA_API_KEY
    };

    try {
      console.log('Testing NVIDIA API connectivity...');
      await axios.get(`${nvidiaServer.host}/v1/models`, {
        headers: { 'Authorization': `Bearer ${nvidiaServer.apiKey}` },
        timeout: 10000
      });
      console.log('NVIDIA API is available');
      return nvidiaServer;
    } catch (error) {
      console.log('NVIDIA API unavailable, falling back to Ollama servers...');
    }
  }

  const primaryServer: OllamaServer = {
    host: env.OLLAMA_PRIMARY_HOST,
    model: env.OLLAMA_PRIMARY_MODEL,
    name: 'primary',
    type: env.OLLAMA_PRIMARY_TYPE
  };

  const secondaryServer: OllamaServer = {
    host: env.OLLAMA_SECONDARY_HOST,
    model: env.OLLAMA_SECONDARY_MODEL,
    name: 'secondary',
    type: env.OLLAMA_SECONDARY_TYPE
  };

  // Test primary server
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
      console.error('All servers unavailable, defaulting to primary');
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

  console.log(`Making request to ${server.name} server (${server.host}) with model ${server.model} using ${server.type} API`);
  console.log(`Prompt length: ${prompt.length} characters`);
  
  // Append /nothink if configured to disable thinking tags
  let finalPrompt = prompt;
  if (env.OLLAMA_APPEND_NOTHINK) {
    finalPrompt = prompt + '/nothink';
    console.log('Appending /nothink to disable thinking tags');
  }
  
  // Log the complete prompt right before making the API call
  console.log('Final prompt being sent to ollamautils:', finalPrompt);
  
  const startTime = Date.now();
  const startDate = new Date(startTime).toLocaleString();
  console.log(`Prompt processing started at ${startDate} (epoch ${startTime}) - Length: ${finalPrompt.length} characters`);
  
  let response;
  
  if (server.type === 'nvidia') {
    // NVIDIA API uses OpenAI-compatible chat completions format with Bearer auth
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${server.apiKey}`,
      'Content-Type': 'application/json'
    };

    response = await axios.post(`${server.host}/v1/chat/completions`, {
      model: server.model,
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: requestOptions.temperature,
      top_p: requestOptions.top_p,
      max_tokens: 4096, // NVIDIA has limits
      stream: false
    }, {
      headers,
      timeout: 420000
    });
  } else if (server.type === 'openai') {
    // OpenAI-compatible API (llama.cpp, llama-swap)
    response = await axios.post(`${server.host}/v1/completions`, {
      model: server.model,
      prompt: finalPrompt,
      temperature: requestOptions.temperature,
      top_p: requestOptions.top_p,
      max_tokens: -1, // Let the model decide
      stream: false
    }, {
      timeout: 420000
    });
  } else {
    // Ollama native API
    response = await axios.post(`${server.host}/api/generate`, {
      model: server.model,
      prompt: finalPrompt,
      stream: false,
      options: {
        ...requestOptions,
        num_ctx: 12384
      }
    }, {
      timeout: 420000
    });
  }

  const endTime = Date.now();
  const endDate = new Date(endTime).toLocaleString();
  const durationSec = (endTime - startTime) / 1000;
  
  // Parse response based on server type
  let responseText: string;
  let evalCount: number | undefined;
  let promptEvalCount: number | undefined;

  if (server.type === 'nvidia') {
    // NVIDIA uses chat completions format: { choices: [{ message: { content: "..." } }], usage: { completion_tokens, prompt_tokens } }
    responseText = response.data.choices?.[0]?.message?.content || '';
    evalCount = response.data.usage?.completion_tokens;
    promptEvalCount = response.data.usage?.prompt_tokens;
  } else if (server.type === 'openai') {
    // OpenAI completions format: { choices: [{ text: "..." }], usage: { completion_tokens, prompt_tokens } }
    responseText = response.data.choices?.[0]?.text || '';
    evalCount = response.data.usage?.completion_tokens;
    promptEvalCount = response.data.usage?.prompt_tokens;
  } else {
    // Ollama format: { response: "..." }
    responseText = typeof response.data === 'string' ? response.data : response.data.response;
    evalCount = response.data.eval_count;
    promptEvalCount = response.data.prompt_eval_count;
  }
  
  // Log the raw API response text for debugging
  console.log('Raw API response text (first 500 chars):', responseText.substring(0, 500));
  console.log('Raw API response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));
  console.log('Total response length:', responseText.length);
  
  const totalTokens = (evalCount ?? 0) + (promptEvalCount ?? 0);
  const tokensPerSec = durationSec > 0 ? (totalTokens / durationSec).toFixed(2) : 'N/A';
  console.log(`Response received at ${endDate} (epoch ${endTime}) - Tokens: ${evalCount} (eval), ${promptEvalCount} (prompt)`);
  console.log(`Tokens per second: ${tokensPerSec}`);
  console.log('Response received successfully');
  
  // Format the created_at timestamp to something more readable
  const createdAt = response.data.created_at 
    ? new Date(response.data.created_at).toLocaleString() 
    : undefined;

  console.log(`Response created at: ${createdAt}`);

  return {
    response: responseText,
    total_duration: response.data.total_duration,
    load_duration: response.data.load_duration,
    prompt_eval_count: promptEvalCount,
    prompt_eval_duration: response.data.prompt_eval_duration,
    eval_count: evalCount,
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
