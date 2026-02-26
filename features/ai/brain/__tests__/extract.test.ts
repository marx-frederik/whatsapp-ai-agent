import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractToolFromText,
  safeParseToolArgs,
} from "@/features/ai/brain/extract";

describe("safeParseToolArgs", () => {
  (it("should successfully parse valid order_create args"),
    () => {
      // Arrange
      const validArgs = {
        customerIdentifier: "123",
        items: [{ skuOrName: "Cola", quantitiy: 2 }],
        note: null,
      };
      // Act
      const result = safeParseToolArgs("order_create", validArgs);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerIdentifier).toBe("123");
        expect(result.data.items[0].quantity).toBe(2);
        expect(result.data.items.length).toBe(1);
      }
    });

  (it("should fail when required field is missing"),
    () => {
      // Arrange
      const validArgs = {
        items: [{ skuOrName: "Cola", quantitiy: 2 }],
        note: null,
      };
      // Act
      const result = safeParseToolArgs("order_create", validArgs);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
});

// 1) Mock vor dem import der zu testenden datei (wichtig!)
vi.mock("@/services/ai/openai", () => {
  return {
    openAiClient: {
      responses: {
        create: vi.fn(),
      },
    },
  };
});

import { openAiClient } from "@/services/ai/openai";

describe("extractToolFromText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns text when no toolcall is present", async () => {
    const createMock = openAiClient.responses.create as unknown as ReturnType<
      typeof vi.fn
    >;
    createMock.mockResolvedValue(respWithText("Hallo"));

    const result = await extractToolFromText("irgendein input");

    expect(result.type).toBe("text");
    if (result.type === "text") {
      expect(result.text).toBe("Hallo");
    }

    expect(openAiClient.responses.create).toHaveBeenCalledTimes(1);
  });
  it("returns tool_call when order_create toolcall with valid args is present", async () => {
    const createMock = openAiClient.responses.create as unknown as ReturnType<
      typeof vi.fn
    >;

    const validArgs = {
      customerIdentifier: "123",
      items: [{ skuOrName: "Cola", quantity: 2 }],
      note: null,
    };

    createMock.mockResolvedValue(respWithToolCall("order_create", validArgs));

    const result = await extractToolFromText("Bitte 2x Cola für Kunde 123");

    expect(result.type).toBe("tool_call");
    if (result.type === "tool_call" && result.tool === "order_create") {
      expect(result.tool).toBe("order_create");
      expect(result.args.customerIdentifier).toBe("123");
      expect(result.args.items[0].skuOrName).toBe("Cola");
      expect(result.args.items[0].quantity).toBe(2);
    }

    expect(openAiClient.responses.create).toHaveBeenCalledTimes(1);
  });
});

function respWithToolCall(name: string, args: unknown) {
  return {
    output: [
      {
        type: "function_call",
        name,
        arguments: typeof args === "string" ? args : JSON.stringify(args),
      },
    ],
    output_text: null,
  };
}

function respWithText(text: string) {
  return {
    output: [{ type: "message" }],
    output_text: text,
  };
}
