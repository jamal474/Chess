#include "net/Server.h"
#include "common/Logger.h"

Server::Server(asio::io_context& io_context, int port)
    : io_context_(io_context),
      acceptor_(io_context, ip::tcp::endpoint(ip::tcp::v4(), port)) {
    game = new Game();

    const auto bound = ip::tcp::endpoint(ip::tcp::v4(), port).address();
    LOG_INFO("Server",
             "bound on " << bound.to_string() << ":" << port
                         << ", game_map size=" << game->game_map.size());

    start_accept(game);
}

//--------------------------------------------------------------------------------------

Server::~Server() {
    delete game;
    LOG_INFO("Server", "game destroyed");
}

//--------------------------------------------------------------------------------------

void Server::start_accept(Game* g) {
    auto connection = Conn_handler::create(io_context_, g);

    // Lambda instead of boost::bind — modern Asio takes any callable.
    acceptor_.async_accept(
        connection->getSocket(),
        [this, connection](const std::error_code& err) {
            handle_accept(connection, err);
        });
}

//--------------------------------------------------------------------------------------

void Server::handle_accept(Conn_handler::pointer connection,
                           const std::error_code& err) {
    if (!err) {
        LOG_DEBUG("Server", "client connected");
        connection->start();
    } else {
        LOG_WARN("Server", "accept error: " << err.message());
    }
    start_accept(game);
}
