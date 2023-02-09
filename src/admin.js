import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import cinemaAbi from "../contract/cinema.abi.json";
import { CinemaContractAddress, ERC20_DECIMALS, disableInput, formatPriceToShow, leadingZero, timeStampToDate } from './helpers.js';

let contract;
var kit;
timeStampToDate
// array for all films
let allFilms = [];

// modal initialization
const modal = new HystModal({ linkAttributeName: "data-hystmodal" });

// options for Toastr notifications
toastr.options = { "positionClass": "toast-top-center" }

// initialization of a spinner loading
var spinner = new Spinner().spin();

// renders a loading spinner if param is true, if false removes spinner
const renderLoading = (value = true) => {
    if (value) {
        spinner.spin(document.getElementById('spinnerContainer'));

        $($('.container')[0]).css({ opacity: "0.5", pointerEvents: "none" });
    } else {
        spinner.stop();
        $($('.container')[0]).css({ opacity: "1", pointerEvents: "all" });
    }
}

// dateTimePicker options
$("#add_session_date").flatpickr({
    disable: [
        function (date) {
            // cinema will not work on sundays, so we disable it
            return (date.getDay() === 0);
        }
    ],
    minDate: "today",
    // cinema will work from 8 am to 10 pm
    minTime: "08:00",
    maxTime: "22:00",
    enableTime: true,
    dateFormat: "Y-m-d H:i"
});

/* notification functions */
function notification(_text) { toastr.warning(_text); }

function notification_success(_text) { toastr.success(_text) }

function notificationOff() { toastr.clear(); }


// retrieves all films
const updateAllFilms = async () =>
    allFilms = await contract.methods.getAllFilms().call();

$('a#films').click(function () {
    renderAdminFilmsList();
});

$('a[class="nav-link"][href="#history"]').click(function (e) {
    renderTicketsList();
});

$('a[class="nav-link"][href="#managers"]').click(function (e) {
    renderManagersList();
})

// add new film click event
$('#add_new_film_button').click(function (e) {

    $('#modal_update_film_label').html("<h2>Add new film</h2>");
    $('#change_film_button').html("Add");

    // we use the same modal for updating and creating, so we need to clear data attribute and inputs
    $('button#change_film_button').removeAttr('update-id')
    clearFilmActionInputs();

    modal.open("#modalFilmAction");
});

// add new film click event
$('#add_new_session_button').click(function (e) {

    $('#modal_update_session_label').html("<h2>Add new session</h2>");
    $('#change_session_button').html("Add");

    // we use the same modal for updating and creating, so we need to clear data attribute and inputs
    $('button#change_session_button').removeAttr('update-id');
    $('button#change_session_button').removeAttr('update-film');
    clearSessionActionInputs();

    modal.open("#modalSessionAction");
});


// functions to clear film/session creating/updating inputs
const clearFilmActionInputs = function () {
    $('#add_film_name').val("");
    $('#add_film_poster').val("");
}

const clearSessionActionInputs = function () {
    $('#add_session_date').val("");
    $('#add_session_seats').val("");
    $('#add_session_seat_price').val("");
}

$('button#submit_mananger_address').click(async function (e) {
    e.preventDefault();

    const address_input = $('input#input_mananger_address');

    const address = address_input.val();

    if (address.length) {
        if (await contract.methods.isNewManager(address).call()) {
            try {
                renderLoading();
                await contract.methods.addManager(address).send({ from: kit.defaultAccount }).then(() => {

                    $(address_input).val('');
                    renderManagersList();
                });

            } catch (err) {
                notification(err);
                notification("Entered value doesn't seem to be an address");
            } finally {
                renderLoading(false);
            }
        } else {
            notification("Manager is already added");
        }
    } else {
        notification("Manager address required");
    }
});


