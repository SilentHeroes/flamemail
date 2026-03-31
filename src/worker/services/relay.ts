import { EmailMessage } from "cloudflare:email";
import { and, eq, or } from "drizzle-orm";
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

async function deriveRelayAddresses(
  passphrase: string,
  domainA: string,
  domainB: string,
): Promise<{ localA: string; localB: string; addressA: string; addressB: string }> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode("flamemail-relay-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    160, // 20 bytes: 10 per local part
  );

  const bytes = new Uint8Array(bits);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

  function bytesToLocalPart(slice: Uint8Array): string {
    return Array.from(slice)
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  }

  const localA = bytesToLocalPart(bytes.slice(0, 10));
  const localB = bytesToLocalPart(bytes.slice(10, 20));

  return {
    localA,
    localB,
    addressA: `${localA}@${domainA}`,
    addressB: `${localB}@${domainB}`,
  };
}

export async function createOrJoinRelay(
  env: Env,
  passphrase: string,
  ttlHours: TempMailboxTtlHours,
  db: Database,
) {
  const hash = await hashPassphrase(passphrase);

  // Check if a relay pair already exists for this passphrase
  const existingPair = await db.query.relayPairs.findFirst({
    where: eq(relayPairs.passphraseHash, hash),
  });

  if (existingPair) {
    // "Joiner" path — second party arriving
    const [inboxA, inboxB] = await Promise.all([
      db.query.inboxes.findFirst({ where: eq(inboxes.id, existingPair.inboxAId) }),
      db.query.inboxes.findFirst({ where: eq(inboxes.id, existingPair.inboxBId) }),
    ]);

    if (!inboxA || !inboxB) {
      throw new PublicError("Relay channel has expired");
    }

    // Create a session token for side B
    const token = await createSessionToken(
      env,
      { type: "user", address: inboxB.fullAddress },
      hoursToMs(ttlHours),
    );

    logger.info("relay_joined", "Second party joined relay channel", {
      addressA: inboxA.fullAddress,
      addressB: inboxB.fullAddress,
    });

    return {
      addressA: inboxA.fullAddress,
      addressB: inboxB.fullAddress,
      domainA: inboxA.domain,
      domainB: inboxB.domain,
      token,
      ttlHours,
      expiresAt: inboxB.expiresAt!,
    };
  }

  // "Creator" path — first party
  // Verify both relay domains are active
  const activeDomains = await db.query.domains.findMany({
    where: eq(domains.isActive, true),
  });

  const activeDomainNames = activeDomains.map((d) => d.domain);
  const domainA = RELAY_DOMAINS.find((d) => activeDomainNames.includes(d));
  const domainB = RELAY_DOMAINS.find((d) => activeDomainNames.includes(d) && d !== domainA);

  if (!domainA || !domainB) {
    throw new PublicError("Relay domains are not available");
  }

  const { localA, localB, addressA, addressB } = await deriveRelayAddresses(
    passphrase,
    domainA,
    domainB,
  );

  // Check for address collisions with existing inboxes
  const [existingA, existingB] = await Promise.all([
    db.query.inboxes.findFirst({ where: eq(inboxes.fullAddress, addressA) }),
    db.query.inboxes.findFirst({ where: eq(inboxes.fullAddress, addressB) }),
  ]);

  if (existingA || existingB) {
    throw new PublicError("Could not create relay channel — please try a different passphrase");
  }

  const createdAt = new Date();
  const expiresAt = computeInboxExpiry(createdAt, ttlHours);
  const inboxAId = nanoid();
  const inboxBId = nanoid();
  const pairId = nanoid();

  try {
    await db.batch([
      db.insert(inboxes).values({
        id: inboxAId,
        localPart: localA,
        domain: domainA,
        fullAddress: addressA,
        isPermanent: false,
        isRelay: true,
        createdAt,
        expiresAt,
      }),
      db.insert(inboxes).values({
        id: inboxBId,
        localPart: localB,
        domain: domainB,
        fullAddress: addressB,
        isPermanent: false,
        isRelay: true,
        createdAt,
        expiresAt,
      }),
      db.insert(relayPairs).values({
        id: pairId,
        passphraseHash: hash,
        inboxAId,
        inboxBId,
        createdAt,
        expiresAt,
      }),
    ] as any);
  } catch (error: any) {
    // Handle concurrent creation — UNIQUE constraint on passphrase_hash
    if (error?.message?.includes("UNIQUE constraint")) {
      logger.info("relay_concurrent_create", "Concurrent relay creation detected, retrying as join");
      return createOrJoinRelay(env, passphrase, ttlHours, db);
    }
    throw error;
  }

  // Create session token for side A (the creator)
  const token = await createSessionToken(
    env,
    { type: "user", address: addressA },
    hoursToMs(ttlHours),
  );

  logger.info("relay_created", "Created new relay channel", {
    addressA,
    addressB,
    domainA,
    domainB,
    ttlHours,
  });

  return {
    addressA,
    addressB,
    domainA,
    domainB,
    token,
    ttlHours,
    expiresAt,
  };
}

export async function getRelayPartner(
  env: Env,
  inboxId: string,
  db: Database,
): Promise<InboxRecord | null> {
  const pair = await db.query.relayPairs.findFirst({
    where: or(eq(relayPairs.inboxAId, inboxId), eq(relayPairs.inboxBId, inboxId)),
  });

  if (!pair) {
    return null;
  }

  const partnerId = pair.inboxAId === inboxId ? pair.inboxBId : pair.inboxAId;
  return (
    (await db.query.inboxes.findFirst({
      where: eq(inboxes.id, partnerId),
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
