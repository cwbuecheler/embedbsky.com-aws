// 3rd Party & Node
import { AtpAgent, RichText } from '@atproto/api';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Local Modules
import deleteFeeds from './helpers/deletefeeds.js';
import getDBPage from './helpers/getdbpage.js';
import markFeedsErrored from './helpers/markFeedErrors.js';
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
			limit: feedInfo.limit || 30,
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
	const feedsWithErrors: FeedInfo[] = [];

	for (let i = 0; i < bskyResponses.length; i++) {
		const feedInfo = dbScanResults[i];
		const resp = bskyResponses[i];
		// handle rejected promises
		if (resp.status === 'rejected') {
			// If it's a not found, add the profile to the list of those that had a not found error
			if (resp.reason?.error === 'InvalidRequest') {
				feedsWithErrors.push(feedInfo);
				continue;
			} else {
				// This is an unknown error so we just want to stay hands off but log it
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
	const didAllFeedUpdatesSucceed = await updateFeeds(ddbClient, feedsToUpdate, RichText);
	if (!didAllFeedUpdatesSucceed) {
		console.error(
			`Error updating feeds - Not all feeds succeeded in updating - see individual errors`,
		);
	}

	// Now mark any feeds that errored as errored
	const didAllFeedErrorsSucceed = await markFeedsErrored(ddbClient, feedsWithErrors);
	if (!didAllFeedErrorsSucceed) {
		console.error(
			`Error marking feeds errored - Not all feeds succeeded in updating - see individual errors`,
		);
	}

	// Now delete any feeds that have errors and the threwError timestamp is older than 7 days
	const didAllFeedDeletesSucceed = await deleteFeeds(feedsWithErrors, ddbClient);
	if (!didAllFeedDeletesSucceed) {
		console.error(
			`Error deleting feeds - Not all feeds succeeded in deleting - see individual errors`,
		);
	}
};

export { handler };
