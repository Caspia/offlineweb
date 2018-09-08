FROM node:10.9-alpine

ARG OFFLINEWEB_PORT=3129
ARG OFFLINEWEB_TLSPORT=3130
ENV OFFLINEWEB_PORT=$OFFLINEWEB_PORT
ENV OFFLINEWEB_TLSPORT=$OFFLINEWEB_TLSPORT

# local dns
# RUN apk add --no-cache dnsmasq
# utilities helpful in development, optional in production
RUN apk add --no-cache nano curl lsof openrc bind-tools
# create app directory
RUN mkdir -p /root/app
WORKDIR /root/app

# Bundle the app source
ENV NODE_ENV production
COPY . /root/app
#RUN chmod 755 bin/*
# Switching to user node is now disabled, more trouble than worth in our isolated environments
# RUN chown node:node -R .
USER root
RUN npm install

VOLUME /var/cache/offlineweb
VOLUME /var/log/offlineweb
VOLUME /root/app/certificates

EXPOSE $OFFLINEWEB_PORT $OFFLINEWEB_TLSPORT

ENTRYPOINT ["node", "index.js"]
