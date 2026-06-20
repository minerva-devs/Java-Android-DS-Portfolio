# Anchor Engine - JOSS Demo Docker Image
# Production-ready container with C++ FTS backend built from source
# Supports: amd64 (x86_64), arm64 (Apple Silicon, Graviton)

FROM node:20-bookworm

# Install pnpm, C++ build tools, and runtime dependencies
RUN npm install -g pnpm && \
    apt-get update && \
    apt-get install -y \
    libstdc++6 curl \
    cmake g++ make git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set environment variables
ENV PROJECT_ROOT=/app
ENV CONTEXT_DIR=/app/engine/context_data
ENV NODE_ENV=production

# Copy project files
COPY . .

# Build C++ native library (anchor_core) for this platform
RUN cd cpp && \
    cmake -B build -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=ON \
    -DBUILD_TESTS=OFF \
    -DBUILD_NAPI_BINDINGS=OFF && \
    cmake --build build --config Release -j$(nproc) && \
    mkdir -p /app/packages/anchor-core/lib/linux-x64 && \
    cp build/libanchor_core.so /app/packages/anchor-core/lib/linux-x64/

# Install dependencies and build TypeScript
RUN pnpm install --no-frozen-lockfile && \
    pnpm run build

# Create data directories (will be mounted as volumes)
RUN mkdir -p \
    /app/inbox \
    /app/external-inbox \
    /app/mirrored_brain \
    /app/backups \
    /app/engine/context_data \
    /app/notebook && \
    chown -R node:node /app

# Copy sample data and docker-specific settings
RUN cp -r /app/sample-data/* /app/inbox/ 2>/dev/null || true && \
    cp /app/user_settings.docker.json /app/user_settings.json 2>/dev/null || true

# Expose API port (serves both API and UI)
EXPOSE 3160

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3160/health || exit 1

# Start the engine
CMD ["node", "--expose-gc", "engine/dist/index.js"]
