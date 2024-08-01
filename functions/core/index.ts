import { BskyAgent } from '/opt/shared.js';

const bskyPassword = process.env.BSKY_PASS || '';

type Data = {
	[key: string]: any;
};

const handler = async (event: any) => {
	// pull data from the event
	const evtBody: any = event.body || {};
	const pathParams: { [key: string]: string } = event.pathParameters || {};
	const routeKey: string = event.routeKey || '';

	// Response variables
	let respData: Data = {};
	let errorMessages: string[] = [];
	let message = 'Success';
	let statusCode = 200;

	// Handle api requests
	switch (routeKey) {
		case 'GET /':
			message = 'Nothing to see here!';
			break;

		case 'GET /lookup/{bskyId}':
			try {
				const { bskyId } = pathParams;

				// Create a logged in BlueSky agent
				const agent = new BskyAgent({
					service: 'https://bsky.social',
				});

				// TODO - set up a login that's not my personal account
				await agent.login({
					identifier: 'cwbuecheler.bsky.social',
					password: bskyPassword,
				});

				// Look up the profile from the bskyId
				const { data: profileData } = await agent.getProfile({ actor: bskyId });

				// Look up the feed from the profile DID
				const { data: feedData } = await agent.getAuthorFeed({
					actor: profileData.did,
					filter: 'posts_and_author_threads',
					limit: 30,
				});

				message = 'Lookup Successful';
				respData = feedData;
			} catch (err: any) {
				errorMessages.push(err.message);
				statusCode = 500;
				console.error(err);
			}
			break;

		default:
			errorMessages.push('Route Not Found');
			message = 'Route Not Found';
			statusCode = 404;
			break;
	}

	/* Model
	/* AWS Requires a statusCode (number) and body (string)
	/* Our body contains:
	/*   data: any (for now)
	/*   message: string
	/*   errorMessages: string[]
	*/
	return {
		statusCode,
		body: JSON.stringify({
			data: respData,
			message,
			errorMessages,
		}),
	};
};

export { handler };
