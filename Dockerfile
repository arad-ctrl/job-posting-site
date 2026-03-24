FROM node:20-slim

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

# Install dependencies separately to leverage Docker layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

# Copy the rest of the source code
COPY . .

EXPOSE 8080

CMD ["npm", "start"]

