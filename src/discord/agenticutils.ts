import axios from 'axios';
import axiosRetry from 'axios-retry';
import { getAvailableOllamaServer } from './ollamautils'; // Reuse server selection

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

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, any>;
    };
  }>;
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

export interface AgenticRequestOptions {
  temperature?: number;
  repeat_penalty?: number;
  top_p?: number;
  top_k?: number;
  max_iterations?: number;
}

/**
 * Executes a chat session with Ollama supporting tool calls.
 * Handles multiple iterations until no more tool calls are needed.
 * @param systemPrompt The system prompt to set the agent's behavior.
 * @param userMessage The initial user query.
 * @param tools Available tools the agent can call.
 * @param toolFunctions Map of tool names to their implementation functions.
 * @param options Request options.
 * @returns The final response content from the agent.
 */
export async function agenticChat(
  systemPrompt: string,
  userMessage: string,
  tools: OllamaTool[],
  toolFunctions: Record<string, (args: any) => Promise<string>>,
  options: AgenticRequestOptions = {}
): Promise<string> {
  const defaultOptions: AgenticRequestOptions = {
    temperature: 0.7,
    repeat_penalty: 1.1,
    top_p: 0.9,
    top_k: 40,
    max_iterations: 5
  };

  const requestOptions = { ...defaultOptions, ...options };

  const server = await getAvailableOllamaServer();
  console.log(`Making agentic chat request to ${server.name} server (${server.host}) with model ${server.model} using ${server.type} API`);

  let messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  let iteration = 0;
  while (iteration < (requestOptions.max_iterations ?? 5)) {
    let response;
    
    if (server.type === 'nvidia') {
      // NVIDIA API uses OpenAI-compatible format with Bearer auth
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${server.apiKey}`,
        'Content-Type': 'application/json'
      };

      response = await axios.post(`${server.host}/v1/chat/completions`, {
        model: server.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
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
      response = await axios.post(`${server.host}/v1/chat/completions`, {
        model: server.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: requestOptions.temperature,
        top_p: requestOptions.top_p,
        stream: false
      }, {
        timeout: 420000
      });
    } else {
      // Ollama native API
      response = await axios.post(`${server.host}/api/chat`, {
        model: server.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        stream: false,
        options: {
          temperature: requestOptions.temperature,
          repeat_penalty: requestOptions.repeat_penalty,
          top_p: requestOptions.top_p,
          top_k: requestOptions.top_k
        }
      }, {
        timeout: 420000
      });
    }

    // Parse response based on server type
    const assistantMessage: OllamaMessage = server.type === 'openai'
      ? response.data.choices?.[0]?.message
      : response.data.message;
    
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // No tool calls, this is the final response
      return assistantMessage.content;
    }

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const functionName = toolCall.function.name;
      const functionArgs = toolCall.function.arguments;

      console.log(`Calling tool: ${functionName} with args: ${JSON.stringify(functionArgs)}`);

      if (!toolFunctions[functionName]) {
        messages.push({
          role: 'tool',
          content: `Error: Tool ${functionName} not found.`
        });
        continue;
      }

      try {
        const toolResult = await toolFunctions[functionName](functionArgs);
        messages.push({
          role: 'tool',
          content: toolResult
        });
      } catch (error) {
        messages.push({
          role: 'tool',
          content: `Error executing ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    iteration++;
  }

  throw new Error(`Max iterations reached (${requestOptions.max_iterations}) without final response.`);
}
