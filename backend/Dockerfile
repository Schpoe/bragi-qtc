FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm prune --production
EXPOSE 3001
CMD ["node", "src/index.js"]
