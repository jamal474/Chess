#pragma once

//*********************************************************
//
// Conn_handler — one TCP connection, one request/response
// cycle. Kept alive across async callbacks via
// std::enable_shared_from_this.
//
//*********************************************************

#include <asio.hpp>
#include <memory>
#include <nlohmann/json.hpp>
#include <queue>
#include <string>
#include <system_error>

#include "engine/Game.h"

namespace ip = asio::ip;
using json = nlohmann::json;

class Conn_handler : public std::enable_shared_from_this<Conn_handler> {
private:
    enum { max_length = 1024 };

    ip::tcp::socket socket;
    std::string return_data;
    char received_data[max_length] = {'1', '\0'};
    std::queue<std::string> request_queue;

    // Process the received HTTP request
    void process_http_request(const std::string& request);

    // Send the response for the processed HTTP request
    void send_http_response(const std::string& response);

    // Read the incoming data from the socket
    void read_data(const std::error_code&, size_t);

    // Various request handlers
    void create_room(json);
    void delete_room(json);
    void get_legal_moves(json);
    void update_board(json);
    void validate_check(json);
    void pawn_promotion(json);
    void undo(json);
    void redo(json);
    void reset_room(json);
    void castle_move(json);

    Game* game;

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
