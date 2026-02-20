# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

RUN npm run build

# ---- prod stage ----
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

# Render supplies PORT; EXPOSE is optional but fine
EXPOSE 3000

CMD ["node", "dist/main.js"]