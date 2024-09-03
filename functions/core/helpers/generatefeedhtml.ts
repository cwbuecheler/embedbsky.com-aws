// AWS & Shared Layer
import { dayjs } from '/opt/shared.js';

// Local modules
import { likeSVG, replySVG, repostSVG, userAvatarSVG } from './svg';

// TS Types
import { GenerateFeedHTMLResp } from 'types/data';

const createPostBox = (post: any, hasQuotePost: boolean, isRepost: boolean) => {
	// Sanity check - no post? Return an empty string
	if (!post) {
		return '';
	}

	// Extract the stuff we need to display from the post obj
	const avatar = post.author?.avatar || null;
	const numLikes = post.likeCount || null;
	const numReplies = post.replyCount || null;
	const numReposts = post.repostCount || null;
	const repostHandle = post.reason?.by?.handle || '';
	const textCopy = post.record?.text || '';
	const userDisplayName = post.author?.displayName || 'unknown';
	const userHandle = post.author?.handle || 'unknown';
	const time = post.record?.createdAt
		? dayjs(post.record.createdAt).format('MM/DD/YYYY hh:mm')
		: 'unknown';

	// Put together a blob of HTML for the post
	return `<div class="embedbsky">
	<div class="postbox">
		${isRepost ? `<div class="repostheader">${repostSVG}reposted by ${repostHandle}</div>` : ''}
		<div class="col avatar">
			<div class="avatar-img">${avatar ? `<img src="${avatar}" alt="" /></div>` : userAvatarSVG}</div>
		</div>
		<div class="col text">
			<div class="textdata">
				<strong>${userDisplayName}</strong> ${userHandle} · <span class="timeago">${time}</span>
			</div>
			<div class="textcopy">${textCopy}</div>
			${hasQuotePost ? createQuotePost(post.embed?.record) : ''}
			<div class="icons">
				<div class="reply">${replySVG}<span class="num">${numReplies}</span></div>
				<div class="reposts">${repostSVG}<span class="num">${numReposts}</span></div>
				<div class="likes">${likeSVG}<span class="num">${numLikes}</span></div>
			</div>
		</div>
	</div>
	</div>`;
};

const createQuotePost = (record: any) => {
	if (!record) {
		return '';
	}

	// Extract the stuff we need to create a quote post
	const avatar = record.author?.avatar || '';
	const userDisplayName = record.author?.displayName || 'unknown';
	const userHandle = record.author?.handle || 'unknown';
	const textCopy = record.value?.text || '';
	const time = record.value?.createdAt
		? dayjs(record.createdAt).format('MM/DD/YYYY hh:mm')
		: 'unknown';

	// Create that HTML blob!
	return `<div class="embedbsky">
	<div class="postbox quote">
		<div class="col text">
			<div class="textdata">
				<span class="avatar">${avatar ? `<img src="${avatar}" alt="" /></div>` : userAvatarSVG}</span>
				<strong>${userDisplayName}</strong> ${userHandle} · <span class="timeago">${time}</span>
			</div>
			<div class="textCopy">${textCopy}</div>
		</div>
	</div>
	</div>`;
};

const generateFeedHtml = (feedData: any): GenerateFeedHTMLResp => {
	const { feed } = feedData;
	let feedHtml = '';

	for (const feedItem of feed) {
		// Get post and reason objects
		const { post, reason } = feedItem;
		const hasQuotePost = post.embed && post.embed.record ? true : false;
		const isRepost = reason ? true : false;

		feedHtml += createPostBox(post, hasQuotePost, isRepost);
	}
	return {
		generatedFeedHTML: feedHtml,
		success: true,
	};
};

export default generateFeedHtml;
