import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import cinemaAbi from "../contract/cinema.abi.json";
import { CinemaContractAddress, pluralize, formatPriceToShow, compareWithObjectArray, leadingZero, timeStampToDate } from './helpers.js';

let contract;
var kit;

// array for all films
let allFilms = [];

// modal initialization
const modal = new HystModal({ linkAttributeName: "data-hystmodal" });

// options for Toastr notifications
toastr.options = { "positionClass": "toast-top-center" }

var spinner = new Spinner().spin();

// tickets user would buy
let current_orders = [];

/* all purchased tickets by all users
    needs to show to user that some of seats are already purchased
*/
let current_tickets = [];

// class object is only for saving tickets user wants to purchase
class BookOrder {
    constructor(film_id, session_id, session_datetime, seat, user, seat_price) {
        this.film_id = film_id;
        this.session_id = session_id;
        this.datetime = session_datetime;
        this.seat = seat;
        this.user = user;
        this.seat_price = seat_price;
    }
}

function notification(_text) { toastr.warning(_text); }

function notification_success(_text) { toastr.success(_text) }

function notificationOff() { toastr.clear(); }

const renderLoading = (value = true) => {
    if (value) {
        spinner.spin(document.getElementById('spinnerContainer'));

        $('body').css({ opacity: "0.5", pointerEvents: "none" });
    } else {
        spinner.stop();
        $('body').css({ opacity: "1", pointerEvents: "all" });
    }
}

// retrieves all films from contract
const updateAllFilms = async () =>
    allFilms = await contract.methods.getAllFilms().call();

// retrieves all tickets that was already purchased by all of the users
const retrieve_current_tickets = async () => {
    const tickets = await contract.methods.allCurrentTickets().call();

    current_tickets = [];

    tickets.forEach((element) => {
        current_tickets.push({
            film_id: element.film_id,
            session_id: element.session_id,
            seat: leadingZero(element.seat)
        })
    });
}

// if seat is not avaiable disable a button of that seat
const checkIsSeatAvailable = (film_id, session_id, seat) => {
    const button = $(`button[data-film="${film_id}"][data-session="${session_id}"]:contains(${seat})`)[0];

    const found = compareWithObjectArray(current_tickets, { film_id, session_id: session_id.toString(), seat });

    if (found) {
        $(button).prop('disabled', true);
    } else {
        $(button).addClass(setSeatClass(film_id, session_id, seat));
    }

}

// function sets a class to a seat button
// it only calls if seat is not already purchased by another user
const setSeatClass = (film_id, session_id, seat) => {

    // to delete an order, we create temp object to compare with orders array
    const session = allFilms[film_id]['sessions'][session_id];

    const temp_order = new BookOrder(film_id, session_id.toString(), session['datetime'], seat, kit.defaultAccount, session['seat_price']);

    const found = compareWithObjectArray(current_orders, temp_order);

    // if seat is already in purchase list return btn-primary className
    if (found)
        return 'btn-primary';
    else
        return 'btn-outline-dark';
}

// renders all films in a list
const renderFilmsContainer = async () => {

    renderLoading();

    await updateAllFilms();

    await retrieve_current_tickets();

    let container = $(".films_containter");

    if (allFilms.length) {

        container.empty();

        for (let i = 0; i < allFilms.length; i++) {
            // if film was not deleted, it has to have name and image
            if (allFilms[i]['name'].length && allFilms[i]['poster_img'].length) {
                container.append(
                    `<div class="card d-flex flex-column mb-4 col-md-4 box-shadow">` +

                    `<img class="card-img-top" src="${allFilms[i]['poster_img']}">` +

                    `<div class="card-header">` +
                    `<h6 class="my-0 font-weight-normal">${allFilms[i]['name']}</h6>` +
                    `</div>` +

                    `<button type="button" data-id="${i}" class="open-sessions mt-auto btn btn-lg btn-block btn-outline-primary">Watch sessions</button>`

                    + `</div>`
                );
            }
        }

        // opens a modal window with sessions list
        $('button.open-sessions').click(function () {
            watchSessions($(this).attr('data-id'));
        });

    }

    renderLoading(false);
}

