export class EmailStateTracker {
	private states = new Map<string, string[]>();

	get(emailId: string): string[] {
		return this.states.get(emailId) ?? [];
	}

	set(emailId: string, mailboxIds: string[]): void {
		this.states.set(emailId, mailboxIds);
	}

	has(emailId: string): boolean {
		return this.states.has(emailId);
	}

	size(): number {
		return this.states.size;
	}
}