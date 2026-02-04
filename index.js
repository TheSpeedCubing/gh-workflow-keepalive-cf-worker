export default {
  async scheduled(event, env, ctx) {
	  
	// github token
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      console.error("[ERROR] Missing GITHUB_TOKEN");
      return;
    }

    // config.json
    const configJson = await env.GH_WORKFLOW_KEEPALIVE.get("config.json");
    if (!configJson) {
      console.error("[ERROR] Missing configJson");
      return;
    }

    let orgs = [], users = [];
    try {
      ({ orgs = [], users = [] } = JSON.parse(configJson));
    } catch (e) {
      console.error("[ERROR] Invalid JSON config", e);
      return;
    }

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
    console.log(`[REPO] ${repo.full_name}`);
	
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

    if (!workflowsRes.ok) {
      console.error(`[ERROR] Workflows fetch failed ${repo.full_name} status=${workflowsRes.status}`);
      continue;
    }

    const { workflows = [] } = await workflowsRes.json();

    for (const wf of workflows) {
      console.log(`[WF] Enabling "${wf.name}" (${wf.id})`);

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
      
	  const text = await res.text();
      if (res.status === 204) {
        console.log(`[OK] Enabled "${wf.name}" in ${repo.full_name}`);
      } else {
        console.error(
          `[FAIL] Enable "${wf.name}" in ${repo.full_name} status=${res.status} body=${text}`
        );
      }
    }
  }
}