const log = require("log4js").getLogger(__filename.split('\\').pop().split('/').pop());
const req = require('./httpClientPromise');
const vm = require('vm');

module.exports = async function(config) {
    const impl = {};
    const ts = new Date().getTime();
    const cexIoHost = config().tlgbp.cexIoHost ? config().tlgbp.cexIoHost : 'cex.io';
    let cpResponse = await req(`https://${cexIoHost}/scripts/currencyProfile/${ts}-tbot`);
    const cpRemote = {};
    vm.runInNewContext( cpResponse.body, cpRemote );
    // log.trace(JSON.stringify(cpRemote, null, 4));
    const cpData = cpRemote.currencyProfileData;
    const currencyProfile = {
        getPairs: () => cpData.pairsList,
        getMarkets: () => cpRemote.getMarkets(),
        isValidPair1: pairStr => cpData.pairsList.indexOf(pairStr) > -1,
        parseAmount: cpRemote.parseAmount,
        formatPrice1: cpRemote.formatPrice1,
        symbol1ToSymbol2: cpRemote.symbol1ToSymbol2
    };
    impl.qGetFullCurrencyProfileWithoutRestricted = () => {
        return Promise.resolve(currencyProfile);
    };
    return Promise.resolve({
        impl: impl,
        visibleForTest: {
        }
    });
};
