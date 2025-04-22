# Use Node base image with Debian to install Java easily
FROM node:18-bullseye

# Install Java (OpenJDK 11)
RUN apt-get update && \
    apt-get install -y openjdk-11-jdk && \
    apt-get clean;

# Install Salesforce CLI
RUN npm install --global sfdx-cli

# Install Salesforce Code Analyzer plugin
RUN sfdx plugins:install @salesforce/sfdx-scanner@3.17.0

# Set JAVA_HOME explicitly (required by scanner)
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Expose the server port
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]
