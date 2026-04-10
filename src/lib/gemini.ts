const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const TEXT_MODEL = "gemini-2.0-flash";

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

interface GenerateTextOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
  systemInstruction?: string;
}

export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {}
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY가 설정되지 않았습니다.");
    return null;
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.9,
      maxOutputTokens: options.maxOutputTokens ?? 512,
      responseMimeType: options.responseMimeType ?? "text/plain",
    },
  };

  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini text API 오류: ${response.status} ${errText}`);
      return null;
    }

    const payload: GeminiGenerateContentResponse = await response.json();
    const firstCandidate = payload.candidates?.[0];
    if (!firstCandidate) return null;

    const textPart = firstCandidate.content.parts.find((part) => part.text);
    return textPart?.text ?? null;
  } catch (error) {
    console.error("Gemini 텍스트 생성 실패:", error);
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
