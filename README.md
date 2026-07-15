# Lockin — your pocket CS2 coach

A free pocket coach for Counter-Strike 2. Answer a quick quiz and Lockin builds you a
personalised training plan plus a daily tracker to actually stick to it — because a good
plan and the discipline to run it shouldn't cost $50 an hour.

It's a single self-contained web app (one HTML file + a service worker for offline) and
installs as an app on any device. Your data stays on your device (localStorage); nothing
is uploaded.

## Run it
- Open `index.html`, or use the hosted version.
- Docker: `docker build -t lockin . && docker run -d -p 8080:80 lockin`
