#!/bin/sh
set -e

# Inject NASA API Key into config.js
if [ -n "$NASA_API_KEY" ]; then
    cat > /usr/share/nginx/html/config.js <<EOF
// NASA API Configuration
// Injected at runtime via NASA_API_KEY environment variable
const NASA_API_KEY = "${NASA_API_KEY}";
EOF
    echo "NASA_API_KEY injected successfully."
else
    echo "WARNING: NASA_API_KEY environment variable is not set. The application may not work correctly."
fi

# Configure nginx port
NGINX_PORT="${PORT:-80}"

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen       ${NGINX_PORT};
    listen  [::]:${NGINX_PORT};
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
        try_files \$uri \$uri.html \$uri/ =404;
    }

    location /proxy/ {
        proxy_pass https://epic.gsfc.nasa.gov/;
        proxy_ssl_server_name on;
        proxy_set_header Host epic.gsfc.nasa.gov;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
EOF

echo "Starting nginx on port ${NGINX_PORT}..."

# Start nginx in foreground
exec nginx -g 'daemon off;'
