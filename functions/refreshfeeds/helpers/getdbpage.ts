// AWS & Shared Layer
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dayjs } from '/opt/shared.js';

// TS Types
import { FeedInfo, GetDBPageInput } from 'types/data';

const getDBPage = async (
	tableName: string,
	ddbClient: DynamoDBDocument,
	lastEvaluatedKey?: Record<string, AttributeValue>,
) => {
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
			const recurseResults = await getDBPage(tableName, ddbClient, response.LastEvaluatedKey);
			if (recurseResults) {
				results.push(...recurseResults);
			}
		}
		return results;
	} catch (err: any) {
		console.error(err);
		throw new Error(`Couldn't get data from database - getDBPage`);
	}
};

export default getDBPage;
