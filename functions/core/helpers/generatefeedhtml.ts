// AWS & Shared Layer
import { dayjs } from '/opt/shared.js';

// Local modules
import { likeSVG, replySVG, repostSVG, userAvatarSVG } from './svg.js';

// TS Types
import { GenerateFeedHTMLResp } from 'types/data';

type BskyImage = {
	alt: string;
	aspectRatio: {
		height: number;
		width: number;
	};
	fullSize: string;
	thumb: string;
};

const createImageHtml = (images: BskyImage[], postUrl: string): string => {
	if (!images) {
		return '';
	}

	const imagesLength = images.length;
	let imagesHtml = `<div class="postimages len-${imagesLength}">`;
	images.forEach((img) => {
		imagesHtml += `<div class="img"><a href="${postUrl}" target="_blank"><img src="${img.thumb}" alt="${img.alt}" /></a></div>`;
	});
	imagesHtml += `</div>`;
	return imagesHtml;
};

const createPostBox = (
	post: any,
	hasQuotePost: boolean,
	isRepost: boolean,
	reason: any,
): string => {
	// Sanity check - no post? Return an empty string
	if (!post) {
		return '';
	}

	// Extract the stuff we need to display from the post obj
	const avatar: string = post.author?.avatar || null;
	const images: BskyImage[] = post.embed?.images || [];
	const numImages: number = post.embed?.images?.length || 0;
	const numLikes: string = post.likeCount > 0 ? post.likeCount.toString() : '';
	const numReplies: string = post.replyCount > 0 ? post.replyCount.toString() : '';
	const numReposts: string = post.repostCount > 0 ? post.repostCount.toString() : '';
	const postUrl: string = getPostUrl(post);
	const textCopy: string = post.record?.text || '';
	const repostDisplayName: string = reason?.by?.displayName || '';
	const repostHandle: string = reason?.by?.handle || '';
	const repostLink: string = isRepost ? `https://bsky.app/profile/${repostHandle}/` : '';
	const time: string = post.record?.createdAt
		? dayjs().to(dayjs(post.record.createdAt))
		: 'unknown';
	const userDisplayName: string = post.author?.displayName || 'unknown';
	const userHandle: string = post.author?.handle || 'unknown';
	const userLink: string = `https://bsky.app/profile/${userHandle}/`;

	// Put together a blob of HTML for the post
	return `
		<div class="postcontainer">
			${isRepost ? `<div class="repostheader"><a href="${repostLink}" target="_blank">${repostSVG}reposted by ${repostDisplayName}</a></div>` : ''}
			<div class="postbox">
				<div class="col avatar">
					<div class="avatar-img"><a href="${userLink}" target="_blank">${avatar ? `<img src="${avatar}" alt="${userHandle}'s user avatar" />` : userAvatarSVG}</a></div>
				</div>
				<div class="col text">
					<div class="textdata">
						<strong><a href="${userLink}" target="_blank">${userDisplayName}</a></strong>
						<span class="handle"><a href="${userLink}" target="_blank">${userHandle}</a></span> &sdot;
						<span class="timeago"><a href="${postUrl}" target="_blank">${time}</a></span>
					</div>
					<div class="textcopy">${textCopy}</div>
					${hasQuotePost ? createQuotePost(post.embed?.record) : ''}
					${numImages > 0 ? createImageHtml(images, postUrl) : ''}
					<div class="icons">
						<div class="replies">${replySVG}<span class="num">${numReplies}</span></div>
						<div class="reposts">${repostSVG}<span class="num">${numReposts}</span></div>
						<div class="likes">${likeSVG}<span class="num">${numLikes}</span></div>
						<div class="empty">&nbsp;</div>
					</div>
				</div>
			</div>
		</div>`;
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
	const time = record.value?.createdAt ? dayjs().to(dayjs(record.value.createdAt)) : 'unknown';

	// Create that HTML blob!
	return `
		<div class="quotebox">
			<div class="text">
				<div class="header">
					<span class="avatar">${avatar ? `<img src="${avatar}" alt="${userHandle}'s user avatar" />` : userAvatarSVG}</span>
					<span class="othertext">
						<strong>${userDisplayName}</strong>
						<span class="handle">${userHandle}</span> &sdot;
						<span class="timeago">${time}</span>
					</span>
				</div>
				<div class="textcopy">${textCopy}</div>
			</div>
		</div>`;
};

const getPostUrl = (post: any) => {
	if (!post.uri) {
		return 'https://bsky.app';
	}

	// split the URI by the forward slash character
	const splitUri: string[] = post.uri.split('/');
	const uriId = splitUri[splitUri.length - 1];
	const userHandle: string = post.author?.handle || 'unknown';
	return `https://bsky.app/profile/${userHandle}/post/${uriId}`;
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