// renders a content inside a modal of session information and opens a modal window
function watchSessions(film_id) {

    const film = allFilms[film_id];
    const sessions = film['sessions'];

    $('#watch_sessions_label').html(`<h5>Book a session for ${film['name']} </h5>`);

    const list = $('#watch_session_list');

    list.empty();

    // renders cards of sessions
    for (let i = 0; i < sessions.length; i++) {
        if (sessions[i].datetime >= Date.now()) {
            list.append(
                `<div class="card-header" id="heading${i}">` +
                `<h5 class="mb-0"> ` +
                `<button class="btn " data-toggle="collapse" data-target="#collapse${i}" aria-expanded="true" aria-controls="collapse${i}">` +
                `${timeStampToDate(sessions[i]['datetime'])} - ${formatPriceToShow(sessions[i]['seat_price'])} CELO per seat` +
                `</button>` +
                `</h5>` +
                `</div>` +

                `<div id="collapse${i}" class="collapse" aria-labelledby="heading${i}" data-parent="#accordion">` +
                `<div class="card-body" id="seats-${i}">` +
                `</div>` +
                `</div>`
            );

            // renders seats of session
            for (let j = 1; j <= sessions[i]['seats_count']; j++) {
                $('#seats-' + i).append(
                    `<button class="mx-1 my-1 btn btn-sm select_seat" data-film=${film_id} data-session=${i}>` +
                    `${leadingZero(j)}` +
                    `</button>`
                );

                checkIsSeatAvailable(film_id, i, leadingZero(j));

            }
        }
    }

    // user clicks on seat event
    $('button.select_seat').click(function () {
        // if seat was not selected before select it
        if ($(this).hasClass('btn-outline-dark')) {
            $(this).toggleClass('btn-outline-dark btn-primary');

            writeBookOrder($(this).attr('data-film'), $(this).attr('data-session'), $(this).text(), kit.defaultAccount);
            // if seat was already selected, unselect it
        } else {
            $(this).toggleClass('btn-primary btn-outline-dark');

            removeBookOrder($(this).attr('data-film'), $(this).attr('data-session'), $(this).text(), kit.defaultAccount);
        }
    });

    if (list.children().length === 0)
        list.append("<h4 class='mx-auto my-4'>There is no sessions at the moment</h4>");

    modal.open('#watchSessions');
}

// total price of all seats user wants to purchase
const purchases_sum = () =>
    current_orders.reduce(
        (accumulator, currentValue) => accumulator + parseInt(currentValue['seat_price']), 0
    );

// sets labels in the purchase modal window
const setPurchaseLabel = () => {

    if (!current_orders.length)
        return false;

    $("span#purchase_seats_count").html(pluralize(current_orders.length, 'seat'));

    $("span#purchase_seats_price").html(formatPriceToShow(purchases_sum()));

    return true;
}

$('button#proceed_purchase').click(async () => {

    renderLoading();

    let purchases = [];

    const timestamp_ = Date.now();

    // length of orders before checking
    const orders_l = current_orders.length;
    
    // update tickets of all users again to get fresh data
    retrieve_current_tickets();

    // recreate an object of purchases
    current_orders.forEach((element) => {

        // before purchase check if a seat is available and a session is not expired
        const available = !compareWithObjectArray(current_tickets, {
            film_id: element.film_id,
            session_id: element.session_id,
            seat: element.seat
        });

        const not_expired = parseInt(allFilms[element.film_id].sessions[element.session_id].datetime) > timestamp_;

        if(available && not_expired){
            purchases.push({
                ticket_id: 0,
                film_id: parseInt(element.film_id),
                session_id: parseInt(element.session_id),
                seat: parseInt(element.seat),
                seat_price: element.seat_price,
                session_datetime: element.datetime,
                purchase_datetime: timestamp_
            });
        // cannot purchase a ticket, remove it from cart
        }else{
            removeBookOrder(element.film_id, element.session_id, element.seat, element.user);
        }

    });

    if(orders_l > purchases.length) {
        notification("Some of tickets are not available or expired");

        renderFilmsContainer();

        modal.close();

        renderLoading(false);

        return;
    }

    notification("Wait till transaction is completed..");

    try {
        await contract.methods.purchaseBooking(kit.defaultAccount, purchases).send({ from: kit.defaultAccount, value: purchases_sum() }).then(async function (receipt) {
            current_orders = [];

            notification_success("Success, watch your profile to check tickets.");

            calculatePurchases();

            renderFilmsContainer();

            modal.close();

            ordersAlert();

            renderLoading(false);

        });
    } catch (err) {
        notification(err);

        renderLoading(false);
    }

});

$('button#purchase_sessions').click(() => {
    calculatePurchases();
});

