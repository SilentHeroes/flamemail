import { relations } from "drizzle-orm";
import { attachments, emails, inboxes, relayPairs } from "@/worker/db/schema";

export const inboxesRelations = relations(inboxes, ({ many }) => ({
  emails: many(emails),
  relayPairAsA: many(relayPairs, { relationName: "relayPairInboxA" }),
  relayPairAsB: many(relayPairs, { relationName: "relayPairInboxB" }),
}));

export const emailsRelations = relations(emails, ({ many, one }) => ({
  inbox: one(inboxes, {
    fields: [emails.inboxId],
    references: [inboxes.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  email: one(emails, {
    fields: [attachments.emailId],
    references: [emails.id],
  }),
}));

export const relayPairsRelations = relations(relayPairs, ({ one }) => ({
  inboxA: one(inboxes, {
    fields: [relayPairs.inboxAId],
    references: [inboxes.id],
    relationName: "relayPairInboxA",
  }),
  inboxB: one(inboxes, {
    fields: [relayPairs.inboxBId],
    references: [inboxes.id],
    relationName: "relayPairInboxB",
  }),
}));
