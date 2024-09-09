import crypto from 'crypto';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import updateLocale from 'dayjs/plugin/updateLocale.js';

// helpers
import generateFeedHtml from './helpers/generatefeedhtml.js';
import saveToCDN from './helpers/savetocdn.js';

/* Chunk arrays into N chunks - borrowed from AWS utils */
export function* chunkArray(arr: any[], stride = 1) {
	for (let i = 0; i < arr.length; i += stride) {
		yield arr.slice(i, Math.min(i + stride, arr.length));
	}
}

/* Dayjs Extentions */
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.updateLocale('en', {
	relativeTime: {
		future: 'in %s',
		past: '%s',
		s: 'a few seconds',
		m: '1min',
		mm: '%dmin',
		h: '1h',
		hh: '%dh',
		d: '1d',
		dd: '%dd',
		M: '1m',
		MM: '%dm',
		y: '1y',
		yy: '%dy',
	},
});

const hashString = async (str: string) => {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
	return hashHex;
};

export { dayjs, generateFeedHtml, hashString, saveToCDN };
