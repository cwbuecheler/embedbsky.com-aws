// 3rd Party & Node
import { Agent, AtpAgent, RichText } from '@atproto/api';

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
	bskyAgent: AtpAgent | Agent,
	includeReposts: boolean,
	enableFooter: boolean,
	limit: number,
): Promise<RespData> => {
	try {
		// Get the hash for this bsky handle
		const bskyHash = await hashString(bskyId);

		const { data: feedData } = await bskyAgent.app.bsky.feed.getAuthorFeed({
			actor: bskyId,
			filter: 'posts_no_replies',
			limit: 90, // We're getting too many here to handle reposts (see below)
		});

		if (!feedData || !feedData.feed) {
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

		// This is hacky - if we're filtering reposts, do so till we get 30 results
		// Otherwise just return the first 30(ish) (or whatever the limit is).
		// This will eventually be addressed here:
		// https://github.com/bluesky-social/atproto/issues/2048
		if (includeReposts) {
			const countedPosts = feedData.feed.slice(0, limit);
			feedData.feed = countedPosts;
		} else {
			const justPosts = [];
			for (let i = 0; i < feedData.feed.length; i++) {
				const post = feedData.feed[i];
				if (!post.reason) {
					justPosts.push(post);
				}
				if (justPosts.length > limit - 1) {
					break;
				}
			}
			feedData.feed = justPosts;
		}

		// Generate feed flat file
		// We have to pass in RichText because if you put it in the shared layer, NPM blows up
		const generateFeedHTMLResp = await generateFeedHtml(feedData, enableFooter, RichText);
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
				enableFooter: enableFooter ? true : false,
				isDeleted: 0,
				lastUpdated: now,
				limit,
				threwError: 0,
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
