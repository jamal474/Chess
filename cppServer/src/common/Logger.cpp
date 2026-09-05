#include "common/Logger.h"

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <string>

namespace chess {

Logger& Logger::instance() {
    static Logger l;
    // Always try to pick up the env var; cheap and idempotent.
    static bool configured = false;
    if (!configured) {
        l.configureFromEnv();
        configured = true;
    }
    return l;
}

void Logger::configureFromEnv() {
    if (const char* env = std::getenv("CHESS_LOG_LEVEL")) {
        level_ = parseLevel(env, level_);
    }
}

void Logger::setLevel(LogLevel l) {
    std::lock_guard<std::mutex> lg(mtx_);
    level_ = l;
}

const char* Logger::levelName(LogLevel l) {
    switch (l) {
        case LogLevel::TRACE: return "TRACE";
        case LogLevel::DEBUG: return "DEBUG";
        case LogLevel::INFO:  return "INFO";
        case LogLevel::WARN:  return "WARN";
        case LogLevel::ERROR_:return "ERROR";
        case LogLevel::FATAL: return "FATAL";
    }
    return "?????";
}

LogLevel Logger::parseLevel(const std::string& s, LogLevel fallback) {
    std::string u;
    u.reserve(s.size());
    for (char c : s) u.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    if (u == "TRACE") return LogLevel::TRACE;
    if (u == "DEBUG") return LogLevel::DEBUG;
    if (u == "INFO")  return LogLevel::INFO;
    if (u == "WARN" || u == "WARNING") return LogLevel::WARN;
    if (u == "ERROR" || u == "ERR") return LogLevel::ERROR_;
    if (u == "FATAL" || u == "CRITICAL") return LogLevel::FATAL;
    return fallback;
}

// Basename without leaning on <filesystem>.
static const char* short_basename(const char* p) {
    const char* last = p;
    for (const char* c = p; *c; ++c) {
        if (*c == '/' || *c == '\\') last = c + 1;
    }
    return last;
}

void Logger::log(LogLevel lvl,
                 const char* file,
                 int line,
                 const std::string& tag,
                 const std::string& msg) {
    using namespace std::chrono;
    const auto now = system_clock::now();
    const std::time_t t = system_clock::to_time_t(now);
    const auto ms = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;
    std::tm tm{};
#if defined(_WIN32)
    localtime_s(&tm, &t);
#else
    localtime_r(&t, &tm);
#endif

    std::ostringstream out;
    out << '[' << std::put_time(&tm, "%F %T") << '.' << std::setw(3) << std::setfill('0') << ms.count() << ']'
        << ' ' << '[' << std::setw(5) << std::left << std::setfill(' ') << levelName(lvl) << ']'
        << ' ' << '[' << short_basename(file) << ':' << line << ']'
        << ' ' << '[' << tag << ']'
        << ' ' << msg
        << '\n';

    std::lock_guard<std::mutex> lg(mtx_);
    if (lvl >= LogLevel::WARN) {
        std::cerr << out.str();
        std::cerr.flush();
    } else {
        std::cout << out.str();
        std::cout.flush();
    }
}

} // namespace chess