const renderManagersList = async function () {
    renderLoading();

    const container = $('div#managers_list');

    container.empty();

    const managers = await contract.methods.allManagers().call();

    for (let key in managers) {
        if (!Web3.utils.toBN(managers[key]).isZero()) {
            container.append(
                `<div class="alert alert-secondary text-left" role="alert">` +
                `<span class="user_address">${managers[key]}</span>` +

                `<span class="actions float-right">` +
                `<button class="btn btn-sm manager_action remove" title="Remove manager"><i class="far fa-trash-alt"></i></button>` +
                `</span>` +
                `</div>`
            );
        }
    }

    $('.manager_action.remove').click(async function () {
        const address = ($(this).parents('.alert').find('.user_address').html()).toString().trim();

        renderLoading();

        await contract.methods.removeManager(address).send({ from: kit.defaultAccount }).then(async function (receipt) {
            renderManagersList();
        });

        renderLoading(false);
    });

    renderLoading(false);
}

const renderTicketsList = async function () {

    renderLoading();

    const users = await contract.methods.allClients().call();

    const accordion = $('#tickets_accordion');

    accordion.empty();

    for (var key in users) {

        const values = (await contract.methods.allBookings(users[key]).call());

        if (values) {

            $(accordion).append(`
                <div class="card">` +
                `<div class="card-header p-1" id="heading${key}u" data-toggle="collapse" data-target="#collapse${key}u" aria-expanded="true" aria-controls="collapse${key}u">` +
                `<h5 class="mb-0 text-left">` +
                `<button class="user_address btn btn-link">` +
                `${users[key]}` +
                `</button>` +
                `</h5>` +
                `</div>` +

                `<div id="collapse${key}u" class="collapse" aria-labelledby="heading${key}u" data-parent="#tickets_accordion">` +
                `<div class="card-body p-1">` +

                `</div>` +
                `</div>` +
                `</div>
            `);

            const tickets_container = $($(`div#collapse${key}u .card-body`)[0]);

            values.forEach((element, index) => {
                tickets_container.append(
                    `<div class="alert alert-secondary text-left" data-index="${index}" data-id="${element.ticket_id}" role="alert">` +
                    `Ticket #${element.ticket_id}` +

                    `<span class="actions float-right">` +
                    `<button class="btn btn-sm ticket_action info" data-index="${index}" title="View info"><i class="fas fa-external-link-alt"></i></button>` +
                    `</span>` +
                    `</div>`
                );

                const ticket = $(`div.alert[data-id="${element.ticket_id}"] .actions`);

                if (element.isUsed)
                    ticket.append(`<button class="btn btn-sm ticket_action used" title="Set as unused"><i class="fas fa-times"></i></button>`)
                else
                    ticket.append(`<button class="btn btn-sm ticket_action unused" title="Set as used"><i class="fas fa-check"></i></button>`)

            });

        }
    };

    const getAddress = (element) => ($(element).parents('.card').find('.user_address').html()).toString();
    const getIndex = (element) => $(element).parents('.alert').attr('data-index');

    $('.ticket_action').click(async function () {

        if ($(this).hasClass('info')) {

            renderLoading();

            const ticket = await contract.methods.getTicket(getAddress(this), getIndex(this)).call();

            const film = allFilms[ticket.film_id];

            $('#ticket_info_label').html(`<h3>Ticket #${ticket.ticket_id}</h3>`);

            $('#ticket_info_client').html(getAddress(this));

            $('#ticket_info_film_id').html(`#${ticket.film_id}`);
            $('#ticket_info_film_name').html(film.name);

            $('#ticket_info_session_id').html(`#${ticket.session_id}`);
            $('#ticket_info_session_date').html(timeStampToDate(film.sessions[ticket.session_id].datetime));

            $('#ticket_info_seat').html(leadingZero(ticket.seat));
            $('#ticket_info_status').html(ticket.isUsed ? 'Used' : 'Not used');

            modal.open('#ticket_info');

            renderLoading(false);
        } else {
            const value = $(this).hasClass('unused');

            renderLoading();

            await contract.methods.setTicketStatus(getAddress(this), getIndex(this), value).send({ from: kit.defaultAccount }).then(async () => {
                await renderTicketsList();

                notification_success("Changes are successfully saved");
            });

            renderLoading(false);
        }
    });

    renderLoading(false);
}

