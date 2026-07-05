FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_PROGRESS=false

COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/ \
  && npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY . .

EXPOSE 8080
CMD ["npm", "start"]
