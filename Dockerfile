FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy web assets explicitly
COPY index.html style.css app.js i18n.js earth3d.html earth3d.js config.js config.example.js /usr/share/nginx/html/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default port (metadata only - actual port configured at runtime)
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
