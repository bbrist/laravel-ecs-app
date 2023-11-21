ARG PHP_EXTS="bcmath ctype fileinfo mbstring pdo pdo_mysql dom pcntl"
ARG PHP_PECL_EXTS="redis"

FROM composer:2.5.1 AS composer
ARG PHP_EXTS
ARG PHP_PECL_EXTS

RUN mkdir -p /app /app/bin
WORKDIR /app

RUN addgroup -S composer \
    && adduser -S composer -G composer \
    && chown -R composer /app \
    && apk add --virtual build-dependencies --no-cache ${PHPIZE_DEPS} openssl ca-certificates libxml2-dev oniguruma-dev \
    && docker-php-ext-install -j$(nproc) ${PHP_EXTS} \
    && pecl install ${PHP_PECL_EXTS} \
    && docker-php-ext-enable ${PHP_PECL_EXTS} \
    && apk del build-dependencies

USER composer

COPY --chown=composer composer.json composer.lock ./

RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY --chown=composer . .

RUN composer install --no-dev --prefer-dist

FROM node:16 as frontend

COPY --from=composer /app /app

WORKDIR /app

RUN npm install && npm run build

FROM php:8.2-alpine as cli

ARG PHP_EXTS
ARG PHP_PECL_EXTS

WORKDIR /app

RUN apk add --virtual build-dependencies --no-cache ${PHPIZE_DEPS} openssl ca-certificates libxml2-dev oniguruma-dev && \
    docker-php-ext-install -j$(nproc) ${PHP_EXTS} && \
    pecl install ${PHP_PECL_EXTS} && \
    docker-php-ext-enable ${PHP_PECL_EXTS} && \
    apk del build-dependencies

COPY --from=composer /app /app
COPY --from=frontend /app/public /app/public

FROM php:8.2-fpm-alpine as fpm

ARG PHP_EXTS
ARG PHP_PECL_EXTS

WORKDIR /app

RUN apk add --virtual build-dependencies --no-cache ${PHPIZE_DEPS} openssl ca-certificates libxml2-dev oniguruma-dev && \
    docker-php-ext-install -j$(nproc) ${PHP_EXTS} && \
    pecl install ${PHP_PECL_EXTS} && \
    docker-php-ext-enable ${PHP_PECL_EXTS} && \
    apk del build-dependencies

USER www-data

COPY --from=composer --chown=www-data /app /app
COPY --from=frontend --chown=www-data /app/public /app/public

COPY --chown=www-data docker/docker-fpm-entrypoint.sh /usr/local/bin/docker-fpm-entrypoint
RUN chmod +x /usr/local/bin/docker-fpm-entrypoint

ENTRYPOINT ["docker-fpm-entrypoint"]

CMD ["php-fpm"]

FROM nginx:1.21-alpine as web

WORKDIR /app

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

COPY --from=frontend /app/public /app/public

FROM cli as cron

WORKDIR /app

RUN touch laravel.cron && \
    echo "* * * * * php /app/artisan schedule:run" >> laravel.cron && \
    crontab laravel.cron

CMD ["crond", "-l", "2", "-f"]
