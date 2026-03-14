import { describe, it, expect } from "vitest";
import { serializeState, deserializeState, cloneState, SerializationError } from "../../src/state/serialize";
import { createInitialState } from "../../src/state/initial";

describe("serializeState", () => {
  it("should serialize state to JSON string", () => {
    const state = createInitialState(Date.now(), 12345);
    const json = serializeState(state);

    expect(typeof json).toBe("string");
    expect(json).toContain('"meta"');
    expect(json).toContain('"wallet"');
    expect(json).toContain('"tavern"');
    expect(json).toContain('"heroes"');
    expect(json).toContain('"time"');
  });

  it("should produce valid JSON that can be parsed", () => {
    const state = createInitialState(Date.now(), 12345);
    const json = serializeState(state);
    const parsed = JSON.parse(json);

    expect(parsed).toBeDefined();
  });
});

describe("deserializeState", () => {
  it("should deserialize valid JSON to GameState", () => {
    const state = createInitialState(Date.now(), 12345);
    const json = serializeState(state);
    const restored = deserializeState(json);

    expect(restored.meta.version).toBe("0.2.0");
    expect(restored.meta.rootSeed).toBe(12345);
    // Starting gold: 10g (10,000 in fixed-point units)
    expect(restored.wallet.gold).toBe(10000);
    expect(restored.tavern.level).toBe(1);
  });

  it("should throw SerializationError for invalid JSON", () => {
    expect(() => deserializeState("not valid json")).toThrow(SerializationError);
  });

  it("should throw SerializationError for non-GameState objects", () => {
    expect(() => deserializeState('{"foo": "bar"}')).toThrow(SerializationError);
  });
});

describe("cloneState", () => {
  it("should create a deep copy of state", () => {
    const state = createInitialState(Date.now(), 12345);
    const clone = cloneState(state);

    expect(clone).toEqual(state);
    expect(clone).not.toBe(state);
  });
});

describe("round-trip", () => {
  it("should preserve all state data through serialize/deserialize", () => {
    const original = createInitialState(1700000000000, 99999);
    const json = serializeState(original);
    const restored = deserializeState(json);

    expect(restored).toEqual(original);
  });
});
