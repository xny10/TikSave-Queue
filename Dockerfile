FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV STORAGE_DIR=/tmp/tiksave

EXPOSE 3000

CMD ["npm", "start"]
