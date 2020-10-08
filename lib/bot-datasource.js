var _ = require('underscore');
var Q = require('q');
const log = require("log4js").getLogger(__filename.split('\\').pop().split('/').pop());

const MESSAGE_TTL = 10 * 60; //10 min

module.exports = async (config, currencyProfileFactory, botClient, redis) => {
	const impl = {};
	impl.getLastPrices = async pairStr => {
		pairStr = pairStr.replace(/[\W_\/]+/,":").toUpperCase();
		const currencyProfile = await currencyProfileFactory.qGetFullCurrencyProfileWithoutRestricted();
		if (currencyProfile.isValidPair1( pairStr )) {
			const s2 = pairStr.split(':')[1];
			const tickers = await botClient.call({}, {}, `/api/tickers/${s2}`, {method: "GET"});
			return _.find(tickers.data, tickerItem => tickerItem.pair === pairStr);
		}
	};
	impl.getPairs = async () => {
		const currencyProfile = await currencyProfileFactory.qGetFullCurrencyProfileWithoutRestricted();
		return currencyProfile.getPairs();
	};
	impl.getAllTickers = async () => {
		const currencyProfile = await currencyProfileFactory.qGetFullCurrencyProfileWithoutRestricted();
		const markets = currencyProfile.getMarkets();
		const ret = await botClient.call({}, {}, `/api/tickers${markets.map(i => `/${i}`).join("")}`, {method: "GET"});
		return ret.data;
	};
	impl.addToSubscribers = async (chatId) => {
		return await Q.npost(redis, "sadd", ["tlg:subscr:tickers", chatId]);
	};
	impl.removeFromSubscribers = async (chatId) => {
		return await Q.npost(redis, "srem", ['tlg:subscr:tickers', chatId]);
	};
	impl.getSubscribers = async () => {
		return await Q.ninvoke(redis, "smembers", ['tlg:subscr:tickers']);
	};
	impl.getSubscribersCount = async () => {
		return await Q.ninvoke(redis, "scard", ['tlg:subscr:tickers']);
	};
	impl.removeAndGetRandomSubscriber = async () => {
		return await Q.ninvoke(redis, "spop", ['tlg:recipients:tickers']);
	};
	impl.copyToRecipientCollection = async () => {
		return await Q.ninvoke(redis, "SUNIONSTORE", ['tlg:recipients:tickers', 'tlg:subscr:tickers']);
	};
	impl.getScheduledMessageParams = async () => {
		const stringValue = await Q.ninvoke(redis, "get", ['tlg:message:tickers']);
		const value = JSON.parse(stringValue) || {};
		return value.tickers;
	};
	impl.createScheduledMessageParams = async (tickers) => {
		return await Q.npost(redis, "setex", ['tlg:message:tickers', MESSAGE_TTL, JSON.stringify({tickers})]);
	};
	impl.updateFuturePost = async (post) => {
		return await Q.npost(redis, "set", ['tlg:post', JSON.stringify(post)]);
	};
	impl.getFuturePost = async () => {
		return await Q.ninvoke(redis, "get", ['tlg:post']);
	};
	impl.clearFuturePost = async () => {
		return await Q.ninvoke(redis, "del", ['tlg:post']);
	};
	impl.createUpvotePost = async (post) => {
		const res = await Q.npost(redis, "hsetnx", [`tlg:votes:photos:${post.photo.file_id}`, 'photo', post.photo.file_id]); //prevents upload the same photos
		if (!!res) {
            return await Q.npost(redis, "hset", [`tlg:votes:${post.photo.file_id}`, 'post', JSON.stringify(post)]);
        }
		return false;
	};
	impl.deleteUpvotePost = async (post) => {
		return await Q.npost(redis, "hrem", [`tlg:votes:${post.photo.file_id}`, 'post']);
	};
	impl.upvoteMessage = async (post_photo_file_id) => {
		return await Q.npost(redis, "HINCRBY", [`tlg:votes:${post_photo_file_id}`, 'upvote', 1]);
	};
	impl.downvoteMessage = async (post_photo_file_id) => {
		return await Q.npost(redis, "HINCRBY", [`tlg:votes:${post_photo_file_id}`, 'downvote', 1]);
	};
	impl.getVoteMessage = async (post_photo_file_id) => {
		return await Q.ninvoke(redis, "hget", [`tlg:votes:${post_photo_file_id}`, 'post']);
	};
	impl.getUpvotes = async (post_photo_file_id) => {
		return await Q.ninvoke(redis, "hget", [`tlg:votes:${post_photo_file_id}`, 'upvote']);
	};
	impl.getDownvotes = async (post_photo_file_id) => {
		return await Q.ninvoke(redis, "hget", [`tlg:votes:${post_photo_file_id}`, 'downvote']);
	};
	impl.listOfVotes = async () => {
		return await Q.ninvoke(redis, "keys", ['tlg:votes:*']);
	};
	return Q.when({
		impl: impl,
		visibleForTest: {
		}
	});
};
