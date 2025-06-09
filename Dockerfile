FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p src/environments && \
    echo "export const environment = {" \
    "  TESTS_BASE_URL: ''," \
    "  PATIENTS_BASE_URL: ''" \
    "};" > src/environments/environment.ts

RUN echo "export const environment = {" > src/environments/environment.prod.ts && \
    echo "  TESTS_BASE_URL: '${TESTS_BASE_URL}'," >> src/environments/environment.prod.ts && \
    echo "  PATIENTS_BASE_URL: '${PATIENTS_BASE_URL}'" >> src/environments/environment.prod.ts && \
    echo "};" >> src/environments/environment.prod.ts

RUN npx ng build --configuration=production

FROM nginx:stable-alpine

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
