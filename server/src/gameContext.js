// In-memory game state, keyed by roomId. One node instance per deployment.
const roomMap = {};   // socket.id -> roomId
const roomState = {}; // roomId    -> { turn, [ID.PLAYER1]: {...}, [ID.PLAYER2]: {...}, creatorId }

module.exports = { roomMap, roomState };
