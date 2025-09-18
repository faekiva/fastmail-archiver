import type { Email, Mailbox, EmailChanges } from "./types.js";

export class JmapClient {
	constructor(private token: string, private apiUrl: string) {}

	async getMailboxes(accountId: string): Promise<Mailbox[]> {
		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
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
			throw new Error(`Failed to fetch mailboxes: ${response.status}`);
		}

		const result = await response.json();
		return result.methodResponses[0][1].list;
	}

	async getEmails(accountId: string, emailIds: string[]): Promise<Email[]> {
		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({
				using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
				methodCalls: [
					[
						"Email/get",
						{
							accountId,
							ids: emailIds,
							properties: ["id", "mailboxIds", "subject"],
						},
						"c1",
					],
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch emails: ${response.status}`);
		}

		const result = await response.json();
		return result.methodResponses[0][1].list;
	}

	async getEmailChanges(accountId: string, sinceState: string): Promise<EmailChanges> {
		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({
				using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
				methodCalls: [
					[
						"Email/changes",
						{
							accountId,
							sinceState,
							maxChanges: 50,
						},
						"c1",
					],
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch email changes: ${response.status}`);
		}

		const result = await response.json();
		return result.methodResponses[0][1];
	}

	async queryEmails(accountId: string, filter: object = {}): Promise<string[]> {
		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({
				using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
				methodCalls: [
					[
						"Email/query",
						{
							accountId,
							filter,
							limit: 1000,
						},
						"c1",
					],
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to query emails: ${response.status}`);
		}

		const result = await response.json();
		return result.methodResponses[0][1].ids;
	}
}