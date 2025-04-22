# Your existing setup...
FROM node:18

RUN npm install --global sfdx-cli

# ✅ Use compatible scanner version (v3.17.0)
RUN sfdx plugins:install @salesforce/sfdx-scanner@3.17.0

# Optionally disable auto updates for stability
ENV SFDX_DISABLE_AUTOUPDATE=true

COPY . /app
WORKDIR /app

EXPOSE 8080

CMD ["node", "index.js"]
