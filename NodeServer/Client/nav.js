let pageNumber = 1;
const navThemeOption = () => {
    const ThemeModal = document.getElementById("popup-themes");
    ThemeModal.style.display = "block";
}

const globalLeaderOption = () => {
    const leaderModal = document.getElementById("popup-global");
    leaderModal.style.display = "block";
    pageNumber = 1;
    fetchLeaderData(pageNumber);
}

const personalStatOption = () => {
    const personalModal = document.getElementById("popup-personal");
    personalModal.style.display = "block";
}

const restartOption = () => {
    alert("Game Reset Successful")
}

const helperOption = () => {

}

const fetchLeaderData = async () => {
    if (pageNumber == 1) {
        const previousButton = document.querySelector('#previousPage');
        previousButton.style.pointerEvents = "none";
        previousButton.classList.add("disabled-button");
    }
    else {
        const previousButton = document.querySelector('#previousPage');
        previousButton.style.pointerEvents = "all";
        previousButton.classList.remove("disabled-button");
    }
    console.log("called with" + pageNumber)
    await axiosInstance.get(`http://localhost:3000/api/leader-stats?page=${pageNumber}&quantity=5&orderField=rating`)
        .then((response) => {

            if (response.data.empty == "true") {
                pageNumber = pageNumber - 1;
                const nextButton = document.querySelector('#nextPage');
                nextButton.style.pointerEvents = "none";
                nextButton.classList.add("disabled-button");
            }
            else {
                const nextButton = document.querySelector('#nextPage');
                nextButton.style.pointerEvents = "all";
                nextButton.classList.remove("disabled-button");

                const leaderData = response.data.leaderList;
                var tableBody = document.querySelector('.tableGlobal tbody');
                tableBody.innerHTML = '';

                console.log(leaderData);

                leaderData.forEach(function (data, index) {

                    var newRow = document.createElement('tr');
                    var rankCell = document.createElement('td');
                    rankCell.textContent = "#" + ((pageNumber - 1) * 5 + index + 1).toString();
                    rankCell.classList.add("globalData");
                    newRow.appendChild(rankCell);

                    var usernameCell = document.createElement('td');
                    usernameCell.textContent = data.userName;
                    usernameCell.classList.add("globalData");
                    newRow.appendChild(usernameCell);

                    var eloRatingCell = document.createElement('td');
                    eloRatingCell.textContent = data.rating;
                    eloRatingCell.classList.add("globalData");
                    newRow.appendChild(eloRatingCell);

                    var matchesPlayedCell = document.createElement('td');
                    matchesPlayedCell.textContent = data.games;
                    matchesPlayedCell.classList.add("globalData");
                    newRow.appendChild(matchesPlayedCell);

                    var totalWinsCell = document.createElement('td');
                    totalWinsCell.textContent = data.win;
                    totalWinsCell.classList.add("globalData");
                    newRow.appendChild(totalWinsCell);

                    tableBody.appendChild(newRow);
                });
                const pageNumberElement = document.querySelector('#pageNumber');
                pageNumberElement.textContent = pageNumber.toString();
            }
        })

}

const incrementPage = () => {
    pageNumber = pageNumber + 1;
    fetchLeaderData();
}

const decrementPage = () => {
    pageNumber = pageNumber - 1;
    fetchLeaderData();
}