FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY metro.js .
EXPOSE 8081
CMD ["node", "metro.js"]