// function renders a film list to table on admin modal window
const renderAdminFilmsList = async function () {
    renderLoading();

    await updateAllFilms();

    // get tbody element from table
    const l = $("#admin_filmslist_table > tbody")

    // clear all elements
    l.empty();

    if (allFilms.length) {

        // appends table rows with films in a loop
        for (let i = 0; i < allFilms.length; i++) {
            if (allFilms[i]['name'].length && allFilms[i]['poster_img'].length) {
                l.append(
                    '<tr>' +
                    '<th scope="row">' + i + '</th>' +
                    '<td>' + allFilms[i]['name'] + '</td>' +
                    '<td> <a href="' + allFilms[i]['poster_img'] + '" target="_blank">Watch</a></td>' +
                    '<td>' +
                    (allFilms[i]['sessions']).length + " " +
                    '<button type="button" data-id="' + i + '" class="sessions_info btn btn-sm btn-default"> ' +
                    '<span class="fa fa-info-circle"> </span>' +
                    '</button>' +
                    '</td>' +
                    '<td name="bstable-actions">' +
                    '<div class="btn-group pull-right">' +

                    '<button type="button" data-id="' + i + '" class="f_edit btn btn-sm btn-default">' +
                    '<span class="fa fa-edit"> </span>' +
                    '</button>' +
                    '<button type="button" data-id="' + i + '" class="f_del btn btn-sm btn-default">' +
                    '<span class="fa fa-trash"> </span>' +
                    '</button>' +
                    '</div>' +
                    '</td>' +
                    '</tr>'
                );
            }
        }

        // sessions info on admin films table click event
        $('.sessions_info').click(async function (e) {

            await updateAllFilms();

            const film_id = $(this).attr('data-id'),
                current_film = allFilms[film_id],
                sessions = current_film['sessions'],
                l = $("#admin_sessions_table > tbody");

            $('#modal_sessions_label').html(`<h3>Sessions for ${current_film['name']} </h3>`);

            l.empty();

            if (sessions.length) {

                // add sessions table rows in a loop
                for (let i = 0; i < sessions.length; i++) {
                    if (sessions[i]['datetime'].length && sessions[i]['seats_count'].length) {
                        l.append(
                            `<tr>` +
                            `<th scope="row">${i}</th>` +
                            `<td>${timeStampToDate(sessions[i]['datetime'])}</td>` +
                            `<td>${sessions[i]['seats_count']}</td>` +
                            `<td>${formatPriceToShow(sessions[i]['seat_price'])} CELO</td>` +
                            `<td name="bstable-actions">` +
                            `<div class="btn-group pull-right">` +

                            `<button type="button" data-id="${i}" data-film="${film_id}" class="s_edit btn btn-sm btn-default">` +
                            `<span class="fa fa-edit"> </span>` +
                            `</button>` +
                            `<button type="button" data-id="${i}" class="s_del btn btn-sm btn-default">` +
                            `<span class="fa fa-trash"> </span>` +
                            `</button>` +
                            `</div>` +
                            `</td>` +
                            `</tr>`
                        );
                    }
                }
            }

            // session edit click event
            $('.s_edit').click(function (e) {
                e.preventDefault();

                const film_id = $(this).attr('data-film');
                const session_id = $(this).attr('data-id');
                const session = allFilms[film_id].sessions[session_id];

                $('#modal_update_session_label').html("<h2>Update session</h2>");
                $('#change_session_button').html("Update");

                $('button#change_session_button').attr('update-id', session_id);

                // we set values for inputs from existing session
                $('input#add_session_date').val(timeStampToDate(session.datetime));
                $('input#add_session_seats').val(session.seats_count);
                $('input#add_session_seat_price').val(formatPriceToShow(session.seat_price));

                modal.open("#modalSessionAction");

            })

            $("#change_session_button").attr('film-id', film_id);

            modal.open("#sessionPanel");
        });

        // film edit event
        $(".f_edit").click(function (e) {
            const film_id = $(this).attr('data-id'),
                current_film = allFilms[film_id];

            $('#modal_update_film_label').html("<h2>Update film</h2>");
            $('#change_film_button').html("Update");

            $('#add_film_name').val(current_film['name']);
            $('#add_film_poster').val(current_film['poster_img']);

            $('button#change_film_button').attr('update-id', film_id)

            modal.open("#modalFilmAction");
        });

        // delete film event
        $(".f_del").click(async function (e) {

            const film_id = $(this).attr('data-id');

            notification("Deleting a film...")
            await contract.methods
                .removeFilm(film_id)
                .send({ from: kit.defaultAccount }).then(async function () {

                    notificationOff();

                    notification_success("Successfully deleted a film");

                    updateAdminFilmsList();

                    renderAdminFilmsList();
                });
        });

    }

    renderLoading(false);
}

