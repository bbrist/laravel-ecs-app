#!/bin/sh

php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan view:cache

exec docker-php-entrypoint "$@"
