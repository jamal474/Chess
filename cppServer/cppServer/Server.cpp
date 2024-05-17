#include "Server.h"

void Server::start_accept(Game *game)
{
    // socket
    Conn_handler::pointer connection = Conn_handler::create((asio::io_context&)acceptor_.get_executor().context(), game);

    // asynchronous accept operation and wait for a new connection.
    acceptor_.async_accept(connection->getSocket(),
        boost::bind(&Server::handle_accept, this, connection,
            boost::asio::placeholders::error));
}

void Server::handle_accept(Conn_handler::pointer connection, const boost::system::error_code& err)
{
    if (!err) {
        std::cout << "connected" << std::endl;
        connection->start();
    }
    start_accept(game);
}
