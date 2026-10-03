#include "net/Conn_handler.h"

#include <chrono>
#include <istream>

#include "common/Logger.h"

namespace {

const char* const OK = "SUCCESSFUL";

const std::string kPromotions[] = {"queen", "rook", "bishop", "knight"};

bool is_player_id(const json& v) {
    return v.is_string() && (v == ID::PLAYER1 || v == ID::PLAYER2);
}

std::string opponent_of(const std::string& player_id) {
    return player_id == ID::PLAYER1 ? ID::PLAYER2 : ID::PLAYER1;
}

// Reads {"x":1..8,"y":1..8}. Returns false for anything else.
bool read_position(const json& v, std::pair<int, int>& out) {
    if (!v.is_object()) return false;
    auto x = v.find("x");
    auto y = v.find("y");
    if (x == v.end() || y == v.end() || !x->is_number_integer() || !y->is_number_integer()) return false;
    int xi = x->get<int>();
    int yi = y->get<int>();
    if (xi < 1 || xi > 8 || yi < 1 || yi > 8) return false;
    out = {xi, yi};
    return true;
}

json position_json(const std::pair<int, int>& p) {
    return {{"x", p.first}, {"y", p.second}};
}

// Base response: echoes req_id as res_id, plus room/player ids when present.
json base_response(const json& req) {
    json res = json::object();
    res["res_id"] = req.value("req_id", "unknown");
    if (req.contains("room_id")) res["room_id"] = req["room_id"];
    if (req.contains("player_id")) res["player_id"] = req["player_id"];
    return res;
}

json error_response(json res, const std::string& status, const std::string& detail) {
    res["status"] = status;
    res["error"] = detail;
    return res;
}

bool is_unpromoted_pawn(Chess_Piece* piece) {
    return piece && !piece->get_is_promoted() && piece->get_id().rfind("pawn", 0) == 0;
}

}  // namespace

//--------------------------------------------------------------------------------------

Conn_handler::Conn_handler(asio::io_context& io_context, Game* game) : socket(io_context), game(game) {}

Conn_handler::~Conn_handler() {
    std::error_code ignored;
    socket.close(ignored);
    LOG_DEBUG("Conn_handler", "relay disconnected");
}

ip::tcp::socket& Conn_handler::getSocket() { return socket; }

void Conn_handler::start() {
    // Small request/response messages: send them immediately rather than
    // letting Nagle's algorithm hold them back waiting for more data.
    std::error_code ec;
    socket.set_option(ip::tcp::no_delay(true), ec);
    socket.set_option(asio::socket_base::keep_alive(true), ec);
    read_next();
}

//--------------------------------------------------------------------------------------
// Transport: read one line at a time, answer each in order.

void Conn_handler::read_next() {
    auto self(shared_from_this());
    asio::async_read_until(socket, inbuf, '\n', [this, self](const std::error_code& err, std::size_t n) {
        if (err) {
            if (err == asio::error::not_found) {
                LOG_WARN("Conn_handler", "request line over " << max_line_bytes << " bytes; closing connection");
            } else if (err != asio::error::eof && err != asio::error::operation_aborted) {
                LOG_WARN("Conn_handler", "read error: " << err.message());
            }
            return;  // dropping `self` closes the connection
        }
        std::string line(asio::buffers_begin(inbuf.data()), asio::buffers_begin(inbuf.data()) + n - 1);
        inbuf.consume(n);
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (!line.empty()) on_line(line);
        read_next();
    });
}

void Conn_handler::on_line(const std::string& line) {
    const auto started = std::chrono::steady_clock::now();
    json req;
    json res;
    try {
        req = json::parse(line);
        res = handle(req);
    } catch (const std::exception& e) {
        res = error_response(json{{"res_id", "unknown"}}, "BAD_REQUEST", std::string("unparseable JSON: ") + e.what());
    }
    if (req.is_object() && req.contains("seq")) res["seq"] = req["seq"];

    const auto us = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - started).count();
    LOG_DEBUG("Conn_handler", res.value("res_id", "?") << " → " << res.value("status", "?") << " in " << us << "us");
    write(res.dump() + "\n");
}

void Conn_handler::write(std::string line) {
    const bool idle = outbox.empty();
    outbox.push_back(std::move(line));
    if (idle) write_next();
}

void Conn_handler::write_next() {
    auto self(shared_from_this());
    asio::async_write(socket, asio::buffer(outbox.front()), [this, self](const std::error_code& err, std::size_t) {
        if (err) {
            LOG_WARN("Conn_handler", "write error: " << err.message());
            outbox.clear();
            return;
        }
        outbox.pop_front();
        if (!outbox.empty()) write_next();
    });
}

//--------------------------------------------------------------------------------------
// Dispatch

