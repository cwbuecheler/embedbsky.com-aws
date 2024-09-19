// 3rd Party & Node
import { AtpAgent, RichText } from '@atproto/api';

// AWS & Shared Layer
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { dayjs, generateFeedHtml, hashString, saveToCDN } from '/opt/shared.js';

// TS Types
import { RespData } from 'types/data';

const AWS_BSKY_FEED_TABLE = process.env.AWS_BSKY_FEED_TABLE;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const CDN_URI = process.env.CDN_URI || '';

const getCreateBksyId = async (
	bskyId: string,
	respData: RespData,
	ddbClient: DynamoDBDocument,
	bskyAgent: AtpAgent,
): Promise<RespData> => {
	try {
		// Get the hash for this bsky handle
		const bskyHash = await hashString(bskyId);

		const { data: feedData } = await bskyAgent.app.bsky.feed.getAuthorFeed({
			actor: bskyId,
			filter: 'posts_no_replies',
			limit: 30,
		});

		if (!feedData) {
			throw new Error(`Couldn't get feed data from BlueSky`);
		}

		// Check to see if this is a no-unauthorized feed and if so, throw
		const feedZero = feedData.feed[0] as any;
		if (feedZero) {
			const authorToCheck = feedZero.reason ? feedZero.reason.by : feedZero.post.author;
			const labels = authorToCheck?.labels;
			if (labels) {
				for (let i = 0; i < labels.length; i++) {
					if (labels[i].val === '!no-unauthenticated') {
						respData = {
							unauth: true,
						};
						return respData;
					}
				}
			}
		}

		// Generate feed flat file
		const generateFeedHTMLResp = await generateFeedHtml(feedData, RichText);
		if (!generateFeedHTMLResp.success) {
			throw new Error(`Couldn't generate feed HTML`);
		}

		// Save it to the CDN
		const { generatedFeedHTML } = generateFeedHTMLResp;
		const cdnResp = await saveToCDN(bskyHash, generatedFeedHTML, CDN_URI, AWS_S3_BUCKET_NAME);
		if (!cdnResp.success) {
			throw new Error(`Couldn't save feed data to CDN`);
		}

		// Add the bskyId and time updated to the DB
		const now = dayjs().unix();
		const putResp = await ddbClient.put({
			TableName: AWS_BSKY_FEED_TABLE,
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
