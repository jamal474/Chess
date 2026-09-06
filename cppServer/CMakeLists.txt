cmake_minimum_required(VERSION 3.16)
project(cppServer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ------------------------------------------------------------------
# Dependencies come from Conan 2. Before running cmake, do:
#   conan install . --output-folder=build --build=missing -s build_type=Release
# Then either build via a preset:
#   cmake --preset conan-release
# or point cmake at the generated toolchain manually:
#   cmake -S . -B build/Release \
#         -DCMAKE_TOOLCHAIN_FILE=build/Release/generators/conan_toolchain.cmake \
#         -DCMAKE_BUILD_TYPE=Release
# ------------------------------------------------------------------

# Conan's CMakeDeps writes package configs into the build folder; make sure
# find_package looks there even when CMake wasn't invoked via a preset.
list(PREPEND CMAKE_MODULE_PATH  "${CMAKE_BINARY_DIR}")
list(PREPEND CMAKE_PREFIX_PATH  "${CMAKE_BINARY_DIR}")

find_package(asio REQUIRED CONFIG)
find_package(nlohmann_json 3.7 REQUIRED CONFIG)
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
)

target_link_libraries(chess_engine PRIVATE
    asio::asio                    # standalone Asio (header-only)
    nlohmann_json::nlohmann_json
    Threads::Threads
)

target_compile_definitions(chess_engine PRIVATE
    CHESS_ENGINE_DEFAULT_PORT=5000
    CHESS_MIN_LOG_LEVEL=${CHESS_MIN_LOG_LEVEL}
)

message(STATUS "chess_engine: CHESS_MIN_LOG_LEVEL=${CHESS_MIN_LOG_LEVEL}")
