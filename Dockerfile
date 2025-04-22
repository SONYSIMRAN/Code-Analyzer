# Use the official Node.js base image
FROM node:18

# Install Salesforce CLI
RUN npm install --global sfdx-cli

# Install SFDX Scanner Plugin
RUN sfdx plugins:install @salesforce/sfdx-scanner@3.17.0

# Create app directory
WORKDIR /app

# Copy app source code to container
COPY . .

# Install Node.js dependencies
RUN npm install

# Expose the app port
EXPOSE 8080

# Run the app
CMD ["node", "index.js"]
