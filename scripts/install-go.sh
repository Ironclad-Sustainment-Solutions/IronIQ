#!/bin/sh
# Downloads Go's official release directly (not via apt -- see the big
# comment in scripts/build-edge-binaries.sh for the history of why:
# apt's golang-go package was unreliable in Render's actual build
# container). Extracted into its own script specifically because the
# render.yaml one-liner this used to be gave zero visibility into WHERE
# in the download/verify/extract sequence a failure actually happened --
# every failure just surfaced downstream as build-edge-binaries.sh's own
# generic "Go toolchain not found," with no way to tell whether the
# download itself failed, succeeded but returned an error page instead
# of a real tarball, or extracted incorrectly.
#
# Does NOT export PATH itself -- this runs as its own script/process, so
# any environment change it made wouldn't survive back to whatever
# invoked it. The caller (render.yaml's buildCommand) adds /tmp/go/bin
# to PATH itself, after confirming this script succeeded, since the
# install location here is fixed and known ahead of time.
#
# Safe to run even when Go is already on PATH -- exits immediately in
# that case, doing nothing.

set -e

if command -v go >/dev/null 2>&1; then
  echo "Go already available: $(go version)"
  exit 0
fi

GO_VERSION="1.22.2"
GO_TARBALL="go${GO_VERSION}.linux-amd64.tar.gz"
GO_URL="https://go.dev/dl/${GO_TARBALL}"

echo "Go not found on PATH -- downloading $GO_URL ..."
# set +e/-e around this specific call: under `set -e`, a bare failing
# command (not part of an if/while/&&/|| condition) would kill the
# script immediately, before this could even inspect its exit code to
# print a clear message -- and using `if ! curl ...; then` instead turns
# out to have its own real bug (confirmed by testing, not assumed):
# `$?` inside that `then` branch reflects the NEGATED condition's own
# result (0, since the negation made the if-test "true"), not curl's
# actual exit code. Disabling errexit for just this one call is what
# actually lets the real status be captured and reported correctly.
set +e
curl -fsSL -o /tmp/go.tar.gz "$GO_URL"
curl_status=$?
set -e
if [ "$curl_status" -ne 0 ]; then
  echo "ERROR: curl failed to download $GO_URL (exit code $curl_status)." >&2
  echo "This usually means either the build environment can't reach go.dev at all" >&2
  echo "(a network/firewall restriction on outbound access), or this specific" >&2
  echo "version/URL no longer exists at go.dev/dl/ -- check https://go.dev/dl/ for" >&2
  echo "the current list of available versions if this keeps happening." >&2
  exit 1
fi

downloaded_size=$(wc -c < /tmp/go.tar.gz | tr -d ' ')
echo "Downloaded /tmp/go.tar.gz (${downloaded_size} bytes)"
# A real Go SDK tarball for this platform is well over 60MB. Anything
# drastically smaller almost always means curl -f didn't actually
# trigger (some proxies return a 200 with an HTML error/login page
# instead of a real 4xx/5xx status) -- catch that here with a size
# sanity check rather than silently trying to tar-extract an HTML file
# and getting a confusing, unrelated tar error instead.
if [ "$downloaded_size" -lt 10000000 ]; then
  echo "ERROR: downloaded file is only ${downloaded_size} bytes -- far too small to be a real Go SDK tarball." >&2
  echo "First 500 bytes of what was actually downloaded (likely an error page, not Go):" >&2
  head -c 500 /tmp/go.tar.gz >&2
  echo "" >&2
  exit 1
fi

echo "Extracting to /tmp/go ..."
if ! tar -C /tmp -xzf /tmp/go.tar.gz; then
  echo "ERROR: failed to extract /tmp/go.tar.gz -- the download may be corrupt or incomplete." >&2
  exit 1
fi

if [ ! -x /tmp/go/bin/go ]; then
  echo "ERROR: extraction finished but /tmp/go/bin/go doesn't exist or isn't executable." >&2
  echo "Contents of /tmp/go/bin (if it exists at all):" >&2
  ls -la /tmp/go/bin/ >&2 2>&1 || echo "/tmp/go/bin does not exist at all" >&2
  exit 1
fi

echo "Go installed successfully: $(/tmp/go/bin/go version)"
