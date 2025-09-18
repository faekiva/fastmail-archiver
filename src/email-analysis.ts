import type { EmailMoveResult, MoveDescription } from "./types.js";

export function compareMailboxArrays(current: string[], previous: string[]): EmailMoveResult {
	const currentSorted = current.slice().sort();
	const previousSorted = previous.slice().sort();
	const hasChanged = !(
		currentSorted.length === previousSorted.length &&
		currentSorted.every((val, index) => val === previousSorted[index])
	);

	const added = current.filter((id) => !previous.includes(id));
	const removed = previous.filter((id) => !current.includes(id));

	return { hasChanged, added, removed };
}

export function analyzeEmailMove(
	current: string[],
	previous: string[],
	mailboxNames: Map<string, string>,
): MoveDescription | null {
	const result = compareMailboxArrays(current, previous);
	if (!result.hasChanged) {
		return null;
	}

	const sourceMailboxes = result.removed.map((id) => mailboxNames.get(id) ?? id);
	const destMailboxes = result.added.map((id) => mailboxNames.get(id) ?? id);

	let type: "move" | "add" | "remove";
	if (sourceMailboxes.length > 0 && destMailboxes.length > 0) {
		type = "move";
	} else if (destMailboxes.length > 0) {
		type = "add";
	} else {
		type = "remove";
	}

	return {
		type,
		subject: "", // Will be filled in by caller
		sourceMailboxes,
		destMailboxes,
	};
}

export function formatMoveMessage(move: MoveDescription): string {
	switch (move.type) {
		case "move":
			return `📧 Email moved: "${move.subject}" from ${move.sourceMailboxes.join(", ")} → ${move.destMailboxes.join(", ")}`;
		case "add":
			return `📧 Email added: "${move.subject}" → ${move.destMailboxes.join(", ")}`;
		case "remove":
			return `📧 Email removed: "${move.subject}" from ${move.sourceMailboxes.join(", ")}`;
	}
}
