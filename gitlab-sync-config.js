window.TEAM_CALCULATOR_GITLAB_SYNC = {
  // Cloudflare Worker endpoint for creating Firestore GitLab jobs.
  endpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-sync",

  // Отправка и обновление GitLab estimate для ручных задач.
  estimateEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-estimate",

  // Расчёт предварительного факта по истории GitLab labels.
  actualPreviewEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-actual-preview",

  // Быстрое отключение нового модуля без отката файлов.
  // false полностью возвращает прежний расчёт факта по выполненным задачам.
  actualCalculationEnabled: true,

  // Точный адрес Team_poker. GitHub Pages чувствителен
  // к регистру: каталог называется Team_poker.
  teamPokerBaseUrl: "https://klavik.github.io/Team_poker/",

  enabled: true,

  // Все обращения к GitLab — метаданные, estimate и расчёт факта —
  // выполняются только после явного нажатия пользователем кнопки.
  manualOnly: true
};