json Conn_handler::handle(const json& req) {
    if (!req.is_object() || !req.contains("req_id") || !req["req_id"].is_string()) {
        return error_response(json{{"res_id", "unknown"}}, "BAD_REQUEST", "missing req_id");
    }
    const std::string id = req["req_id"];
    try {
        if (id == "create_room") return create_room(req);
        if (id == "delete_room") return delete_room(req);
        if (id == "valid_moves") return get_legal_moves(req);
        if (id == "update_position") return update_board(req);
        if (id == "check_or_mate") return validate_check(req);
        if (id == "turn_state") return turn_state(req);
        if (id == "pawn_promotion") return pawn_promotion(req);
        if (id == "undo_move") return undo(req);
        if (id == "redo_move") return redo(req);
        if (id == "reset") return reset_room(req);
        if (id == "resign") return resign(req);
        if (id == "ping") return json{{"res_id", "ping"}, {"status", OK}};
        return error_response(base_response(req), "UNKNOWN_REQUEST", "unknown req_id: " + id);
    } catch (const std::exception& e) {
        // nlohmann::json type errors etc. — a bad field, not a server fault.
        LOG_WARN("Conn_handler", id << " failed: " << e.what());
        return error_response(base_response(req), "BAD_REQUEST", e.what());
    }
}

// Common guards. Each returns nullptr / false and fills `res` with an error.
namespace {

Board* require_board(Game* game, const json& req, json& res) {
    if (!req.contains("room_id") || !req["room_id"].is_string()) {
        res = error_response(res, "BAD_REQUEST", "missing room_id");
        return nullptr;
    }
    Board* board = (*game)[req["room_id"].get<std::string>()];
    if (!board) res = error_response(res, "ROOM_DOES_NOT_EXIST", "no such room");
    return board;
}

bool require_player(const json& req, json& res) {
    if (is_player_id(req.value("player_id", json()))) return true;
    res = error_response(res, "BAD_REQUEST", "player_id must be pl1 or pl2");
    return false;
}

// A live piece of `player_id`, or nullptr (never inserts into piece maps).
Chess_Piece* require_live_piece(Board* board, const json& req, json& res) {
    if (!req.contains("piece_id") || !req["piece_id"].is_string()) {
        res = error_response(res, "BAD_REQUEST", "missing piece_id");
        return nullptr;
    }
    Chess_Piece* piece = board->find_piece(req["player_id"], req["piece_id"]);
    if (!piece || !piece->get_is_alive()) {
        res = error_response(res, "INVALID_PIECE", "no live piece " + req["piece_id"].get<std::string>());
        return nullptr;
    }
    return piece;
}

}  // namespace

//--------------------------------------------------------------------------------------
// Rooms

json Conn_handler::create_room(const json& req) {
    json res = base_response(req);
    if (!req.contains("room_id") || !req["room_id"].is_string()) return error_response(res, "BAD_REQUEST", "missing room_id");
    // A fresh board every time: the relay only creates a room it doesn't have,
    // so an existing engine room with that id is stale.
    game->create_room(req["room_id"]);
    res["status"] = OK;
    res["turn_state"] = (*game)[req["room_id"].get<std::string>()]->turn_state(ID::PLAYER1);
    return res;
}

json Conn_handler::delete_room(const json& req) {
    json res = base_response(req);
    if (!req.contains("room_id") || !req["room_id"].is_string()) return error_response(res, "BAD_REQUEST", "missing room_id");
    res["status"] = game->delete_room(req["room_id"]) ? OK : "ROOM_DOES_NOT_EXIST";
    return res;
}

json Conn_handler::reset_room(const json& req) {
    json res = base_response(req);
    if (!require_board(game, req, res)) return res;
    game->reset_room(req["room_id"]);
    res["status"] = OK;
    res["turn_state"] = (*game)[req["room_id"].get<std::string>()]->turn_state(ID::PLAYER1);
    return res;
}

json Conn_handler::resign(const json& req) {
    json res = base_response(req);
    if (!require_board(game, req, res) || !require_player(req, res)) return res;
    res["status"] = OK;
    return res;
}

//--------------------------------------------------------------------------------------
// Moves

json Conn_handler::get_legal_moves(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;
    res["piece_id"] = req.value("piece_id", json());
    if (!require_live_piece(board, req, res)) return res;

    res["status"] = OK;
    res["position_array"] = json::array();
    for (const auto& move : board->get_legal_moves(req["player_id"], req["piece_id"])) {
        res["position_array"].push_back(position_json(move));
    }
    return res;
}

