#FROM node:11.11-alpine
FROM node:8.9.4-alpine

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
COPY .npmrc .
RUN npm install
COPY . .

USER node

CMD ["node"]
