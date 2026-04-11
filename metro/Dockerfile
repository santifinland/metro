# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist/metro /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
