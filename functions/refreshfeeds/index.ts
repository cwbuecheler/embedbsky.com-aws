// 3rd Party & Node
import { AtpAgent, RichText } from '@atproto/api';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { chunkArray, dayjs, generateFeedHtml, saveToCDN } from '/opt/shared.js';

// Local Modules
import getDBPage from './helpers/getdbpage.js';

// TS Types
import { FeedInfo } from 'types/data';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE || '';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const CDN_URI = process.env.CDN_URI || '';

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
		console.error(`Error refreshing feeds - BlueSky loolkup - ${err.message}`);
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
				continue;
			}
		}
		feedsToUpdate.push({
			feedInfo,
			feed: resp?.value?.data?.feed,
		});
	}

	try {
		/* Handle feed updates first */
		for (const feedToUpdate of feedsToUpdate) {
			// Generate feed flat file
			const generateFeedHTMLResp = await generateFeedHtml(feedToUpdate, RichText);
			if (!generateFeedHTMLResp.success) {
				throw new Error(`Couldn't generate feed HTML`);
			}

			// Save it to the CDN
			const { generatedFeedHTML } = generateFeedHTMLResp;
			const cdnResp = await saveToCDN(
				feedToUpdate.feedInfo.bskyHash,
				generatedFeedHTML,
				CDN_URI,
				AWS_S3_BUCKET_NAME,
			);
			if (!cdnResp.success) {
				throw new Error(`Couldn't save feed data to CDN`);
			}
		}
	} catch (err: any) {
		console.error(`Error refreshing feeds - CDN save - ${err.message}`);
	}

	// Break the results into chunks of 25 (max batchwrite amount)
	const feedInfoChunks = chunkArray(dbScanResults, 25);

	// Iterate over results and update the feeds
	const dbSavePromises: Promise<any>[] = [];

	try {
		for (const chunk of feedInfoChunks) {
			// generate put requests for each feedInfo object in the chunk
			const putRequests = chunk.map((feedInfo) => {
				const newFeedInfo = {
					...feedInfo,
					lastUpdated: dayjs().unix(),
				};
				return { PutRequest: { Item: newFeedInfo } };
			});

			const command = new BatchWriteCommand({
				RequestItems: {
					[AWS_BSKY_FEED_TABLE]: putRequests,
				},
			});

			dbSavePromises.push(ddbClient.send(command));
		}

		const dbResps = await Promise.allSettled(dbSavePromises);

		dbResps.forEach((resp) => {
			if (resp.status === 'rejected') {
				throw new Error(resp.reason);
			}
		});
	} catch (err: any) {
		console.error(`Error refreshing feeds - DB Save - ${err.message}`);
	}
};

export { handler };
