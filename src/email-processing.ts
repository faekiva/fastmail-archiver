import { analyzeEmailMove, formatMoveMessage } from "./email-analysis";
import type { EmailStateTracker } from "./email-state-tracker";
import type { JmapClient } from "./jmap-client";
import { MailboxOperations } from "./mailbox-operations";
import { shouldTrackEmail } from "./mailbox-utils";
import type { EmailChanges, Mailbox } from "./types";

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
	_mailboxes: Mailbox[],
	mailboxOperations?: MailboxOperations,
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

			const moveAnalysis = analyzeEmailMove(currentMailboxIds, previousMailboxIds, mailboxNames);
			if (moveAnalysis) {
				const moveDescription = {
					...moveAnalysis,
					subject: email.subject ?? "(no subject)",
				};
				console.log(formatMoveMessage(moveDescription));

				if (mailboxOperations && moveAnalysis.type === "move") {
					const sourceMailboxIds = moveAnalysis.sourceMailboxes
						.map((name) => {
							for (const [id, mailboxName] of mailboxNames.entries()) {
								if (mailboxName === name) {
									return id;
								}
							}

							return "";
						})
						.filter((id) => id !== "");

					const destMailboxIds = moveAnalysis.destMailboxes
						.map((name) => {
							for (const [id, mailboxName] of mailboxNames.entries()) {
								if (mailboxName === name) {
									return id;
								}
							}

							return "";
						})
						.filter((id) => id !== "");

					// eslint-disable-next-line no-await-in-loop
					await mailboxOperations.handleEmailMove(
						email.id,
						email.subject ?? "(no subject)",
						sourceMailboxIds,
						destMailboxIds,
					);
				}
			}

			// Update stored state
			stateTracker.set(email.id, currentMailboxIds);
		}
	} catch (error) {
		console.error("Error processing email changes:", error);
	}
}
