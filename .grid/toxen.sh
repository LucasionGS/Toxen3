#!/usr/bin/env bash
# Grid Deploy hooks for Toxen (see .grid/deploy.yml). They also work by hand from the checkout.
#
#   build    Build the web app and the website into a staging folder, skipping each one that hasn't
#            changed since it was last published. Runs before the new server starts.
#   publish  Put what `build` staged in place: buildweb/ (served by the server container) and the
#            toxen.net document root. Runs once the new server is healthy.
#
# The staging folder and the record of what was published live inside .git, so `git status` (and
# Grid's local-changes check) never sees them.
set -euo pipefail
cd "$(dirname "$0")/.."

GIT_DIR=$(git rev-parse --absolute-git-dir)
STAGE="$GIT_DIR/grid-stage"
STATE="$GIT_DIR/grid-state"
SITE_ROOT=${TOXEN_SITE_ROOT:-/var/www/vhosts/toxen.net}

log() { echo "==> toxen: $*" >&2; }

# Fingerprint of everything the web app is built from: the top-level tree without the submodules.
web_fingerprint() {
  git ls-tree HEAD | grep -vP '\t(server|website|mini)$' | sha256sum | cut -d" " -f1
}

# Fingerprint of the website: the commit the website submodule is on.
website_fingerprint() {
  git rev-parse HEAD:website
}

# is_published <name> <fingerprint>: whether that exact build is what's live.
is_published() {
  [[ -f "$STATE/$1" ]] && [[ "$(cat "$STATE/$1")" = "$2" ]]
}

# Node from nvm when it's there: the version in .nvmrc if installed, else nvm's default.
use_node() {
  local home
  home=$(getent passwd "$(id -un)" | cut -d: -f6)
  export NVM_DIR=${NVM_DIR:-$home/.nvm}
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    set +eu # nvm.sh isn't written for -e or -u
    . "$NVM_DIR/nvm.sh"
    nvm use --silent "$(cat .nvmrc)" >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1
    set -eu
  fi
  command -v npm >/dev/null || { log "Node.js isn't installed; install it with nvm (see .nvmrc)."; exit 1; }
  log "node $(node -v)"
}

# install_deps <dir>: `npm ci` when package-lock.json changed since the last install there.
# Install scripts are skipped: the web build needs neither the Electron nor the ffmpeg download.
install_deps() {
  local dir=$1 lock
  lock=$(sha256sum "$dir/package-lock.json" | cut -d" " -f1)
  if [[ -f "$dir/node_modules/.grid-lock" ]] && [[ "$(cat "$dir/node_modules/.grid-lock")" = "$lock" ]]; then
    return 0
  fi
  log "npm ci in ${dir}"
  (cd "$dir" && npm ci --ignore-scripts --no-audit --no-fund >&2)
  echo "$lock" > "$dir/node_modules/.grid-lock"
}

build() {
  rm -rf "$STAGE"
  mkdir -p "$STAGE"
  local web site
  web=$(web_fingerprint)
  site=$(website_fingerprint)
  if is_published web "$web" && is_published website "$site"; then
    log "the web app and the website are unchanged; nothing to build"
    return 0
  fi
  use_node

  if is_published web "$web"; then
    log "the web app is unchanged"
  else
    install_deps .
    log "building the web app"
    npx vite build --config ./vite.web.config.ts --outDir "$STAGE/buildweb" --emptyOutDir >&2
    echo "$web" > "$STAGE/web"
  fi

  if is_published website "$site"; then
    log "the website is unchanged"
  else
    [[ -f website/package.json ]] || { log "the website submodule isn't checked out; add it to submodules in .grid/deploy.yml."; exit 1; }
    install_deps website
    log "building the website"
    (cd website && npm run build >&2)
    mkdir -p "$STAGE/website"
    cp -a website/dist/. "$STAGE/website/"
    echo "$site" > "$STAGE/website.fingerprint"
  fi
}

publish() {
  mkdir -p "$STATE"
  if [[ -f "$STAGE/web" ]]; then
    log "publishing the web app to buildweb/"
    mkdir -p buildweb
    # Into the folder, not replacing it: the server container bind-mounts buildweb/ itself.
    rsync -a --delete "$STAGE/buildweb/" buildweb/
    mv "$STAGE/web" "$STATE/web"
  fi
  if [[ -f "$STAGE/website.fingerprint" ]]; then
    log "publishing the website to $SITE_ROOT"
    rsync -a --delete "$STAGE/website/" "$SITE_ROOT/"
    mv "$STAGE/website.fingerprint" "$STATE/website"
  fi
  rm -rf "$STAGE"
}

case "${1:-}" in
  build) build ;;
  publish) publish ;;
  *)
    [[ -n "${1:-}" ]] && echo "Command not found: $1" >&2
    echo "Usage: bash .grid/toxen.sh build|publish" >&2
    exit 2
    ;;
esac
