import { runWhatsappAgent } from "./run-whatsapp-agent";
import { toolByName } from "../tools/agent-tool-bridge";
import type { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";

export const brainAgent = {
  async process(msg: NormalizedMessage) {
    const brainContext = {
      locale: "de-DE",
      timezone: "Europe/Berlin",
    };

    const result = await runWhatsappAgent({
      text: msg.text?.trim() ?? "",
      brainContext,
    });

    const lastTool = result.executedTools[result.executedTools.length - 1];

    if (lastTool) {
      const toolDef = toolByName.get(lastTool.toolName);

      if (toolDef) {
        const replyText = toolDef.render(
          lastTool.args as any,
          lastTool.result as any,
          brainContext,
        );

        return {
          replyText,
          raw: result.raw,
        };
      }
    }

    const replyText =
      typeof result.finalOutput === "string"
        ? result.finalOutput
        : JSON.stringify(result.finalOutput);

    return {
      replyText,
      raw: result.raw,
    };
  },
};