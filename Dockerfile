# 유니 타임즈 — NAS(시놀로지 등)·서버에서 도커로 실행
# 외부 패키지가 없어 Node만 있으면 됩니다. 자료는 /data 볼륨에 저장돼요.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js data-seed.json ./
COPY lib ./lib
COPY public ./public
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data TZ=Asia/Seoul
# su-exec: 시작할 때 자료 폴더 권한을 맞춘 뒤, 일반 사용자(node)로 서버를 돌린다
# (시놀로지에서 폴더를 연결하면 폴더 주인이 달라 '쓰기 권한 없음'으로 멈추는 일을 막음)
RUN apk add --no-cache tzdata su-exec && mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/me >/dev/null || exit 1
CMD ["sh", "-c", "chown -R node:node /data 2>/dev/null; exec su-exec node node server.js"]
