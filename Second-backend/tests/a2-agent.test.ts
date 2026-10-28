// Tests agent A2's tool-calling loop with a scripted fake LLM.
// No network calls are made, so the test is free and deterministic.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("../src/llm/config", () => ({
  getLLMClient: () => ({ chat: { completions: { create } } }),
  getLLMConfig: () => ({ provider: "openai", apiKey: "test", models: { fast: "fake-fast", strong: "fake-strong" } }),
}));

import { run, type A2Task, type Evidence } from "../src/agents/a2/a2";

const evidence: Evidence[] = [
  {
    title: "Attention Is All You Need",
    authors: ["Vaswani, A.", "Shazeer, N."],
    year: "2017",
    journal: "NeurIPS",
    text: "The Transformer relies entirely on self-attention, unlike recurrent models [5].",
    source_type: "pdf",
    is_main_paper: true,
  },
  {
    title: "BERT",
    authors: ["Devlin, J."],
    year: "2019",
    journal: "NAACL",
    text: "BERT pre-trains deep bidirectional representations.",
    source_type: "abstract",
  },
];

const task = (ev: Evidence[] = evidence): A2Task => ({
  agent: "A2",
  action: "reason",
  inputs: { query: "What is a Transformer?", evidence: ev, expertise: "intermediate", format: "markdown" },
});

// Helpers that build the shape of an OpenAI Chat Completions response.
const toolCall = (name: string, args: object, id = `call_${name}`) => ({
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
    },
  ],
});
const finalReply = (content = "Done.") => ({ choices: [{ message: { role: "assistant", content } }] });

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

beforeEach(() => create.mockReset());

describe("A2 answer agent (mocked LLM)", () => {
  it("returns the synthesized answer after the tool loop finishes", async () => {
    create
      .mockResolvedValueOnce(toolCall("get_evidence", {}))
      .mockResolvedValueOnce(
        toolCall("synthesize_answer", {
          answer_text: "A Transformer is built only on self-attention [0].",
          cited_indices: [0],
          confidence: "high",
        })
      )
      .mockResolvedValueOnce(finalReply());

    const result = await run(task());

    expect(result.status).toBe("success");
    expect(result.answer).toContain("self-attention [0]");
    expect(result.confidence).toBe("high");
    expect(result.metadata?.citations_count).toBe(1);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[0][0].model).toBe("fake-fast");
  });

  it("removes citation markers that point to evidence that does not exist", async () => {
    create
      .mockResolvedValueOnce(
        toolCall("synthesize_answer", { answer_text: "Claim [1] and an invented source [7].", cited_indices: [1, 7] })
      )
      .mockResolvedValueOnce(finalReply());

    const result = await run(task());

    expect(result.answer).toContain("[1]");
    expect(result.answer).not.toContain("[7]");
    expect(result.metadata?.citations_count).toBe(1);
  });

  it("refuses to answer without evidence and never calls the LLM", async () => {
    const result = await run(task([]));

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/No evidence/);
    expect(create).not.toHaveBeenCalled();
  });

  it("reports an error when the model never produces an answer", async () => {
    create.mockResolvedValueOnce(finalReply("I am not sure."));

    const result = await run(task());

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/synthesize/i);
  });

  it("never shows the model the paper's own reference numbers as bracket markers", async () => {
    create
      .mockResolvedValueOnce(toolCall("get_evidence", {}))
      .mockResolvedValueOnce(toolCall("analyze_evidence", { indices: [0] }))
      .mockResolvedValueOnce(toolCall("synthesize_answer", { answer_text: "Self-attention only [0].", cited_indices: [0] }))
      .mockResolvedValueOnce(finalReply());

    await run(task());

    // The tool results the model saw are the "tool" messages in later calls.
    const lastCall = create.mock.calls[create.mock.calls.length - 1][0];
    const toolOutputs = lastCall.messages.filter((m: any) => m.role === "tool").map((m: any) => m.content).join("\n");
    expect(toolOutputs).toContain("(ref 5)");
    expect(toolOutputs).not.toContain("models [5]");
  });
});

