import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

export type BodyCreateFeed = {
	did: string;
	enableFooter?: boolean;
	includeReposts: string;
	limit?: number;
};

export type BodyRefreshLogin = {
	did: string;
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
	enableFooter?: boolean;
	includeReposts: boolean;
	isDeleted: number;
	lastUpdated: number;
	limit?: number;
	threwError: number;
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
