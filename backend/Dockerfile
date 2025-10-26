FROM node:lts-alpine3.21

WORKDIR /backend

COPY package*.json  .

RUN npm install
RUN npm install cors
COPY . .

EXPOSE 3000

CMD [ "node", "server.js" ]
