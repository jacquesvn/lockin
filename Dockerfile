FROM nginx:alpine

# Serve the Lockin PWA (app + manifest + icons + service worker)
COPY index.html manifest.webmanifest service-worker.js icon.svg icon-192.png icon-512.png /usr/share/nginx/html/

# Long cache for assets is fine; the app is one file so keep it simple
EXPOSE 80
