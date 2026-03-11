import { describe, expect, it } from "vitest";
import { PROMPTS } from "./prompts.js";

describe("PROMPTS", () => {
  describe("ask", () => {
    it("is a non-empty string", () => {
      expect(typeof PROMPTS.ask).toBe("string");
      expect(PROMPTS.ask.length).toBeGreaterThan(0);
    });
  });

  describe("explainError", () => {
    it("instructs to explain, list causes, and suggest fixes", () => {
      expect(PROMPTS.explainError).toMatch(/explain/i);
      expect(PROMPTS.explainError).toMatch(/caus/i);
      expect(PROMPTS.explainError).toMatch(/fix/i);
    });
  });

  describe("summarize", () => {
    it("bullets format mentions bullet points", () => {
      expect(PROMPTS.summarize("bullets")).toMatch(/bullet/i);
    });

    it("paragraph format mentions paragraph", () => {
      expect(PROMPTS.summarize("paragraph")).toMatch(/paragraph/i);
    });

    it("tldr format mentions TL;DR", () => {
      expect(PROMPTS.summarize("tldr")).toMatch(/TL;DR/);
    });

    it("returns distinct prompts for each format", () => {
      const bullets = PROMPTS.summarize("bullets");
      const paragraph = PROMPTS.summarize("paragraph");
      const tldr = PROMPTS.summarize("tldr");
      expect(bullets).not.toBe(paragraph);
      expect(bullets).not.toBe(tldr);
      expect(paragraph).not.toBe(tldr);
    });
  });

  describe("generateCommit", () => {
    it("includes conventional commit format hint", () => {
      expect(PROMPTS.generateCommit).toMatch(/feat|fix|chore/);
    });

    it("instructs to output only the commit message", () => {
      expect(PROMPTS.generateCommit).toMatch(/ONLY/);
    });

    it("mentions 72 character limit", () => {
      expect(PROMPTS.generateCommit).toMatch(/72/);
    });
  });

  describe("translate", () => {
    it("instructs to output only the translation", () => {
      expect(PROMPTS.translate).toMatch(/only/i);
    });
  });

  describe("reviewCode", () => {
    it("includes all four review categories", () => {
      expect(PROMPTS.reviewCode).toMatch(/Bug/i);
      expect(PROMPTS.reviewCode).toMatch(/Security/i);
      expect(PROMPTS.reviewCode).toMatch(/Performance/i);
      expect(PROMPTS.reviewCode).toMatch(/Style/i);
    });
  });
});
