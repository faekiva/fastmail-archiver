import {
	buildMailboxHierarchy,
	findMailboxByPath,
	type MailboxHierarchy,
	shouldMirrorToArchive,
} from "./archive-mirroring";
import type { JmapClient } from "./jmap-client";
import type { Mailbox } from "./types";

export class MailboxOperations {
	private hierarchyMap: Map<string, MailboxHierarchy> = new Map();

	constructor(
		private readonly client: JmapClient,
		private readonly accountId: string,
	) {}

	updateMailboxes(mailboxes: Mailbox[]): void {
		this.hierarchyMap = buildMailboxHierarchy(mailboxes);
	}

	async createMissingMailboxes(missingPaths: string[]): Promise<Map<string, string>> {
		const createdMailboxes = new Map<string, string>();

		for (const path of missingPaths) {
			const pathParts = path.split("/");
			const name = pathParts[pathParts.length - 1];
			const parentPath = pathParts.slice(0, -1).join("/");

			let parentId: string | undefined;
			if (parentPath) {
				const parentMailbox = findMailboxByPath(parentPath, this.hierarchyMap);
				if (parentMailbox) {
					parentId = parentMailbox.id;
				} else if (createdMailboxes.has(parentPath)) {
					parentId = createdMailboxes.get(parentPath);
				}
			}

			try {
				// eslint-disable-next-line no-await-in-loop
				const newMailboxId = await this.client.createMailbox(this.accountId, name, parentId);
				createdMailboxes.set(path, newMailboxId);

				const newMailbox: Mailbox = {
					id: newMailboxId,
					name,
					parentId,
					role: null,
					totalEmails: 0,
					unreadEmails: 0,
				};

				const hierarchy: MailboxHierarchy = {
					mailbox: newMailbox,
					path,
					children: [],
				};

				this.hierarchyMap.set(newMailboxId, hierarchy);

				if (parentId) {
					const parent = this.hierarchyMap.get(parentId);
					if (parent) {
						parent.children.push(hierarchy);
					}
				}

				console.log(`📁 Created mailbox: ${path}`);
			} catch (error) {
				console.error(`Failed to create mailbox ${path}:`, error);
				throw error;
			}
		}

		return createdMailboxes;
	}

	async handleEmailMove(
		emailId: string,
		emailSubject: string,
		sourceMailboxes: string[],
		destMailboxes: string[],
	): Promise<boolean> {
		const mirrorResult = shouldMirrorToArchive(sourceMailboxes, destMailboxes, this.hierarchyMap);

		if (!mirrorResult.shouldMirror) {
			return false;
		}

		console.log(`🔄 Processing archive mirror for "${emailSubject}"`);
		console.log(`   From: ${mirrorResult.sourcePath} → To: ${mirrorResult.targetPath}`);

		let targetMailboxId = mirrorResult.targetMailboxId;

		if (!targetMailboxId && mirrorResult.missingMailboxes) {
			try {
				const createdMailboxes = await this.createMissingMailboxes(mirrorResult.missingMailboxes);
				targetMailboxId = createdMailboxes.get(mirrorResult.targetPath ?? "");
			} catch (error) {
				console.error(`Failed to create missing mailboxes for ${mirrorResult.targetPath}:`, error);

				return false;
			}
		}

		if (!targetMailboxId) {
			console.error(`Could not determine target mailbox ID for ${mirrorResult.targetPath}`);

			return false;
		}

		try {
			await this.client.moveEmail(this.accountId, emailId, targetMailboxId);
			console.log(`✅ Email "${emailSubject}" moved to ${mirrorResult.targetPath}`);

			return true;
		} catch (error) {
			console.error(`Failed to move email "${emailSubject}" to ${mirrorResult.targetPath}:`, error);

			return false;
		}
	}
}
