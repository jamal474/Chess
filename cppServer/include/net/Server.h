#pragma once

//*********************************************************
//
// Server — Asio TCP acceptor. Owns the game state and keeps
// itself listening between requests.
//
//*********************************************************

#include <asio.hpp>
#include <memory>
#include <system_error>

#include "engine/Game.h"
#include "net/Conn_handler.h"

namespace ip = asio::ip;

class Server {
private:
    // The main Game holds every active room. One per Server lifetime.
    Game* game;

    asio::io_context& io_context_;
    ip::tcp::acceptor acceptor_;

    void start_accept(Game*);

public:
    Server(asio::io_context&, int);
    ~Server();

    void handle_accept(Conn_handler::pointer, const std::error_code&);
};
