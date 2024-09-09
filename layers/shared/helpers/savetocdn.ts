// AWS & Shared Layer
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// TS Types
import { CDNResp } from 'types/data';

const saveToCDN = async (
	bskyHash: string,
	html: string,
	uri: string,
	bucketName: string,
): Promise<CDNResp> => {
	let savedFeedURI = '';
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const params = {
		Bucket: bucketName,
		Key: `feeds/${bskyHash}.html`,
		Body: html,
		ContentType: 'text/html',
	};

	try {
		const data = await s3Client.send(new PutObjectCommand(params));
		if (data) {
			savedFeedURI = `${uri}/feeds/${bskyHash}.html`;
			// change when we get cloudfront working properly
			// savedFeedURI = `https://embedbsky.com/feeds/${bskyId}.html`;
		}
	} catch (err: any) {
		console.error(err);
		throw new Error(`Couldn't save feed to S3`);
	}

	return {
		savedFeedURI,
		success: true,
	};
};

export default saveToCDN;
