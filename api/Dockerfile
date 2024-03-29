# local dev and dev/int/prod images are separate because they
# are built using a different and incompatible mode (default vs release)

FROM rust:1.73 AS builder
ARG mac

ENV MAC_INSTALL=${mac:+"build-essential gcc-x86-64-linux-gnu clang llvm"}
RUN apt-get update && apt-get install -y musl-tools musl-dev $MAC_INSTALL


RUN rustup target add x86_64-unknown-linux-musl
RUN rustup component add clippy rustfmt


WORKDIR /app

# First we handle fetching and building our dependencies
# This rarely changes so is done once and for all
# Cargo needs a stub entry point otherwise it fails
COPY Cargo.toml Cargo.lock ./
RUN mkdir src; echo "fn main() {}" > src/main.rs
RUN cargo fetch --target x86_64-unknown-linux-musl

ENV SQLX_OFFLINE=true
RUN if [ "$mac" = "true" ]; then \
        RUSTFLAGS="-C linker=x86_64-linux-gnu-gcc" \
        CC_x86_64_unknown_linux_musl="clang" \
        AR_x86_64_unknown_linux_musl="llvm-ar" \
        CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_RUSTFLAGS="-Clink-self-contained=yes -Clinker=rust-lld" \
        CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_RUNNER="qemu-x86_64 -L /usr/x86-64-linux-gnu" \
        cargo build --offline --target x86_64-unknown-linux-musl --release; \
    else \
        cargo build --offline --target x86_64-unknown-linux-musl --release; \
    fi


# Then we copy every files, and detect linting / formating errors
# This is only detection, fixing the errors should be done outside docker
# We handle this section in offline mode to avoid unecessary and terribly long crates index update
COPY ./ .

RUN cargo fmt --all -- --check

# we don't care about linting dependencies, but clippy still does so despite our use
# of --package and --no-deps flags
# this is relatively fast so not a blocker
RUN if [ "$mac" = "true" ]; then \
        RUSTFLAGS="-C linker=x86_64-linux-gnu-gcc" \
        CC_x86_64_unknown_linux_musl="clang" \
        AR_x86_64_unknown_linux_musl="llvm-ar" \
        CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_RUSTFLAGS="-Clink-self-contained=yes -Clinker=rust-lld" \
        CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_RUNNER="qemu-x86_64 -L /usr/x86-64-linux-gnu" \
        cargo clippy --package api --target x86_64-unknown-linux-musl --tests --examples --offline --release  --no-deps; \
    else \
        cargo clippy --package api --target x86_64-unknown-linux-musl --tests --examples --offline --release  --no-deps; \
    fi

# The tests actually requires a live DB so it must be run after the image is built
# See "make acceptance"

# We build the app
RUN if [ "$mac" = "true" ]; then \
        RUSTFLAGS="-C linker=x86_64-linux-gnu-gcc" \
        CC_x86_64_unknown_linux_musl="clang" \
        AR_x86_64_unknown_linux_musl="llvm-ar" \
        CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_RUSTFLAGS="-Clink-self-contained=yes -Clinker=rust-lld" \
        CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_RUNNER="qemu-x86_64 -L /usr/x86-64-linux-gnu" \
        cargo build --target x86_64-unknown-linux-musl --release --offline; \
    else \
        cargo build --target x86_64-unknown-linux-musl --release --offline; \
    fi


## The final image is quite small and almost minimal
FROM alpine:3.17

RUN apk add util-linux

# Import from builder.
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

WORKDIR /app

# Create appuser
ENV USER=appuser
ENV UID=10001

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"

# Copy the app (we assume the musl libc from alpine is available and compatible)
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/api ./

USER 10001
CMD ["/app/api"]
