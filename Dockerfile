FROM node:20-alpine
WORKDIR /app
COPY server.js login.html index.html app.js projects.json ./
COPY screenshots ./screenshots
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
