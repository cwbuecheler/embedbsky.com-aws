// 3rd Party Libraries
import { NodeOAuthClient } from '@atproto/oauth-client-node';

// AWS & Shared Layer
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Local Modules
import { SessionStore, StateStore } from './storage.js';

export const createClient = async (ddbClient: DynamoDBDocument) => {
	const publicURI = process.env.PUBLIC_URI;
	const uri = publicURI || `http://127.0.0.1:3000`;
	return new NodeOAuthClient({
		clientMetadata: {
			application_type: 'web',
			client_id: publicURI
				? `${uri}/client-metadata.json`
				: `http://localhost?redirect_uri=${encodeURIComponent(uri)}`,
			client_name: 'Embed Bsky',
			client_uri: uri,
			dpop_bound_access_tokens: true,
			grant_types: ['authorization_code', 'refresh_token'],
			redirect_uris: [uri],
			response_types: ['code'],
			scope: 'atproto transition:generic',
			token_endpoint_auth_method: 'none',
		},
		stateStore: new StateStore(ddbClient),
		sessionStore: new SessionStore(ddbClient),
	});
};
