export type FeedInfo = {
	bskyHash: string;
	bskyId: string;
	lastUpdated: number;
};

export type CDNResp = {
	savedFeedURI: string;
	success: boolean;
};

export type GenerateFeedHTMLResp = {
	generatedFeedHTML: string;
	success: boolean;
};

export type RespData = {
	[key: string]: any;
};
