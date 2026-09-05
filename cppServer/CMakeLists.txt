cmake_minimum_required(VERSION 3.16)
project(cppServer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Boost.Asio + Boost.System
find_package(Boost REQUIRED COMPONENTS system)
# nlohmann_json — packaged as libnlohmann-json3-dev on Debian/Ubuntu
find_package(nlohmann_json 3.7 REQUIRED)
# thread support for Boost.Asio
find_package(Threads REQUIRED)

# ---- Compile-time minimum log level --------------------------------------
# Any LOG_* call below this level compiles to a no-op.
# Values: 0=TRACE 1=DEBUG 2=INFO 3=WARN 4=ERROR 5=FATAL
set(CHESS_MIN_LOG_LEVEL "0" CACHE STRING
    "Compile-time minimum log level (0=TRACE .. 5=FATAL). Anything strictly below is elided.")

# ---- Sources -------------------------------------------------------------
file(GLOB_RECURSE CPP_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")
file(GLOB_RECURSE CPP_HEADERS CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/include/*.h")

add_executable(chess_engine ${CPP_SOURCES} ${CPP_HEADERS})

target_include_directories(chess_engine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${Boost_INCLUDE_DIRS}
)

target_link_libraries(chess_engine PRIVATE
    Boost::system
    nlohmann_json::nlohmann_json
    Threads::Threads
)

target_compile_definitions(chess_engine PRIVATE
    CHESS_ENGINE_DEFAULT_PORT=5000
    CHESS_MIN_LOG_LEVEL=${CHESS_MIN_LOG_LEVEL}
    BOOST_BIND_GLOBAL_PLACEHOLDERS  # keep pre-1.73 placeholder semantics
)

message(STATUS "chess_engine: CHESS_MIN_LOG_LEVEL=${CHESS_MIN_LOG_LEVEL}")
