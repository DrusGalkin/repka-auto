# Проверки 2026-11-09

- Python unittest: 4/4 passed.
- Демо HTTP: /api/state содержит 17 метрик; / возвращает HTML, 200.
- python-OBD 0.7.3: все используемые команды присутствуют; единицы percent доступны.
- React Native TypeScript: tsc --noEmit passed.
- BLE decoder: 3/3 Node tests passed (фрагментация, потеря/смешивание пакетов, схема данных).
- Expo SDK 55: Android prebuild passed; разрешения BLUETOOTH_SCAN/CONNECT присутствуют в Manifest.
- Expo export --platform android: JS/Hermes bundle успешно собран, 583 модуля.
- Полноценная Gradle/APK-сборка, iOS-сборка, BlueZ на ARM64, OBD2 и BLE с физическими устройствами не проверены.
- npm audit: 12 замечаний в дереве Expo; подробности и ограничения указаны в README.
