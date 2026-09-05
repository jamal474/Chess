#pragma once
//*********************************************************
//
// Small header-only-ish logger for the chess engine.
//
// Usage:
//   LOG_INFO("Server", "listening on port " << port);
//   LOG_ERROR("Conn_handler", "parse failed: " << e.what());
//
// The tag is normally the class name of the caller. Every
// line is written as:
//   [YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] [file:line] [tag] message
//
// Compile-time floor:
//   -DCHESS_MIN_LOG_LEVEL=<n>  (0=TRACE, 5=FATAL) elides any
//   log call below that level so it costs nothing at runtime.
//
// Runtime level:
//   CHESS_LOG_LEVEL env var (TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
//   defaults to INFO; can be lifted (but not lowered) at any
//   time via Logger::instance().setLevel(...).
//
//*********************************************************

#include <sstream>
#include <string>
#include <mutex>

namespace chess {

enum class LogLevel : int {
    TRACE = 0,
    DEBUG = 1,
    INFO  = 2,
    WARN  = 3,
    ERROR_ = 4,   // ERROR is a Windows macro; keep an alias below
    FATAL = 5,
};
constexpr LogLevel LL_ERROR = LogLevel::ERROR_;

class Logger {
public:
    static Logger& instance();

    // Initialise level from CHESS_LOG_LEVEL env var (or leave default INFO).
    void configureFromEnv();

    void setLevel(LogLevel l);
    LogLevel level() const { return level_; }

    // The actual write. Thread-safe.
    void log(LogLevel level,
             const char* file,
             int line,
             const std::string& tag,
             const std::string& msg);

    static const char* levelName(LogLevel l);
    static LogLevel parseLevel(const std::string& s, LogLevel fallback);

private:
    Logger() = default;
    LogLevel level_{LogLevel::INFO};
    std::mutex mtx_;
};

} // namespace chess

// Compile-time floor. Anything strictly below this level compiles to a no-op.
#ifndef CHESS_MIN_LOG_LEVEL
#define CHESS_MIN_LOG_LEVEL 0
#endif

#define CHESS_LOG_IMPL(LVL_ENUM, LVL_INT, TAG, MSG_EXPR)                        \
    do {                                                                        \
        if constexpr ((LVL_INT) >= CHESS_MIN_LOG_LEVEL) {                       \
            if (static_cast<int>(::chess::Logger::instance().level())           \
                <= (LVL_INT)) {                                                 \
                std::ostringstream _chess_oss;                                  \
                _chess_oss << MSG_EXPR;                                         \
                ::chess::Logger::instance().log(                                \
                    LVL_ENUM, __FILE__, __LINE__, (TAG), _chess_oss.str());     \
            }                                                                   \
        }                                                                       \
    } while (0)

#define LOG_TRACE(tag, msg) CHESS_LOG_IMPL(::chess::LogLevel::TRACE, 0, tag, msg)
#define LOG_DEBUG(tag, msg) CHESS_LOG_IMPL(::chess::LogLevel::DEBUG, 1, tag, msg)
#define LOG_INFO(tag, msg)  CHESS_LOG_IMPL(::chess::LogLevel::INFO,  2, tag, msg)
#define LOG_WARN(tag, msg)  CHESS_LOG_IMPL(::chess::LogLevel::WARN,  3, tag, msg)
#define LOG_ERROR(tag, msg) CHESS_LOG_IMPL(::chess::LL_ERROR,        4, tag, msg)
#define LOG_FATAL(tag, msg) CHESS_LOG_IMPL(::chess::LogLevel::FATAL, 5, tag, msg)
