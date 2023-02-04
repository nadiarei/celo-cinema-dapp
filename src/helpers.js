export const ERC20_DECIMALS = 18;

export const CinemaContractAddress = "0x8350E764B9Dfcd4a881B97C6cDc14937c90Dbaf3";

export const leadingZero = (num) => ( ("0" + num).slice(-2) );

// Function converts unix timestamp to string date
export const timeStampToDate = (stamp) => {
    const d = new Date(parseInt(stamp));

    return d.getFullYear() + "-" +
        ("0" + (d.getMonth() + 1)) + "-" +
        leadingZero(d.getDate()) + " " +
        leadingZero(d.getHours()) + ":" +
        leadingZero(d.getMinutes());
}

export const formatPriceToShow = (value) => (parseInt(value) / Math.pow(10, ERC20_DECIMALS))

// disabled or enables input
export const disableInput = (elem, value) => elem.prop("disabled", value);

export const pluralize = (count, noun, suffix = 's') => `${count} ${noun}${count !== 1 ? suffix : ''}`;

// finds object in array of object, if it is found returns true
export const compareWithObjectArray = (array, obj) => {
    return array.some(element => {
        if (JSON.stringify(element) === JSON.stringify(obj)) {
            return true;
        }

        return false;
    });
}

export const connectCeloWallet = async () => {
    if (window.celo) {
        notification("⚠️ Please approve this DApp to use it.");
        try {
            await window.celo.enable();
            setTimeout(notificationOff(), 5000);

            const web3 = new Web3(window.celo);
            kit = newKitFromWeb3(web3);

            const accounts = await kit.web3.eth.getAccounts();
            kit.defaultAccount = accounts[0];

            contract = new kit.web3.eth.Contract(cinemaAbi, CinemaContractAddress);
        } catch (error) {
            notification(`⚠️ ${error}.`);
        }
    } else {
        notification("⚠️ Please install the CeloExtensionWallet.");
    }
};