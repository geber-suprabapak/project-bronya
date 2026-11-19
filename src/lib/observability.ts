import {
  context,
  propagation,
  type TextMapSetter,
  trace,
} from "@opentelemetry/api";

export type OperationalEvent = {
  event: "astra.request" | "auth.failure" | "http.request" | "request.error";
  outcome: "success" | "failure";
  service?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  code?: string;
  error?: string;
  durationMs?: number;
};

export interface ActiveTraceContext {
  traceId?: string;
  spanId?: string;
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+62|62|0)8\d{8,12}\b/g;
const NIK_OR_NISN_PATTERN = /\b\d{10,16}\b/g;
const SECRET_KV_PATTERN =
  /\b(authorization|cookie|set-cookie|token|access_token|refresh_token|id_token|password|passwd|secret|code|session)\s*[:=]\s*[^\s,;]+/gi;

const HEADERS_SETTER: TextMapSetter<Headers> = {
  set(carrier, key, value) {
    carrier.set(key, value);
  },
};

const RECORD_SETTER: TextMapSetter<Record<string, string>> = {
  set(carrier, key, value) {
    carrier[key] = value;
  },
};

export function createRequestId(candidate?: string | null): string {
  const normalized = candidate?.trim();
  return normalized && SAFE_REQUEST_ID.test(normalized)
    ? normalized
    : crypto.randomUUID();
}

export function getServiceName(): string {
  return process.env.OTEL_SERVICE_NAME?.trim() || "bronya";
}

export function safeOperationalPath(
  path: string | undefined,
): string | undefined {
  if (!path) return path;
  const trimmed = path.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed.split("?")[0]?.split("#")[0];
    }
  }
  return trimmed.split("?")[0]?.split("#")[0];
}

export function redactPiiText(value: string): string {
  return value
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(SECRET_KV_PATTERN, "$1=[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(NIK_OR_NISN_PATTERN, "[REDACTED_ID]");
}

export function getActiveTraceContext(): ActiveTraceContext {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (
    !spanContext ||
    !spanContext.traceId ||
    spanContext.traceId === "00000000000000000000000000000000"
  ) {
    return {};
  }
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

export function injectTraceHeaders(headers: Headers): void {
  propagation.inject(context.active(), headers, HEADERS_SETTER);
}

export function injectTraceRecord(headers: Record<string, string>): void {
  propagation.inject(context.active(), headers, RECORD_SETTER);
}

export function writeOperationalEvent(event: OperationalEvent): void {
  const activeTrace = getActiveTraceContext();
  const payload: OperationalEvent & { timestamp: string } = {
    timestamp: new Date().toISOString(),
    ...event,
    service: event.service ?? getServiceName(),
    path: safeOperationalPath(event.path),
  };
  if (activeTrace.traceId && !payload.traceId) {
    payload.traceId = activeTrace.traceId;
  }
  if (activeTrace.spanId && !payload.spanId) {
    payload.spanId = activeTrace.spanId;
  }
  if (event.error !== undefined) {
    payload.error = redactPiiText(event.error);
  }
  const entry = JSON.stringify(payload);

  if (event.outcome === "failure") {
    console.error(entry);
  } else {
    console.info(entry);
  }
}
