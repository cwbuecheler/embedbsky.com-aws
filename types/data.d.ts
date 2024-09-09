export type FeedTableResp = {
	bskyHash: string;
	bskyId: string;
	lastUpdated: string;
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
