import { AttributeValue } from '@aws-sdk/client-dynamodb';

export type CDNResp = {
	savedFeedURI: string;
	success: boolean;
};

export type FeedInfo = {
	bskyHash: string;
	bskyId: string;
	lastUpdated: number;
};

export type GenerateFeedHTMLResp = {
	generatedFeedHTML: string;
	success: boolean;
};

type GetDBPageInput = {
	ExclusiveStartKey?: Record<string, AttributeValue>;
	ExpressionAttributeValues: {
		[key: string]: string | number;
	};
	FilterExpression: string;
	TableName: string;
};

export type RespData = {
	[key: string]: any;
};
