//*********************************************************
//
// Entry point for the game.
// Creates a server object; port is 5000 by default and can
// be overridden with the CHESS_ENGINE_PORT environment
// variable (useful in containers / on a VM).
//
//*********************************************************

#include <boost/asio.hpp>
#include <cstdlib>
#include <stdexcept>
#include <string>

#include "common/Logger.h"
#include "net/Conn_handler.h"
#include "net/Server.h"

namespace asio = boost::asio;
namespace ip   = asio::ip;
using namespace nlohmann;

int main(int /*argc*/, char* /*argv*/[]) {
    // Pick up CHESS_LOG_LEVEL early so subsequent LOG_* calls honour it.
    chess::Logger::instance().configureFromEnv();

    try {
        int port = 5000;
        if (const char* env_port = std::getenv("CHESS_ENGINE_PORT")) {
            try {
                port = std::stoi(env_port);
            } catch (...) {
                LOG_WARN("main", "Invalid CHESS_ENGINE_PORT='" << env_port << "', using 5000");
            }
        }

        LOG_INFO("main",
                 "cpp chess engine starting  (log level="
                 << chess::Logger::levelName(chess::Logger::instance().level())
                 << ", port=" << port << ")");

        asio::io_context io_context;
        Server server(io_context, port);
        LOG_INFO("main", "listening on port " << port);
        io_context.run();
    } catch (std::exception& e) {
        LOG_FATAL("main", "unhandled exception: " << e.what());
        return 1;
    }
    return 0;
}
