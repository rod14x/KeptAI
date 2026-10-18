# syntax=docker/dockerfile:1
# Contexto de build: Backend/. Sin secretos ni artefactos locales.
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /build
COPY --chmod=0755 mvnw ./mvnw
COPY .mvn ./.mvn
COPY pom.xml ./pom.xml
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
RUN groupadd --gid 10001 keptai && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin keptai
COPY --from=build --chown=10001:10001 /build/target/keptai-backend-0.0.1-SNAPSHOT.jar ./app.jar
USER 10001:10001
ENV SPRING_PROFILES_ACTIVE=dev
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
