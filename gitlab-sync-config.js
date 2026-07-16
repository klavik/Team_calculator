window.TEAM_CALCULATOR_GITLAB_SYNC = {
  // Cloudflare Worker endpoint for creating Firestore GitLab jobs.
  endpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-sync",

  // Отправка и обновление GitLab estimate для ручных задач.
  estimateEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-estimate",

  // Точный адрес Team_poker. GitHub Pages чувствителен
  // к регистру: каталог называется Team_poker.
  teamPokerBaseUrl: "https://klavik.github.io/Team_poker/",

  enabled: true,

  // Все обращения к GitLab выполняются только после явного
  // нажатия пользователем соответствующей кнопки.
  manualOnly: true
};
