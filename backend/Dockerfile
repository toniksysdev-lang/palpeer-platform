# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY pom.xml .
COPY palpeer-common/pom.xml palpeer-common/
COPY palpeer-auth/pom.xml palpeer-auth/
COPY palpeer-user/pom.xml palpeer-user/
COPY palpeer-profile/pom.xml palpeer-profile/
COPY palpeer-kyc/pom.xml palpeer-kyc/
COPY palpeer-wallet/pom.xml palpeer-wallet/
COPY palpeer-ledger/pom.xml palpeer-ledger/
COPY palpeer-currency/pom.xml palpeer-currency/
COPY palpeer-exchange/pom.xml palpeer-exchange/
COPY palpeer-p2p/pom.xml palpeer-p2p/
COPY palpeer-negotiation/pom.xml palpeer-negotiation/
COPY palpeer-chat/pom.xml palpeer-chat/
COPY palpeer-transaction/pom.xml palpeer-transaction/
COPY palpeer-notification/pom.xml palpeer-notification/
COPY palpeer-card/pom.xml palpeer-card/
COPY palpeer-promotion/pom.xml palpeer-promotion/
COPY palpeer-security/pom.xml palpeer-security/
COPY palpeer-admin/pom.xml palpeer-admin/
COPY palpeer-audit/pom.xml palpeer-audit/
COPY palpeer-app/pom.xml palpeer-app/

RUN apk add --no-cache maven \
    && mvn -B -q -DskipTests dependency:go-offline || true

COPY . .
RUN mvn -B -pl palpeer-app -am -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S palpeer && adduser -S palpeer -G palpeer
USER palpeer

COPY --from=build /workspace/palpeer-app/target/palpeer-app-*.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=dev \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
