import JamClient from "jmap-jam";

async function main() {
	const token = process.env.FASTMAIL_TOKEN;
	if (token === undefined) {
		throw new Error("fastmail token not in env");
	}
	// throw new Error("test error for stack trace");
	const jam = new JamClient({
		sessionUrl: "https://api.fastmail.com/.well-known/jmap",
		bearerToken: token,
	});
	const accountId = await jam.getPrimaryAccount();
	const session = await jam.session;
	console.log(session.accounts);
	
	// const [mailboxes] = await jam.request(["Mailbox/get", { accountId }]);
	console.log(await jam.api.Email.query({ accountId }));
}

await main();
