import { eg, type TypeFromCodec } from "@cloudflare/util-en-garde";
import { NullableString, TurnstileToken } from "./common";
import { TempMailboxTtlHours } from "./inboxes";

export const CreateRelayRequest = eg.object({
  passphrase: eg.string,
  ttlHours: TempMailboxTtlHours,
  turnstileToken: TurnstileToken,
});
export type CreateRelayRequest = TypeFromCodec<typeof CreateRelayRequest>;

export const CreateRelayResponse = eg.object({
  addressA: eg.string,
  addressB: eg.string,
  domainA: eg.string,
  domainB: eg.string,
  token: eg.string,
  ttlHours: eg.number,
  expiresAt: eg.string,
});
export type CreateRelayResponse = TypeFromCodec<typeof CreateRelayResponse>;

export const SetNotificationRequest = eg.object({
  email: eg.string,
});
export type SetNotificationRequest = TypeFromCodec<typeof SetNotificationRequest>;

export const NotificationStatusResponse = eg.object({
  hasNotification: eg.boolean,
});
export type NotificationStatusResponse = TypeFromCodec<typeof NotificationStatusResponse>;

export const SendEmailRequest = eg.object({
  to: eg.string,
  subject: eg.string,
  body: eg.string,
});
export type SendEmailRequest = TypeFromCodec<typeof SendEmailRequest>;

export const SendEmailResponse = eg.object({
  ok: eg.boolean,
});
export type SendEmailResponse = TypeFromCodec<typeof SendEmailResponse>;
