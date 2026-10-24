FROM node:22-alpine AS build
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npx ng build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/dashboard/browser /usr/share/nginx/html
# the real config.json is personal and never baked in: mount it over this placeholder (see deploy/config.example.yaml)
COPY --from=build /app/dist/dashboard/browser/config.example.json /usr/share/nginx/html/config.json
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/feeds.conf /etc/nginx/feeds.conf
