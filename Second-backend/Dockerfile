FROM node:20-slim
WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY eval ./eval

ENV PORT=3001
EXPOSE 3001
CMD ["npx", "tsx", "src/server.ts"]
