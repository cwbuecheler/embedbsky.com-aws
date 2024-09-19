// 3rd Party Modules
import { AtpAgent } from '@atproto/api';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Local Modules
import getCreateBksyId from './get-create-bskyid.js';
import getOAuthURI from './getoauthuri.js';

// TS Types
import { RespData } from 'types/data';

const dynamoClient = new DynamoDB({});
const ddbClient = DynamoDBDocument.from(dynamoClient); // client is DynamoDB client

const handler: Handler = async (event) => {
	// pull data from the event
	// const evtBody: any = event.body || {}; - will need this for any POS/PUT routes
	const pathParams: { [key: string]: string } = event.pathParameters || {};
	const routeKey: string = event.routeKey || '';

	// Response variables
	let respData: RespData = {};
	const errorMessages: string[] = [];
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

				// No auth needed for this endpoint
				const bskyAgent = new AtpAgent({ service: 'https://api.bsky.app' });
				const { data: feedData } = await bskyAgent.app.bsky.feed.getAuthorFeed({
					actor: bskyId,
					filter: 'posts_and_author_threads',
					limit: 30,
				});

				respData = feedData;
			} catch (err: any) {
				errorMessages.push(err.message);
				statusCode = 500;
				console.error(err);
			}
			message = 'Lookup Successful';
			break;

		case 'GET /create/{bskyId}': {
			const { bskyId } = pathParams;

			try {
				const bskyAgent = new AtpAgent({ service: 'https://api.bsky.app' });
				respData = await getCreateBksyId(bskyId, respData, ddbClient, bskyAgent);
				if (respData.unauth) {
					statusCode = 403;
					message = `Sorry, this user has their timeline set to viewable by authenticated users only.`;
					errorMessages.push(`Couldn't display feed because it's hidden from unauthorized users`);
					break;
				}
			} catch (err: any) {
				errorMessages.push(err.message);
				statusCode = 500;
				console.error(err);
			}
			message = `Successfully created feed HTML and saved to CDN`;
			break;
		}

		case 'POST /oauth/{handle}': {
			const { handle } = pathParams;

			try {
				const respUri = await getOAuthURI(handle);
				respData.data = respUri;
			} catch (err: any) {
				message = 'Login Failed';
				errorMessages.push(err.message);
				statusCode = 500;
				console.error(err);
			}
			break;
		}

		default:
			errorMessages.push('Route Not Found');
			message = 'Route Not Found';
			statusCode = 404;
			break;
	}

	dynamoClient.destroy(); // destroys DynamoDBClient

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
