import Anthropic from "@anthropic-ai/sdk";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Claude Haiku: quick/casual/normal 티어 (빠르고 저렴)
// Claude Sonnet: detailed/expert 티어 (고품질)
const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";
const CLAUDE_SONNET = "claude-sonnet-4-6";

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GeminiGenerateContentResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
}

export interface GenerateTextOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
  systemInstruction?: string;
  /** 품질 티어에 따라 Sonnet 사용. 기본 Haiku. */
  useHighQuality?: boolean;
}

export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {}
): Promise<string | null> {
  const model = options.useHighQuality ? CLAUDE_SONNET : CLAUDE_HAIKU;
  try {
    const msg = await anthropicClient.messages.create({
      model,
      max_tokens: options.maxOutputTokens ?? 1024,
      temperature: options.temperature ?? 0.9,
      system: options.systemInstruction ?? "You are a helpful assistant.",
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    if (!block || block.type !== "text") return null;
    return block.text;
  } catch (error) {
    console.error("Claude 텍스트 생성 실패:", error);
    return null;
  }
}

export async function generateImage(
  prompt: string,
  _style: "photo" | "illustration" | "flat" = "illustration"
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY가 설정되지 않았습니다.");
    return null;
  }

  const fullPrompt = [
    `고품질 블로그 썸네일 이미지를 생성해주세요.`,
    `주제: ${prompt}`,
    `스타일: 깔끔하고 현대적인 한국 블로그 스타일`,
    `텍스트 없이 비주얼만 생성`,
  ].join("\n");

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: fullPrompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`Gemini API 오류: ${response.status}`);
      return null;
    }

    const responseData: GeminiGenerateContentResponse = await response.json();
    const firstCandidate = responseData.candidates[0];
    if (!firstCandidate) return null;

    const imagePart = firstCandidate.content.parts.find(
      (part) => part.inlineData
    );

    if (imagePart?.inlineData) {
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }

    return null;
  } catch (error) {
    console.error("Gemini 이미지 생성 실패:", error);
    return null;
  }
}
