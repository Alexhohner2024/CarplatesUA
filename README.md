## CarplatesUA — деплой и проверка на Fly.io

### Предварительные требования (macOS)
- Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- Добавить brew в PATH:
  - `echo >> ~/.zprofile`
  - `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile`
  - `eval "$((/opt/homebrew/bin/brew shellenv))"` — либо открыть новый терминал
- Fly CLI: `brew install flyctl`
- Логин: `flyctl auth login`

### Деплой
```bash
cd /Users/alex/Documents/GitHub/CarplatesUA-1
flyctl deploy
```

### Конфигурация Fly (важное)
- `fly.toml`:
  - `[http_service] internal_port = 8080`
  - `auto_stop_machines = false` — машина не будет авто-останавливаться
  - `auto_start_machines = true`
  - `min_machines_running = 1` — держим минимум 1 машину
- `bot.mjs` поднимает простой HTTP health-сервер на 8080 для health-check.

### Запуск/статус/логи
```bash
# Статус приложения и машин
flyctl status
flyctl machines list

# Запуск машины вручную (если stopped)
flyctl machines start <MACHINE_ID>

# Логи
flyctl logs -a carplatesua
```

### Проверка
- Открыть `https://carplatesua.fly.dev/` — должен вернуть `OK` (ответ health-сервера)
- В логах видеть строки:
  - `Bot started...`
  - `Health server listening on port 8080`

### Типичные проблемы
- Машина уходит в `stopped`:
  - Проверьте, что в `fly.toml` стоит `auto_stop_machines = false`
  - Убедитесь, что health-сервер запущен (лог: `Health server listening on port 8080`)
  - Запустите: `flyctl machines start <MACHINE_ID>`

### Обновление кода
```bash
# Внести изменения → коммит → пуш
git add -A
git commit -m "change"
git push origin main

# Затем деплой
flyctl deploy
```


