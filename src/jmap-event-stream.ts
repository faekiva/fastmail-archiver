export class JmapEventStream {
	private shouldStop = false;
	private reader?: ReadableStreamDefaultReader<Uint8Array>;

	constructor(
		private url: string,
		private token: string,
		private onEvent: (data: any) => Promise<void>
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

		this.reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (!this.reader) {
			throw new Error("No readable stream available");
		}

		// Handle graceful shutdown
		process.on("SIGINT", () => {
			console.log("Closing event stream connection...");
			this.disconnect();
			process.exit(0);
		});

		// Read the stream
		let done = false;
		while (!done && !this.shouldStop) {
			const result = await this.reader.read();
			done = result.done;

			if (done) break;

			const chunk = decoder.decode(result.value, { stream: true });
			const lines = chunk.split("\n");

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const eventData = line.slice(6);
					console.log("Push event received:", eventData);

					try {
						const data = JSON.parse(eventData);
						console.log("Parsed push data:", JSON.stringify(data, null, 2));
						await this.onEvent(data);
					} catch (_e) {
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
		if (this.reader) {
			void this.reader.cancel();
		}
	}
}