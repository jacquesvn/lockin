FROM nginx:alpine

# Serve the Lockin PWA (app + manifest + icons + service worker)
COPY docs/ /usr/share/nginx/html/

EXPOSE 80
