FROM node:20-alpine

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src

# Build TS → JS
RUN npm run build

EXPOSE 3000

# Apply migrations + start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
