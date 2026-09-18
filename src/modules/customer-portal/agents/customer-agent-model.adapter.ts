import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LanguageModel, ToolSet } from 'ai';
import type { z } from 'zod';
import { strictOutputSchema } from './strict-output-schema';

export type CustomerAgentName = 'lead' | 'sales' | 'support';
export interface CustomerAgentModelTool {
  description: string;
  inputSchema: z.ZodType;
  execute: (args: unknown) => Promise<unknown>;
}
export interface CustomerAgentModelRequest {
  agent: CustomerAgentName;
  system: string;
  context: Record<string, unknown>;
  tools: Record<string, CustomerAgentModelTool>;
  outputSchema: z.ZodType;
  signal: AbortSignal;
  maxSteps: number;
  onStep: () => void;
}
export interface CustomerAgentConfiguration {
  provider: 'google' | 'openai-compatible';
  model: string;
}

/** Keeps the ESM SDK and provider IO outside shopping rules and test fixtures. */
@Injectable()
export class CustomerAgentModelAdapter {
  constructor(private readonly config: ConfigService) {}

  configuration(): CustomerAgentConfiguration | null {
    const enabled = this.config.get<unknown>('CUSTOMER_MULTI_AGENT_ENABLED');
    if (enabled !== true && enabled !== 'true') return null;
    const provider =
      this.config.get<string>('CUSTOMER_MULTI_AGENT_PROVIDER') || 'google';
    const model = (
      this.config.get<string>('CUSTOMER_MULTI_AGENT_MODEL') ||
      (provider === 'openai-compatible'
        ? this.config.get<string>('AI_CHAT_MODEL')
        : '') ||
      ''
    ).trim();
    if (!model || model.length > 200) return null;
    if (provider === 'google' && this.googleKey()) return { provider, model };
    if (
      provider === 'openai-compatible' &&
      this.config.get<string>('AI_API_KEY')?.trim() &&
      this.config.get<string>('AI_BASE_URL')?.trim()
    ) {
      return { provider, model };
    }
    return null;
  }

  async generate(request: CustomerAgentModelRequest): Promise<unknown> {
    const configured = this.configuration();
    if (!configured) throw new Error('Customer agent is unconfigured');
    const { generateText, Output, stepCountIs, tool } = await import('ai');
    let model: LanguageModel;
    if (configured.provider === 'google') {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      model = createGoogleGenerativeAI({ apiKey: this.googleKey() })(
        configured.model,
      );
    } else {
      const { createOpenAICompatible } =
        await import('@ai-sdk/openai-compatible');
      model = createOpenAICompatible({
        name: 'customer-configured-provider',
        baseURL: this.config.getOrThrow<string>('AI_BASE_URL'),
        apiKey: this.config.getOrThrow<string>('AI_API_KEY'),
        supportsStructuredOutputs: true,
      })(configured.model);
    }
    const tools: ToolSet = {};
    for (const [name, definition] of Object.entries(request.tools)) {
      tools[name] = tool({
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: definition.execute,
      });
    }
    const output =
      configured.provider === 'openai-compatible'
        ? strictOutputSchema(request.outputSchema)
        : {
            schema: request.outputSchema,
            decode: (value: unknown) => request.outputSchema.parse(value),
          };
    const result = await generateText({
      model,
      system: request.system,
      prompt: JSON.stringify(request.context),
      tools,
      output: Output.object({ schema: output.schema }),
      stopWhen: stepCountIs(request.maxSteps),
      prepareStep: ({ stepNumber, steps }) => {
        const unavailable = steps.some((step) =>
          step.toolResults.some((result) => {
            const value: unknown = result.output;
            return (
              value !== null &&
              typeof value === 'object' &&
              'available' in value &&
              value.available === false
            );
          }),
        );
        // Reserve a final answer step and stop re-querying unavailable data.
        return unavailable ||
          (stepNumber > 0 && stepNumber >= request.maxSteps - 1)
          ? { activeTools: [], toolChoice: 'none' as const }
          : undefined;
      },
      maxRetries: 0,
      maxOutputTokens: request.agent === 'lead' ? 300 : 1600,
      abortSignal: request.signal,
      onStepStart: request.onStep,
      telemetry: { isEnabled: false },
    });
    return output.decode(result.output);
  }

  private googleKey(): string | undefined {
    return (
      this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() ||
      this.config.get<string>('GEMINI_API_KEY')?.trim()
    );
  }
}
