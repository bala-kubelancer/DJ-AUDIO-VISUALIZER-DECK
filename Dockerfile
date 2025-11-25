# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build React app (for Vite or similar)
# If using CRA, this is still usually `npm run build`
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine

# Remove default Nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy built app (Vite: dist, CRA: build)
# If your build folder is "build", change /app/dist → /app/build
COPY --from=builder /app/dist /usr/share/nginx/html

# Optional: custom Nginx config (uncomment if you create nginx.conf)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
