# ffmpeg is the whole reason this container exists, so it comes from a base
# that already has it rather than an apt-get that has to be kept working.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY assets ./assets

# No port: this polls a table rather than listening. Deploy it as a worker
# process, not a web service.
CMD ["node", "index.js"]
