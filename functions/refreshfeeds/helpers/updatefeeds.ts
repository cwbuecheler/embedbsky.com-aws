// 3rd Party Modules
import { RichText } from '@atproto/api';
import { chunkArray, dayjs, generateFeedHtml, saveToCDN } from '/opt/shared.js';

// AWS & Shared Layer
import { BatchWriteCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// TS Types
import { FeedInfo } from 'types/data';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE || '';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const CDN_URI = process.env.CDN_URI || '';

const updateFeeds = async (
	ddbClient: DynamoDBDocument,
	feedsToUpdate: { feedInfo: FeedInfo; feed: any }[],
) => {
	let didAllFeedsSucceed = true;

	try {
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
		didAllFeedsSucceed = false;
		console.error(`Error refreshing feeds - CDN save - ${err.message}`);
	}

	// Generate DB items to overwrite
	const dbUpdateItems = feedsToUpdate.map((feedToUpdate) => feedToUpdate.feedInfo);

	// Break the results into chunks of 25 (max batchwrite amount)
	const feedInfoChunks = chunkArray(dbUpdateItems, 25);

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
				console.error(`Feed update failed - ${resp.reason}`);
				didAllFeedsSucceed = false;
				throw new Error(resp.reason);
			}
		});
	} catch (err: any) {
		console.error(`Error refreshing feeds - DB Save - ${err.message}`);
		didAllFeedsSucceed = false;
	}
	return didAllFeedsSucceed;
};

export default updateFeeds;
