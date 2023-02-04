import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import cinemaAbi from "../contract/cinema.abi.json";
import { CinemaContractAddress, formatPriceToShow, leadingZero, timeStampToDate } from './helpers.js';

let contract;
var kit;

// Array for all films
let allFilms = [];

// Options for Toastr notifications
toastr.options = { "positionClass": "toast-top-center" }

var spinner = new Spinner().spin();

// renders loading spinner
const renderLoading = (value = true) => {
    if (value) {
        spinner.spin(document.getElementById('spinnerContainer'));

        $($('.container')[0]).css({ opacity: "0.5", pointerEvents: "none" });
    } else {
        spinner.stop();
        $($('.container')[0]).css({ opacity: "1", pointerEvents: "all" });
    }
}

function notification(_text) { toastr.warning(_text); }

function notificationOff() { toastr.clear(); }

// reverse hisory to see last added tickets first
const sortHistory = (arr) => {

    let new_ = [];

    arr.forEach((element, key) => {
        new_.unshift({
            ticket_id: key,
            film_id: element.film_id,
            isUsed: element.isUsed,
            purchase_datetime: element.purchase_datetime,
            seat: element.seat,
            seat_price: element.seat_price,
            session_datetime: element.session_datetime,
            ticket_id: element.ticket_id
        });
    });

    return new_;
}

// fetch all films
const updateAllFilms = async () =>
    allFilms = await contract.methods.getAllFilms().call();

// card title depends on ticket status(used or not used) and session expiry
const cardTitle = (element) => {

    let class_ = "card-title ";
    let text = `Ticket - #${element.ticket_id} `;

    if(element.isUsed)
        text += "(was Used)";
    else
        text += "(was not Used)";

    if(element.session_datetime <= Date.now()){
        class_ += "text-danger";
        text += ", Session ended";
    }

    return `<h4 class="${class_}">${text}</h4>`;
}

const render_history = async () => {
    renderLoading();

    const list = $('div#list');

    const history = sortHistory(await contract.methods.allBookings(kit.defaultAccount).call());

    if(!history.length){
        list.html("You don't have any tickets purchased");
        list.addClass('text-center')
        renderLoading(false);

        return;
    }

    await updateAllFilms();


    history.forEach((element) => {
        const film = allFilms[element.film_id];

        list.append(
            `<div class="card mb-4">` +
                `<div class="card-horizontal">` +
                    `<div class="img-square-wrapper">` +
                        `<img class="" src="${film['poster_img']}" alt="Card image cap">` +
                    `</div>` +
                    `<div class="card-body pb-0">` +
                        cardTitle(element) +
                        `<p class="card-text">
                            Film name - ${film['name']} <br />
                            Session date - ${timeStampToDate(element.session_datetime)} <br />
                            Seat - ${leadingZero(element.seat)}, cost ${formatPriceToShow(element.seat_price)} CELO
                        </p>` +
                    `</div>` +
                `</div>` +
                `<div class="card-footer">` +
                    `<small class="text-muted">Purchase date - ${timeStampToDate(element.purchase_datetime)}</small>` +
                `</div>` +
            `</div>`
        );
    });

    renderLoading(false);
}

const connectCeloWallet = async () => {
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

window.addEventListener("load", async () => {
    notification("⌛ Loading...");
    await connectCeloWallet();

    if (kit.defaultAccount) {

        const role = await contract.methods.userRole(kit.defaultAccount).call();

        if(role !== "client")
            $('.menu').append('<nav class="my-2 my-md-0 mr-md-3"><a class="p-2 text-dark" href="/admin.html" id="open_admin_panel">Admin panel</a></nav>');

        $("body").fadeIn(0);

        await render_history();
    }

});