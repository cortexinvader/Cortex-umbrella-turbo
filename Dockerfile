# Use a supported Debian release (Bookworm is current)
FROM node:20-bookworm

# Install required tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        imagemagick \
        webp && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install deps
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Run the app
CMD ["npm", "start"]
