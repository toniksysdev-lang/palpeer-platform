const SENSITIVE_KEY =
  /pass(word)?|otp|^code$|^(new|current|old|confirm)?pin(code)?$|token|authorization|secret|cvv|cvc|^pan$|cardnumber|answer|credential/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const REDACTED = '[redacted]';

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === 'string') {
    return value.replace(BEARER, `Bearer ${REDACTED}`).replace(JWT, REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, depth + 1) };
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context?: unknown) {
  if (!__DEV__ && (level === 'debug' || level === 'info')) return;
  const payload = context === undefined ? [] : [redact(context)];
  if (level === 'error') {
    console.error(`[palpeer] ${message}`, ...payload);
  } else if (level === 'warn' || __DEV__) {
    console.warn(`[palpeer:${level}] ${message}`, ...payload);
  }
}

export const logger = {
  debug: (message: string, context?: unknown) => emit('debug', message, context),
  info: (message: string, context?: unknown) => emit('info', message, context),
  warn: (message: string, context?: unknown) => emit('warn', message, context),
  error: (message: string, context?: unknown) => emit('error', message, context),
};
