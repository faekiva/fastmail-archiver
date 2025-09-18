import type { Mailbox, Email } from "./types.js";
import type { EmailStateTracker } from "./email-state-tracker.js";

export function createMailboxNames(mailboxes: Mailbox[]): Map<string, string> {
	const mailboxNames = new Map<string, string>();
	for (const mailbox of mailboxes) {
		mailboxNames.set(mailbox.id, mailbox.name);
	}
	return mailboxNames;
}

export function findInboxAndChildren(mailboxes: Mailbox[]): string[] {
	const inboxMailbox = mailboxes.find((m) => m.role === "inbox");
	const inboxAndChildren = mailboxes.filter(
		(m) => m.id === inboxMailbox?.id || m.parentId === inboxMailbox?.id
	);
	return inboxAndChildren.map((m) => m.id);
}

export function shouldTrackEmail(
	email: Email,
	trackedMailboxIds: string[],
	stateTracker: EmailStateTracker
): boolean {
	const currentMailboxIds = Object.keys(email.mailboxIds);
	const previousMailboxIds = stateTracker.get(email.id);

	return (
		currentMailboxIds.some((id) => trackedMailboxIds.includes(id)) ||
		previousMailboxIds.some((id) => trackedMailboxIds.includes(id))
	);
}