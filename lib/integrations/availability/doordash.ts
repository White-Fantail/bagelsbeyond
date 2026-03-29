// ─── Bagel Availability: DoorDash Adapter ─────────────────────────────────────
// Pushes bagel availability state to DoorDash (item 86ing / reactivation).
//
// Strategy:
//  - For "item": Use the DoorDash Drive/Merchant API to 86 or reactivate the item.
//  - For "option": Use the option-level 86 endpoint if available.
//  - If access is not certified for the API path, surfaces the error and preserves local state.
//
// Environment variables:
//   DOORDASH_DEVELOPER_ID   — DoorDash developer ID
//   DOORDASH_KEY_ID         — DoorDash key ID
//   DOORDASH_SIGNING_SECRET — DoorDash signing secret (PEM ES256 private key)
//   DOORDASH_API_BASE_URL   — Override base URL

import type { AvailabilityAdapter, ChannelMapping, SyncOutcome } from "./base";

const DEFAULT_BASE_URL = "https://openapi.doordash.com/merchant/v1";

const DD_JWT_VER = "DD-JWT-V1";
const DD_JWT_VER_CLAIM = "dd-ver";
const DD_KEY_ID_HEADER = "dd-keyid";

function getBaseUrl(): string {
  return process.env.DOORDASH_API_BASE_URL ?? DEFAULT_BASE_URL;
}

function isConfigured(): boolean {
  return !!(
    process.env.DOORDASH_DEVELOPER_ID &&
    process.env.DOORDASH_KEY_ID &&
    process.env.DOORDASH_SIGNING_SECRET
  );
}

async function buildJwt(): Promise<string | null> {
  // DoorDash uses JWT with ES256 signed with the developer's private key
  try {
    const developerId = process.env.DOORDASH_DEVELOPER_ID;
    const keyId = process.env.DOORDASH_KEY_ID;
    const signingSecret = process.env.DOORDASH_SIGNING_SECRET;

    if (!developerId || !keyId || !signingSecret) return null;

    const { SignJWT, importPKCS8 } = await import("jose");

    const privateKey = await importPKCS8(
      signingSecret.replace(/\\n/g, "\n"),
      "ES256"
    );

    const token = await new SignJWT({ [DD_JWT_VER_CLAIM]: DD_JWT_VER })
      .setProtectedHeader({ alg: "ES256", [DD_KEY_ID_HEADER]: `${developerId}/${keyId}` })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    return token;
  } catch {
    return null;
  }
}

export const doordashAvailabilityAdapter: AvailabilityAdapter = {
  channel: "doordash",

  async pushAvailability(
    _bagelTypeCode: string,
    isAvailable: boolean,
    mappings: ChannelMapping[]
  ): Promise<SyncOutcome> {
    const enabledMappings = mappings.filter((m) => m.isEnabled);

    if (enabledMappings.length === 0) {
      return { status: "skipped", reason: "No enabled DoorDash mappings for this bagel type" };
    }

    if (!isConfigured()) {
      return {
        status: "skipped",
        reason: "DoorDash credentials not configured (DOORDASH_DEVELOPER_ID / DOORDASH_KEY_ID / DOORDASH_SIGNING_SECRET)",
      };
    }

    const jwt = await buildJwt();
    if (!jwt) {
      return {
        status: "failed",
        error: "Could not build DoorDash JWT — check DOORDASH_SIGNING_SECRET format (must be PEM ES256 private key)",
        retryable: false,
      };
    }

    const errors: string[] = [];
    let successCount = 0;

    for (const mapping of enabledMappings) {
      const storeId = mapping.remoteStoreId;
      const entityId = mapping.remoteEntityId;
      const entityType = mapping.remoteEntityType;

      if (!storeId || !entityId) {
        errors.push(`Mapping ${mapping.id}: remoteStoreId and remoteEntityId required`);
        continue;
      }

      try {
        let url: string;
        let body: Record<string, unknown>;

        if (entityType === "option" || entityType === "modifier_option") {
          // Option-level 86
          url = `${getBaseUrl()}/stores/${storeId}/extras/${entityId}/86`;
          body = { is_86ed: !isAvailable };
        } else {
          // Item-level 86
          url = `${getBaseUrl()}/stores/${storeId}/items/${entityId}/86`;
          body = { is_86ed: !isAvailable };
        }

        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          successCount++;
        } else {
          const responseBody = await res.text().catch(() => "");
          if (res.status === 403 || res.status === 401) {
            errors.push(
              `Mapping ${mapping.id}: Access denied (${res.status}). ` +
              `This DoorDash account may not have the required API certification. ` +
              `Local state preserved. Error: ${responseBody.slice(0, 200)}`
            );
          } else {
            errors.push(`Mapping ${mapping.id}: HTTP ${res.status}: ${responseBody.slice(0, 200)}`);
          }
        }
      } catch (err) {
        errors.push(`Mapping ${mapping.id}: ${String(err)}`);
      }
    }

    if (successCount === enabledMappings.length && errors.length === 0) {
      return { status: "success", remoteState: isAvailable };
    }
    if (successCount === 0) {
      return { status: "failed", error: errors.join("; "), retryable: true };
    }
    return { status: "partial", successCount, failureCount: errors.length, errors };
  },
};
