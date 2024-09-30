import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

export type BodyCreateFeed = {
	did: string;
	includeReposts: string;
};

export type BodyVerifyLogin = {
	code: string;
	iss: string;
	state: string;
};

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

export interface HTTPAPIEvent extends APIGatewayProxyEvent {
	routeKey?: string;
}

export type RespData = {
	[key: string]: any;
};
