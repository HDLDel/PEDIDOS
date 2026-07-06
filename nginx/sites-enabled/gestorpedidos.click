server {
    listen 8900;
    server_name gestorpedidos.click www.gestorpedidos.click;

    location / {
        proxy_pass http://127.0.0.1:8901;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
