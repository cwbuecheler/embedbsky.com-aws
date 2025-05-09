// 3rd Party Modules
import { dayjs, chunkArray, removeFromCDN } from '/opt/shared.js';

// AWS & Shared Layer
import { BatchWriteCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// TS Types
import { FeedInfo } from 'types/data';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE || '';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

const deleteFeeds = async (feedsWithErrors: FeedInfo[], ddbClient: DynamoDBDocument) => {
	let didAllFeedsSucceed = true;
	// Filter to only include feeds where threwError timestamp is > 7 days old
	const bskyFeedsToDelete = feedsWithErrors.filter(
		(feed) => feed.threwError > 0 && dayjs().diff(feed.threwError, 'day') > 7,
	);

	// Break the results into chunks of 25 (max batchwrite amount)
	const bskyFeedsToDeleteChunked = chunkArray(bskyFeedsToDelete, 25);

	// Iterate over results and update the feeds
	const dbDeletePromises: Promise<any>[] = [];

	try {
		for (const chunk of bskyFeedsToDeleteChunked) {
			// generate put requests for each feedInfo object in the chunk
			const putRequests = chunk.map((feedInfo) => {
				const newFeedInfo: FeedInfo = {
					...feedInfo,
					isDeleted: 1,
				};
				return { PutRequest: { Item: newFeedInfo } };
			});

			const command = new BatchWriteCommand({
				RequestItems: {
					[AWS_BSKY_FEED_TABLE]: putRequests,
				},
			});

			dbDeletePromises.push(ddbClient.send(command));
		}

		const dbResps = await Promise.allSettled(dbDeletePromises);

		dbResps.forEach((resp) => {
			if (resp.status === 'rejected') {
				console.error(`Feed delete failed - ${resp.reason}`);
				didAllFeedsSucceed = false;
			}
		});
	} catch (err: any) {
		console.error(`Error refreshing feeds - DB Save - ${err.message}`);
		didAllFeedsSucceed = false;
	}

	// Remove them from the CDN
	for (const feedToDelete of bskyFeedsToDelete) {
		const cdnResp = await removeFromCDN(feedToDelete.bskyHash, AWS_S3_BUCKET_NAME);
		if (!cdnResp.success) {
			didAllFeedsSucceed = false;
			console.error(`Couldn't remove feed data from CDN - ${feedToDelete.bskyHash}`);
			continue;
		}
	}

	return didAllFeedsSucceed;
};

export default deleteFeeds;
