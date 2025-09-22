import type { Mailbox } from "./types";

export interface MailboxHierarchy {
	mailbox: Mailbox;
	path: string;
	children: MailboxHierarchy[];
}

export interface MirrorResult {
	shouldMirror: boolean;
	sourcePath?: string;
	targetPath?: string;
	targetMailboxId?: string;
	missingMailboxes?: string[];
}

export function buildMailboxHierarchy(mailboxes: Mailbox[]): Map<string, MailboxHierarchy> {
	const hierarchyMap = new Map<string, MailboxHierarchy>();
	const rootMailboxes: MailboxHierarchy[] = [];

	for (const mailbox of mailboxes) {
		const hierarchy: MailboxHierarchy = {
			mailbox,
			path: "",
			children: [],
		};
		hierarchyMap.set(mailbox.id, hierarchy);
	}

	for (const mailbox of mailboxes) {
		const hierarchy = hierarchyMap.get(mailbox.id);
		if (!hierarchy) {
			continue;
		}

		if (mailbox.parentId) {
			const parent = hierarchyMap.get(mailbox.parentId);
			if (parent) {
				parent.children.push(hierarchy);
				hierarchy.path = parent.path ? `${parent.path}/${mailbox.name}` : mailbox.name;
			} else {
				hierarchy.path = mailbox.name;
			}
		} else {
			hierarchy.path = mailbox.name;
			rootMailboxes.push(hierarchy);
		}
	}

	return hierarchyMap;
}

export function getMailboxPath(mailboxId: string, hierarchyMap: Map<string, MailboxHierarchy>): string | null {
	const hierarchy = hierarchyMap.get(mailboxId);

	return hierarchy ? hierarchy.path : null;
}

export function findMailboxByPath(path: string, hierarchyMap: Map<string, MailboxHierarchy>): Mailbox | null {
	for (const hierarchy of hierarchyMap.values()) {
		if (hierarchy.path === path) {
			return hierarchy.mailbox;
		}
	}

	return null;
}

export function shouldMirrorToArchive(
	sourceMailboxes: string[],
	destMailboxes: string[],
	hierarchyMap: Map<string, MailboxHierarchy>,
): MirrorResult {
	const inboxMailbox = findInboxMailbox(hierarchyMap);
	const archiveMailbox = findArchiveMailbox(hierarchyMap);

	if (!inboxMailbox || !archiveMailbox) {
		return { shouldMirror: false };
	}

	let inboxSubfolderPath: string | null = null;

	for (const sourceId of sourceMailboxes) {
		const sourcePath = getMailboxPath(sourceId, hierarchyMap);
		if (sourcePath && isInboxSubfolder(sourcePath, inboxMailbox.mailbox.name)) {
			inboxSubfolderPath = sourcePath;
			break;
		}
	}

	if (!inboxSubfolderPath) {
		return { shouldMirror: false };
	}

	const isMovingToArchive = destMailboxes.some((destId) => {
		const destPath = getMailboxPath(destId, hierarchyMap);

		return destPath === archiveMailbox.mailbox.name;
	});

	if (!isMovingToArchive) {
		return { shouldMirror: false };
	}

	const relativePath = inboxSubfolderPath.substring(inboxMailbox.mailbox.name.length + 1);
	const targetPath = `${archiveMailbox.mailbox.name}/${relativePath}`;

	const existingTargetMailbox = findMailboxByPath(targetPath, hierarchyMap);
	if (existingTargetMailbox) {
		return {
			shouldMirror: true,
			sourcePath: inboxSubfolderPath,
			targetPath,
			targetMailboxId: existingTargetMailbox.id,
		};
	}

	const missingMailboxes = calculateMissingMailboxes(targetPath, archiveMailbox.mailbox.name, hierarchyMap);

	return {
		shouldMirror: true,
		sourcePath: inboxSubfolderPath,
		targetPath,
		missingMailboxes,
	};
}

function findInboxMailbox(hierarchyMap: Map<string, MailboxHierarchy>): MailboxHierarchy | null {
	for (const hierarchy of hierarchyMap.values()) {
		if (hierarchy.mailbox.role === "inbox") {
			return hierarchy;
		}
	}

	return null;
}

function findArchiveMailbox(hierarchyMap: Map<string, MailboxHierarchy>): MailboxHierarchy | null {
	for (const hierarchy of hierarchyMap.values()) {
		if (hierarchy.mailbox.role === "archive") {
			return hierarchy;
		}
	}

	return null;
}

function isInboxSubfolder(path: string, inboxName: string): boolean {
	return path.startsWith(`${inboxName}/`);
}

function calculateMissingMailboxes(
	targetPath: string,
	_archiveName: string,
	hierarchyMap: Map<string, MailboxHierarchy>,
): string[] {
	const missingPaths: string[] = [];
	const pathParts = targetPath.split("/");

	for (let i = 1; i < pathParts.length; i++) {
		const partialPath = pathParts.slice(0, i + 1).join("/");
		const existing = findMailboxByPath(partialPath, hierarchyMap);
		if (!existing) {
			missingPaths.push(partialPath);
		}
	}

	return missingPaths;
}
