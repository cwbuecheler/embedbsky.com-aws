// AWS & Shared Layer
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// TS Types
import { CDNResp } from 'types/data';

const saveToCDN = async (bskyId: string, html: string): Promise<CDNResp> => {
	let savedFeedURI = '';
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const bucket = process.env.AWS_S3_BUCKET_NAME;
	const params = {
		Bucket: bucket,
		Key: `feeds/${bskyId}.html`,
		Body: html,
		ContentType: 'text/html; charset=utf-8',
	};

	try {
		const data = await s3Client.send(new PutObjectCommand(params));
		if (data) {
			savedFeedURI = `https://embedbsky.com/feeds/${bskyId}.html`;
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
