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

const createLinkCard = (linkInfo: any) => {
	const { description, thumb, title, uri } = linkInfo;
	const hasThumb = thumb ? true : false;
	const finalThumbUri = thumb?.uri || thumb;
	const domain = new URL(uri).hostname;
	return `<div class="linkcard"><a href="${uri}" target="_blank">${hasThumb ? `<div class="image"><img src="${finalThumbUri}" alt="header image - ${title}" /></div>` : ''}<div class="site">${domain}</div><div class="text"><strong>${title}</strong><br />${description}</div></a></div>`;
};

const createPostBox = (
	post: any,
	hasQuotePost: boolean,
	isRepost: boolean,
	reason: any,
	richText: any,
): string => {
	// Sanity check - no post? Return an empty string
	if (!post) {
		return '';
	}

	// Handle rich text
	const hasFacets = post.record?.facets?.length > 0 ? true : false;
	let textCopy: string = post.record?.text || '';
	if (hasFacets) {
		textCopy = createRichText(textCopy, post.record.facets, richText);
	}

	// TODO - DRY this
	// Find images and unbury them
	let images: BskyImage[] = [];
	if (post.embed?.images) {
		images = post.embed.images;
	} else if (post.embed?.media?.images) {
		images = post.embed.media.images;
	} else if (post.embeds) {
		post.embeds.forEach((embed: any) => {
			if (embed.images?.length > 0) {
				images = embed.images;
			}
			if (embed.media?.images?.length > 0) {
				images = embed.media.images;
			}
		});
	}

	// TODO - DRY this
	// Discover link cards
	let hasLinkCard = false;
	let linkCardData: any = undefined;
	if (post.embed?.external) {
		hasLinkCard = true;
		linkCardData = post.embed.external;
	} else if (post.embeds) {
		post.embeds.forEach((embed: any) => {
			if (embed.external) {
				hasLinkCard = true;
				linkCardData = embed.external;
			}
		});
	}

	// Extract the stuff we need to display from the post obj
	const avatar: string = post.author?.avatar || null;
	const numImages: number = images.length;
	const numLikes: string = post.likeCount > 0 ? post.likeCount.toString() : '';
	const numReplies: string = post.replyCount > 0 ? post.replyCount.toString() : '';
	const numReposts: string = post.repostCount > 0 ? post.repostCount.toString() : '';
	const postUrl: string = getPostUrl(post);
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
	return `<div class="postcontainer">${isRepost ? `<div class="repostheader"><a href="${repostLink}" target="_blank">${repostSVG}reposted by ${repostDisplayName}</a></div>` : ''}<div class="postbox"><div class="col avatar"><div class="avatar-img"><a href="${userLink}" target="_blank">${avatar ? `<img src="${avatar}" alt="${userHandle}'s user avatar" />` : userAvatarSVG}</a></div></div><div class="col text"><div class="textdata"><strong><a href="${userLink}" target="_blank"><span>${userDisplayName}</span></a></strong> <span class="handle"><a href="${userLink}" target="_blank">${userHandle}</a></span> &sdot; <span class="timeago"><a href="${postUrl}" target="_blank">${time}</a></span></div><div class="textcopy">${textCopy}</div>${numImages > 0 ? createImageHtml(images, postUrl) : ''}${hasQuotePost ? createQuotePost(post.embed?.record, richText) : ''}${hasLinkCard ? createLinkCard(linkCardData) : ''}<div class="icons"><div class="replies">${replySVG}<span class="num">${numReplies}</span></div><div class="reposts">${repostSVG}<span class="num">${numReposts}</span></div><div class="likes">${likeSVG}<span class="num">${numLikes}</span></div><div class="empty">&nbsp;</div></div></div></div></div>`;
};

const createQuotePost = (record: any, richText: any) => {
	// Sanity check - no record? Return an empty string
	if (!record) {
		return '';
	}

	// Handle self-quotes, which have an extra "record" level;
	if (record.record) {
		record = record.record;
	}

	// Handle rich text
	const hasFacets = record?.facets?.length > 0 ? true : false;
	let textCopy: string = record?.text || record?.value?.text || '';
	if (hasFacets) {
		textCopy = createRichText(textCopy, record.facets, richText);
	}

	// Find images and unbury them
	let images: BskyImage[] = [];
	if (record.embed?.images) {
		images = record.embed.images;
	} else if (record.embed?.media?.images) {
		images = record.embed.media.images;
	} else if (record.embeds) {
		record.embeds.forEach((embed: any) => {
			if (embed.images?.length > 0) {
				images = embed.images;
			}
			if (embed.media?.images?.length > 0) {
				images = embed.media.images;
			}
		});
	}

	// Discover link cards
	let hasLinkCard = false;
	let linkCardData: any = undefined;
	if (record.embed?.external) {
		hasLinkCard = true;
		linkCardData = record.embed.external;
	} else if (record.embeds) {
		record.embeds.forEach((embed: any) => {
			if (embed.external) {
				hasLinkCard = true;
				linkCardData = embed.external;
			}
		});
	}

	// Extract the stuff we need to create a quote post
	const avatar = record.author?.avatar || '';
	const numImages: number = images?.length;
	const postUrl: string = getPostUrl(record);
	const time = record.value?.createdAt ? dayjs().to(dayjs(record.value.createdAt)) : 'unknown';
	const userDisplayName = record.author?.displayName || 'unknown';
	const userHandle = record.author?.handle || 'unknown';

	// Create that HTML blob!
	return `<div class="quotebox"><div class="text"><div class="header"><span class="avatar">${avatar ? `<img src="${avatar}" alt="${userHandle}'s user avatar" />` : userAvatarSVG}</span><span class="othertext"><strong><span>${userDisplayName}</span></strong> <span class="handle">${userHandle}</span> &sdot; <span class="timeago">${time}</span></span></div><div class="textcopy">${textCopy}</div>${hasLinkCard ? createLinkCard(linkCardData) : ''}${numImages > 0 ? createImageHtml(images, postUrl) : ''}</div></div>`;
};

const createRichText = (text: string, facets: any, richText: any): string => {
	const rt: any = new richText({ text, facets });
	let finalText = ``;

	for (const segment of rt.segments()) {
		if (segment.isLink()) {
			finalText += `<a href="${segment.link?.uri}" target="_blank">${segment.text}</a>`;
		} else if (segment.isMention()) {
			finalText += `<a href="https://bsky.app/profile/${segment.mention?.did}" target="_blank">${segment.text}</a>`;
		} else if (segment.isTag()) {
			finalText += `<a href="https://bsky.app/hashtag/${segment.tag?.tag}" target="_blank">${segment.text}</a>`;
		} else {
			finalText += segment.text;
		}
	}

	return finalText;
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

const generateFeedHtml = (feedData: any, richText: any): GenerateFeedHTMLResp => {
	const { feed } = feedData;
	let feedHtml = '';

	for (const feedItem of feed) {
		// Get post and reason objects
		const { post, reason } = feedItem;
		const hasQuotePost = post.embed && post.embed.record ? true : false;
		const isRepost = reason ? true : false;

		feedHtml += createPostBox(post, hasQuotePost, isRepost, reason, richText);
	}
	return {
		generatedFeedHTML: feedHtml,
		success: true,
	};
};

export default generateFeedHtml;
