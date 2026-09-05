#include "net/Server.h"
#include "common/Logger.h"

Server::Server(asio::io_context& io_context, int port)
    : io_context_(io_context),
      acceptor_(io_context, ip::tcp::endpoint(ip::tcp::v4(), port)) {
    game = new Game();

    ip::address bound = ip::tcp::endpoint(ip::tcp::v4(), port).address();
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

void Server::start_accept(Game* game) {
    Conn_handler::pointer connection = Conn_handler::create(io_context_, game);

    acceptor_.async_accept(
        connection->getSocket(),
        boost::bind(&Server::handle_accept, this, connection,
                    boost::asio::placeholders::error));
}

//--------------------------------------------------------------------------------------

void Server::handle_accept(Conn_handler::pointer connection,
                           const boost::system::error_code& err) {
    if (!err) {
        LOG_DEBUG("Server", "client connected");
        connection->start();
    } else {
        LOG_WARN("Server", "accept error: " << err.message());
    }
    start_accept(game);
}
