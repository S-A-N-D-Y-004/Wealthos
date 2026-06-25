export type AuthRuntimeConfig = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl?: string;
  authSecret?: string;
  authUrl?: string;
  trustHost: boolean;
  google?: {
    clientId: string;
    clientSecret: string;
  };
  email?: {
    server: string;
    from: string;
  };
  enableDevelopmentCredentials: boolean;
  sessionMaxAgeSeconds: number;
  sessionUpdateAgeSeconds: number;
};

export class EnvironmentConfigurationError extends Error {
  readonly code = "ENV_VALIDATION_ERROR";

  constructor(readonly details: string[]) {
    super(`Invalid WealthOS environment configuration: ${details.join("; ")}`);
    this.name = "EnvironmentConfigurationError";
  }
}

const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;
const PRODUCTION_BUILD_PHASE = "phase-production-build";

export function getAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV);
  const strictProductionRuntime = nodeEnv === "production" && env.NEXT_PHASE !== PRODUCTION_BUILD_PHASE;
  const errors: string[] = [];
  const databaseUrl = clean(env.DATABASE_URL);
  const authSecret = clean(env.AUTH_SECRET);
  const authUrl = clean(env.AUTH_URL);
  const googleClientId = clean(env.AUTH_GOOGLE_ID);
  const googleClientSecret = clean(env.AUTH_GOOGLE_SECRET);
  const emailServer = clean(env.AUTH_EMAIL_SERVER);
  const emailFrom = clean(env.AUTH_EMAIL_FROM);
  const google = completePair("AUTH_GOOGLE_ID", googleClientId, "AUTH_GOOGLE_SECRET", googleClientSecret, errors);
  const email = completePair("AUTH_EMAIL_SERVER", emailServer, "AUTH_EMAIL_FROM", emailFrom, errors);
  const enableDevelopmentCredentials =
    nodeEnv !== "production" && clean(env.WEALTHOS_ENABLE_DEV_CREDENTIALS) !== "false";
  const sessionMaxAgeSeconds = parsePositiveInteger(
    env.AUTH_SESSION_MAX_AGE_SECONDS,
    DEFAULT_SESSION_MAX_AGE_SECONDS,
    "AUTH_SESSION_MAX_AGE_SECONDS",
    errors
  );
  const sessionUpdateAgeSeconds = parsePositiveInteger(
    env.AUTH_SESSION_UPDATE_AGE_SECONDS,
    DEFAULT_SESSION_UPDATE_AGE_SECONDS,
    "AUTH_SESSION_UPDATE_AGE_SECONDS",
    errors
  );

  if (strictProductionRuntime && !databaseUrl) {
    errors.push("DATABASE_URL is required in production.");
  }

  if (strictProductionRuntime && !isValidProductionSecret(authSecret)) {
    errors.push("AUTH_SECRET must be a non-placeholder secret with at least 32 characters in production.");
  }

  if (strictProductionRuntime && !isValidUrl(authUrl)) {
    errors.push("AUTH_URL must be a valid absolute URL in production.");
  }

  if (strictProductionRuntime && !google && !email) {
    errors.push("At least one production sign-in provider must be configured: Google OAuth or email.");
  }

  if (errors.length > 0) {
    throw new EnvironmentConfigurationError(errors);
  }

  return {
    nodeEnv,
    databaseUrl,
    authSecret,
    authUrl,
    trustHost: parseBoolean(env.AUTH_TRUST_HOST) ?? nodeEnv !== "production",
    google: google ? { clientId: google.left, clientSecret: google.right } : undefined,
    email: email ? { server: email.left, from: email.right } : undefined,
    enableDevelopmentCredentials,
    sessionMaxAgeSeconds,
    sessionUpdateAgeSeconds
  };
}

function normalizeNodeEnv(value: string | undefined): AuthRuntimeConfig["nodeEnv"] {
  return value === "production" || value === "test" ? value : "development";
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function completePair(
  leftName: string,
  left: string | undefined,
  rightName: string,
  right: string | undefined,
  errors: string[]
) {
  if (left && right) {
    return { left, right };
  }

  if (left || right) {
    errors.push(`${leftName} and ${rightName} must be configured together.`);
  }

  return undefined;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  errors: string[]
) {
  const cleaned = clean(value);

  if (!cleaned) {
    return fallback;
  }

  const parsed = Number(cleaned);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive integer.`);
    return fallback;
  }

  return parsed;
}

function parseBoolean(value: string | undefined) {
  const cleaned = clean(value)?.toLowerCase();

  if (cleaned === "true") {
    return true;
  }

  if (cleaned === "false") {
    return false;
  }

  return undefined;
}

function isValidProductionSecret(value: string | undefined) {
  return Boolean(value && value.length >= 32 && value !== "replace-with-a-long-random-secret");
}

function isValidUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}
