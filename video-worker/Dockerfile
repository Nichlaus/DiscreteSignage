FROM node:24-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY decode.mjs server.mjs ./
COPY decode.test.mjs server.test.mjs ./
RUN node --test decode.test.mjs server.test.mjs && rm decode.test.mjs server.test.mjs
USER node
ENV PORT=8080
CMD ["node", "server.mjs"]
