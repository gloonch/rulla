FROM docker.abrha.net/node:20-alpine AS dev
WORKDIR /app
ENV NPM_CONFIG_REGISTRY=https://package-mirror.liara.ir/repository/npm/ \
    NPM_CONFIG_REPLACE_REGISTRY_HOST=always \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
EXPOSE 5174
CMD ["npm", "run", "dev"]

FROM docker.abrha.net/node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_BASE_PATH=/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV NPM_CONFIG_REGISTRY=https://package-mirror.liara.ir/repository/npm/ \
    NPM_CONFIG_REPLACE_REGISTRY_HOST=always \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.abrha.net/nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
