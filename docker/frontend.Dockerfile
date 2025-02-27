FROM node:16
WORKDIR /app
COPY frontend/package.json .
RUN npm install
COPY frontend .
CMD ["npm", "run", "dev"]
