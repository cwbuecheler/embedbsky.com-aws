// TS Types
import { CDNResp } from 'types/data';

const saveToCDN = async (generatedFeedHtml: string): Promise<CDNResp> => {
	console.log(generatedFeedHtml);
	return {
		savedFeedURI: '',
		success: true,
	};
};

export default saveToCDN;
