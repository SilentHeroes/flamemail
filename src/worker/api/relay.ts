import type { Hono } from "hono";
import { EmailMessage } from "cloudflare:email";
import { nanoid } from "nanoid";
import { createMimeMessage } from "mimetext";
import {
  CreateRelayRequest,
  CreateRelayResponse,
  ErrorResponse,
  NotificationStatusResponse,
  SendEmailRequest,
  SendEmailResponse,
  SetNotificationRequest,
} from "@/shared/contracts";
import { emails } from "@/worker/db/schema";
import { createLogger, errorContext } from "@/worker/logger";
import { requireInboxAccess } from "@/worker/middleware/auth";
import { getPublicErrorMessage } from "@/worker/security";
import { storeEmailBody } from "@/worker/services/storage";
import { createOrJoinRelay, registerNotificationEmail } from "@/worker/services/relay";
import { verifyTurnstileToken } from "@/worker/services/turnstile";
import type { AppBindings } from "@/worker/types";

const logger = createLogger("relay-api");

const MIN_PASSPHRASE_LENGTH = 8;
const MAX_PASSPHRASE_LENGTH = 256;

export function registerRelayRoutes(app: Hono<AppBindings>) {
  app.post("/api/relay", async (c) => {
    let body;

    try {
      body = CreateRelayRequest.assertDecode(await c.req.json());
    } catch {
      return c.json(ErrorResponse.create({ error: "A passphrase and mailbox duration are required" }), 400);
    }

    const passphrase = body.passphrase.trim();

    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      return c.json(
        ErrorResponse.create({ error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters` }),
        400,
      );
    }

    if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
      return c.json(
        ErrorResponse.create({ error: `Passphrase must be at most ${MAX_PASSPHRASE_LENGTH} characters` }),
        400,
      );
    }

    const turnstileResult = await verifyTurnstileToken(c.env, {
      token: body.turnstileToken,
      expectedAction: "create_relay",
      remoteIp: c.req.header("cf-connecting-ip"),
      requestUrl: c.req.url,
    });

    if (!turnstileResult.ok) {
      logger.warn("create_relay_turnstile_failed", "Rejected relay creation request", {
        reason: turnstileResult.reason,
        errorCodes: turnstileResult.errorCodes,
      });
      return c.json(ErrorResponse.create({ error: turnstileResult.message }), turnstileResult.status);
    }

    try {
      const result = await createOrJoinRelay(c.env, passphrase, body.ttlHours, c.get("db"));
      return c.json(
        CreateRelayResponse.create({
          addressA: result.addressA,
          addressB: result.addressB,
          domainA: result.domainA,
          domainB: result.domainB,
          token: result.token,
          ttlHours: result.ttlHours,
          expiresAt: result.expiresAt.toISOString(),
        }),
        201,
      );
    } catch (error) {
      logger.warn("create_relay_failed", "Could not create relay channel", {
        ...errorContext(error),
      });
      return c.json(
        ErrorResponse.create({
          error: getPublicErrorMessage(error, "Could not create relay channel"),
        }),
        400,
      );
    }
  });

  app.put("/api/inboxes/:address/notification", requireInboxAccess, async (c) => {
    const inbox = c.get("inbox");

    if (!inbox.isRelay) {
      return c.json(ErrorResponse.create({ error: "Notifications are only available for relay inboxes" }), 400);
    }

    let body;

    try {
      body = SetNotificationRequest.assertDecode(await c.req.json());
    } catch {
      return c.json(ErrorResponse.create({ error: "A valid email address is required" }), 400);
    }

    const email = body.email.trim().toLowerCase();

    if (!email || !email.includes("@") || email.length < 5) {
      return c.json(ErrorResponse.create({ error: "A valid email address is required" }), 400);
    }

    try {
      await registerNotificationEmail(c.env, inbox.id, email, c.get("db"));
      return c.json(NotificationStatusResponse.create({ hasNotification: true }));
    } catch (error) {
      logger.warn("set_notification_failed", "Could not set notification email", {
        address: inbox.fullAddress,
        ...errorContext(error),
      });
      return c.json(
        ErrorResponse.create({
          error: getPublicErrorMessage(error, "Could not set notification email"),
        }),
        400,
      );
    }
  });

  app.get("/api/inboxes/:address/notification", requireInboxAccess, async (c) => {
    const inbox = c.get("inbox");
    return c.json(NotificationStatusResponse.create({ hasNotification: Boolean(inbox.notificationEmail) }));
  });

  app.post("/api/inboxes/:address/send", requireInboxAccess, async (c) => {
    const inbox = c.get("inbox");
    const session = c.get("session");

    if (session.type === "admin") {
      return c.json(ErrorResponse.create({ error: "Admin cannot send emails" }), 403);
    }

    let body;

    try {
      body = SendEmailRequest.assertDecode(await c.req.json());
    } catch {
      return c.json(ErrorResponse.create({ error: "A recipient, subject, and body are required" }), 400);
    }

    const to = body.to.trim().toLowerCase();

    if (!to || !to.includes("@") || to.length < 5) {
      return c.json(ErrorResponse.create({ error: "A valid recipient email address is required" }), 400);
    }

    try {
      const msg = createMimeMessage();
      msg.setSender({ addr: inbox.fullAddress, name: inbox.fullAddress });
      msg.setRecipient(to);
      msg.setSubject(body.subject || "(no subject)");
      msg.addMessage({
        contentType: "text/plain",
        data: body.body,
      });

      const emailMessage = new EmailMessage(
        inbox.fullAddress,
        to,
        msg.asRaw(),
      );

      await c.env.EMAIL_SEND.send(emailMessage);

      // Store sent email in D1 + R2
      const emailId = nanoid();
      const sentAt = new Date();
      const db = c.get("db");

      await db.insert(emails).values({
        id: emailId,
        inboxId: inbox.id,
        recipientAddress: to,
        fromAddress: inbox.fullAddress,
        fromName: null,
        subject: body.subject || "(no subject)",
        receivedAt: sentAt,
        isRead: true,
        isSent: true,
        sizeBytes: body.body.length,
        hasAttachments: false,
        bodyKey: `bodies/${emailId}.json`,
      });

      await storeEmailBody(c.env.STORAGE, emailId, {
        text: body.body,
        html: null,
      });

      logger.info("email_sent", "Sent outbound email from inbox", {
        from: inbox.fullAddress,
        to,
        subject: body.subject,
        emailId,
      });

      return c.json(SendEmailResponse.create({ ok: true }));
    } catch (error) {
      logger.warn("email_send_failed", "Could not send email", {
        from: inbox.fullAddress,
        to,
        ...errorContext(error),
      });
      return c.json(
        ErrorResponse.create({
          error: getPublicErrorMessage(error, "Could not send email"),
        }),
        400,
      );
    }
  });
}
