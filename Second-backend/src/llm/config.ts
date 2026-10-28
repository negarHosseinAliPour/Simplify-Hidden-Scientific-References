// src/llm/config.ts
//
// Single place that decides which LLM provider and models RefHunters uses.
// Every agent gets its client and model names from here, so switching from
// OpenAI to Gemini (or any OpenAI-compatible endpoint) is a .env change only.
//
//   LLM_PROVIDER      openai | gemini | custom   (auto-detected if unset)
//   LLM_API_KEY       key for the provider (falls back to OPENAI_API_KEY / GEMINI_API_KEY)
//   LLM_BASE_URL      override the endpoint (required for "custom")
//   LLM_MODEL_FAST    model for cheap steps: planning, citation parsing, answer writing
//   LLM_MODEL_STRONG  model for the evidence-gathering tool loop in A1
import "dotenv/config";
import OpenAI from "openai";
import { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from "@openai/agents";

export type Provider = "openai" | "gemini" | "custom";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

const DEFAULT_MODELS: Record<Provider, { fast: string; strong: string }> = {
  openai: { fast: "gpt-4o-mini", strong: "gpt-4o" },
  gemini: { fast: "gemini-2.5-flash", strong: "gemini-2.5-flash" },
  custom: { fast: "", strong: "" },
};

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  models: { fast: string; strong: string };
}

function detectProvider(env: NodeJS.ProcessEnv): Provider {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    if (explicit === "openai" || explicit === "gemini" || explicit === "custom") return explicit;
    throw new Error(`LLM_PROVIDER must be openai, gemini or custom (got "${env.LLM_PROVIDER}").`);
  }
  if (env.GEMINI_API_KEY && !env.OPENAI_API_KEY) return "gemini";
  return "openai";
}

/** Reads the configuration from environment variables. Pure, so it can be unit-tested. */
export function loadLLMConfig(env: NodeJS.ProcessEnv = process.env): LLMConfig {
  const provider = detectProvider(env);

  const apiKey =
    env.LLM_API_KEY ||
    (provider === "gemini" ? env.GEMINI_API_KEY : env.OPENAI_API_KEY) ||
    "";
  if (!apiKey) {
    const keyName = provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
    throw new Error(
      `No API key for provider "${provider}". Set LLM_API_KEY or ${keyName} in your .env file ` +
        `(see .env.example).`
    );
  }

  const baseURL = env.LLM_BASE_URL || (provider === "gemini" ? GEMINI_BASE_URL : undefined);
  if (provider === "custom" && !baseURL) {
    throw new Error('LLM_PROVIDER=custom needs LLM_BASE_URL (an OpenAI-compatible endpoint).');
  }

  const defaults = DEFAULT_MODELS[provider];
  const fast = env.LLM_MODEL_FAST || defaults.fast;
  const strong = env.LLM_MODEL_STRONG || env.LLM_MODEL_FAST || defaults.strong;
  if (!fast || !strong) {
    throw new Error("Set LLM_MODEL_FAST (and optionally LLM_MODEL_STRONG) for a custom provider.");
  }

  return { provider, apiKey, baseURL, models: { fast, strong } };
}

let cachedConfig: LLMConfig | null = null;
let cachedClient: OpenAI | null = null;
let agentsConfigured = false;

export function getLLMConfig(): LLMConfig {
  if (!cachedConfig) cachedConfig = loadLLMConfig();
  return cachedConfig;
}

/** Shared OpenAI-compatible client used by A1 and A2. */
export function getLLMClient(): OpenAI {
  if (!cachedClient) {
    const { apiKey, baseURL } = getLLMConfig();
    cachedClient = new OpenAI({ apiKey, baseURL });
  }
  return cachedClient;
}

/**
 * Points the OpenAI Agents SDK (used by A0) at the same provider.
 * Non-OpenAI endpoints only implement Chat Completions, and the SDK's trace
 * exporter only talks to OpenAI, so both are adjusted for them.
 */
export function configureAgentsSdk(): void {
  if (agentsConfigured) return;
  const { provider } = getLLMConfig();
  setDefaultOpenAIClient(getLLMClient());
  if (provider !== "openai") {
    setOpenAIAPI("chat_completions");
    setTracingDisabled(true);
  }
  agentsConfigured = true;
}

/** Test helper: forget cached config and client. */
export function resetLLMForTests(): void {
  cachedConfig = null;
  cachedClient = null;
  agentsConfigured = false;
}
