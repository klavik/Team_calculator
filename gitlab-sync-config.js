window.TEAM_CALCULATOR_GITLAB_SYNC = {
  // v23.4.32:
  // GitLab jobs создаются напрямую в Firestore.
  queueMode: "firestore",

  endpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-sync",

  estimateEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-estimate",

  actualPreviewEndpoint:
    "https://team-poker-team-calculator-integration.slavanazin.workers.dev/gitlab-actual-preview",

  // Полный канонический набор GitLab labels, отображаемых в колонке
  // «Статус GitLab». Значения должны совпадать с labels буквально.
  statusLabels: [
    "Backlog",
    "Open",
    "In Progress",
    "On Hold",
    "Review",
    "Approved",
    "QA (DEV)",
    "Ready to PREPROD",
    "QA (PREPROD)",
    "Ready to PROD",
    "QA return",
    "GOA return"
  ],

  estimateLabel: "estimate::done",
  estimateHoursPerDay: 8,

  actualCalculationEnabled: true,

  teamPokerBaseUrl:
    "https://klavik.github.io/Team_poker/",

  enabled: true,
  manualOnly: true
};
