// import {
// 	createBidirectionalResolver,
// 	createIdResolver,
// 	BidirectionalResolver,
// } from '#/id-resolver';
// import { IdResolver, MemoryCache } from '@atproto/identity';

// 3rd Party Modules
// import type { OAuthClient } from '@atproto/oauth-client-node';
import { isValidHandle } from '@atproto/syntax';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Local Modules
import { createClient } from './session/client.js';

// TS Types
import { BodyVerifyLogin, RespData } from 'types/data';
import { NodeOAuthClient, OAuthResolverError } from '@atproto/oauth-client-node';

const dynamoClient = new DynamoDB({});
const ddbClient = DynamoDBDocument.from(dynamoClient); // client is DynamoDB client

let oauthClient: NodeOAuthClient;
try {
	// Create the atproto utilities
	oauthClient = await createClient(ddbClient);
} catch (err: any) {
	console.error(err);
}

const handler: Handler = async (event) => {
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

		case 'GET /login/{bskyId}': {
			// Validate
			const { bskyId } = pathParams;
			if (typeof bskyId !== 'string' || !isValidHandle(bskyId)) {
				throw new Error(`Couldn't Log In - Invalid BlueSky Handle`);
			}

			// Initiate the OAuth flow
			try {
				if (oauthClient) {
					const uri = await oauthClient.authorize(bskyId, {
						scope: 'atproto transition:generic',
					});
					respData = {
						uri: uri ? uri.toString() : '',
					};
				} else {
					throw new Error('No OAuth Client Established');
				}
			} catch (err: any) {
				console.error(err);
				const msg = err instanceof OAuthResolverError ? err.message : `Couldn't Initiate Login`;
				errorMessages.push(msg);
				statusCode = 500;
				console.error(msg);
			}

			message = `Successfully logged user in`;
			break;
		}

		case 'POST /login/verify': {
			// pull data from the event
			const evtBody: BodyVerifyLogin = JSON.parse(event.body); // used for POST/PUT routes

			// Sanity check - data needs to be there
			if (!evtBody.code || !evtBody.iss || !evtBody.state) {
				console.error(`Couldn't get code, ISS, or state to verify login`);
				errorMessages.push(`Couldn't get code or state to verify login`);
				message = `Couldn't verify login`;
				statusCode = 500;
				break;
			}

			// Use client callback to verify
			const paramString = `iss=${evtBody.iss}&code=${evtBody.code}&state=${evtBody.state}`;
			const params = new URLSearchParams(paramString);
			try {
				const { session } = await oauthClient.callback(params);
				if (session.sub?.includes('did')) {
					// We don't need to store session data in cookies because we're just validating the login
					respData = {
						success: true,
						did_plc: session.sub,
					};
				}
			} catch (err: any) {
				console.error(err);
				errorMessages.push(`Couldn't generate session - ${err.message}`);
				message = `Couldn't generate session`;
				statusCode = 500;
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
