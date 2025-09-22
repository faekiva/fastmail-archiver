import type { EmailStateTracker } from "./email-state-tracker";
import type { Email, Mailbox } from "./types";

export function createMailboxNames(mailboxes: Mailbox[]): Map<string, string> {
	const mailboxNames = new Map<string, string>();

	// Build hierarchy to get full paths
	const hierarchyMap = new Map<string, { mailbox: Mailbox; children: string[]; path: string }>();

	// First pass: create all entries
	for (const mailbox of mailboxes) {
		hierarchyMap.set(mailbox.id, { mailbox, children: [], path: "" });
	}

	// Second pass: build parent-child relationships and paths
	for (const mailbox of mailboxes) {
		const entry = hierarchyMap.get(mailbox.id);
		if (!entry) {
			continue;
		}

		if (mailbox.parentId) {
			const parent = hierarchyMap.get(mailbox.parentId);
			if (parent) {
				parent.children.push(mailbox.id);
				entry.path = parent.path ? `${parent.path}/${mailbox.name}` : mailbox.name;
			} else {
				entry.path = mailbox.name;
			}
		} else {
			entry.path = mailbox.name;
		}

		mailboxNames.set(mailbox.id, entry.path);
	}

	return mailboxNames;
}

export function findInboxAndChildren(mailboxes: Mailbox[]): string[] {
	const inboxMailbox = mailboxes.find((m) => m.role === "inbox");
	const inboxAndChildren = mailboxes.filter((m) => m.id === inboxMailbox?.id || m.parentId === inboxMailbox?.id);

	return inboxAndChildren.map((m) => m.id);
}

export function shouldTrackEmail(email: Email, trackedMailboxIds: string[], stateTracker: EmailStateTracker): boolean {
	const currentMailboxIds = Object.keys(email.mailboxIds);
	const previousMailboxIds = stateTracker.get(email.id);

	return (
		currentMailboxIds.some((id) => trackedMailboxIds.includes(id)) ||
		previousMailboxIds.some((id) => trackedMailboxIds.includes(id))
	);
}
