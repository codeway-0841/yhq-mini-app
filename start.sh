#!/bin/sh
npm install --include=dev
npm run build:server
node server/dist/standalone.js
