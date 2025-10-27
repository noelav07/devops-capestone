FROM node:18-alpine AS backend
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .


#Prod
FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY frontend/ .

COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

RUN apk add --no-cache nodejs npm

WORKDIR /app/backend
COPY --from=backend /app/backend ./

EXPOSE 80 3000

CMD \
  node server.js & \
  nginx -g "daemon off;"
