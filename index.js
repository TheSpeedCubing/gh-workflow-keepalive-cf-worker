import yaml from 'js-yaml';

export default {
  async scheduled(event, env, ctx) {
    console.log("Worker triggered by cron:", event.cron);

    // Get workflows.yml from KV
    const workflowsYml = await env.SCHEDULE_WORKFLOWS.get("workflows.yml");
    if (!workflowsYml) {
      console.error("workflows.yml not found in KV!");
      return;
    }

    let config;
    try {
      config = yaml.load(workflowsYml);
    } catch (e) {
      console.error("Failed to parse YAML:", e);
      return;
    }

    const repos = Object.keys(config.repos || {});
    if (!repos.length) {
      console.log("No repositories found in workflows.yml");
      return;
    }

    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      console.error("GITHUB_TOKEN not set in Worker secrets");
      return;
    }

    for (const repo of repos) {
      const workflows = config.repos[repo];
      for (const wf of workflows) {
        console.log(`Enabling workflow ${wf} in repository ${repo}...`);
        try {
          const response = await fetch(
            `https://api.github.com/repos/${repo}/actions/workflows/${wf}/enable`,
            {
              method: 'PUT',
              headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github+json"
              }
            }
          );

          if (response.status === 204) {
            console.log(`Success: ${wf} enabled in ${repo}`);
          } else {
            console.error(`Failed: ${wf} in ${repo}, HTTP code ${response.status}`);
          }
        } catch (err) {
          console.error(`Error enabling ${wf} in ${repo}:`, err);
        }
      }
    }
  }
};
