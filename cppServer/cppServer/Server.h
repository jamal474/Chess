#pragma once
#include "Conn_handler.h"
#include <boost/asio.hpp>
#include <boost/bind.hpp>
#include <boost/enable_shared_from_this.hpp>

namespace asio = boost::asio;
namespace ip = asio::ip;

class Server
{
private:
    ip::tcp::acceptor acceptor_;
    void start_accept(Game *);
    //process the Received Data from Node
    //void process_data(const boost::system::error_code&, size_t);
    //for C++ game server state
    Game* game;
public:
    //constructor for accepting connection from client
    Server(asio::io_context& io_context, int port) : acceptor_(io_context, ip::tcp::endpoint(ip::tcp::v4(), port))
    {
        game = new Game();
        std::cout << "GAME RESET" << game->game_map.size()<< std::endl;

        start_accept(game);

    }
    void handle_accept(Conn_handler::pointer, const boost::system::error_code&);
};

