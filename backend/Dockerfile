FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN node node_modules/prisma/build/index.js generate

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
