import { createEventSource } from "eventsource-client";

import type { JmapPushEvent } from "./types";

export class JmapEventStream {
	private shouldStop = false;
	private eventSourcePromise?: Promise<void>;

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

		const eventSource = createEventSource({
			url: eventSourceUrl,
			headers: {
				Authorization: `Bearer ${this.token}`,
			},
		});

		console.log("Event stream connection opened");

		// Handle graceful shutdown
		process.on("SIGINT", () => {
			console.log("Closing event stream connection...");
			this.disconnect();
			process.exit(0);
		});

		// Store the promise so we can potentially cancel it
		this.eventSourcePromise = this.processEventStream(eventSource);
		await this.eventSourcePromise;
	}

	disconnect(): void {
		this.shouldStop = true;
	}

	private async processEventStream(eventSource: AsyncIterable<{ data: string; event?: string; id?: string }>) {
		try {
			for await (const { data, event, id } of eventSource) {
				if (this.shouldStop) {
					break;
				}

				if (event) {
					console.log("Event type:", event);
				}

				if (id) {
					console.log("Event ID:", id);
				}

				console.log("Push event received:", data);

				try {
					const parsedData = JSON.parse(data);
					console.log("Parsed push data:", JSON.stringify(parsedData, null, 2));
					void this.onEvent(parsedData);
				} catch {
					console.log("Raw push data:", data);
				}
			}
		} catch (error) {
			console.error("Event stream error:", error);
			throw error;
		}
	}
}
