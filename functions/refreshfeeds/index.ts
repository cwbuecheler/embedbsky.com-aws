// 3rd Party & Node
import { AtpAgent } from '@atproto/api';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Local Modules
import deleteFeeds from './helpers/deletefeeds.js';
import getDBPage from './helpers/getdbpage.js';
import updateFeeds from './helpers/updatefeeds.js';

// TS Types
import { FeedInfo } from 'types/data';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE || '';

const dynamoClient = new DynamoDB({});
const ddbClient = DynamoDBDocument.from(dynamoClient); // client is DynamoDB client

const handler: Handler = async () => {
	// Create a BlueSky agent
	const bskyAgent = new AtpAgent({ service: 'https://api.bsky.app' });

	// Get all feeds from DB older than five minutes ago
	let dbScanResults: FeedInfo[] = [];
	try {
		dbScanResults = await getDBPage(AWS_BSKY_FEED_TABLE, ddbClient);

		// If results is empty, nothing to refresh, so let's get out of here
		if (dbScanResults.length < 1) {
			return;
		}
	} catch (err: any) {
		console.error(`Error refreshing feeds - DB lookup - ${err.message}`);
	}

	// Get updated feed for each result from the DB
	const bskyPromises: any[] = [];
	for (const feedInfo of dbScanResults) {
		const bskyRespPromise = bskyAgent.app.bsky.feed.getAuthorFeed({
			actor: feedInfo.bskyId,
			filter: 'posts_no_replies',
			limit: 30,
		});
		bskyPromises.push(bskyRespPromise);
	}

	let bskyResponses: any[] = [];

	try {
		bskyResponses = await Promise.allSettled(bskyPromises);
	} catch (err: any) {
		console.error(`Error refreshing feeds - BlueSky lookup - ${err.message}`);
	}

	// iterate over all the responses and prepare to update or remove feeds from the DB
	const feedsToUpdate: { feedInfo: FeedInfo; feed: any }[] = [];
	const feedsToDelete: string[] = [];

	for (let i = 0; i < bskyResponses.length; i++) {
		const feedInfo = dbScanResults[i];
		const resp = bskyResponses[i];
		// handle rejected promises
		if (resp.status === 'rejected') {
			// If it's a not found, add the profile to the list of those to be removed
			if (resp.reason?.error === 'InvalidRequest') {
				feedsToDelete.push(feedInfo.bskyId);
				continue;
			} else {
				// This is an unknown error so we don't want to delete OR update the feed
				console.error(`Unknown error returned from BlueSky - ${resp.reason?.error}`);
				continue;
			}
		}
		feedsToUpdate.push({
			feedInfo,
			feed: resp?.value?.data?.feed,
		});
	}

	// Handle updating feeds first
	const didAllFeedUpdatesSucceed = await updateFeeds(ddbClient, feedsToUpdate);
	if (!didAllFeedUpdatesSucceed) {
		console.error(
			`Error updating feeds - Not all feeds succeeded in updating - see individual errors`,
		);
	}

	// Now delete any feeds that for users who no longer exist on bsky
	const didAllFeedDeletesSucceed = await deleteFeeds(feedsToDelete, ddbClient);
	if (!didAllFeedDeletesSucceed) {
		console.error(
			`Error deleting feeds - Not all feeds succeeded in deleting - see individual errors`,
		);
	}
};

export { handler };
