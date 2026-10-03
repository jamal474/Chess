#pragma once

//*********************************************************
//
// Conn_handler — one long-lived TCP connection from the
// Node relay.
//
// Protocol: newline-delimited JSON (NDJSON). Each line the
// relay sends is one request object; the engine answers
// every request with exactly one response line, in the
// order the requests arrived. A request may carry a "seq"
// field, which is echoed back so the relay can match
// responses to requests. Several requests can be in flight
// on the same connection.
//
//   → {"seq":7,"req_id":"valid_moves","room_id":"AB12C",...}\n
//   ← {"seq":7,"res_id":"valid_moves","status":"SUCCESSFUL",...}\n
//
// Malformed or invalid requests get an error response
// (status != "SUCCESSFUL") instead of being dropped, and
// never touch game state.
//
//*********************************************************

#include <asio.hpp>
#include <deque>
#include <memory>
#include <nlohmann/json.hpp>
#include <string>
#include <system_error>

#include "engine/Game.h"

namespace ip = asio::ip;
using json = nlohmann::json;

class Conn_handler : public std::enable_shared_from_this<Conn_handler> {
private:
    // A single request line may not exceed this. Real requests are < 300 bytes.
    static constexpr std::size_t max_line_bytes = 64 * 1024;

    ip::tcp::socket socket;
    asio::streambuf inbuf{max_line_bytes};
    std::deque<std::string> outbox;  // responses waiting to be written
    Game* game;

    void read_next();
    void on_line(const std::string& line);
    void write(std::string line);
    void write_next();

    // Request → response. Never throws.
    json handle(const json& req);

    // Request handlers. Each returns the response body (without "seq").
    json create_room(const json&);
    json delete_room(const json&);
    json get_legal_moves(const json&);
    json update_board(const json&);
    json validate_check(const json&);
    json turn_state(const json&);
    json pawn_promotion(const json&);
    json undo(const json&);
    json redo(const json&);
    json reset_room(const json&);
    json resign(const json&);

public:
    typedef std::shared_ptr<Conn_handler> pointer;

    Conn_handler(asio::io_context&, Game*);
    ~Conn_handler();
    ip::tcp::socket& getSocket();
    void start();

    static pointer create(asio::io_context& io_context, Game* game) {
        return pointer(new Conn_handler(io_context, game));
    }
};
