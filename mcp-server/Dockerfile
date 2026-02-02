FROM node:20-slim

WORKDIR /app

# Copy package files first (for caching)
COPY package.json package-lock.json* ./

# Install dependencies including devDependencies for build
RUN npm install

# Copy source files
COPY tsconfig.json ./
COPY main.ts ./
COPY mcp ./mcp

# Build with leanmcp
RUN npm run build

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]