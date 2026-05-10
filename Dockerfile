FROM node:20-alpine

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# Data directory (will be mounted as volume)
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
