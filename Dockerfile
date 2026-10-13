FROM caddy:alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/
COPY css /srv/css
COPY js /srv/js