// button click event on film create/update modal window
$('#change_film_button').click(async function (e) {
    e.preventDefault();

    renderLoading();

    let id = $(this).attr('update-id');

    let film_name_input = $('#add_film_name'),
        name = film_name_input.val();

    let film_poster_input = $('#add_film_poster'),
        poster_img = film_poster_input.val();

    if (/(jpg|png|jpeg)$/i.test(poster_img)) {

        notification((id ? "Updating a film" : "Adding a new film") + ", please wait");

        // disable input until changes will be saved
        disableInput(film_name_input, true)
        disableInput(film_poster_input, true);
        disableInput($(this), true);

        // if id passed as an attribute of a button then edit an existing film
        // if no, add new film to list
        try {
            if (id) {
                // update existing film
                await contract.methods
                    .updateFilm(id, name, poster_img)
                    .send({ from: kit.defaultAccount });
            } else {
                // add new film
                await contract.methods
                    .addFilm(name, poster_img)
                    .send({ from: kit.defaultAccount });
            }

            // clear modal window inputs
            clearFilmActionInputs();

            // show a notification with text depending on what we did, created or updated a film
            notification_success(id ? "Successfully updated a film." : "Successfully added a new film.");

            modal.close();

        } catch (err) {
            notification(err);
        }

        renderLoading(false);

        // Changes saved, enable input on modal window
        disableInput(film_name_input, false)
        disableInput(film_poster_input, false);
        disableInput($(this), false);

        // Update Films list on the page
        renderAdminFilmsList();

    } else {
        toastr.error("Entered link does not seem to be an image")
    }
});

// button click event on session create/update modal window
$('#change_session_button').click(async function (e) {
    e.preventDefault();

    let button = $(this);

    let id = $(this).attr('update-id'),
        film_id = $(this).attr('film-id');

    let session_date_input = $('#add_session_date'),
        date_unix = Date.parse(session_date_input.val());

    let session_seats_input = $('#add_session_seats'),
        seats = session_seats_input.val();

    let session_price_input = $('#add_session_seat_price'),
        price = session_price_input.val();

    notification("Adding a session, please wait..");

    disableInput(session_date_input, true);
    disableInput($(this), true);
    disableInput(session_seats_input, true);
    disableInput(session_price_input, true);

    renderLoading();

    const session_obj = {
        datetime: date_unix,
        seats_count: seats,
        seat_price: (price * Math.pow(10, ERC20_DECIMALS)).toString()
    };

    try {
        if (id) {
            // update existing session
            await contract.methods
                .updateFilmSession(id, film_id, session_obj)
                .send({ from: kit.defaultAccount });
        } else {
            // add new session
            await contract.methods
                .addFilmSession(film_id, session_obj)
                .send({ from: kit.defaultAccount });
        }

        renderAdminFilmsList();

        clearSessionActionInputs();

        notificationOff();
        notification_success(id ? "Successfully updated a session." : "Successfully added a new session.");

        $('button.sessions_info[data-id=' + film_id + ']').click();

    } catch (err) {
        notification(err);
    }

    disableInput(session_date_input, false);
    disableInput(button, false);
    disableInput(session_seats_input, false);
    disableInput(session_price_input, false);

    renderLoading(false);
});

const connectCeloWallet = async function () {
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

        if (role === "client") {
            window.location.href = "/";
        } else if (role === "manager") {
            $('a[class="nav-link"][href="#managers"]').parents('.nav-item').remove();
            $('.nav-tabs > .nav-item').removeClass('col-4').addClass('col-6');

            $('.admin-header .display-6').html('Manager panel');
        }

        $('.menu').append('<nav class="my-2 my-md-0 mr-md-3"><a class="p-2 text-dark" href="/admin.html" id="open_admin_panel">Admin panel</a></nav>');

        $("body").fadeIn(0);

        renderAdminFilmsList();
    }

});

