import { describe, expect, it } from "vitest";
import { extractIdentity } from "./oauth.server";

// Real JWT structure (header.payload.signature, base64url-encoded) with
// a genuine claims payload -- decodeIdToken (from arctic) just base64url
// decodes and JSON-parses the middle segment, it doesn't verify the
// signature (verification already happened via validateAuthorizationCode's
// direct token-endpoint exchange, an HTTPS server-to-server call an
// attacker can't forge), so a hand-built token with a real payload shape
// exercises the same decode path a genuine one would.
function fakeIdToken(claims: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.`;
}

describe("extractIdentity", () => {
  it("reads Google's sub/email claims", () => {
    const token = fakeIdToken({
      sub: "108234567890123456789",
      email: "jane@example.com",
      name: "Jane Doe",
    });
    const identity = extractIdentity("google", token);
    expect(identity).toEqual({
      providerUserId: "108234567890123456789",
      email: "jane@example.com",
      fullName: "Jane Doe",
    });
  });

  it("reads Microsoft's oid claim, not sub", () => {
    const token = fakeIdToken({
      sub: "some-per-app-registration-value", // Microsoft's own sub is NOT stable across app registrations
      oid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      email: "john@example.com",
      name: "John Smith",
    });
    const identity = extractIdentity("microsoft", token);
    expect(identity.providerUserId).toBe(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(identity.providerUserId).not.toBe("some-per-app-registration-value");
  });

  it("falls back to preferred_username for a Microsoft work/school account with no email claim", () => {
    const token = fakeIdToken({
      oid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      preferred_username: "john@contoso.onmicrosoft.com",
    });
    const identity = extractIdentity("microsoft", token);
    expect(identity.email).toBe("john@contoso.onmicrosoft.com");
  });

  it("lowercases the email so it matches app_users' lookup consistently", () => {
    const token = fakeIdToken({ sub: "123", email: "Jane.Doe@Example.COM" });
    const identity = extractIdentity("google", token);
    expect(identity.email).toBe("jane.doe@example.com");
  });

  it("throws rather than silently proceeding when the required claims are missing", () => {
    const token = fakeIdToken({ name: "No Subject Or Email" });
    expect(() => extractIdentity("google", token)).toThrow();
  });

  it("has no fullName rather than crashing when name is absent", () => {
    const token = fakeIdToken({ sub: "123", email: "a@b.com" });
    const identity = extractIdentity("google", token);
    expect(identity.fullName).toBeNull();
  });
});
