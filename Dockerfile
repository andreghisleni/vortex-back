FROM oven/bun AS build

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY bun.lock bun.lock

RUN bun install

COPY ./prisma ./prisma

RUN bun db:g
RUN bun db:m:d

COPY ./src ./src

ENV NODE_ENV=production

RUN bun build ./src/http/index.ts \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/server server

ENV NODE_ENV=production

CMD ["./server"]

EXPOSE 3000