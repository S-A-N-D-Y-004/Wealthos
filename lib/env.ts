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
    super(formatEnvironmentConfigurationMessage(details));
    this.name = "EnvironmentConfigurationError";
  }
}

const DEFAULT_DEVELOPMENT_AUTH_URL = "http://localhost:3000";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;
const PRODUCTION_BUILD_PHASE = "phase-production-build";

export function getAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV);
  const strictRuntime = env.NEXT_PHASE !== PRODUCTION_BUILD_PHASE;
  const strictProductionRuntime = nodeEnv === "production" && strictRuntime;
  const errors: string[] = [];
  const databaseUrl = clean(env.DATABASE_URL);
  const authSecret = clean(env.AUTH_SECRET);
  const authUrl = clean(env.AUTH_URL) ?? clean(env.NEXTAUTH_URL) ?? (nodeEnv === "production" ? undefined : DEFAULT_DEVELOPMENT_AUTH_URL);
  const googleClientId = clean(env.AUTH_GOOGLE_ID) ?? clean(env.GOOGLE_CLIENT_ID);
  const googleClientSecret = clean(env.AUTH_GOOGLE_SECRET) ?? clean(env.GOOGLE_CLIENT_SECRET);
  const emailServer = clean(env.AUTH_EMAIL_SERVER);
  const emailFrom = clean(env.AUTH_EMAIL_FROM);
  const google = completePair(
    "AUTH_GOOGLE_ID or GOOGLE_CLIENT_ID",
    googleClientId,
    "AUTH_GOOGLE_SECRET or GOOGLE_CLIENT_SECRET",
    googleClientSecret,
    errors
  );
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

  if (strictRuntime && !authSecret) {
    errors.push(missingAuthSecretMessage());
  } else if (strictRuntime && isPlaceholderSecret(authSecret)) {
    errors.push([
      "AUTH_SECRET still uses an example placeholder.",
      "Generate a real secret with:",
      "",
      "npx auth secret",
      "",
      "and place it inside .env.local."
    ].join("\n"));
  } else if (strictProductionRuntime && !isValidProductionSecret(authSecret)) {
    errors.push([
      "AUTH_SECRET must be at least 32 characters in production.",
      "Generate one with:",
      "",
      "npx auth secret",
      "",
      "and store it in your production secret manager."
    ].join("\n"));
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
  return Boolean(value && value.length >= 32 && !isPlaceholderSecret(value));
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

function isPlaceholderSecret(value: string | undefined) {
  return value === "replace-with-a-long-random-secret";
}

function missingAuthSecretMessage() {
  return [
    "AUTH_SECRET is missing.",
    "Generate one with:",
    "",
    "npx auth secret",
    "",
    "and place it inside .env.local."
  ].join("\n");
}

function formatEnvironmentConfigurationMessage(details: string[]) {
  return [
    "WealthOS environment setup is incomplete.",
    "",
    ...details.map((detail) => `- ${detail}`)
  ].join("\n");
}
