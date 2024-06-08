const ID = Object.freeze({
    PLAYER1: "pl1",
    PLAYER2: "pl2",
});

const socket = io();
socket.on("connect", () => {
    console.log("in front id:", socket.id);
});

const dropdown = document.querySelector('.drop-down');
const list = document.querySelector('.play-choice-list');
const selected = document.querySelector('.selected-choice');
const selectedImg = document.querySelector('.selected-choice-img');
dropdown.addEventListener('click', () => {
    list.classList.toggle('show');
})

const playChoiceItems = document.querySelectorAll('.play-choice-item');
playChoiceItems.forEach((playChoiceOption) => {
    playChoiceOption.addEventListener('click', (e) => {
        const text = playChoiceOption.querySelector('.text').innerHTML;
        const img = playChoiceOption.querySelector('img').getAttribute('src');
        selectedImg.src = img;
        selected.innerHTML = text;
    })
})

function generateRoomCode(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
function redirect() {
    //store the user chosen playerId
    let chosenPlayerId;
    switch (selected.innerHTML) {
        case "White":
            chosenPlayerId = ID.PLAYER1;
            break;
        case "Black":
            chosenPlayerId = ID.PLAYER2;
            break;
        default: //Random
            let randomNum = Math.floor(Math.random() * 2);
            chosenPlayerId = randomNum == 0 ? ID.PLAYER1 : ID.PLAYER2;
            break;
    }
    sessionStorage.setItem("playerID", chosenPlayerId);
    sessionStorage.setItem("isCreator", "true");
    var roomCode = generateRoomCode(5);
    sessionStorage.setItem("createRoomId", roomCode);
    window.location.href = "game";
}

function redirectWithJoin() {
    const inputElement = document.querySelector(".roomCodeInput");
    const joinRoomId = inputElement.value;

    if (joinRoomId) {

        socket.emit("roomExistsCheck", joinRoomId, (doesExist, joinerPlayerId) => {
            if (doesExist == true) {
                sessionStorage.setItem("playerID", joinerPlayerId);
                sessionStorage.setItem("joinRoomId", joinRoomId);
                sessionStorage.setItem("isCreator", "false");
                window.location.href = "game";
            }
            else {
                window.alert("Room can't be accessed");
            }
        });
    }

}