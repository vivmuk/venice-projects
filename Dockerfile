FROM node:20-alpine
WORKDIR /app
COPY server.js login.html index.html app.js projects.json films.json ./
COPY screenshots ./screenshots
COPY films ./films
COPY scripts ./scripts
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
