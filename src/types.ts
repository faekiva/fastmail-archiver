import type { Email, Mailbox } from "jmap-jam/dist/types/jmap-mail";

export type { Email, Mailbox };

export interface EmailMoveResult {
	hasChanged: boolean;
	added: string[];
	removed: string[];
}

export interface MoveDescription {
	type: "move" | "add" | "remove";
	subject: string;
	sourceMailboxes: string[];
	destMailboxes: string[];
}

export interface EmailChanges {
	updated: string[];
	created: string[];
	destroyed: string[];
}

export interface AppConfig {
	token: string;
	accountId: string;
	apiUrl: string;
	eventSourceUrl: string;
}

export interface JmapPushEvent {
	type?: "connect" | "client" | string;
	clientId?: string;
	changed?: Record<
		string,
		{
			Email?: string;
			Mailbox?: string;
			Thread?: string;
			EmailDelivery?: string;
		}
	>;
	servertimestamp?: number;
}
