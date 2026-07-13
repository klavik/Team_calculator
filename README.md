# Калькулятор ёмкости команды — установка через Firebase Console

Эта версия не требует административного SDK, Node.js, service account или вспомогательных скриптов.

## Состав комплекта

```text
index.html
firebase-config.js
firestore.rules
README.md
```

## Как устроено хранение

```text
Firebase Authentication
└── пользователь
    ├── email
    ├── пароль
    ├── UID
    └── состояние enabled/disabled

Cloud Firestore
└── users/{uid}
    ├── email
    ├── alias
    ├── role
    ├── active
    ├── app/main
    └── sprints/{sprintId}
```

Пароль хранится только в Firebase Authentication. В Firestore находятся профиль и данные калькулятора.

---

## 1. Создать проект Firebase

1. Откройте Firebase Console.
2. Нажмите **Create project / Создать проект**.
3. Укажите название, например:

```text
team-capacity-calculator
```

4. Google Analytics можно не включать.
5. Дождитесь создания проекта.

## 2. Зарегистрировать Web App

1. Откройте созданный проект.
2. В разделе **Project overview** нажмите значок `</>`.
3. Укажите название приложения, например:

```text
Team Capacity Calculator
```

4. Нажмите **Register app**.
5. Firebase покажет конфигурацию примерно такого вида:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "team-capacity-calculator.firebaseapp.com",
  projectId: "team-capacity-calculator",
  storageBucket: "team-capacity-calculator.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## 3. Заполнить `firebase-config.js`

Откройте `firebase-config.js` и замените значения `REPLACE_ME`:

```javascript
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "team-capacity-calculator.firebaseapp.com",
  projectId: "team-capacity-calculator",
  storageBucket: "team-capacity-calculator.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

Этот файл является конфигурацией Web App и размещается рядом с `index.html`.

## 4. Включить вход по email и паролю

В Firebase Console:

1. Перейдите в **Build → Authentication**.
2. Нажмите **Get started**.
3. Откройте **Sign-in method**.
4. Выберите **Email/Password**.
5. Включите обычный режим **Email/Password**.
6. Режим `Email link` включать не нужно.
7. Нажмите **Save**.

Публичной регистрации в приложении нет. Пользователи создаются только вручную в Firebase Console.

## 5. Создать Cloud Firestore

1. Перейдите в **Build → Firestore Database**.
2. Нажмите **Create database**.
3. Выберите **Production mode**.
4. Выберите подходящий регион.
5. Завершите создание базы.

## 6. Опубликовать правила Firestore

1. Откройте **Firestore Database → Rules**.
2. Откройте файл `firestore.rules` из комплекта.
3. Скопируйте его содержимое в редактор Firebase.
4. Нажмите **Publish**.

Правила разрешают пользователю:

- читать свой профиль;
- изменять только свой псевдоним;
- читать и изменять своё состояние калькулятора;
- читать и изменять свои спринты.

Создание и удаление профилей из браузерного приложения запрещено.

---

# Создание пользователей

## 7. Создать учётную запись в Authentication

Откройте:

```text
Authentication → Users
```

Нажмите:

```text
Add user
```

Введите:

```text
Email: user@example.com
Password: начальный пароль
```

Нажмите **Add user**.

После создания скопируйте значение **User UID**.

Пример:

```text
aBcDeFg123456
```

## 8. Создать профиль в Firestore

Откройте:

```text
Firestore Database → Data
```

Если коллекции `users` ещё нет:

1. Нажмите **Start collection**.
2. Collection ID:

```text
users
```

3. Document ID — вставьте UID пользователя:

```text
aBcDeFg123456
```

Добавьте поля:

| Поле | Тип | Пример |
|---|---|---|
| `email` | string | `user@example.com` |
| `alias` | string | `Руководитель команды` |
| `role` | string | `user` |
| `active` | boolean | `true` |

Псевдоним необязателен. Можно указать пустую строку:

```text
alias = ""
```

Важно:

- ID документа должен точно совпадать с UID из Authentication;
- `email` должен совпадать с email пользователя;
- поля `role` и `active` должны присутствовать.

Пример:

```text
users
└── aBcDeFg123456
    ├── email: "user@example.com"
    ├── alias: "Руководитель команды"
    ├── role: "user"
    └── active: true
