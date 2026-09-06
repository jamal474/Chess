"""Chess engine build recipe (Conan 2).

Dependencies:
    * asio 1.30+ — standalone Asio (no Boost). Header-only, ~3 MB. Used
      exclusively for the network layer (TCP acceptor + async I/O).
    * nlohmann_json 3.11 — request/response JSON. Header-only.

Both are header-only, so `conan install` fetches only small archives and
nothing is compiled from third-party sources. That keeps the C++ build
under 30 seconds on a fresh machine and the runtime image stripped down
to libstdc++/libc.

Layout note: this recipe intentionally does NOT use `cmake_layout()`. With
`cmake_layout()`, `conan install . --output-folder=build` would nest the
generated files under `build/Release/generators/` and you would then have
to build via `cmake --preset conan-release`. We prefer the flat layout so
`conan install . --output-folder=build` puts every generated file — the
toolchain and the per-package `*-config.cmake` files — directly in
`build/`, matching what our `scripts/build.sh`, `Makefile` and `Dockerfile`
already expect:

    conan install . --output-folder=build --build=missing -s build_type=Release
    cmake -S . -B build \
        -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake \
        -DCMAKE_BUILD_TYPE=Release
    cmake --build build -j

Or use `./scripts/build.sh`, which does all of the above.
"""

from conan import ConanFile


class ChessEngineConan(ConanFile):
    name = "chess_engine"
    version = "3.0.0"
    description = "C++ chess game engine — Asio HTTP server + JSON I/O."
    license = "MIT"

    settings = "os", "compiler", "build_type", "arch"
    generators = "CMakeToolchain", "CMakeDeps"

    requires = (
        "asio/1.30.2",
        "nlohmann_json/3.11.3",
    )
