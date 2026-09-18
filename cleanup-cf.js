
import dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

async function cfFetch(path, init) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const resp = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return await resp.json();
}

async function cleanup() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  console.log("Fetching projects...");
  const data = await cfFetch(`/accounts/${accountId}/pages/projects`, { method: "GET" });
  
  if (!data.success) {
    console.error("Failed to fetch projects:", data.errors);
    return;
  }

  const projects = data.result || [];
  console.log(`Found ${projects.length} projects.`);

  // Filter projects created by this system (starting with 'job-')
  const toDelete = projects.filter(p => p.name.startsWith("job-"));
  console.log(`Found ${toDelete.length} system-generated projects to cleanup.`);

  for (const p of toDelete) {
    console.log(`Deleting project: ${p.name}...`);
    const del = await cfFetch(`/accounts/${accountId}/pages/projects/${p.name}`, { method: "DELETE" });
    if (del.success) {
      console.log(`Successfully deleted ${p.name}`);
    } else {
      console.error(`Failed to delete ${p.name}:`, del.errors);
    }
  }
  console.log("Cleanup finished.");
}

cleanup();
