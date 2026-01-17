# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Ensure we install all dependencies (including devDependencies) for the build
# Setting NODE_ENV to development ensures npm ci installs everything
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Default port for Cloud Run
ENV PORT=5000

COPY package*.json ./
# Install only production dependencies for the final image
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Expose the port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
