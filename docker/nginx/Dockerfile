FROM nginx
ARG HTTPS_PRIVATE_KEY

COPY conf/selfsigned.crt /etc/nginx/ssl/selfsigned.crt
RUN mkdir /static/
COPY static/ /static
RUN touch /etc/nginx/ssl/selfsigned.key && echo "$HTTPS_PRIVATE_KEY" >> /etc/nginx/ssl/selfsigned.key

