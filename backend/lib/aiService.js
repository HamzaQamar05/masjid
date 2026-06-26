const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODERATIONS_URL = 'https://api.openai.com/v1/moderations';

export const defaultAiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function authHeaders() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

export function extractResponseText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string') return response.output_text.trim();
  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
      if (typeof content.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('\n').trim();
}

export function parseAiJson(text, fallback = {}) {
  if (!text) return fallback;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[0]);
    } catch {
      return fallback;
    }
  }
}

export function usageFromResponse(response) {
  const usage = response?.usage || {};
  return {
    promptTokens: usage.input_tokens ?? usage.prompt_tokens ?? null,
    completionTokens: usage.output_tokens ?? usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null
  };
}

export async function runModeration(input) {
  const text = String(input || '').slice(0, 8000);
  if (!text.trim()) return { flagged: false, categories: {}, categoryScores: {}, usage: {} };
  const response = await fetch(OPENAI_MODERATIONS_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model: 'omni-moderation-latest', input: text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'AI moderation failed.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  const result = data.results?.[0] || {};
  return {
    flagged: Boolean(result.flagged),
    categories: result.categories || {},
    categoryScores: result.category_scores || {},
    usage: usageFromResponse(data)
  };
}

export async function runAiText({ system, prompt, maxOutputTokens = 700, model = defaultAiModel }) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      instructions: system,
      input: prompt,
      max_output_tokens: maxOutputTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'AI request failed.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return {
    text: extractResponseText(data),
    raw: data,
    usage: usageFromResponse(data)
  };
}

export async function runAiImageRead({ system, prompt, imageUrl, maxOutputTokens = 800, model = defaultAiModel }) {
  if (!imageUrl) {
    const error = new Error('An image URL or data URL is required.');
    error.status = 400;
    throw error;
  }
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      instructions: system,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl }
          ]
        }
      ],
      max_output_tokens: maxOutputTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'AI poster reading failed.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return {
    text: extractResponseText(data),
    raw: data,
    usage: usageFromResponse(data)
  };
}
