//*********************************************************
//
// Entry point for the game.
// Creates a Server object. The bind port is chosen from,
// in order of preference:
//     PORT env var                 (Railway / most PaaS)
//     CHESS_ENGINE_PORT env var    (docker-compose / local)
//     compile-time default 5000
//
//*********************************************************

#include <asio.hpp>
#include <cstdlib>
#include <stdexcept>
#include <string>

#include "common/Logger.h"
#include "net/Conn_handler.h"
#include "net/Server.h"

using json = nlohmann::json;

int main(int /*argc*/, char* /*argv*/[]) {
    // Pick up CHESS_LOG_LEVEL early so subsequent LOG_* calls honour it.
    chess::Logger::instance().configureFromEnv();

    try {
        int port = 5000;
        const char* env_port = std::getenv("PORT");
        if (!env_port) env_port = std::getenv("CHESS_ENGINE_PORT");
        if (env_port) {
            try {
                port = std::stoi(env_port);
            } catch (...) {
                LOG_WARN("main", "Invalid port env='" << env_port << "', using 5000");
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
