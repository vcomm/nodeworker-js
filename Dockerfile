FROM node:10

# создание директории приложения
WORKDIR /usr/src/app

# установка зависимостей
# символ астериск ("*") используется для того чтобы по возможности 
# скопировать оба файла: package.json и package-lock.json
COPY package*.json ./

RUN npm install
# Если вы создаете сборку для продакшн
# RUN npm ci --only=production

# копируем исходный код
COPY . .

# Compile backend
RUN echo compile backend
RUN npm run secure
RUN rm -r ./server
RUN rm cluster.js

# Compile frontend
RUN echo compile frontend
RUN npm run build
RUN rm -r ./public/src

EXPOSE 5555
CMD [ "node", "./dist/cluster.js", "../" ]