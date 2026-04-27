# Use the latest Node.js runtime as a parent image
FROM node:24-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json .

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

VOLUME /mnt /config

# Run the script
CMD ["node", "dist/index.js"]
