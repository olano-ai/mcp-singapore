FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY tsconfig.base.json ./
COPY LICENSE ./
RUN npm ci && npm run build && npm prune --omit=dev
RUN mkdir /runtime-packages && \
  for package_dir in packages/*; do \
    package_name="${package_dir##*/}"; \
    mkdir -p "/runtime-packages/${package_name}"; \
    cp "${package_dir}/package.json" "${package_dir}/LICENSE" "/runtime-packages/${package_name}/"; \
    cp -R "${package_dir}/dist" "/runtime-packages/${package_name}/dist"; \
  done

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/LICENSE ./LICENSE
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /runtime-packages ./packages
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(async r=>{const b=await r.json();if(r.status!==404||!String(b.error).includes('/mcp'))process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "packages/singapore/dist/cli.js"]
CMD ["--transport", "http", "--host", "0.0.0.0", "--port", "3000"]
