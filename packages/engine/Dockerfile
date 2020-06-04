FROM node:12

WORKDIR /usr/embracesql
COPY . .
RUN yarn install --force

ENTRYPOINT ["yarn", "run", "--silent", "cli"]