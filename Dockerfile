# Use an official Node.js runtime as a parent image
# Using LTS version (check Node.js website for current LTS)
FROM node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
# Use --only=production if you don't need devDependencies in the final image
# Or install all and prune later if build steps require devDeps
RUN npm install

# Copy app source code
COPY . .

# (Optional) Add build step here if needed (e.g., for TypeScript)
# RUN npm run build

# --- Production Stage ---
# Use a smaller base image for the final stage
FROM node:18-alpine

WORKDIR /app

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
# Copy config and logger explicitly if they are top-level (they are in src)
# COPY --from=builder /app/config.js ./
# COPY --from=builder /app/logger.js ./

# Expose the port the app runs on (default 3000, but can be overridden by env var)
# Note: This is documentation; you still need to map the port when running the container.
EXPOSE 3000

# Define environment variables (defaults, can be overridden)
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_PATH="/app/data/tokens.json"
# Add other ENV vars as needed (e.g., LOG_LEVEL)

# Command to run the application
# Use node directly to run the server script
CMD ["npm", "start"]

# Healthcheck (Optional but recommended)
# Checks if the server is responding on the health endpoint
# Adjust interval/timeout/retries as needed
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT}/api/health || exit 1
