import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ZodSchema } from 'zod';

export interface LlmParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      baseURL: this.config.get('LLM_BASE_URL', 'https://api.openai.com/v1'),
      apiKey: this.config.get('LLM_API_KEY'),
    });
    this.model = this.config.get('LLM_MODEL', 'gpt-4o');
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    params: LlmParams = {},
  ): Promise<string> {
    const { temperature = 0.8, topP = 0.9, maxTokens = 4000 } = params;

    const response = await this.callWithRetry(systemPrompt, userPrompt, {
      temperature,
      topP,
      maxTokens,
    });

    return response;
  }

  async generateJson<T>(
    systemPrompt: string,
    userPrompt: string,
    params: LlmParams = {},
    schema: ZodSchema<T>,
  ): Promise<T> {
    const maxRetries = 2;
    let lastError: Error | null = null;
    let currentTemp = params.temperature ?? 0.8;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const raw = await this.callWithRetry(systemPrompt, userPrompt, {
          temperature: currentTemp,
          topP: params.topP ?? 0.9,
          maxTokens: params.maxTokens ?? 4000,
        });

        const jsonStr = this.extractJson(raw);
        const parsed = JSON.parse(jsonStr);
        return schema.parse(parsed);
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(
          `JSON generation attempt ${attempt + 1} failed: ${lastError.message}`,
        );
        currentTemp = Math.max(0.1, currentTemp - 0.2);
      }
    }

    throw new Error(
      `Failed to generate valid JSON after ${maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  async *generateStream(
    systemPrompt: string,
    userPrompt: string,
    params: LlmParams = {},
  ): AsyncGenerator<string> {
    const { temperature = 0.85, topP = 0.92, maxTokens = 4000 } = params;

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  private async callWithRetry(
    systemPrompt: string,
    userPrompt: string,
    params: { temperature: number; topP: number; maxTokens: number },
  ): Promise<string> {
    const maxRetries = 2;
    const delays = [1000, 3000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: params.temperature,
          top_p: params.topP,
          max_tokens: params.maxTokens,
        });

        return response.choices[0]?.message?.content || '';
      } catch (err) {
        if (attempt < maxRetries) {
          this.logger.warn(`LLM call attempt ${attempt + 1} failed, retrying...`);
          await this.sleep(delays[attempt]);
        } else {
          throw err;
        }
      }
    }

    throw new Error('Unreachable');
  }

  private extractJson(text: string): string {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();

    const braceStart = text.indexOf('{');
    const bracketStart = text.indexOf('[');

    if (braceStart === -1 && bracketStart === -1) return text.trim();

    const start =
      braceStart === -1
        ? bracketStart
        : bracketStart === -1
          ? braceStart
          : Math.min(braceStart, bracketStart);

    const isArray = text[start] === '[';
    const closeChar = isArray ? ']' : '}';

    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === text[start]) depth++;
      else if (text[i] === closeChar) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }

    return text.slice(start);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
