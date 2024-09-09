// 3rd Party & Node
import { AtpAgent, RichText } from '@atproto/api';

// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { AttributeValue, DynamoDB } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocument, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { chunkArray, dayjs, generateFeedHtml, saveToCDN } from '/opt/shared.js';

// TS Types
import { FeedInfo } from 'types/data';

const dynamoClient = new DynamoDB({});
const ddbClient = DynamoDBDocument.from(dynamoClient); // client is DynamoDB client

const bskyFeedTable = process.env.AWS_BSKY_USER_TABLE || '';

type GetDBPageInput = {
	ExclusiveStartKey?: Record<string, AttributeValue>;
	TableName: string;
	ExpressionAttributeValues: {
		[key: string]: string | number;
	};
	FilterExpression: string;
};

const getDBPage = async (tableName: string, lastEvaluatedKey?: Record<string, AttributeValue>) => {
	try {
		const fiveMinutesAgo = dayjs().subtract(5, 'minutes').unix();

		// Master results array
		const results: FeedInfo[] = [];

		// Format DB params
		const input: GetDBPageInput = {
			TableName: tableName,
			ExpressionAttributeValues: {
				':fiveMinutesAgo': fiveMinutesAgo,
			},
			FilterExpression: `lastUpdated < :fiveMinutesAgo`,
		};
		if (lastEvaluatedKey) {
			input.ExclusiveStartKey = lastEvaluatedKey;
		}

		// Set up a DB Scan command & send it
		const command = new ScanCommand(input);
		const response = await ddbClient.send(command);

		// AWS returns an Items array, push that to our results
		if (response.Items) {
			const items: FeedInfo[] = response.Items as FeedInfo[];
			results.push(...items);
		}
		// We're not throwing if no Items because depending on timing, there might not be any results returned

		// If there's a last evaluated key, recursively run the function and add its output to the results array
		if (response.LastEvaluatedKey) {
			const recurseResults = await getDBPage(tableName, response.LastEvaluatedKey);
			if (recurseResults) {
				results.push(...recurseResults);
			}
		}
		return results;
	} catch (err: any) {
		console.error(err);
	}
};

const handler: Handler = async () => {
	// Create a BlueSky agent
	const bskyAgent = new AtpAgent({ service: 'https://api.bsky.app' });

	// Get all feeds from DB older than five minutes ago
	try {
		// Get all items that need to be updated from the DB
		const results = await getDBPage(bskyFeedTable);

		// If results flat-out doesn't exist, something went wrong
		if (!results) {
			throw new Error(`Couldn't refresh feeds in DB`);
		}

		// If results is empty, nothing to refresh, so let's get out of here
		if (results.length < 1) {
			return;
		}

		// Get updated feed for each result from the DB
		const bskyPromises: any[] = [];
		for (const feedInfo of results) {
			const bskyRespPromise = bskyAgent.app.bsky.feed.getAuthorFeed({
				actor: feedInfo.bskyId,
				filter: 'posts_no_replies',
				limit: 30,
			});
			bskyPromises.push(bskyRespPromise);
		}

		const bskyResponses: any[] = await Promise.allSettled(bskyPromises);

		// iterate over all the responses and prepare to update or remove feeds from the DB
		const feedsToUpdate: { feedInfo: FeedInfo; feed: any }[] = [];
		const feedsToDelete: string[] = [];

		for (let i = 0; i < bskyResponses.length; i++) {
			const feedInfo = results[i];
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

		/* Handle feed updates first */
		for (const feedToUpdate of feedsToUpdate) {
			// Generate feed flat file
			const generateFeedHTMLResp = await generateFeedHtml(feedToUpdate, RichText);
			if (!generateFeedHTMLResp.success) {
				throw new Error(`Couldn't generate feed HTML`);
			}

			// Save it to the CDN
			const { generatedFeedHTML } = generateFeedHTMLResp;
			const cdnResp = await saveToCDN(feedToUpdate.feedInfo.bskyHash, generatedFeedHTML);
			if (!cdnResp.success) {
				throw new Error(`Couldn't save feed data to CDN`);
			}
		}

		// Break the results into chunks of 25 (max batchwrite amount)
		const feedInfoChunks = chunkArray(results, 25);

		// Iterate over results and update the feeds
		const promises: Promise<any>[] = [];

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
					[bskyFeedTable]: putRequests,
				},
			});

			promises.push(ddbClient.send(command));
		}

		const dbResps = await Promise.allSettled(promises);
		console.log(dbResps);
	} catch (err: any) {
		console.error(err.message);
	}
};

export { handler };
