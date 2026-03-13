import type { EnhancedOutput } from '../../shared/ipc';
import type { EnhancementArtifacts } from './enhancement-artifacts';

export type EnhancementErrorCode =
  | 'invalid_api_key'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'invalid_response'
  | 'unknown';

export interface LlmClient {
  enhance(input: EnhancementArtifacts): Promise<EnhancedOutput>;
}

export interface EnhancementProviderErrorOptions {
  cause?: unknown;
  provider?: string;
}

export class EnhancementProviderError extends Error {
  public readonly code: EnhancementErrorCode;
  public readonly provider: string | undefined;
  public override readonly cause: unknown;

  public constructor(
    code: EnhancementErrorCode,
    message: string,
    options?: EnhancementProviderErrorOptions
  ) {
    super(message);
    this.name = 'EnhancementProviderError';
    this.code = code;
    this.provider = options?.provider;
    this.cause = options?.cause;
  }
}

export function isRetryableEnhancementError(error: unknown): boolean {
  if (!(error instanceof EnhancementProviderError)) {
    return false;
  }

  return error.code === 'rate_limited' || error.code === 'timeout' || error.code === 'network';
}

export function normalizeEnhancementError(
  error: unknown,
  options?: { provider?: string; fallbackMessage?: string }
): EnhancementProviderError {
  if (error instanceof EnhancementProviderError) {
    return error;
  }

  const provider = options?.provider;
  const fallbackMessage = options?.fallbackMessage ?? 'Enhancement request failed.';
  const status = getNumericProperty(error, 'status');
  const code = getStringProperty(error, 'code');
  const message = getStringProperty(error, 'message') ?? fallbackMessage;

  if (status === 401 || status === 403 || code === 'invalid_api_key') {
    return new EnhancementProviderError('invalid_api_key', message, {
      ...createErrorOptions(provider, error)
    });
  }

  if (status === 429 || code === 'rate_limited') {
    return new EnhancementProviderError('rate_limited', message, {
      ...createErrorOptions(provider, error)
    });
  }

  if (code === 'timeout' || code === 'ETIMEDOUT' || code === 'AbortError') {
    return new EnhancementProviderError('timeout', message, {
      ...createErrorOptions(provider, error)
    });
  }

  if (
    code === 'network' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  ) {
    return new EnhancementProviderError('network', message, {
      ...createErrorOptions(provider, error)
    });
  }

  if (code === 'invalid_response') {
    return new EnhancementProviderError('invalid_response', message, {
      ...createErrorOptions(provider, error)
    });
  }

  return new EnhancementProviderError('unknown', message, {
    ...createErrorOptions(provider, error)
  });
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate[key] === 'string' ? candidate[key] : undefined;
}

function getNumericProperty(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate[key] === 'number' ? candidate[key] : undefined;
}

function createErrorOptions(
  provider: string | undefined,
  cause: unknown
): EnhancementProviderErrorOptions {
  return {
    cause,
    ...(provider ? { provider } : {})
  };
}
