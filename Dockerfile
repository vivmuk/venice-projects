FROM nginx:alpine
COPY nginx.template.conf /etc/nginx/templates/default.conf.template
COPY index.html app.js projects.json /usr/share/nginx/html/
COPY screenshots/ /usr/share/nginx/html/screenshots/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
