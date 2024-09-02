// 3rd party
import AtpAgent from '@atproto/api';

// AWS & Shared Layer
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { dayjs } from '/opt/shared.js';

// Local functions
import generateFeedHtml from './helpers/generatefeedhtml.js';
import saveToCDN from './helpers/savetocdn.js';

// TS Types
import { RespData } from 'types/data';

const bksyUserTable = process.env.AWS_BSKY_USER_TABLE;

const getCreateBksyId = async (
	bskyId: string,
	respData: RespData,
	ddbClient: DynamoDBDocument,
	bskyAgent: AtpAgent,
): Promise<RespData> => {
	/*
	.
	Uncomment when done testing!
	.
	.
	// Sanity check - does the timeline already exist in the DB?
	const lookupResp = await ddbClient.get({
		TableName: bksyUserTable,
		Key: {
			bskyId,
		},
	});

	if (lookupResp.Item) {
		// Just return the feed URL to the CDN
		respData = { feedUri: `${CDN_URI}/${bskyId}` };
		return respData;
	}
	*/

	const { data: feedData } = await bskyAgent.getAuthorFeed({
		actor: bskyId,
		filter: 'posts_and_author_threads',
		limit: 30,
	});

	if (!feedData) {
		throw new Error(`Couldn't get feed data from BlueSky`);
	}

	// Generate feed flat file
	const generateFeedHTMLResp = await generateFeedHtml(feedData);
	if (!generateFeedHTMLResp.success) {
		throw new Error(`Couldn't generate feed HTML`);
	}

	// Save it to the CDN
	const { generatedFeedHTML } = generateFeedHTMLResp;
	const cdnResp = await saveToCDN(generatedFeedHTML);

	// Add the bskyId and time updated to the DB
	const now = dayjs().toISOString();
	const putResp = await ddbClient.put({
		TableName: bksyUserTable,
		Item: {
			bskyId,
			lastUpdated: now,
		},
	});

	if (!putResp) {
		throw new Error(`Couldn't put bsky user data to DDB`);
	}

	// return the feed URL
	if (cdnResp.success) {
		respData = {
			savedFeedURI: cdnResp.savedFeedURI,
		};
	} else {
		throw new Error(`Couldn't save feed data to CDN`);
	}

	return respData;
};

export default getCreateBksyId;
