import { beforeAll, describe, expect, it, vi } from "vitest";
import { parseLLMJson } from "../src/utils";

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("parseLLMJson", () => {
  it("parses plain JSON", () => {
    expect(parseLLMJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences that LLMs often add", () => {
    expect(parseLLMJson<number[]>("```json\n[1, 2, 3]\n```")).toEqual([1, 2, 3]);
  });

  it("extracts JSON surrounded by explanatory text", () => {
    const reply = 'Here is the plan:\n{"mode": "main_only", "allow_external_retrieval": false}\nHope this helps!';
    expect(parseLLMJson<{ mode: string }>(reply).mode).toBe("main_only");
  });

  it("throws when the reply contains no JSON", () => {
    expect(() => parseLLMJson("I cannot answer that.")).toThrow();
  });
});
