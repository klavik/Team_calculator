window.TEAM_CALCULATOR_GITLAB_SYNC = {
  // Cloudflare Worker endpoint for creating Firestore GitLab jobs.
  endpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-sync",

  // Отправка и обновление GitLab estimate для ручных задач.
  estimateEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-estimate",

  // Адрес Team_poker для ссылок из общего пула и спринта.
  // Относительный путь рассчитан на соседние GitHub Pages:
  // /team_calculator/ → /team_poker/
  teamPokerBaseUrl: "../team_poker/",

  enabled: true,

  // One automatic request when a sprint is opened and its data is stale.
  // There is no continuous polling from the browser.
  autoSyncOnOpen: true,

  // Do not create an automatic job when all GitLab data is newer than this.
  staleAfterMinutes: 10
};
