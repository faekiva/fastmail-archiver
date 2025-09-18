import JamClient from "jmap-jam";

// Store email states to track moves
const emailStates = new Map<string, string[]>();

// Helper function to compare arrays
function arraysEqual(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((val, index) => val === b[index]);
}

// Initialize email states by fetching current emails
async function initializeEmailStates(accountId: string, token: string, apiUrl: string, trackedMailboxIds: string[]) {
	try {
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
				methodCalls: [
					[
						"Email/query",
						{
							accountId,
							filter: {},
							limit: 1000,
						},
						"c1",
					],
					[
						"Email/get",
						{
							accountId,
							"#ids": {
								resultOf: "c1",
								name: "Email/query",
								path: "/ids",
							},
							properties: ["id", "mailboxIds"],
						},
						"c2",
					],
				],
			}),
		});

		if (!response.ok) {
			console.error("Failed to initialize email states");
			return;
		}

		const result = await response.json();
		const emails = result.methodResponses[1][1].list;

		// Filter emails to only include those in tracked mailboxes
		const trackedEmails = emails.filter(email => {
			const emailMailboxIds = Object.keys(email.mailboxIds);
			return emailMailboxIds.some(id => trackedMailboxIds.includes(id));
		});

		for (const email of trackedEmails) {
			const mailboxIds = Object.keys(email.mailboxIds);
			emailStates.set(email.id, mailboxIds);
		}

		console.log(`Initialized states for ${trackedEmails.length} emails in tracked mailboxes`);
	} catch (error) {
		console.error("Error initializing email states:", error);
	}
}

// Handle email changes to detect moves between mailboxes
async function handleEmailChanges(
	emailState: string,
	accountId: string,
	token: string,
	apiUrl: string,
	mailboxMap: Map<string, string>,
	trackedMailboxIds: string[],
) {
	try {
		const changesResponse = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
				methodCalls: [
					[
						"Email/changes",
						{
							accountId,
							sinceState: emailState,
							maxChanges: 50,
						},
						"c1",
					],
				],
			}),
		});

		if (!changesResponse.ok) {
			console.error("Failed to fetch email changes");
			return;
		}

		const changesResult = await changesResponse.json();
		const changes = changesResult.methodResponses[0][1];

		if (changes.updated && changes.updated.length > 0) {
			// Fetch the updated emails to see mailbox changes
			const emailsResponse = await fetch(apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
					methodCalls: [
						[
							"Email/get",
							{
								accountId,
								ids: changes.updated,
								properties: ["id", "mailboxIds", "subject"],
							},
							"c2",
						],
					],
				}),
			});

			if (!emailsResponse.ok) {
				console.error("Failed to fetch updated emails");
				return;
			}

			const emailsResult = await emailsResponse.json();
			const emails = emailsResult.methodResponses[0][1].list;

			for (const email of emails) {
				const currentMailboxIds = Object.keys(email.mailboxIds);
				const previousMailboxIds = emailStates.get(email.id) || [];

				// Only process emails that are in tracked mailboxes (current or previous)
				const isTracked = currentMailboxIds.some(id => trackedMailboxIds.includes(id)) ||
					previousMailboxIds.some(id => trackedMailboxIds.includes(id));

				if (!isTracked) continue;

				// Check if mailboxes actually changed
				const hasChanged = !arraysEqual(currentMailboxIds.sort(), previousMailboxIds.sort());

				if (hasChanged) {
					const currentMailboxNames = currentMailboxIds.map((id) => mailboxMap.get(id) ?? id);
					const previousMailboxNames = previousMailboxIds.map((id) => mailboxMap.get(id) ?? id);

					const sourceMailboxes = previousMailboxNames.filter(name =>
						!currentMailboxNames.includes(name)
					);
					const destMailboxes = currentMailboxNames.filter(name =>
						!previousMailboxNames.includes(name)
					);

					if (sourceMailboxes.length > 0 && destMailboxes.length > 0) {
						console.log(`📧 Email moved: "${email.subject}" from ${sourceMailboxes.join(", ")} → ${destMailboxes.join(", ")}`);
					} else if (destMailboxes.length > 0) {
						console.log(`📧 Email added: "${email.subject}" → ${destMailboxes.join(", ")}`);
					} else if (sourceMailboxes.length > 0) {
						console.log(`📧 Email removed: "${email.subject}" from ${sourceMailboxes.join(", ")}`);
					}
				}

				// Update stored state
				emailStates.set(email.id, currentMailboxIds);
			}
		}
	} catch (error) {
		console.error("Error handling email changes:", error);
	}
}

