// 3rd Party Modules
import { chunkArray, dayjs } from '/opt/shared.js';

// AWS & Shared Layer
import { BatchWriteCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// TS Types
import { FeedInfo } from 'types/data';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE || '';

const markFeedsErrored = async (ddbClient: DynamoDBDocument, feedsToUpdate: FeedInfo[]) => {
	let didAllFeedsSucceed = true;

	// Generate DB items to overwrite
	const dbUpdateItems = feedsToUpdate.map((feedToUpdate) => feedToUpdate);

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
					threwError: dayjs().unix(),
					isDeleted: 0,
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
			}
		});
	} catch (err: any) {
		console.error(`Error refreshing feeds - DB Save - ${err.message}`);
		didAllFeedsSucceed = false;
	}
	return didAllFeedsSucceed;
};

export default markFeedsErrored;
