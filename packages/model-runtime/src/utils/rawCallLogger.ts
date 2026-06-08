import { desensitizeUrl } from './desensitizeUrl';

type RawLogMode = 'off' | 'safe' | 'full';

interface LogRawErrorParams {
  baseURL?: string;
  error: unknown;
  model?: string;
  operation: 'chat' | 'generateObject' | 'embeddings';
  provider: string;
}

interface LogRawRequestParams {
  baseURL?: string;
  model?: string;
  operation: 'chat' | 'generateObject' | 'embeddings';
  payload: unknown;
  provider: string;
}

const SENSITIVE_KEY_PATTERN =
  /^(apikey|api_key|token|secret|password|credential|authorization|bearer|api-key|ocp-apim-subscription-key|x-api-key|auth|key)$/i;

/**
 * Safely extract properties from an error object, avoiding circular references.
 * Returns a plain object snapshot suitable for JSON.stringify.
 */
function safeExtractError(error: unknown, mode: RawLogMode, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH]';

  if (error === null || error === undefined) return error;
  if (typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean') {
    return error;
  }

  if (error instanceof Error) {
    const extracted: Record<string, unknown> = {
      message: error.message,
      name: error.name,
    };

    // Extract non-standard properties from SDK errors (e.g. status, error body)
    for (const key of Object.getOwnPropertyNames(error)) {
      if (key === 'message' || key === 'name' || key === 'stack') continue;
      const value = (error as any)[key];
      extracted[key] = sanitizeValue(key, value, mode, depth);
    }

    return extracted;
  }

  if (Array.isArray(error)) {
    return error.map((item) => safeExtractError(item, mode, depth + 1));
  }

  if (typeof error === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(error as Record<string, unknown>)) {
      const value = (error as Record<string, unknown>)[key];
      result[key] = sanitizeValue(key, value, mode, depth);
    }
    return result;
  }

  return String(error);
}

function sanitizeValue(key: string, value: unknown, mode: RawLogMode, depth: number): unknown {
  // Always redact credential fields
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  // In safe mode, redact all headers
  if (mode === 'safe' && key.toLowerCase() === 'headers') {
    return '[REDACTED_HEADERS]';
  }

  // In full mode, redact only auth-related headers
  if (mode === 'full' && key.toLowerCase() === 'headers' && value && typeof value === 'object') {
    const sanitizedHeaders: Record<string, unknown> = {};
    for (const [hKey, hValue] of Object.entries(value as Record<string, unknown>)) {
      sanitizedHeaders[hKey] = SENSITIVE_KEY_PATTERN.test(hKey) ? '[REDACTED]' : hValue;
    }
    return sanitizedHeaders;
  }

  if (value && typeof value === 'object') {
    return safeExtractError(value, mode, depth + 1);
  }

  return value;
}

function getMode(): RawLogMode {
  const raw = process.env.DEBUG_MODEL_RUNTIME_RAW;
  if (raw === 'safe' || raw === 'full') return raw;
  return 'off';
}

function isProviderEnabled(provider: string): boolean {
  const filter = process.env.DEBUG_MODEL_RUNTIME_RAW_PROVIDERS;
  if (!filter) return true;
  const list = filter.split(',').map((s) => s.trim().toLowerCase());
  return list.includes(provider.toLowerCase());
}

/**
 * Summarize a request payload for safe-mode logging.
 * Strips message content but keeps structural info (count, roles, content lengths).
 */
function summarizePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const obj = payload as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Summarize messages array (OpenAI/Anthropic format)
    if (key === 'messages' && Array.isArray(value)) {
      result[key] = {
        count: value.length,
        roles: value.map((m: any) => ({
          contentLength: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content ?? '').length,
          role: m.role,
        })),
      };
      continue;
    }

    // Summarize contents array (Google format)
    if (key === 'contents' && Array.isArray(value)) {
      result[key] = {
        count: value.length,
        roles: value.map((c: any) => ({
          partsCount: Array.isArray(c.parts) ? c.parts.length : 0,
          role: c.role,
        })),
      };
      continue;
    }

    // Summarize tools array
    if (key === 'tools' && Array.isArray(value)) {
      result[key] = { count: value.length };
      continue;
    }

    // Summarize input array (OpenAI Responses API format)
    if (key === 'input' && Array.isArray(value)) {
      result[key] = {
        count: value.length,
        items: value.map((item: any) => {
          if (!item || typeof item !== 'object') return { type: 'unknown' };
          const summary: any = { type: item.type };
          if (item.role) summary.role = item.role;
          if (item.type === 'input_text' || item.type === 'output_text') {
            summary.textLength = typeof item.text === 'string' ? item.text.length : 0;
          }
          if (item.type === 'function_call') {
            summary.name = item.name;
          }
          if (item.type === 'function_call_output') {
            summary.outputLength = typeof item.output === 'string' ? item.output.length : 0;
          }
          if (item.type === 'reasoning') {
            const summaryArray = Array.isArray(item.summary) ? item.summary : [];
            summary.summaryLength = summaryArray.reduce((acc: number, s: any) =>
              acc + (typeof s.text === 'string' ? s.text.length : 0), 0);
          }
          return summary;
        }),
      };
      continue;
    }

    // Redact system instruction content
    if (key === 'systemInstruction' || key === 'system') {
      result[key] = typeof value === 'string'
        ? `[${value.length} chars]`
        : value ? '[present]' : value;
      continue;
    }

    // Pass through scalar config params (model, temperature, max_tokens, stream, etc.)
    result[key] = value;
  }

  return result;
}

/**
 * Log raw SDK error before it gets transformed by handleError.
 * Controlled by DEBUG_MODEL_RUNTIME_RAW env var (off | safe | full).
 */
export function logRawError(params: LogRawErrorParams): void {
  const mode = getMode();
  if (mode === 'off') return;
  if (!isProviderEnabled(params.provider)) return;

  try {
    const event = {
      baseURL: mode === 'safe' && params.baseURL ? desensitizeUrl(params.baseURL) : params.baseURL,
      error: safeExtractError(params.error, mode),
      event: 'error' as const,
      mode,
      model: params.model,
      operation: params.operation,
      provider: params.provider,
      timestamp: new Date().toISOString(),
    };

    console.error('[model-runtime:raw:error]', JSON.stringify(event));
  } catch {
    // Never let logging break the error handling flow
  }
}

/**
 * Log raw request payload before SDK call.
 * In safe mode, message content is summarized (counts + lengths only).
 * In full mode, the complete payload is logged for curl replay.
 * Controlled by DEBUG_MODEL_RUNTIME_RAW env var (off | safe | full).
 */
export function logRawRequest(params: LogRawRequestParams): void {
  const mode = getMode();
  if (mode === 'off') return;
  if (!isProviderEnabled(params.provider)) return;

  try {
    const event = {
      baseURL: mode === 'safe' && params.baseURL ? desensitizeUrl(params.baseURL) : params.baseURL,
      event: 'request' as const,
      mode,
      model: params.model,
      operation: params.operation,
      payload: mode === 'safe' ? summarizePayload(params.payload) : params.payload,
      provider: params.provider,
      timestamp: new Date().toISOString(),
    };

    console.log('[model-runtime:raw:request]', JSON.stringify(event));
  } catch {
    // Never let logging break the request flow
  }
}
