# syntax=docker/dockerfile:1

FROM node:20.19.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc .node-version ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm run build:server

FROM node:20.19.0-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json .npmrc .node-version ./
RUN npm ci --omit=dev

COPY --from=build /app/dist-server/index.mjs ./index.mjs
COPY --from=build /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000; fetch('http://127.0.0.1:'+port+'/healthz').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.mjs"]
