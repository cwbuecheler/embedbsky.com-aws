import { OAuthClient } from '@atproto/oauth-client-node';
import { isValidHandle } from '@atproto/syntax';

const oauthClient = new OAuthClient();

const getOAuthURI = async (handle: string) => {
	// Make sure the handle's valid
	if (typeof handle !== 'string' || handle.length < 3)
		if (!handle.includes('.')) {
			// add .bsky.social to it, just to catch people who are only using the first part
			handle += '.bsky.social';
		}

	// Validate
	if (typeof handle !== 'string' || !isValidHandle(handle)) {
		throw new Error(`Login - Handle is invalid or couldn't be validated`);
	}

	// Initiate the OAuth flow
	try {
		const url = await oauthClient.authorize(handle, {
			scope: 'atproto transition:generic',
		});
		return res.redirect(url.toString());
	} catch (err) {
		ctx.logger.error({ err }, 'oauth authorize failed');
		return res.type('html').send(
			page(
				login({
					error: err instanceof OAuthResolverError ? err.message : "couldn't initiate login",
				}),
			),
		);
	}
};

export default getOAuthURI;