```

## 9. Создать следующих пользователей

Для каждого нового пользователя повторите:

```text
1. Authentication → Users → Add user
2. Скопировать User UID
3. Firestore → users → создать документ с ID = User UID
4. Заполнить email, alias, role и active
```

---

# Проверка и публикация

## 10. Проверить локально

Запустите простой HTTP-сервер:

```bash
cd /путь/к/team_capacity_firebase_console_setup
python3 -m http.server 8080
```

Откройте:

```text
http://localhost:8080
```

Открывать `index.html` через `file://` не рекомендуется.

Если вход блокируется:

1. Откройте **Authentication → Settings**.
2. Найдите **Authorized domains**.
3. Добавьте:

```text
localhost
```

Для остановки сервера нажмите:

```text
Ctrl+C
```

## 11. Разместить на GitHub Pages

В репозиторий загрузите:

```text
index.html
firebase-config.js
```

Файл `firestore.rules` можно хранить там же как резервную копию правил.

В GitHub:

1. Откройте **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main`.
4. Folder: `/root`.
5. Сохраните.

Адрес будет выглядеть примерно так:

```text
https://USERNAME.github.io/REPOSITORY/
```

## 12. Разрешить домен GitHub Pages

В Firebase Console:

1. Откройте **Authentication → Settings**.
2. Найдите **Authorized domains**.
3. Добавьте:

```text
USERNAME.github.io
```

Путь репозитория добавлять не нужно.

Правильно:

```text
USERNAME.github.io
```

Неправильно:

```text
USERNAME.github.io/REPOSITORY
```

---

# Работа с учётной записью

## 13. Первый вход

Введите email и начальный пароль, созданные в Authentication.

После входа приложение:

1. получает UID из Firebase Authentication;
2. читает профиль `users/{uid}`;
3. загружает состояние из `users/{uid}/app/main`;
4. загружает спринты из `users/{uid}/sprints`.

При первом входе `app/main` и `sprints` могут отсутствовать. Они появятся после изменения настроек и сохранения первого спринта.

## 14. Изменение псевдонима

В приложении:

1. Нажмите **Профиль и пароль**.
2. Измените поле **Псевдоним**.
3. Нажмите **Сохранить псевдоним**.

Изменяется поле:

```text
users/{uid}.alias
```

Пользователь не может изменить через приложение email, роль или статус.

## 15. Изменение пароля

В приложении:

1. Нажмите **Профиль и пароль**.
2. Введите текущий пароль.
3. Введите новый пароль.
4. Повторите новый пароль.
5. Нажмите **Изменить пароль**.

Приложение повторно проверяет текущий пароль и обновляет пароль через Firebase Authentication.

## 16. Отключение пользователя

Для полного отключения:

### Authentication

1. Откройте **Authentication → Users**.
2. Выберите пользователя.
3. Отключите или удалите его учётную запись.

### Firestore

В документе:

```text
users/{uid}
```

установите:

```text
active = false
```

Приложение не разрешит работу пользователю с `active = false`.

## 17. Удаление пользователя

1. Удалите пользователя в **Authentication → Users**.
2. Удалите документ `users/{uid}`.
3. Удалите его подколлекции:
   - `app`;
   - `sprints`.

Удаление пользователя из Authentication автоматически не удаляет документы Firestore.

---

# Контрольный список

- [ ] создан Firebase project;
- [ ] зарегистрирован Web App;
- [ ] заполнен `firebase-config.js`;
- [ ] включён Email/Password;
- [ ] создан Cloud Firestore;
- [ ] опубликованы правила из `firestore.rules`;
- [ ] пользователь создан в Authentication;
- [ ] скопирован его UID;
- [ ] создан документ `users/{uid}`;
- [ ] заполнены `email`, `alias`, `role`, `active`;
- [ ] добавлен домен приложения в Authorized domains;
- [ ] приложение открывается через HTTP или HTTPS.
