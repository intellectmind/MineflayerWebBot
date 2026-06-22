#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
APP_VERSION="1.0.0"
NODE_VERSION="22.23.0"
WEB_PORT="15666"
RUNTIME_DIR="$PWD/.runtime"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
NODE_EXE="node"
NPM_CMD="npm"

echo "========================================"
echo "  Mineflayer Web Bot ${APP_VERSION}"
echo "========================================"
echo ""
echo "Enter : start"
echo "r     : reset dependencies then start"
echo "n     : use official npm registry for this run"
echo "c     : remove portable Node runtime"
echo "q     : quit"
echo ""
read -r -p "Select: " ACTION || ACTION=""
case "${ACTION}" in
  q|Q) exit 0 ;;
  c|C) rm -rf .runtime; echo "[OK] Removed .runtime"; exit 0 ;;
  n|N) NPM_REGISTRY="https://registry.npmjs.org" ;;
esac
RESET_DEPS=0
[[ "${ACTION}" =~ ^[rR]$ ]] && RESET_DEPS=1

echo "[1/5] Checking Node.js 22+ ..."
if command -v node >/dev/null 2>&1; then
  MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if [[ "${MAJOR}" -ge 22 ]]; then
    echo "[OK] Using system Node: $(node -v)"
  else
    NODE_EXE=""
  fi
else
  NODE_EXE=""
fi

if [[ -z "${NODE_EXE}" ]]; then
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  case "${ARCH}" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "[ERROR] Unsupported arch: ${ARCH}"; exit 1 ;;
  esac
  case "${OS}" in
    linux) NODE_FOLDER="node-v${NODE_VERSION}-linux-${ARCH}" ;;
    darwin) NODE_FOLDER="node-v${NODE_VERSION}-darwin-${ARCH}" ;;
    *) echo "[ERROR] Unsupported OS: ${OS}"; exit 1 ;;
  esac
  NODE_DIR="${RUNTIME_DIR}/${NODE_FOLDER}"
  NODE_ARCHIVE="${RUNTIME_DIR}/${NODE_FOLDER}.tar.xz"
  NODE_URL_CN="https://npmmirror.com/mirrors/node/v${NODE_VERSION}/${NODE_FOLDER}.tar.xz"
  NODE_URL_OFFICIAL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_FOLDER}.tar.xz"
  if [[ ! -x "${NODE_DIR}/bin/node" ]]; then
    mkdir -p "${RUNTIME_DIR}"
    echo "[INFO] Downloading portable Node ${NODE_VERSION} ..."
    echo "[DOWNLOAD] ${NODE_URL_CN}"
    if ! curl -L --fail -o "${NODE_ARCHIVE}" "${NODE_URL_CN}"; then
      echo "[WARN] China mirror failed. Trying official source."
      curl -L --fail -o "${NODE_ARCHIVE}" "${NODE_URL_OFFICIAL}"
    fi
    tar -xJf "${NODE_ARCHIVE}" -C "${RUNTIME_DIR}"
  fi
  export PATH="${NODE_DIR}/bin:${PATH}"
  NODE_EXE="${NODE_DIR}/bin/node"
  NPM_CMD="${NODE_DIR}/bin/npm"
  "${NODE_EXE}" -v
fi

echo "[2/5] Preparing config ..."
mkdir -p config
if [[ ! -f config/app.json ]]; then
  "${NODE_EXE}" scripts/init-config.js
else
  echo "[OK] config/app.json exists."
fi

echo "[3/5] npm registry: ${NPM_REGISTRY}"
"${NPM_CMD}" config set registry "${NPM_REGISTRY}"
"${NPM_CMD}" config set fund false >/dev/null 2>&1 || true
"${NPM_CMD}" config set audit false >/dev/null 2>&1 || true

if [[ "${RESET_DEPS}" == "1" ]]; then
  echo "[RESET] Removing node_modules and package-lock.json ..."
  rm -rf node_modules package-lock.json
fi

echo "[4/5] Checking runtime dependencies and bundled plugins ..."
if [[ ! -d node_modules ]]; then
  echo "[INFO] Installing runtime dependencies and bundled plugins. First run may take several minutes."
  "${NPM_CMD}" install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry "${NPM_REGISTRY}"
else
  echo "[OK] node_modules exists."
fi
if ! "${NODE_EXE}" scripts/check-runtime-deps.js; then
  echo "[INFO] Runtime dependency or bundled plugin check failed. Repairing dependencies ..."
  "${NPM_CMD}" install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry "${NPM_REGISTRY}"
  "${NODE_EXE}" scripts/check-runtime-deps.js
fi

echo "[5/5] Checking prebuilt web UI and starting server ..."
if [[ ! -f client/dist/index.html ]]; then
  echo "[ERROR] client/dist/index.html is missing. Please unzip the official release package again."
  exit 1
fi
ACCESS_URL="$(${NODE_EXE} scripts/print-url.js | head -n 1)"
echo "Access URL: ${ACCESS_URL}"
echo "Login information:"
"${NODE_EXE}" scripts/print-access.js
if command -v xdg-open >/dev/null 2>&1; then xdg-open "${ACCESS_URL}" >/dev/null 2>&1 || true; fi
"${NPM_CMD}" start
