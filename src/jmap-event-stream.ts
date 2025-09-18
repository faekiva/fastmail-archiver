import type { JmapPushEvent } from "./types";

export class JmapEventStream {
	private shouldStop = false;

	constructor(
		private readonly url: string,
		private readonly token: string,
		private readonly onEvent: (data: JmapPushEvent) => Promise<void>,
	) {}

	async connect(): Promise<void> {
		const eventSourceUrl = this.url
			.replace("{types}", "Email,Mailbox,Thread")
			.replace("{closeafter}", "state")
			.replace("{ping}", "240");

		console.log("Connecting to event stream:", eventSourceUrl);

		const response = await fetch(eventSourceUrl, {
			method: "GET",
			headers: {
				Accept: "text/event-stream",
				Authorization: `Bearer ${this.token}`,
				"Cache-Control": "no-cache",
			},
		});

		if (!response.ok) {
			throw new Error(`Event stream connection failed: ${response.status}`);
		}

		console.log("Event stream connection opened");

		if (!response.body) {
			throw new Error("No readable stream available");
		}

		const decoder = new TextDecoder();

		// Handle graceful shutdown
		process.on("SIGINT", () => {
			console.log("Closing event stream connection...");
			this.disconnect();
			process.exit(0);
		});

		// Read the stream using modern async iteration
		for await (const chunk of response.body.values()) {
			if (this.shouldStop) {
				break;
			}

			const chunkText = decoder.decode(chunk, { stream: true });
			const lines = chunkText.split("\n");

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const eventData = line.slice(6);
					console.log("Push event received:", eventData);

					try {
						const data = JSON.parse(eventData);
						console.log("Parsed push data:", JSON.stringify(data, null, 2));
						void this.onEvent(data);
					} catch {
						console.log("Raw push data:", eventData);
					}
				} else if (line.startsWith("event: ")) {
					const eventType = line.slice(7);
					console.log("Event type:", eventType);
				}
			}
		}
	}

	disconnect(): void {
		this.shouldStop = true;
	}
}
