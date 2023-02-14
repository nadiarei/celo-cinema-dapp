export const ERC20_DECIMALS = 18;

export const CinemaContractAddress = "0x6D36f91d6354B2341d0B44141FA3c78F07016782";

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
