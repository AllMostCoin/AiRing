FROM node:20-alpine

# Non-root user for security
RUN addgroup -S airing && adduser -S airing -G airing

WORKDIR /app

# Copy dependency manifests and install production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy application source
COPY server.js ./
COPY docs ./docs

# Set ownership
RUN chown -R airing:airing /app

USER airing

# PORT defaults to 3000; override via environment variable on the host
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
