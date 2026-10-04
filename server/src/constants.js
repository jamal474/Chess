// Protocol constants shared across the whole node server.
// Anything that appears in a socket.io event name, C++ request/response
// body, or an enum status string lives here — so wire compatibility with
// the client and the C++ engine can be reviewed in one place.

const PLAYER = Object.freeze({
  PLAYER1: "pl1",
  PLAYER2: "pl2",
});

// Names of C++ engine requests + response `res_id` values.
const CPP_REQ = Object.freeze({
  CREATE_ROOM:     "create_room",
  DELETE_ROOM:     "delete_room",
  TURN_STATE:      "turn_state",
  VALID_MOVES:     "valid_moves",
  UPDATE_POSITION: "update_position",
  CHECK_OR_MATE:   "check_or_mate",
  UNDO_MOVE:       "undo_move",
  REDO_MOVE:       "redo_move",
  RESIGN:          "resign",
  RESET:           "reset",
  PAWN_PROMOTION:  "pawn_promotion",
});

// C++ engine response `status` field.
const STATUS = Object.freeze({
  SUCCESSFUL: "SUCCESSFUL",
});

// C++ engine `check_or_mate_status` field.
const MATE_STATUS = Object.freeze({
  CHECK_MATE: "CHECK_MATE",
  CHECK:      "CHECK",
  STALE_MATE: "STALE_MATE",
  NIL:        "NIL",
});

// Every socket.io event name the client or server touches. The values must
// stay identical to whatever the browser side emits/listens to.
const SOCKET_EVENT = Object.freeze({
  // client → server
  ROOM_EXISTS_CHECK:               "roomExistsCheck",
  CREATE_ROOM:                     "createRoom",
  JOIN_ROOM:                       "joinRoom",
  CHAT_TEXT:                       "chatText",
  PIECE_FOCUS:                     "pieceFocus",
  PIECE_MOVE:                      "pieceMove",
  CHECK_OR_MATE_STATUS:            "checkOrMateStatus",
  UNDO:                            "undo",
  REDO:                            "redo",
  RESIGN:                          "resign",
  RESET:                           "reset",
  PAWN_PROMOTION:                  "pawnPromotion",
  UPDATE_ALREADY_PROMOTED_PAWN_OF: "updateAlreadyPromotedPawnOf",
  GET_ALREADY_PROMOTED_PAWN_OF:    "getAlreadyPromotedPawnOf",
  // (playerId, { name, country: { code, name } | null })
  SET_PROFILE:                     "setProfile",
  // Undo is a request the opponent has to approve.
  UNDO_REQUEST:                    "undoRequest",  // (playerId)
  UNDO_RESPOND:                    "undoRespond",  // (playerId, accept: boolean)
  UNDO_CANCEL:                     "undoCancel",   // (playerId)
  // Leaving the game page. A closed tab or lost connection counts the same.
  LEAVE_ROOM:                      "leaveRoom",
  // Matchmaking. The browser's id travels in the handshake (auth.clientId).
  LOBBY_SUBSCRIBE:                 "lobby:subscribe",   // (ack(stats)) — live counts while on the menu
  LOBBY_UNSUBSCRIBE:               "lobby:unsubscribe",
  QUEUE_JOIN:                      "queue:join",        // (profile, ack({ ok, status | error }))
  QUEUE_LEAVE:                     "queue:leave",       // (ack?)

  // server → client
  START_GAME:            "startGame",
  SERVER_CHAT_TEXT:      "serverChatText",
  SERVER_PIECE_FOCUS:    "serverPieceFocus",
  SERVER_PIECE_MOVE:     "serverPieceMove",
  CHANGE_TURN:           "changeTurn",
  // (playerId, { [pieceId]: [{x,y}, …] }): every legal move for the side to
  // move, sent at the start of each turn so the browser can highlight
  // without asking.
  LEGAL_MOVES:           "legalMoves",
  CHECK:                 "check",
  CHECK_MATE:            "checkMate",
  STALE_MATE:            "staleMate",
  SERVER_UNDO:           "serverUndo",
  SERVER_REDO:           "serverRedo",
  SERVER_RESIGN:         "serverResign",
  SERVER_RESET:          "serverReset",
  SERVER_PAWN_PROMOTION: "serverPawnPromotion",
  // ({ pl1: Profile | null, pl2: Profile | null })
  SERVER_PROFILES:       "serverProfiles",
  // (UndoState, event?) — see RoomRegistry.undoState(); event is
  // { type: "requested" | "accepted" | "declined" | "cancelled" | "expired" | "failed", by }.
  SERVER_UNDO_STATE:     "serverUndoState",
  // ({ seats: {pl1, pl2}: boolean, paused, left: PlayerId | null, elapsed })
  // Sent whenever a seat empties or fills. A started game pauses while a seat
  // is empty and resumes when someone takes it.
  SERVER_PRESENCE:       "serverPresence",
  // ({ pieces, moveRows, recentMove, turn, elapsed }) — the whole position,
  // for a player taking over a seat in a game already under way.
  SERVER_SNAPSHOT:       "serverSnapshot",
  // ({ online, searching, playing }) to sockets subscribed to the lobby,
  // at most every LOBBY_STATS_INTERVAL_MS and only when something changed.
  LOBBY_STATS:           "lobby:stats",
  // ({ roomId, playerId, ticket, opponent: Profile }) — go to the game page
  // and joinRoom(roomId, ticket) within MATCH_CLAIM_TIMEOUT_MS.
  MATCH_FOUND:           "match:found",
  // ({ reason, requeued }) — the other player never showed up. requeued: you
  // are back at the front of the queue.
  MATCH_CANCELLED:       "match:cancelled",
});

// Chat text is clipped to this length before broadcast — defence-in-depth
// against a rogue client hammering the room.
const MAX_CHAT_LENGTH = 500;

// Player names are clipped to this many characters.
const MAX_NAME_LENGTH = 16;

// Each player may take back at most this many moves per game, and only with
// the opponent's approval. An unanswered request is declined after the timeout.
const MAX_UNDOS = 3;
const UNDO_REQUEST_TIMEOUT_MS = 15000;

// Matchmaking: both players must join their reserved seats within this time
// after a match is made, or it's called off.
const MATCH_CLAIM_TIMEOUT_MS = 10000;
// How often the lobby counts may be pushed (only when they changed).
const LOBBY_STATS_INTERVAL_MS = 1500;
// socket.io room of sockets that want the lobby counts.
const LOBBY_ROOM = "lobby";

module.exports = {
  PLAYER, CPP_REQ, STATUS, MATE_STATUS, SOCKET_EVENT,
  MAX_CHAT_LENGTH, MAX_NAME_LENGTH, MAX_UNDOS, UNDO_REQUEST_TIMEOUT_MS,
  MATCH_CLAIM_TIMEOUT_MS, LOBBY_STATS_INTERVAL_MS, LOBBY_ROOM,
};
