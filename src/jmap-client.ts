import type { Email, EmailChanges, Mailbox } from "./types";

export class JmapClient {
	constructor(
		private readonly token: string,
		private readonly apiUrl: string,
	) {}

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

	async createMailbox(accountId: string, name: string, parentId?: string): Promise<string> {
		const mailboxData: { name: string; parentId?: string } = {
			name,
		};

		if (parentId) {
			mailboxData.parentId = parentId;
		}

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
						"Mailbox/set",
						{
							accountId,
							create: {
								"new-mailbox": mailboxData,
							},
						},
						"c1",
					],
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to create mailbox: ${response.status}`);
		}

		const result = await response.json();

		if (result.methodResponses[0][1].created) {
			return result.methodResponses[0][1].created["new-mailbox"].id;
		}

		throw new Error(`Failed to create mailbox: ${JSON.stringify(result.methodResponses[0][1])}`);
	}

	async moveEmail(accountId: string, emailId: string, targetMailboxId: string): Promise<void> {
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
						"Email/set",
						{
							accountId,
							update: {
								[emailId]: {
									mailboxIds: {
										[targetMailboxId]: true,
									},
								},
							},
						},
						"c1",
					],
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to move email: ${response.status}`);
		}

		const result = await response.json();

		if (!result.methodResponses[0][1].updated || !(emailId in result.methodResponses[0][1].updated)) {
			throw new Error(`Failed to move email: ${JSON.stringify(result.methodResponses[0][1])}`);
		}
	}
}
