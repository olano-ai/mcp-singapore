FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY tsconfig.base.json ./
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
USER node
EXPOSE 3000
ENTRYPOINT ["node", "packages/singapore/dist/cli.js"]
CMD ["--transport", "http", "--host", "0.0.0.0", "--port", "3000"]
