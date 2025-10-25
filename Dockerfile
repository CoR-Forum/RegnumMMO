FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code, excluded via .dockerignore
COPY . .

EXPOSE 3223

CMD ["npm", "start"]