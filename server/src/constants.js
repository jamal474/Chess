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

  // server → client
  START_GAME:            "startGame",
  SERVER_CHAT_TEXT:      "serverChatText",
  SERVER_PIECE_FOCUS:    "serverPieceFocus",
  SERVER_PIECE_MOVE:     "serverPieceMove",
  CHANGE_TURN:           "changeTurn",
  CHECK:                 "check",
  CHECK_MATE:            "checkMate",
  STALE_MATE:            "staleMate",
  SERVER_UNDO:           "serverUndo",
  SERVER_REDO:           "serverRedo",
  SERVER_RESIGN:         "serverResign",
  SERVER_RESET:          "serverReset",
  SERVER_PAWN_PROMOTION: "serverPawnPromotion",
});

// Chat text is clipped to this length before broadcast — defence-in-depth
// against a rogue client hammering the room.
const MAX_CHAT_LENGTH = 500;

module.exports = { PLAYER, CPP_REQ, STATUS, MATE_STATUS, SOCKET_EVENT, MAX_CHAT_LENGTH };
