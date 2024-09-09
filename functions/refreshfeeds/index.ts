// AWS and Shared Layer
import { Handler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDB({});
const ddbClient = DynamoDBDocument.from(dynamoClient); // client is DynamoDB client

const bskyUserTable = process.env.AWS_BSKY_USER_TABLE;

type FeedTableItem = {
	bskyId: string;
	lastUpdated: string;
};

const getDBPage = (tableName: string) => {
	try {
		let results: any[] = [];
		const input = {
			TableName: tableName,
		};
	} catch (err: any) {
		console.error(err);
	}
};

const handler: Handler = async () => {
	// Get all feeds from DB older than five minutes ago
	try {
		const input = {
			TableName: bskyUserTable,
		};

		const command = new ScanCommand(input);
		const response = await ddbClient.send(command);

		if (response.LastEvaluatedKey) {
			// we need to paginate
		}
	} catch (err: any) {
		console.error(err);
	}
	// Re-generate HTML code for each feed
	// Set the last updated date
	// (note: this will eventually cause all entries to update at the same time)
	// (something to consider for performance reasons later)
	// Save all the entries to the DB
};

export { handler };
