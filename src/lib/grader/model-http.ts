/**
 * One HTTP call to the Anthropic Messages API, with no `server-only` guard so
 * the calibration script can call it outside Next. The app imports
 * `anthropic.ts`, which adds the guard.
 *
 * No SDK: the request is four fields, and a dependency in the grading path is a
 * supply-chain surface for the thing that decides people's scores. The token
 * ceiling is enforced here rather than trusted to the prompt, and temperature is
 * 0 because a grader that drifts between identical submissions is not a grader.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 1_200;
const TIMEOUT_MS = 30_000;

export type ModelCall = (input: { system: string; user: string; model: string }) => Promise<string>;

export function graderModel(): string {
  return process.env.GRADER_MODEL?.trim() || "claude-sonnet-5-5";
}

export const callAnthropic: ModelCall = async ({ system, user, model }) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("grader_not_configured");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`grader_http_${response.status}`);

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = (payload.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  if (!text) throw new Error("grader_empty_response");
  return text;
};
