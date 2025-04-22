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

const createFeedHeader = (author: any) => {
	const avatar: string = author?.avatar || null;
	const userDisplayName: string = author?.displayName || 'unknown';
	const userDid: string = author?.did || 'unknown';
	const userHandle: string = author?.handle || 'unknown';
	const userLink: string = `https://bsky.app/profile/${userDid}`;
	return `<div class="header"><div class="avatar"><a href="${userLink}" target="_blank"><img src="${avatar}" alt="${userDisplayName} avatar" /></a></div><div class="text"><div class="namecontainer"><a class="name" href="${userLink}" target="_blank">${userDisplayName}</a></div><a class="handle" href="${userLink}" target="_blank">@${userHandle}</a></div></div>`;
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

	// Find images and unbury them
	const images: BskyImage[] = extractImages(post);

	// Discover link cards
	const { hasLinkCard, linkCardData } = extractLinkCard(post);

	// Discover video thumbnail
	const { hasVideo, thumbnail } = extractVideo(post);
	if (hasVideo) {
		console.log('has video');
		console.log(post);
		console.log(thumbnail);
	}

	// Extract the stuff we need to display from the post obj
	const avatar: string = post.author?.avatar || null;
	const numImages: number = images.length;
	const numLikes: string = post.likeCount > 0 ? post.likeCount.toString() : '';
	const numReplies: string = post.replyCount > 0 ? post.replyCount.toString() : '';
	const numReposts: string = post.repostCount > 0 ? post.repostCount.toString() : '';
	const postUrl: string = getPostUrl(post);
	const repostDisplayName: string = reason?.by?.displayName || '';
	const repostDid: string = reason?.by?.did || '';
	const repostLink: string = isRepost ? `https://bsky.app/profile/${repostDid}/` : '';
	const time: string = post.record?.createdAt
		? dayjs().to(dayjs(post.record.createdAt))
		: 'unknown';
	const userDisplayName: string = post.author?.displayName || 'unknown';
	const userHandle: string = post.author?.handle || 'unknown';
	const userDid: string = post.author?.did || 'unknown';
	const userLink: string = `https://bsky.app/profile/${userDid}`;

	// Put together a blob of HTML for the post
	return `<div class="postcontainer">${isRepost ? `<div class="repostheader"><a href="${repostLink}" target="_blank">${repostSVG}reposted by ${repostDisplayName}</a></div>` : ''}<div class="postbox"><div class="col avatar"><div class="avatar-img"><a href="${userLink}" target="_blank">${avatar ? `<img src="${avatar}" alt="${userHandle}'s user avatar" />` : userAvatarSVG}</a></div></div><div class="col text"><div class="textdata"><strong><a href="${userLink}" target="_blank"><span>${userDisplayName}</span></a></strong> <span class="handle"><a href="${userLink}" target="_blank">@${userHandle}</a></span> &sdot; <span class="timeago"><a href="${postUrl}" target="_blank">${time}</a></span></div><div class="textcopy">${textCopy}</div>${hasVideo ? createVideoHtml(thumbnail, postUrl) : ''}${numImages > 0 ? createImageHtml(images, postUrl) : ''}${hasQuotePost ? createQuotePost(post.embed?.record, richText) : ''}${hasLinkCard ? createLinkCard(linkCardData) : ''}<div class="icons"><div class="replies">${replySVG}<span class="num">${numReplies}</span></div><div class="reposts">${repostSVG}<span class="num">${numReposts}</span></div><div class="likes">${likeSVG}<span class="num">${numLikes}</span></div><div class="empty">&nbsp;</div></div></div></div></div>`;
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
	const images: BskyImage[] = extractImages(record);

	// Discover link cards
	const { hasLinkCard, linkCardData } = extractLinkCard(record);

	// Discover video thumbnail
	const { hasVideo, thumbnail } = extractVideo(record);

	// Extract the stuff we need to create a quote post
	const avatar = record.author?.avatar || '';
	const numImages: number = images?.length;
	const postUrl: string = getPostUrl(record);
	const time = record.value?.createdAt ? dayjs().to(dayjs(record.value.createdAt)) : 'unknown';
	const userDisplayName = record.author?.displayName || 'unknown';
	const userHandle = record.author?.handle || 'unknown';

	// Create that HTML blob!
	return `<div class="quotebox"><div class="text"><div class="header"><span class="avatar">${avatar ? `<img src="${avatar}" alt="${userHandle}'s user avatar" />` : userAvatarSVG}</span><span class="othertext"><strong><span>${userDisplayName}</span></strong> <span class="handle">@${userHandle}</span> &sdot; <span class="timeago">${time}</span></span></div><div class="textcopy">${textCopy}</div>${hasVideo ? createVideoHtml(thumbnail, postUrl) : ''}${hasLinkCard ? createLinkCard(linkCardData) : ''}${numImages > 0 ? createImageHtml(images, postUrl) : ''}</div></div>`;
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

// Create video thumbnail HTML
const createVideoHtml = (thumbnail: string, postUrl: string): string => {
	if (!thumbnail) {
		return '';
	}
	return `<div class="postimages len-1"><div class="img"><a href="${postUrl}" target="_blank" style="position:relative"><div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: 50%; position: absolute; top: 0; left: 0; z-index: 10;"><svg fill="#FFFFFF" version="1.1" id="playbutton" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100px" height="100px" viewBox="0 0 124.512 124.512" xml:space="preserve"><g><path d="M113.956,57.006l-97.4-56.2c-4-2.3-9,0.6-9,5.2v112.5c0,4.6,5,7.5,9,5.2l97.4-56.2 C117.956,65.105,117.956,59.306,113.956,57.006z"/></g></svg></div><img src="${thumbnail}" alt="video thumbnail" /></a></div></div>`;
};

// Extract images from the post or record
const extractImages = (postOrRecord: any): BskyImage[] => {
	if (!postOrRecord) {
		return [];
	}
	let images: BskyImage[] = [];
	if (postOrRecord.embed?.images) {
		images = postOrRecord.embed.images;
	} else if (postOrRecord.embed?.media?.images) {
		images = postOrRecord.embed.media.images;
	} else if (postOrRecord.embeds) {
		postOrRecord.embeds.forEach((embed: any) => {
			if (embed.images?.length > 0) {
				images = embed.images;
			}
			if (embed.media?.images?.length > 0) {
				images = embed.media.images;
			}
		});
	}
	return images;
};

// Extract link cards from the post or record
const extractLinkCard = (postOrRecord: any): { hasLinkCard: boolean; linkCardData: any } => {
	let hasLinkCard = false;
	let linkCardData: any = undefined;
	if (postOrRecord.embed?.external) {
		hasLinkCard = true;
		linkCardData = postOrRecord.embed.external;
	} else if (postOrRecord.embeds) {
		postOrRecord.embeds.forEach((embed: any) => {
			if (embed.external) {
				hasLinkCard = true;
				linkCardData = embed.external;
			}
		});
	}
	return { hasLinkCard, linkCardData };
};

// Extract video thumbnail from the post or record
const extractVideo = (postOrRecord: any): { hasVideo: boolean; thumbnail: string } => {
	return {
		hasVideo: postOrRecord.embed?.thumbnail ? true : false,
		thumbnail: postOrRecord.embed?.thumbnail || '',
	};
};

const getPostUrl = (post: any) => {
	if (!post.uri) {
		return 'https://bsky.app';
	}

	// split the URI by the forward slash character
	const splitUri: string[] = post.uri.split('/');
	const uriId = splitUri[splitUri.length - 1];
	const userDid: string = post.author?.did || 'unknown';
	return `https://bsky.app/profile/${userDid}/post/${uriId}`;
};

// We have to pass in RichText because if you put it in the shared layer, NPM blows up
const generateFeedHtml = (feedData: any, richText: any): GenerateFeedHTMLResp => {
	const { feed } = feedData;

	// We're using the feed items to get some info about the feed owner
	const firstItem = feed[0];

	// If there's no post or author, just mosey on
	if (!firstItem) {
		return {
			generatedFeedHTML: '',
			success: true,
		};
	}
	const author = firstItem.reason ? firstItem.reason.by : firstItem.post.author;
	if (!author) {
		return {
			generatedFeedHTML: '',
			success: false,
		};
	}

	// Then we're creating a header with that info
	let feedHtml = createFeedHeader(author);

	// Then we're adding all the posts
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
