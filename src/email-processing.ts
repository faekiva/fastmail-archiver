import { analyzeEmailMove, formatMoveMessage } from "./email-analysis";
import type { EmailStateTracker } from "./email-state-tracker";
import type { JmapClient } from "./jmap-client";
import { shouldTrackEmail } from "./mailbox-utils";
import type { EmailChanges } from "./types";

export async function initializeEmailStates(
	client: JmapClient,
	accountId: string,
	trackedMailboxIds: string[],
	stateTracker: EmailStateTracker,
): Promise<void> {
	try {
		const emailIds = await client.queryEmails(accountId, {});
		const emails = await client.getEmails(accountId, emailIds);

		// Filter emails to only include those in tracked mailboxes
		const trackedEmails = emails.filter((email) => {
			const emailMailboxIds = Object.keys(email.mailboxIds);

			return emailMailboxIds.some((id) => trackedMailboxIds.includes(id));
		});

		for (const email of trackedEmails) {
			const mailboxIds = Object.keys(email.mailboxIds);
			stateTracker.set(email.id, mailboxIds);
		}

		console.log(`Initialized states for ${trackedEmails.length} emails in tracked mailboxes`);
	} catch (error) {
		console.error("Error initializing email states:", error);
	}
}

export async function processEmailChanges(
	changes: EmailChanges,
	client: JmapClient,
	accountId: string,
	stateTracker: EmailStateTracker,
	mailboxNames: Map<string, string>,
	trackedMailboxIds: string[],
): Promise<void> {
	if (changes.updated.length === 0) {
		return;
	}

	try {
		const emails = await client.getEmails(accountId, changes.updated);

		for (const email of emails) {
			if (!shouldTrackEmail(email, trackedMailboxIds, stateTracker)) {
				continue;
			}

			const currentMailboxIds = Object.keys(email.mailboxIds);
			const previousMailboxIds = stateTracker.get(email.id);

			const moveDescription = analyzeEmailMove(currentMailboxIds, previousMailboxIds, mailboxNames);
			if (moveDescription) {
				moveDescription.subject = email.subject ?? "(no subject)";
				console.log(formatMoveMessage(moveDescription));
			}

			// Update stored state
			stateTracker.set(email.id, currentMailboxIds);
		}
	} catch (error) {
		console.error("Error processing email changes:", error);
	}
}
