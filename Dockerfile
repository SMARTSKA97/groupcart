FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production

# Copy application files
COPY server.js ./
COPY public/ ./public/

# Data volume for persistence
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "server.js"]
