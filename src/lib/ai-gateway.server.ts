import { createAnthropic } from "@ai-sdk/anthropic";

// Direct Anthropic provider. Requires ANTHROPIC_API_KEY to be set in the
// environment (see .env.example). Model id is passed by each call site.
export function createAnthropicProvider(apiKey: string) {
  return createAnthropic({ apiKey });
}
