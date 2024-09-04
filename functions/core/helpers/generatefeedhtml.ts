// AWS & Shared Layer
import { dayjs } from '/opt/shared.js';

// Local modules
import { likeSVG, replySVG, repostSVG, userAvatarSVG } from './svg.js';

// TS Types
import { GenerateFeedHTMLResp } from 'types/data';

const createPostBox = (post: any, hasQuotePost: boolean, isRepost: boolean, reason: any) => {
	// Sanity check - no post? Return an empty string
	if (!post) {
		return '';
	}
	console.log(post.reason);

	// Extract the stuff we need to display from the post obj
	const avatar = post.author?.avatar || null;
	const numLikes = post.likeCount > 0 ? post.likeCount.toString() : '';
	const numReplies = post.replyCount > 0 ? post.replyCount.toString() : '';
	const numReposts = post.repostCount > 0 ? post.repostCount.toString() : '';
	const rawText = post.record?.text || '';
	const repostDisplayName = reason?.by?.displayName || '';
	const repostHandle = reason?.by?.handle || '';
	const repostLink = isRepost ? `https://bsky.app/profile/${repostHandle}/` : '';
	const textCopy = rawText.replace('\n', '<br /><br />');
	const userDisplayName = post.author?.displayName || 'unknown';
	const userHandle = post.author?.handle || 'unknown';
	const userLink = `https://bsky.app/profile/${userHandle}/`;
	const time = post.record?.createdAt ? dayjs().to(dayjs(post.record.createdAt)) : 'unknown';

	// Put together a blob of HTML for the post
	// TODO - timestamp links should go to the specific post, not the user page
	return `<div class="embedbsky">${isRepost ? `<div class="repostheader"><a href="${repostLink}" target="_blank">${repostSVG}reposted by ${repostDisplayName}</a></div>` : ''}<div class="postbox"><div class="col avatar"><div class="avatar-img"><a href="${userLink}" target="_blank">${avatar ? `<img src="${avatar}" alt="" />` : userAvatarSVG}</a></div></div><div class="col text"><div class="textdata"><strong><a href="${userLink}" target="_blank">${userDisplayName}</a></strong> <span class="handle"><a href="${userLink}" target="_blank">${userHandle}</a></span> &sdot; <span class="timeago"><a href="${userLink}" target="_blank">${time}</a></span></div><div class="textcopy">${textCopy}</div>${hasQuotePost ? createQuotePost(post.embed?.record) : ''}<div class="icons"><div class="replies">${replySVG}<span class="num">${numReplies}</span></div><div class="reposts">${repostSVG}<span class="num">${numReposts}</span></div><div class="likes">${likeSVG}<span class="num">${numLikes}</span></div><div class="empty">&nbsp;</div></div></div></div></div>`;
};

const createQuotePost = (record: any) => {
	// Sanity check - no record? Return an empty string
	if (!record) {
		return '';
	}

	// Extract the stuff we need to create a quote post
	const avatar = record.author?.avatar || '';
	const userDisplayName = record.author?.displayName || 'unknown';
	const userHandle = record.author?.handle || 'unknown';
	const textCopy = record.value?.text || '';
	const time = record.value?.createdAt ? dayjs().to(dayjs(record.createdAt)) : 'unknown';

	// Create that HTML blob!
	return `<div class="quotebox"><div class="text"><div class="header"><span class="avatar">${avatar ? `<img src="${avatar}" alt="" />` : userAvatarSVG}</span><strong>${userDisplayName}</strong> <span class="handle">${userHandle}</span> &sdot; <span class="timeago">${time}</span></div><div class="textcopy">${textCopy}</div></div></div>`;
};

const generateFeedHtml = (feedData: any): GenerateFeedHTMLResp => {
	const { feed } = feedData;
	let feedHtml = '';

	for (const feedItem of feed) {
		// Get post and reason objects
		const { post, reason } = feedItem;
		const hasQuotePost = post.embed && post.embed.record ? true : false;
		const isRepost = reason ? true : false;

		feedHtml += createPostBox(post, hasQuotePost, isRepost, reason);
	}
	return {
		generatedFeedHTML: feedHtml,
		success: true,
	};
};

export default generateFeedHtml;
