# Runs the MCP server over stdio. Used by directories that build and inspect
# servers (Glama, Smithery). The server starts without a key and lists its
# tools; calls need SEO_SCORE_API_KEY (free at https://seoscoreapi.com).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js lib.js tools.json server-instructions.txt ./
USER node
ENTRYPOINT ["node", "index.js"]