json Conn_handler::update_board(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;
    res["piece_id"] = req.value("piece_id", json());
    Chess_Piece* piece = require_live_piece(board, req, res);
    if (!piece) return res;

    std::pair<int, int> target;
    if (!read_position(req.value("position", json()), target)) return error_response(res, "BAD_REQUEST", "bad position");

    const std::string player_id = req["player_id"];
    const std::string piece_id = req["piece_id"];

    // The engine is the authority on legality, whatever the relay checked.
    const auto legal = board->get_legal_moves(player_id, piece_id);
    if (legal.find(target) == legal.end()) return error_response(res, "ILLEGAL_MOVE", "not a legal move");

    std::string promotion;
    const int last_rank = player_id == ID::PLAYER1 ? 8 : 1;
    if (is_unpromoted_pawn(piece) && target.first == last_rank) {
        promotion = req.value("promotion", "queen");
        bool known = false;
        for (const auto& p : kPromotions) known = known || p == promotion;
        if (!known) return error_response(res, "BAD_REQUEST", "promotion must be queen, rook, bishop or knight");
    }

    // Undo/redo bookkeeping uses the engine's own idea of where the piece was,
    // never the client's.
    const std::pair<int, int> from = piece->get_position();
    board->undo_is = false;
    board->old_position = from;
    board->move(json{{"player_id", player_id}, {"piece_id", piece_id}, {"position", position_json(target)}});
    board->new_position = target;

    if (!promotion.empty()) board->pawn_promotion(player_id, piece_id, target, promotion);

    res["status"] = OK;
    res["old_position"] = position_json(from);
    res["position"] = position_json(target);
    res["captured_piece_id"] = board->last_kill_info.value("piece_id", "NIL");
    res["promoted_to"] = promotion.empty() ? json() : json(promotion);
    // Everything the next player needs, so the relay needs no second request.
    res["turn_state"] = board->turn_state(opponent_of(player_id));
    return res;
}

// Legacy: kept for older relays. turn_state supersedes it.
json Conn_handler::validate_check(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;
    res["status"] = OK;
    res["check_or_mate_status"] = board->turn_state(req["player_id"])["check_or_mate_status"];
    return res;
}

json Conn_handler::turn_state(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;
    res["status"] = OK;
    res["turn_state"] = board->turn_state(req["player_id"]);
    return res;
}

// Legacy: update_position promotes automatically now. Kept, with guards, so
// an older client can't promote a piece that isn't a pawn on the last rank.
json Conn_handler::pawn_promotion(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;
    res["piece_id"] = req.value("piece_id", json());
    res["new_piece_id"] = req.value("new_piece_id", json());
    Chess_Piece* piece = require_live_piece(board, req, res);
    if (!piece) return res;

    std::pair<int, int> position;
    if (!read_position(req.value("position", json()), position)) return error_response(res, "BAD_REQUEST", "bad position");
    const int last_rank = req["player_id"] == ID::PLAYER1 ? 8 : 1;
    if (!is_unpromoted_pawn(piece) || piece->get_position() != position || position.first != last_rank) {
        return error_response(res, "INVALID_PROMOTION", "not an unpromoted pawn on the last rank");
    }
    const std::string kind = req.value("new_piece_id", "");
    bool known = false;
    for (const auto& p : kPromotions) known = known || p == kind;
    if (!known) return error_response(res, "BAD_REQUEST", "new_piece_id must be queen, rook, bishop or knight");

    board->pawn_promotion(req["player_id"], req["piece_id"], position, kind);
    res["status"] = OK;
    res["position"] = position_json(position);
    return res;
}

json Conn_handler::undo(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;

    json undo_data = board->undo(req["player_id"]);
    if (undo_data["status"] != OK) return error_response(res, undo_data["status"], "nothing to undo for this player");

    board->undo_is = true;
    res["status"] = OK;
    res["position"] = position_json(board->old_position);
    res["player_id"] = undo_data["player_id"];
    res["piece_id"] = undo_data["piece_id"];
    res["revived_player_id"] = undo_data["revived_player_id"];
    res["revived_piece_id"] = undo_data["revived_piece_id"];
    res["revived_position"] = undo_data["revived_position"];
    res["is_demoted"] = undo_data.value("is_demoted", "no");
    // The player who undid moves again.
    res["turn_state"] = board->turn_state(undo_data["player_id"]);
    return res;
}

json Conn_handler::redo(const json& req) {
    json res = base_response(req);
    Board* board = require_board(game, req, res);
    if (!board || !require_player(req, res)) return res;

    json redo_data = board->redo(req["player_id"]);
    if (redo_data["status"] != OK) return error_response(res, redo_data["status"], "nothing to redo for this player");

    board->undo_is = false;
    res["status"] = OK;
    res["position"] = position_json(board->redo_new_position);
    res["player_id"] = redo_data["player_id"];
    res["piece_id"] = redo_data["piece_id"];
    res["killed_player_id"] = redo_data["killed_player_id"];
    res["killed_piece_id"] = redo_data["killed_piece_id"];
    res["killed_position"] = redo_data["killed_position"];
    res["pawn_promoted"] = redo_data.value("pawn_promoted", "no");
    res["turn_state"] = board->turn_state(opponent_of(redo_data["player_id"]));
    return res;
}
