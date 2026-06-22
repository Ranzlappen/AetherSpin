import { describe, it, expect } from "vitest";
import { loadGameDefinition, listGameIds } from "./loadDefinition.js";
import { toApiAmount, fromApiAmount, API_AMOUNT_MULTIPLIER } from "./index.js";

describe("shared game definitions", () => {
  it("lists at least novaforged and template", () => {
    const ids = listGameIds();
    expect(ids).toContain("novaforged");
    expect(ids).toContain("template");
  });

  it("loads a structurally valid NovaForged definition", () => {
    const d = loadGameDefinition("novaforged");
    expect(d.id).toBe("novaforged");
    expect(d.engine.numReels).toBe(5);
    expect(d.engine.numRows).toBe(3);
    expect(d.paylines.length).toBe(20);
    expect(Object.keys(d.paytable)).toContain("W");
    expect(d.betModes.some((m) => m.isBuyBonus)).toBe(true);
    expect(d.engine.rtpTarget).toBeGreaterThan(0.9);
    expect(d.engine.rtpTarget).toBeLessThan(1);
  });

  it("converts amounts via the API multiplier", () => {
    expect(toApiAmount(1)).toBe(API_AMOUNT_MULTIPLIER);
    expect(fromApiAmount(API_AMOUNT_MULTIPLIER)).toBe(1);
    expect(toApiAmount(0.1)).toBe(100000);
  });
});
