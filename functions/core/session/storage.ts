import { dayjs } from '/opt/shared.js';
import type {
	NodeSavedSession,
	NodeSavedSessionStore,
	NodeSavedState,
	NodeSavedStateStore,
} from '@atproto/oauth-client-node';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const AWS_BSKY_SESSION_TABLE = process.env.AWS_BSKY_SESSION_TABLE;
const AWS_BSKY_STATE_TABLE = process.env.AWS_BSKY_STATE_TABLE;

/* Auth State */
export class StateStore implements NodeSavedStateStore {
	constructor(private ddbClient: DynamoDBDocument) {}
	async get(key: string): Promise<NodeSavedState | undefined> {
		try {
			const resp = await this.ddbClient.get({
				TableName: AWS_BSKY_STATE_TABLE,
				Key: {
					key,
				},
			});

			// Check for a value
			if (!resp.Item) {
				return;
			}
			return JSON.parse(resp.Item.state) as NodeSavedState;
		} catch (err: any) {
			console.error(err);
			return;
		}
	}
	async set(key: string, val: NodeSavedState) {
		const thirtyDaysFromNow = dayjs().add(30, 'days').unix();
		try {
			await this.ddbClient.put({
				TableName: AWS_BSKY_STATE_TABLE,
				Item: {
					key,
					state: JSON.stringify(val),
					ttl: thirtyDaysFromNow,
				},
			});
		} catch (err: any) {
			console.error(err);
			return;
		}
	}
	async del(key: string) {
		try {
			await this.ddbClient.delete({
				TableName: AWS_BSKY_STATE_TABLE,
				Key: {
					key,
				},
			});
		} catch (err: any) {
			console.error(err);
			return;
		}
	}
}

/* Auth Session */
export class SessionStore implements NodeSavedSessionStore {
	constructor(private ddbClient: DynamoDBDocument) {}
	async get(key: string): Promise<NodeSavedSession | undefined> {
		try {
			const resp = await this.ddbClient.get({
				TableName: AWS_BSKY_SESSION_TABLE,
				Key: {
					key,
				},
			});

			// Check for a value
			if (!resp.Item) {
				return;
			}
			return JSON.parse(resp.Item.session) as NodeSavedSession;
		} catch (err: any) {
			console.error(err);
			return;
		}
	}
	async set(key: string, val: NodeSavedSession) {
		const thirtyDaysFromNow = dayjs().add(30, 'days').unix();
		try {
			await this.ddbClient.put({
				TableName: AWS_BSKY_SESSION_TABLE,
				Item: {
					key,
					session: JSON.stringify(val),
					ttl: thirtyDaysFromNow,
				},
			});
		} catch (err: any) {
			console.error(err);
			return;
		}
	}
	async del(key: string) {
		try {
			await this.ddbClient.delete({
				TableName: AWS_BSKY_SESSION_TABLE,
				Key: {
					key,
				},
			});
		} catch (err: any) {
			console.error(err);
			return;
		}
	}
}
