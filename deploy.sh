# !/bin/bash
# ---------------------------------------------------------------------------
# Toxen Remote Deployment Script
# This is not meant to be run by end-users. This just helps me deploy faster
# by automating some of the manual steps I have to do every time I want to
# deploy a new version of Toxen Remote.
# ---------------------------------------------------------------------------

git pull
# Update the server related to this Toxen release.
# The server submodule is private - Not meant to be publicly accessible
git submodule update --recursive
# Build the web app before building the server, since Docker will create a root-owned folder otherwise
yarn buildweb

# Build and start the server with Docker
cd server
docker compose up --build -d
cd ..