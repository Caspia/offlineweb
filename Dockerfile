FROM node:10.3-alpine

# local dns
RUN apk add --no-cache dnsmasq
# utilities helpful in development, optional in production
RUN apk add --no-cache nano curl lsof openrc bind-tools
# create app directory
RUN mkdir -p /root/app
WORKDIR /root/app

# Bundle the app source
ENV NODE_ENV production
COPY . /root/app
#RUN chmod 755 bin/*
# Switching to user node is now disabled, more trouble than worth in out isolated environments
# RUN chown node:node -R .
USER root
RUN npm install

EXPOSE 3129 3130

ENTRYPOINT ["node", "index.js"]
