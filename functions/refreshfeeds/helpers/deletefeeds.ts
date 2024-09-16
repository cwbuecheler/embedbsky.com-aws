// 3rd Party Modules
import { chunkArray } from '/opt/shared.js';

// AWS & Shared Layer
import { BatchWriteCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE || '';

const deleteFeeds = async (bskyIDsToDelete: string[], ddbClient: DynamoDBDocument) => {
	let didAllFeedsSucceed = true;

	// Break the results into chunks of 25 (max batchwrite amount)
	const bskyIDsToDeleteChunked = chunkArray(bskyIDsToDelete, 25);

	// Iterate over results and update the feeds
	const dbDeletePromises: Promise<any>[] = [];

	try {
		for (const chunk of bskyIDsToDeleteChunked) {
			// generate put requests for each feedInfo object in the chunk
			const putRequests = chunk.map((bskyId) => {
				return { DeleteRequest: { Key: { bskyId } } };
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
				throw new Error(resp.reason);
			}
		});
	} catch (err: any) {
		console.error(`Error refreshing feeds - DB Save - ${err.message}`);
		didAllFeedsSucceed = false;
	}
	return didAllFeedsSucceed;
};

export default deleteFeeds;
