/**
 * Ollama Service
 * Handles communication with local Ollama instance for LLM inference
 */

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

interface OllamaListResponse {
  models: OllamaModelInfo[];
}

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  /**
   * List available models on the Ollama instance
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = (await response.json()) as OllamaListResponse;
      return data.models;
    } catch (error: any) {
      throw new Error(`Ollama connection failed: ${error.message}`);
    }
  }

  /**
   * Send a chat message to Ollama
   */
  async chat(
    model: string,
    messages: OllamaMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const request: OllamaChatRequest = {
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2000,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      return data.message.content;
    } catch (error: any) {
      throw new Error(`Ollama chat failed: ${error.message}`);
    }
  }

  /**
   * Stream chat responses from Ollama
   */
  async *chatStream(
    model: string,
    messages: OllamaMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string> {
    const request: OllamaChatRequest = {
      model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2000,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body from Ollama");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data: OllamaChatResponse = JSON.parse(line);
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Ollama stream failed: ${error.message}`);
    }
  }

  /**
   * Check if Ollama is available and running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();
