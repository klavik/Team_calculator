window.TEAM_CALCULATOR_GITLAB_SYNC = {
  // v23.4.31:
  // GitLab jobs создаются напрямую в Firestore.
  // workers.dev больше не находится в критическом пути кнопок
  // Team_calculator. Endpoint сохраняется для совместимости и
  // определения типа job в клиенте.
  queueMode: "firestore",

  endpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-sync",

  estimateEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-estimate",

  actualPreviewEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-actual-preview",

  // Набор GitLab labels, которые Mac connector должен вернуть
  // в метаданных задачи. Пользовательские статусы расчёта факта
  // также автоматически добавляются к этому списку.
  statusLabels: [
    "In Progress",
    "Ready to PREPROD",
    "Ready to PROD",
    "Approved",
    "QA(DEV)",
    "QA(PREPROD)",
    "QA return"
  ],

  estimateLabel: "estimate::done",
  estimateHoursPerDay: 8,

  actualCalculationEnabled: true,

  teamPokerBaseUrl:
    "https://klavik.github.io/Team_poker/",

  enabled: true,
  manualOnly: true
};
