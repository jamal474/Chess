// Shared enums / helpers used by the socket layer and the C++ handler.
const ID = Object.freeze({
  PLAYER1: "pl1",
  PLAYER2: "pl2",
});

// server -> client conversion for board positions
function strPosition(positionObj) {
  return `${positionObj.x}${positionObj.y}`;
}

function objPosition(positionStr) {
  return { x: Number(positionStr[0]), y: Number(positionStr[1]) };
}

module.exports = { ID, strPosition, objPosition };
