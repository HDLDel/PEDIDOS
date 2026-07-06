#!/bin/bash
set -euo pipefail

NGINX_DIR="/root/PEDIDOS/nginx"
NGINX_BIN="$NGINX_DIR/sbin/nginx"
NGINX_CONF="$NGINX_DIR/conf/nginx.conf"

case "${1:-}" in
    start)
        echo "Starting third nginx (port 8900)..."
        "$NGINX_BIN" -c "$NGINX_CONF" -p "$NGINX_DIR"
        echo "OK"
        ;;
    stop)
        echo "Stopping third nginx..."
        "$NGINX_BIN" -c "$NGINX_CONF" -p "$NGINX_DIR" -s stop 2>/dev/null || echo "Already stopped"
        echo "OK"
        ;;
    reload)
        echo "Reloading third nginx..."
        "$NGINX_BIN" -c "$NGINX_CONF" -p "$NGINX_DIR" -s reload
        echo "OK"
        ;;
    test)
        "$NGINX_BIN" -c "$NGINX_CONF" -p "$NGINX_DIR" -t
        ;;
    status)
        if [ -f "$NGINX_DIR/run/nginx.pid" ]; then
            PID=$(cat "$NGINX_DIR/run/nginx.pid")
            if kill -0 "$PID" 2>/dev/null; then
                echo "Running (PID $PID)"
            else
                echo "Stopped (stale PID $PID)"
            fi
        else
            echo "Stopped"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|reload|test|status}"
        exit 1
        ;;
esac
