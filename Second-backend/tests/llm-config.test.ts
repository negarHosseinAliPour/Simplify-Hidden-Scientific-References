import { describe, expect, it } from "vitest";
import { loadLLMConfig } from "../src/llm/config";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe("loadLLMConfig", () => {
  it("defaults to OpenAI models when only an OpenAI key is set", () => {
    const cfg = loadLLMConfig(env({ OPENAI_API_KEY: "sk-test" }));
    expect(cfg.provider).toBe("openai");
    expect(cfg.baseURL).toBeUndefined();
    expect(cfg.models).toEqual({ fast: "gpt-4o-mini", strong: "gpt-4o" });
  });

  it("detects Gemini from its key and uses the OpenAI-compatible endpoint", () => {
    const cfg = loadLLMConfig(env({ GEMINI_API_KEY: "g-test" }));
    expect(cfg.provider).toBe("gemini");
    expect(cfg.apiKey).toBe("g-test");
    expect(cfg.baseURL).toContain("generativelanguage.googleapis.com");
  });

  it("lets .env override model names", () => {
    const cfg = loadLLMConfig(
      env({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g", LLM_MODEL_FAST: "fast-x", LLM_MODEL_STRONG: "strong-y" })
    );
    expect(cfg.models).toEqual({ fast: "fast-x", strong: "strong-y" });
  });

  it("uses the fast model for both roles when only LLM_MODEL_FAST is set", () => {
    const cfg = loadLLMConfig(env({ OPENAI_API_KEY: "k", LLM_MODEL_FAST: "only-one" }));
    expect(cfg.models).toEqual({ fast: "only-one", strong: "only-one" });
  });

  it("prefers LLM_API_KEY over provider-specific keys", () => {
    const cfg = loadLLMConfig(env({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "a", LLM_API_KEY: "b" }));
    expect(cfg.apiKey).toBe("b");
  });

  it("fails with a clear message when no key is configured", () => {
    expect(() => loadLLMConfig(env({}))).toThrow(/No API key/);
  });

  it("rejects an unknown provider name", () => {
    expect(() => loadLLMConfig(env({ LLM_PROVIDER: "foo", LLM_API_KEY: "k" }))).toThrow(/LLM_PROVIDER/);
  });

  it("requires a base URL and model for a custom endpoint", () => {
    expect(() => loadLLMConfig(env({ LLM_PROVIDER: "custom", LLM_API_KEY: "k" }))).toThrow(/LLM_BASE_URL/);
    const cfg = loadLLMConfig(
      env({ LLM_PROVIDER: "custom", LLM_API_KEY: "k", LLM_BASE_URL: "http://localhost:11434/v1", LLM_MODEL_FAST: "llama3.1" })
    );
    expect(cfg.baseURL).toBe("http://localhost:11434/v1");
    expect(cfg.models.strong).toBe("llama3.1");
  });
});
