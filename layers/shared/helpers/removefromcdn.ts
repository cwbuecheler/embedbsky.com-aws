// AWS & Shared Layer
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// TS Types
import { CDNResp } from 'types/data';

const removeFromCDN = async (bskyHash: string, bucketName: string): Promise<CDNResp> => {
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const params = {
		Bucket: bucketName,
		Key: `feeds/${bskyHash}.html`,
	};
	try {
		const data = await s3Client.send(new DeleteObjectCommand(params));
		if (data) {
			return {
				savedFeedURI: '',
				success: true,
			};
		}
	} catch (err: any) {
		console.error(err);
		throw new Error(`Couldn't remove feed from S3`);
	}
	return {
		savedFeedURI: '',
		success: false,
	};
};

export default removeFromCDN;
