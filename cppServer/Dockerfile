# --- C++ chess engine image ---
# Multi-stage: builds with Conan 2 + CMake + g++, ships in a minimal runtime.
#
# Because Conan is set to static-link Boost, the runtime image needs nothing
# from apt beyond libstdc++/libc — no libboost_system.so to keep in sync.

# ------------------------------ builder ---------------------------------
FROM debian:12-slim AS build
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      pkg-config \
      python3 \
      python3-pip \
      git \
    && rm -rf /var/lib/apt/lists/*

# Conan 2. --break-system-packages: this is a build stage, no OS packages to
# collide with.
RUN pip3 install --break-system-packages "conan>=2.0,<3.0"
RUN conan profile detect --force

WORKDIR /src
COPY conanfile.py CMakeLists.txt ./
# Prefetch deps in their own layer for docker cache reuse. If conanfile.py
# doesn't change, this layer is reused even when sources are edited below.
RUN conan install . --output-folder=build --build=missing -s build_type=Release

COPY include ./include
COPY src ./src
ARG CHESS_MIN_LOG_LEVEL=0
RUN cmake -S . -B build \
      -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake \
      -DCMAKE_BUILD_TYPE=Release \
      -DCHESS_MIN_LOG_LEVEL=${CHESS_MIN_LOG_LEVEL} && \
    cmake --build build -j"$(nproc)"

# ------------------------------ runtime ---------------------------------
FROM debian:12-slim AS runtime
# No third-party libs to install — Boost is statically linked in.
WORKDIR /app
COPY --from=build /src/build/chess_engine /app/chess_engine
ENV CHESS_ENGINE_PORT=5000
ENV CHESS_LOG_LEVEL=INFO
EXPOSE 5000
CMD ["/app/chess_engine"]
