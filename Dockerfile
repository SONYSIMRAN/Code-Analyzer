FROM node:20



# Install Salesforce CLI & Scanner Plugin
# RUN npm install --global sfdx-cli && \
#     sfdx plugins:install @salesforce/sfdx-scanner

# ...
RUN sfdx plugins:uninstall @salesforce/sfdx-scanner && \
    sfdx plugins:install @salesforce/sfdx-scanner@3.17.0
# ...


# Set working directory
WORKDIR /usr/src/app

# Copy package files and install deps
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Expose port
EXPOSE 8080

# Run the app
CMD ["node", "index.js"]
