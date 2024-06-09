export const leaderTemplate = `
<!-- Popup : Leader board -->
  <div id="popup-global" class="modal">
    <div class="content2">
      <span class="close" style="font-size: 50px;">&times;</span>
      <p class="leadCon">
        <span class="material-symbols-outlined lead-icon">
          social_leaderboard
        </span>
        LEADERBOARD
        <span class="material-symbols-outlined lead-icon">
          social_leaderboard
        </span>
      </p>
      <div class="leaderBoard">
        <table class="tableGlobal">
          <thead class="headGlob">
            <tr class="trGlobal">
              <th class="headerGlobal">Rank</th>
              <th class="headerGlobal">Username</th>
              <th class="headerGlobal">Elo Rating</th>
              <th class="headerGlobal">Matches Played</th>
              <th class="headerGlobal">Total Wins</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span onclick="decrementPage()" class="material-symbols-outlined" id="previousPage">
          arrow_back_ios
        </span>
        <div id="pageNumber">1</div>
        <span onclick="incrementPage()" class="material-symbols-outlined" id="nextPage">
          arrow_forward_ios
        </span>

      </div>
    </div>
  </div>
`;