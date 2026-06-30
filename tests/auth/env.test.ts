import { describe, expect, it } from "vitest";
import {
  EnvironmentConfigurationError,
  getAuthRuntimeConfig
} from "@/lib/env";

describe("auth runtime environment", () => {
  it("enables development credentials outside production by default", () => {
    const config = getAuthRuntimeConfig({
      NODE_ENV: "development",
      AUTH_SECRET: "local-development-secret"
    });

    expect(config.authUrl).toBe("http://localhost:3000");
    expect(config.enableDevelopmentCredentials).toBe(true);
    expect(config.sessionMaxAgeSeconds).toBe(30 * 24 * 60 * 60);
    expect(config.sessionUpdateAgeSeconds).toBe(24 * 60 * 60);
  });

  it("explains missing local Auth.js secrets with setup instructions", () => {
    const loadConfig = () => getAuthRuntimeConfig({
      NODE_ENV: "development"
    });

    expect(loadConfig).toThrow(EnvironmentConfigurationError);
    expect(loadConfig).toThrow("AUTH_SECRET is missing");
    expect(loadConfig).toThrow("npx auth secret");
    expect(loadConfig).toThrow(".env.local");
  });

  it("supports NEXTAUTH_URL as a local compatibility fallback", () => {
    const config = getAuthRuntimeConfig({
      NODE_ENV: "development",
      AUTH_SECRET: "local-development-secret",
      NEXTAUTH_URL: "http://127.0.0.1:3000"
    });

    expect(config.authUrl).toBe("http://127.0.0.1:3000");
  });

  it("accepts production Google OAuth configuration", () => {
    const config = getAuthRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://wealthos:secret@localhost:5432/wealthos",
      AUTH_SECRET: "x".repeat(32),
      AUTH_URL: "https://wealthos.example.com",
      AUTH_GOOGLE_ID: "google-client-id",
      AUTH_GOOGLE_SECRET: "google-client-secret"
    });

    expect(config.google).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret"
    });
    expect(config.enableDevelopmentCredentials).toBe(false);
    expect(config.trustHost).toBe(false);
  });

  it("accepts Google OAuth compatibility aliases", () => {
    const config = getAuthRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://wealthos:secret@localhost:5432/wealthos",
      AUTH_SECRET: "x".repeat(32),
      AUTH_URL: "https://wealthos.example.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret"
    });

    expect(config.google).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret"
    });
  });

  it("accepts production email authentication configuration", () => {
    const config = getAuthRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://wealthos:secret@localhost:5432/wealthos",
      AUTH_SECRET: "x".repeat(32),
      AUTH_URL: "https://wealthos.example.com",
      AUTH_EMAIL_SERVER: "smtp://user:pass@smtp.example.com:587",
      AUTH_EMAIL_FROM: "WealthOS <security@example.com>"
    });

    expect(config.email).toEqual({
      server: "smtp://user:pass@smtp.example.com:587",
      from: "WealthOS <security@example.com>"
    });
  });

  it("rejects incomplete provider configuration", () => {
    expect(() => getAuthRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://wealthos:secret@localhost:5432/wealthos",
      AUTH_SECRET: "x".repeat(32),
      AUTH_URL: "https://wealthos.example.com",
      AUTH_GOOGLE_ID: "google-client-id"
    })).toThrow(EnvironmentConfigurationError);
  });

  it("requires a real production provider and secret", () => {
    expect(() => getAuthRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://wealthos:secret@localhost:5432/wealthos",
      AUTH_SECRET: "replace-with-a-long-random-secret",
      AUTH_URL: "https://wealthos.example.com"
    })).toThrow(EnvironmentConfigurationError);
  });
});
