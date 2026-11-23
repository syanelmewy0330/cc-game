# Used only if Render is set to "Docker". Runs the game + co-op room server.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js index.html ./
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.js"]
