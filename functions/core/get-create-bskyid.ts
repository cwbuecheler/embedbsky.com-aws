// 3rd Party & Node
import { AtpAgent } from '@atproto/api';

// AWS & Shared Layer
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { dayjs, hashString } from '/opt/shared.js';

// Local functions
import generateFeedHtml from './helpers/generatefeedhtml.js';
import saveToCDN from './helpers/savetocdn.js';

// TS Types
import { RespData } from 'types/data';

const bskyUserTable = process.env.AWS_BSKY_USER_TABLE;
const CDN_URI = process.env.CDN_URI;

const getCreateBksyId = async (
	bskyId: string,
	respData: RespData,
	ddbClient: DynamoDBDocument,
	bskyAgent: AtpAgent,
): Promise<RespData> => {
	try {
		// Get the hash for this bsky handle
		const bskyHash = await hashString(bskyId);

		// Sanity check - does the timeline already exist in the DB?
		const lookupResp = await ddbClient.get({
			TableName: bskyUserTable,
			Key: {
				bskyId,
			},
		});

		if (lookupResp.Item) {
			// Just return the feed URL to the CDN
			respData = { feedUri: `${CDN_URI}/feeds/${bskyHash}.html` };
			return respData;
		}

		const { data: feedData } = await bskyAgent.app.bsky.feed.getAuthorFeed({
			actor: bskyId,
			filter: 'posts_no_replies',
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
		// TODO - hash the file name and return it, to make it harder for people to guess feeds
		const cdnResp = await saveToCDN(bskyHash, generatedFeedHTML);
		if (!cdnResp.success) {
			throw new Error(`Couldn't save feed data to CDN`);
		}

		// Add the bskyId and time updated to the DB
		const now = dayjs().unix();
		const putResp = await ddbClient.put({
			TableName: bskyUserTable,
			Item: {
				bskyId,
				bskyHash,
				lastUpdated: now,
			},
		});

		if (!putResp) {
			throw new Error(`Couldn't put bsky user data to DDB`);
		}

		// return the feed URL
		respData = {
			feedData,
			savedFeedURI: cdnResp.savedFeedURI,
		};
	} catch (e: any) {
		console.error(e.message);
		throw new Error(`Couldn't create BlueSky feed`);
	}

	return respData;
};

export default getCreateBksyId;