async function main() {
	const token = process.env.FASTMAIL_TOKEN;
	if (token === undefined) {
		throw new Error("fastmail token not in env");
	}
	// throw new Error("test error for stack trace");
	const jam = new JamClient({
		sessionUrl: "https://api.fastmail.com/jmap/session",
		bearerToken: token,
	});
	const accountId = await jam.getPrimaryAccount();
	const session = await jam.session;

	const response = await fetch(session.apiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
			methodCalls: [
				[
					"Mailbox/get",
					{
						accountId,
						ids: null,
						properties: ["id", "name", "role", "parentId", "totalEmails", "unreadEmails"],
					},
					"c1",
				],
			],
		}),
	});

	if (!response.ok) {
		console.error(`HTTP error! status: ${response.status}`);
		const errorText = await response.text();
		console.error("Error response:", errorText);

		return;
	}

	const result = await response.json();
	console.log("Mailboxes:", JSON.stringify(result, null, 2));

	// Create mailbox ID to name mapping for push event handling
	const mailboxMap = new Map<string, string>();
	const mailboxes = result.methodResponses[0][1].list;
	for (const mailbox of mailboxes) {
		mailboxMap.set(mailbox.id, mailbox.name);
	}

	// Find Inbox and its child folders
	const inboxMailbox = mailboxes.find(m => m.role === "inbox");
	const inboxAndChildren = mailboxes.filter(m =>
		m.id === inboxMailbox?.id || m.parentId === inboxMailbox?.id
	);
	const trackedMailboxIds = inboxAndChildren.map(m => m.id);

	// Initialize email states by fetching current emails in tracked mailboxes
	console.log("Initializing email states for Inbox and child folders...");
	await initializeEmailStates(accountId, token, session.apiUrl, trackedMailboxIds);

	// Subscribe to push events using fetch with streaming
	if (session.eventSourceUrl) {
		const eventSourceUrl = session.eventSourceUrl
			.replace("{types}", "Email,Mailbox,Thread")
			.replace("{closeafter}", "state")
			.replace("{ping}", "240");

		console.log("Connecting to event stream:", eventSourceUrl);

		try {
			const response = await fetch(eventSourceUrl, {
				method: "GET",
				headers: {
					Accept: "text/event-stream",
					Authorization: `Bearer ${token}`,
					"Cache-Control": "no-cache",
				},
			});

			if (!response.ok) {
				console.error(`Event stream connection failed: ${response.status}`);
				return;
			}

			console.log("Event stream connection opened");

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				console.error("No readable stream available");
				return;
			}

			// Handle graceful shutdown
			let shouldStop = false;
			process.on("SIGINT", () => {
				console.log("Closing event stream connection...");
				shouldStop = true;
				reader.cancel();
				process.exit(0);
			});

			// Read the stream
			while (!shouldStop) {
				const { done, value } = await reader.read();

				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = line.slice(6);
						console.log("Push event received:", eventData);

						try {
							const data = JSON.parse(eventData);
							console.log("Parsed push data:", JSON.stringify(data, null, 2));

							// Handle state change events to detect email moves
							if (data.changed && data.changed[accountId] && data.changed[accountId].Email) {
								console.log("Email state changed, fetching changes...");
								await handleEmailChanges(data.changed[accountId].Email, accountId, token, session.apiUrl, mailboxMap, trackedMailboxIds);
							}
						} catch (_e) {
							console.log("Raw push data:", eventData);
						}
					} else if (line.startsWith("event: ")) {
						const eventType = line.slice(7);
						console.log("Event type:", eventType);
					}
				}
			}
		} catch (error) {
			console.error("Event stream error:", error);
		}

		console.log("Listening for push events... Press Ctrl+C to exit");
	} else {
		console.log("EventSource URL not available in session");
	}

	// const mailboxes = await jam.api.Mailbox.get({ accountId });
	// console.log(mailboxes);
}

await main();