const calculatePurchases = () => {

    if (setPurchaseLabel()) {

        let purchased_films = [];

        /*
            We need to recreate an array.
            So in the result of a loop array will look like this example:
            0 - film id
                0 - session id
                    3 - seat number
                    5 - seat number
                12 - session id
                    ...
            5 - film id
                ...
    
            Array will be with specific keys of id's and that keys will not be sorted,
            so we can't loop over created array with for loop.
        */

        for (let i = 0; i < current_orders.length; i++) {
            const film_id = current_orders[i]['film_id'];
            const session_id = current_orders[i]['session_id'];

            if (purchased_films[film_id]) {
                if (!purchased_films[film_id][session_id])
                    purchased_films[film_id][session_id] = [];

                purchased_films[film_id][session_id].push(current_orders[i]);
            } else {
                purchased_films[film_id] = [];
                purchased_films[film_id][session_id] = [current_orders[i]];
            }
        }

        renderPurchaseTickets(purchased_films);

        modal.open('#purchaseSessions');
    } else {
        modal.close();
    }
};


const renderPurchaseTickets = async (value) => {

    const list = $('#accordion_purchase');

    list.empty();

    // Loop over films
    value.forEach(function (element, film_id) {

        list.append(

            `<div class="card">` +
            `<div class="card-header" id="heading${film_id}" data-toggle="collapse" data-target="#collapse${film_id}p" aria-expanded="true" aria-controls="collapse${film_id}p">` +
            `<h5 class="mb-0">` +
            `${allFilms[film_id]['name']}` +
            `</h5>` +
            `</div>` +

            `<div id="collapse${film_id}p" class="collapse" aria-labelledby="heading${film_id}" data-parent="#accordion_purchase">` +
            `<div class="card-body" id="collapse_sessions${film_id}"> </div>` +
            `</div>` +
            `</div>`
        );

        const sessions_container = $(`div#collapse_sessions${film_id}`)

        // Loop over sessions
        element.forEach((session, ses_id) => {
            sessions_container.append(
                `${timeStampToDate(allFilms[film_id]['sessions'][ses_id])} - ${pluralize(session.length, 'seat')}` +
                `<div id="purchased_seats${film_id}${ses_id}"></div>`
            );

            const seats_container = $(`div#purchased_seats${film_id}${ses_id}`);

            session.forEach((seat) => {
                seats_container.append(
                    `<button class="btn mr-2 my-1 remove_purchase" data-film="${film_id}" data-session="${ses_id}" data-seat="${seat['seat']}" role="alert">` +
                    `${seat['seat']} &#10005;` +
                    `</button>`
                );
            });

        });

    });

    // Function to remove purchased ticket
    $('.remove_purchase').click(function () {

        removeBookOrder($(this).attr('data-film'), $(this).attr('data-session'), $(this).attr('data-seat'), kit.defaultAccount);

        calculatePurchases();
    });

    // Open a first element to show to user how accordion works
    $($('#accordion_purchase .collapse')[0]).addClass('show');

}

const writeBookOrder = (film_id, session_id, seat, user) => {
    const session = allFilms[film_id]['sessions'][session_id];

    current_orders.push(new BookOrder(film_id, session_id, session['datetime'], seat, user, session['seat_price']));

    toastr.remove();
    notification_success(`Success, you have selected seat ${seat}, close a window to purchase.`);

    ordersAlert();
}

const removeBookOrder = (film_id, session_id, seat, user) => {
    const session = allFilms[film_id]['sessions'][session_id];

    // To delete an order, we create temp object to compare with orders array
    let temp_order = new BookOrder(film_id, session_id, session['datetime'], seat, user, session['seat_price']);

    current_orders = current_orders.filter(function (item) {
        return JSON.stringify(item) !== JSON.stringify(temp_order)
    })

    toastr.remove();

    notification_success(`Success, you have removed seat ${seat}`);

    ordersAlert();
}

const ordersAlert = () => {
    const count = current_orders.length;

    if (count) {
        $('#purchase_alert').removeClass('d-none').addClass('d-block');
    } else {
        $('#purchase_alert').removeClass('d-block').addClass('d-none');
    }

    $('#purchase_alert_count').html(pluralize(count, 'seat'))
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

        if (role !== "client")
            $('.menu').append('<nav class="my-2 my-md-0 mr-md-3"><a class="p-2 text-dark" href="/admin.html" id="open_admin_panel">Admin panel</a></nav>');

        $("body").fadeIn(0);
        renderFilmsContainer();
    }

});