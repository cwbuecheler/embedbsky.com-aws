// 3rd Party Modules
import { Agent, AtpAgent } from '@atproto/api';
import { NodeOAuthClient } from '@atproto/oauth-client-node';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Local Modules
import getCreateBksyId from './get-create-bskyid.js';
import {
	createBidirectionalResolver,
	createIdResolver,
	BidirectionalResolver,
} from './idresolver.js';
import { createClient } from './session/client.js';

// TS Types
import { BodyCreateFeed, HTTPAPIEvent, RespData } from 'types/data';

const dynamoClient = new DynamoDB({});
const ddbClient = DynamoDBDocument.from(dynamoClient); // client is DynamoDB client

const baseIdResolver = createIdResolver();
const resolver: BidirectionalResolver = createBidirectionalResolver(baseIdResolver);

let oauthClient: NodeOAuthClient;
try {
	// Create the atproto utilities
	oauthClient = await createClient(ddbClient);
} catch (err: any) {
	console.error(err);
}

const handler: Handler = async (event: HTTPAPIEvent) => {
	// pull data from the event
	const pathParams: { [key: string]: string | undefined } = event.pathParameters || {};
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

				if (!bskyId) {
					throw new Error(`No BlueSky handle was included in the get request`);
				}

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

		case 'POST /create/{bskyId}': {
			const { bskyId } = pathParams;
			// pull data from the event
			const evtBody: BodyCreateFeed = JSON.parse(event.body || '{}');

			if (!bskyId) {
				throw new Error(`No BlueSky handle was included in the POST request`);
			}
			if (!evtBody.did) {
				throw new Error(`No DID was included in the POST request - couldn't verify auth`);
			}

			// Establish or pick back up the OAuth session & generate a Bsky agent
			let bskyAgent;
			try {
				const oauthSession = await oauthClient.restore(evtBody.did);
				bskyAgent = oauthSession ? new Agent(oauthSession) : null;
				if (!bskyAgent) {
					throw new Error(`Couldn't instantiate Bsky agent from OAuth Session`);
				}
			} catch (err: any) {
				console.error(err.message);
				errorMessages.push(err.message);
				message = `Agent Error - ${err.message}`;
				statusCode = 500;
				break;
			}

			// Make sure the handle returned by the ID resolver matches the handle being passed in
			const resolvedHandle = await resolver.resolveDidToHandle(evtBody.did);
			if (resolvedHandle !== bskyId) {
				console.error(`Authenticated user does not match timeline`);
				errorMessages.push(`Authenticated user does not match timeline`);
				message = `The Authenticated user does not match the handle being used for lookup`;
				statusCode = 403;
				break;
			}

			try {
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
