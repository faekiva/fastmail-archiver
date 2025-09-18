import JamClient from "jmap-jam";

import { initializeEmailStates, processEmailChanges } from "./email-processing";
import { EmailStateTracker } from "./email-state-tracker";
import { JmapClient } from "./jmap-client";
import { JmapEventStream } from "./jmap-event-stream";
import { createMailboxNames, findInboxAndChildren } from "./mailbox-utils";
import type { AppConfig, JmapPushEvent } from "./types";

async function setupApplication(): Promise<AppConfig> {
	const token = process.env.FASTMAIL_TOKEN;
	if (!token) {
		throw new Error("FASTMAIL_TOKEN not found in environment variables");
	}

	const jam = new JamClient({
		sessionUrl: "https://api.fastmail.com/jmap/session",
		bearerToken: token,
	});

	const accountId = await jam.getPrimaryAccount();
	const session = await jam.session;

	if (!session.eventSourceUrl) {
		throw new Error("EventSource URL not available in session");
	}

	return {
		token,
		accountId,
		apiUrl: session.apiUrl,
		eventSourceUrl: session.eventSourceUrl,
	};
}

async function handlePushEvent(
	data: JmapPushEvent,
	client: JmapClient,
	accountId: string,
	stateTracker: EmailStateTracker,
	mailboxNames: Map<string, string>,
	trackedMailboxIds: string[],
): Promise<void> {
	if (!data.changed?.[accountId]?.Email) {
		return;
	}

	console.log("Email state changed, fetching changes...");
	const changes = await client.getEmailChanges(accountId, data.changed[accountId].Email);
	await processEmailChanges(changes, client, accountId, stateTracker, mailboxNames, trackedMailboxIds);
}

async function main(): Promise<void> {
	const config = await setupApplication();
	const client = new JmapClient(config.token, config.apiUrl);
	const stateTracker = new EmailStateTracker();

	const mailboxes = await client.getMailboxes(config.accountId);
	console.log("Mailboxes:", JSON.stringify({ list: mailboxes }, null, 2));

	const mailboxNames = createMailboxNames(mailboxes);
	const trackedMailboxIds = findInboxAndChildren(mailboxes);

	console.log("Initializing email states for Inbox and child folders...");
	await initializeEmailStates(client, config.accountId, trackedMailboxIds, stateTracker);

	const eventStream = new JmapEventStream(config.eventSourceUrl, config.token, (data) =>
		handlePushEvent(data, client, config.accountId, stateTracker, mailboxNames, trackedMailboxIds),
	);

	try {
		await eventStream.connect();
		console.log("Listening for push events... Press Ctrl+C to exit");
	} catch (error) {
		console.error("Event stream error:", error);
	}
}

void main().catch((error) => {
	console.error("Application error:", error);
	process.exit(1);
});
