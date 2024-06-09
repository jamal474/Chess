export const personalTemplate = `
<!-- Popup : Personal Stats -->
  <div id="popup-personal" class="modal">
    <div class="content2">
      <span class="close" style="font-size: 50px;">&times;</span>
      <div class=userName>
        <div class="button-username" role="button">
          <span class="material-symbols-outlined" style="font-size:35px;color:rgb(0, 0, 0);">
            account_circle
          </span>
          <div class="userNameData"></div>
          <div class="userRatingData"></div>
        </div>
      </div>
      <div class="rowStatGraph">
        <canvas id="graphColumn"></canvas>
        <div class="statColumn">
          <div class="winDraw">
            <div class=win>
              <div class="button-win" role="button">
                <span class="material-symbols-outlined" style="font-size:35px;color:rgb(0, 0, 0);">
                  military_tech
                </span>
                <div class="winText">Wins:</div>
                <div class="winData">
                </div>
              </div>
            </div>
            <div class=draw>
              <div class="button-draw" role="button">
                <span class="material-symbols-outlined" style="font-size:35px;color:rgb(0, 0, 0);">
                  balance
                </span>
                <div class="drawText">Draws:</div>
                <div class="drawData"></div>
              </div>
            </div>
          </div>
          <div class="lossRes">
            <div class=loss>
              <div class="button-loss" role="button">
                <span class="material-symbols-outlined" style="font-size:35px;color:rgb(0, 0, 0);">
                  thumb_down
                </span>
                <div class="lossText">Losses:</div>
                <div class="lossData"></div>
              </div>
            </div>
            <div class=resign>
              <div class="button-resign" role="button">
                <span class="material-symbols-outlined" style="font-size:35px;color:rgb(0, 0, 0);">
                  handshake
                </span>
                <div class="resignText">Resigns:</div>
                <div class="resignData"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="stat">
        <table class="tableStat">
          <thead class="headStat">
            <tr class="trStat">
              <th class="headerStat">Match No.</th>
              <th class="headerStat">Username</th>
              <th class="headerStat">Game Result</th>
              <th class="headerStat">Rating Change</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    </div>
  </div>
`;