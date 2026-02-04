export default {
  async scheduled(event, env, ctx) {
	  
	// github token
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) return;

    // config.json
    const configJson = await env.GH_WORKFLOW_KEEPALIVE.get("config.json");
    if (!configJson) return;

    const { orgs = [], users = [] } = JSON.parse(configJson);

    const repoFetchers = [
      ...orgs.map(org => ({
        name: `org:${org}`,
        url: page => `https://api.github.com/orgs/${org}/repos?type=all&per_page=100&page=${page}`
      })),
      ...users.map(user => ({
        name: `user:${user}`,
        url: page => `https://api.github.com/users/${user}/repos?type=all&per_page=100&page=${page}`
      }))
    ];

    // iterate all orgs and users
    for (const src of repoFetchers) {
      let page = 1;
      let repos = [];

      // fetch all repos 
      while (true) {
        const res = await fetch(src.url(page), {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "gh-workflow-keepalive",
          },
        });

        if (!res.ok) break;

        const data = await res.json();
        if (!data.length) break;

        repos.push(...data);
        page++;
      }

      await processRepos(repos, GITHUB_TOKEN);
    }
  },
};

async function processRepos(repos, GITHUB_TOKEN) {
  for (const repo of repos) {
    const workflowsRes = await fetch(
      `https://api.github.com/repos/${repo.full_name}/actions/workflows`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "gh-workflow-keepalive",
        },
      }
    );

    if (!workflowsRes.ok) continue;

    const { workflows = [] } = await workflowsRes.json();

    for (const wf of workflows) {
      const res = await fetch(
        `https://api.github.com/repos/${repo.full_name}/actions/workflows/${wf.id}/enable`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "gh-workflow-keepalive",
          },
        }
      );
    }
  }
}
