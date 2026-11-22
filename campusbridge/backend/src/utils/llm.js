// Minimal client for the AI learning assistant. Runs ONLY on the server: the API key comes from backend/.env and is
// never returned to the browser or written to logs. Supports the Anthropic Messages API (default) and any
// OpenAI-compatible chat API. Nothing is stored: each call is independent.
import { config } from '../config.js';

export class LlmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

export const llmEnabled = () => Boolean(config.llm.apiKey);

// Roles must alternate and start with the user. Merge neighbours of the same role and drop a leading assistant turn.
export function normalizeTurns(turns) {
  const out = [];
  for (const t of turns) {
    if (!out.length && t.role !== 'user') continue;
    if (out.length && out[out.length - 1].role === t.role) out[out.length - 1].text += `\n\n${t.text}`;
    else out.push({ role: t.role, text: t.text });
  }
  return out;
}

export async function askLlm({ system, turns, maxTokens = 900 }) {
  if (!llmEnabled()) throw new LlmError('The AI assistant is not configured.', 503);
  const { provider, apiKey, model, baseUrl, timeoutMs } = config.llm;
  const messages = normalizeTurns(turns);

  let url; let headers; let body;
  if (provider === 'openai') {
    url = `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
    headers = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
    body = { model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.text }))] };
  } else {
    url = `${baseUrl || 'https://api.anthropic.com'}/v1/messages`;
    headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    body = { model, max_tokens: maxTokens, system, messages: messages.map((m) => ({ role: m.role, content: m.text })) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) {
      console.error(`AI assistant: the provider answered HTTP ${res.status}.`); // status only: never the body, never the key
      throw new LlmError('The AI provider returned an error.', res.status === 429 ? 429 : 502);
    }
    const data = await res.json();
    const text = provider === 'openai'
      ? data?.choices?.[0]?.message?.content
      : (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (!text || !String(text).trim()) throw new LlmError('The AI provider sent an empty answer.', 502);
    return String(text).trim();
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err?.name === 'AbortError') throw new LlmError('The AI provider took too long to answer.', 504);
    console.error('AI assistant: could not reach the provider.');
    throw new LlmError('The AI provider could not be reached.', 502);
  } finally {
    clearTimeout(timer);
  }
}
