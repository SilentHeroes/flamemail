import { EmailMessage } from "cloudflare:email";
import { eq } from "drizzle-orm";
import { createMimeMessage } from "mimetext";
import { nanoid } from "nanoid";
import type { TempMailboxTtlHours } from "@/shared/contracts";
import type { Database } from "@/worker/db";
import { domains, inboxes, relayPairs } from "@/worker/db/schema";
import { createLogger, errorContext } from "@/worker/logger";
import { PublicError } from "@/worker/security";
import { computeInboxExpiry, createSessionToken } from "@/worker/services/inbox";
import type { InboxRecord } from "@/worker/types";

const logger = createLogger("relay-service");

const RELAY_DOMAINS = ["easydemo.org", "orangeclouded-tmn.net"] as const;

function hoursToMs(hours: number) {
  return hours * 60 * 60 * 1000;
}

async function hashPassphrase(passphrase: string): Promise<string> {
  const data = new TextEncoder().encode(passphrase);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveLocalParts(
  passphrase: string,
  primaryDomain: string,
  aliasDomain: string,
): Promise<{ primary: string; alias: string }> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  // Derive 20 bytes — 10 per local part, using domain-specific salts
  // so the two addresses have completely different local parts
  const [primaryBits, aliasBits] = await Promise.all([
    crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(`flamemail-relay-v1:${primaryDomain}`),
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      80,
    ),
    crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(`flamemail-relay-v1:${aliasDomain}`),
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      80,
    ),
  ]);

  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const toLocalPart = (bits: ArrayBuffer) =>
    Array.from(new Uint8Array(bits))
      .map((b) => alphabet[b % alphabet.length])
      .join("");

  return {
    primary: toLocalPart(primaryBits),
    alias: toLocalPart(aliasBits),
  };
}

export async function createOrJoinRelay(
  env: Env,
  passphrase: string,
  ttlHours: TempMailboxTtlHours,
  db: Database,
) {
  const hash = await hashPassphrase(passphrase);

  // Check if relay already exists for this passphrase
  const existingPair = await db.query.relayPairs.findFirst({
    where: eq(relayPairs.passphraseHash, hash),
  });

  if (existingPair) {
    // Join existing relay — return the same inbox with a new session token
    const inbox = await db.query.inboxes.findFirst({
      where: eq(inboxes.id, existingPair.inboxId),
    });

    if (!inbox) {
      throw new PublicError("Relay channel has expired");
    }

    const token = await createSessionToken(
      env,
      { type: "user", address: inbox.fullAddress },
      hoursToMs(ttlHours),
    );

    logger.info("relay_joined", "Party joined existing relay channel", {
      inboxAddress: inbox.fullAddress,
      aliasAddress: existingPair.aliasAddress,
    });

    return {
      inboxAddress: inbox.fullAddress,
      aliasAddress: existingPair.aliasAddress,
      primaryDomain: inbox.domain,
      aliasDomain: existingPair.aliasDomain,
      token,
      ttlHours,
      expiresAt: inbox.expiresAt!,
    };
  }

  // Create new relay — one inbox on domain A, alias on domain B
  const activeDomains = await db.query.domains.findMany({
    where: eq(domains.isActive, true),
  });

  const activeDomainNames = activeDomains.map((d) => d.domain);
  const primaryDomain = RELAY_DOMAINS.find((d) => activeDomainNames.includes(d));
  const aliasDomain = RELAY_DOMAINS.find((d) => activeDomainNames.includes(d) && d !== primaryDomain);

  if (!primaryDomain || !aliasDomain) {
    throw new PublicError("Relay domains are not available");
  }

  const { primary: primaryLocalPart, alias: aliasLocalPart } = await deriveLocalParts(
    passphrase,
    primaryDomain,
    aliasDomain,
  );
  const inboxAddress = `${primaryLocalPart}@${primaryDomain}`;
  const aliasAddress = `${aliasLocalPart}@${aliasDomain}`;

  // Check for collisions
  const [existingInbox, existingAlias] = await Promise.all([
    db.query.inboxes.findFirst({ where: eq(inboxes.fullAddress, inboxAddress) }),
    db.query.inboxes.findFirst({ where: eq(inboxes.fullAddress, aliasAddress) }),
  ]);

  if (existingInbox || existingAlias) {
    throw new PublicError("Could not create relay channel — please try a different passphrase");
  }

  const createdAt = new Date();
  const expiresAt = computeInboxExpiry(createdAt, ttlHours);
  const inboxId = nanoid();
  const pairId = nanoid();

  try {
    await db.batch([
      db.insert(inboxes).values({
        id: inboxId,
        localPart: primaryLocalPart,
        domain: primaryDomain,
        fullAddress: inboxAddress,
        isPermanent: false,
        isRelay: true,
        createdAt,
        expiresAt,
      }),
      db.insert(relayPairs).values({
        id: pairId,
        passphraseHash: hash,
        inboxId,
        aliasAddress,
        aliasDomain,
        createdAt,
        expiresAt,
      }),
    ] as any);
  } catch (error: any) {
    if (error?.message?.includes("UNIQUE constraint")) {
      logger.info("relay_concurrent_create", "Concurrent relay creation, retrying as join");
      return createOrJoinRelay(env, passphrase, ttlHours, db);
    }
    throw error;
  }

  const token = await createSessionToken(
    env,
    { type: "user", address: inboxAddress },
    hoursToMs(ttlHours),
  );

  logger.info("relay_created", "Created new relay channel", {
    inboxAddress,
    aliasAddress,
    primaryDomain,
    aliasDomain,
    ttlHours,
  });

  return {
    inboxAddress,
    aliasAddress,
    primaryDomain,
    aliasDomain,
    token,
    ttlHours,
    expiresAt,
  };
}

/**
 * Resolve an alias address to the real inbox.
 * Called by the email handler when no inbox is found by the recipient address directly.
 */
export async function resolveRelayAlias(
  aliasAddress: string,
  db: Database,
): Promise<InboxRecord | null> {
  const pair = await db.query.relayPairs.findFirst({
    where: eq(relayPairs.aliasAddress, aliasAddress),
  });

  if (!pair) {
    return null;
  }

  return (
    (await db.query.inboxes.findFirst({
      where: eq(inboxes.id, pair.inboxId),
    })) ?? null
  );
}

export async function registerNotificationEmail(
  env: Env,
  inboxId: string,
  email: string,
  db: Database,
) {
  await db
    .update(inboxes)
    .set({ notificationEmail: email.trim().toLowerCase() })
    .where(eq(inboxes.id, inboxId));

  logger.info("notification_email_registered", "Registered notification email for relay inbox", {
    inboxId,
  });
}

export async function sendRelayNotification(
  env: Env,
  notificationEmail: string,
  fromDomain: string,
  originalSubject: string,
) {
  const msg = createMimeMessage();
  msg.setSender({ addr: `relay@${fromDomain}`, name: "Mail Relay" });
  msg.setRecipient(notificationEmail);
  msg.setSubject(`[Relay] New message: ${originalSubject}`);
  msg.addMessage({
    contentType: "text/plain",
    data: [
      "You have a new message in your relay inbox.",
      "",
      `Subject: ${originalSubject}`,
      "",
      "Log in to read it.",
    ].join("\n"),
  });

  const emailMessage = new EmailMessage(
    `relay@${fromDomain}`,
    notificationEmail,
    msg.asRaw(),
  );

  await env.EMAIL_SEND.send(emailMessage);

  logger.info("relay_notification_sent", "Sent relay notification email", {
    fromDomain,
    subject: originalSubject,
  });
}
