# --- Build Stage ---
FROM rust:1.75-slim-bookworm AS builder

WORKDIR /usr/src/app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project context
# Note: We need the program crate as well for dependencies
COPY . .

# Build the quorum-node binary
# We navigate to the specific node directory
RUN cd nodes/quorum-node && cargo build --release

# --- Runtime Stage (SGX TEE) ---
FROM switchboardlabs/sgx-function:latest

# Copy the compiled binary from the builder stage
COPY --from=builder /usr/src/app/target/release/quorum-node /usr/bin/quorum-node

# Metadata for Switchboard
LABEL org.switchboard.function.name="parakletos-quorum-node"
LABEL org.switchboard.function.description="Hardware-rooted quorum node for Parakletos-Shard"

# Set the entrypoint
ENTRYPOINT ["/usr/bin/quorum-node"]
