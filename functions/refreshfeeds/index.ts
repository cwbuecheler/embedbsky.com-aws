// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { AttributeValue, DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dayjs } from '/opt/shared.js';

// TS Types
import { FeedTableResp } from 'types/data';

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
		const results: FeedTableResp[] = [];

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
			const items: FeedTableResp[] = response.Items as FeedTableResp[];
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

		// Return all of the results
		return results;
	} catch (err: any) {
		console.error(err);
	}
};

const handler: Handler = async () => {
	// Get all feeds from DB older than five minutes ago
	try {
		const results = await getDBPage(bskyFeedTable);
		if (!results) {
			throw new Error(`Couldn't refresh feeds in DB`);
		}
		if (results.length < 1) {
			// We can remove this once everything's working
			console.log(`Nothing to refresh`);
		}

		// Re-generate HTML code for each feed
		// Set the last updated date
		//   (note: this will eventually cause all entries to update at the same time)
		//   (something to consider for performance reasons later)
		// Save all the entries to the DB
	} catch (err: any) {
		console.error(err);
	}
};

export { handler };
