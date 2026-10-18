# syntax=docker/dockerfile:1

# ==========================================
# Fase 1: Build del Frontend (Node 20 + Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY Frontend/package*.json ./
RUN npm ci --prefer-offline || npm install
COPY Frontend/ ./
ARG VITE_API_MODE=mock
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ARG VITE_API_BASE_URL=
ENV VITE_API_MODE=${VITE_API_MODE}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ==========================================
# Fase 2: Build del Backend (Temurin 21 + Maven)
# ==========================================
FROM eclipse-temurin:21-jdk-jammy AS backend-builder
WORKDIR /build
COPY Backend/mvnw ./mvnw
COPY Backend/.mvn ./.mvn
COPY Backend/pom.xml ./pom.xml
COPY Backend/src ./src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -DskipTests package

# ==========================================
# Fase 3: Runtime All-in-One (Nginx + JRE 21)
# ==========================================
FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache nginx bash curl

WORKDIR /app

RUN mkdir -p /run/nginx /usr/share/nginx/html

COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY --from=backend-builder /build/target/keptai-backend-0.0.1-SNAPSHOT.jar /app/app.jar

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV SPRING_PROFILES_ACTIVE=dev
ENV PORT=8080

EXPOSE 80 8080

ENTRYPOINT ["/app/entrypoint.sh"]