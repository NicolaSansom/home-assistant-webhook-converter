FROM node:24-alpine

# Metadata
LABEL maintainer="Nicola Sansom"
LABEL description="Converts GET requests to POST for Home Assistant webhooks"
LABEL version="1.0.0"

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY app/package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application
COPY app/server.js ./
COPY app/views ./views

# Create logs directory
RUN mkdir -p logs && \
    chmod 777 logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root user
USER node

# Start application
CMD ["node", "server.js"]
