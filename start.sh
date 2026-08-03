#!/bin/sh
npm install
npm run build
node dist/server/standalone.js
