import JamClient from "jmap-jam";

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
