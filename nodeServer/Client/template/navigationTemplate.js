export const navigationTemplate = `
<input class="menu-icon" type="checkbox" id="menu-icon" name="menu-icon" />
<label for="menu-icon" class="navLabel"></label>
<nav class="nav">
  <ol class="pt-5" class="ulStyle">
    <li class="listyle">
      <div onclick="navThemeOption()">Game Theme</div>
    </li>
    <li class="listyle">
      <div onclick="globalLeaderOption()">Global leaderboard</div>
    </li>
    <li class="listyle">
      <div onclick="personalStatOption()">Personal Statistics</div>
    </li>
    <li class="listyle">
      <div id="resetBtn" onclick="restartOption()">Restart Game</div>
    </li>
    <li class="listyle">
      <div onclick="helperOption()">Help Assistant</div>
    </li>
    <li class="listyle">
      <div onclick="signOutHandler()">Logout</div>
    </li>
  </ol>
</nav>`;