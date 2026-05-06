/**
 * Read-only repo context fetcher for GitHub and GitLab public repositories.
 * Returns a formatted string with the file tree and key file contents
 * to be injected into agent system prompts as project context.
 */

const MAX_FILE_SIZE = 50_000; // 50 KB per file
const MAX_FILES = 30;
const PRIORITY_FILES = ['README.md', 'README.rst', 'readme.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md'];
const PRIORITY_DIRS = ['src', 'lib', 'app', 'core', 'docs', 'packages'];
const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor', '__pycache__'];
const CODE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.md', '.yaml', '.yml', '.json', '.toml'];

interface RepoFile {
  path: string;
  size: number;
  url: string;
}

interface GitHubTreeItem {
  path: string;
  type: string;
  size?: number;
  url: string;
}

interface GitLabTreeItem {
  id: string;
  name: string;
  path: string;
  type: 'blob' | 'tree';
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function parseGitLabUrl(url: string): { namespace: string; project: string } | null {
  const m = url.match(/gitlab\.com\/(.+?)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!m) return null;
  return { namespace: m[1], project: m[2] };
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AgentForge/1.0', 'Accept': 'application/json', ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AgentForge/1.0', ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function scoreFile(path: string): number {
  const name = path.split('/').pop() ?? '';
  if (PRIORITY_FILES.includes(name)) return 100;
  const dir = path.split('/')[0];
  if (PRIORITY_DIRS.includes(dir)) return 50;
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  if (CODE_EXTS.includes(ext)) return 10;
  return 0;
}

// ── GitHub ────────────────────────────────────────────────────────────────────

async function fetchGitHubContext(owner: string, repo: string, token?: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `token ${token}`;

  // Get default branch
  const repoMeta = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`, headers);
  const branch = repoMeta.default_branch ?? 'main';

  // Get full file tree
  const tree = await fetchJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    headers
  );

  const files: RepoFile[] = (tree.tree as GitHubTreeItem[])
    .filter(item => {
      if (item.type !== 'blob') return false;
      const parts = item.path.split('/');
      if (parts.some(p => SKIP_DIRS.includes(p))) return false;
      const ext = item.path.includes('.') ? '.' + item.path.split('.').pop() : '';
      if (!CODE_EXTS.includes(ext)) return false;
      if ((item.size ?? 0) > MAX_FILE_SIZE) return false;
      return true;
    })
    .map(item => ({ path: item.path, size: item.size ?? 0, url: item.url }))
    .sort((a, b) => scoreFile(b.path) - scoreFile(a.path))
    .slice(0, MAX_FILES);

  const fileTree = (tree.tree as GitHubTreeItem[])
    .filter(item => {
      const parts = item.path.split('/');
      return !parts.some(p => SKIP_DIRS.includes(p));
    })
    .map(item => `${item.type === 'tree' ? 'd' : 'f'} ${item.path}`)
    .join('\n');

  const sections: string[] = [`=== File Tree ===\n${fileTree}\n`];

  for (const file of files) {
    try {
      const blob = await fetchJson(file.url, headers);
      const content = Buffer.from(blob.content, 'base64').toString('utf-8');
      sections.push(`=== ${file.path} ===\n${content.slice(0, MAX_FILE_SIZE)}`);
    } catch {
      // skip unreadable files
    }
  }

  return sections.join('\n\n');
}

// ── GitLab ────────────────────────────────────────────────────────────────────

async function fetchGitLabContext(namespace: string, project: string, token?: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (token) headers['PRIVATE-TOKEN'] = token;

  const encodedPath = encodeURIComponent(`${namespace}/${project}`);
  const projMeta = await fetchJson(`https://gitlab.com/api/v4/projects/${encodedPath}`, headers);
  const branch = projMeta.default_branch ?? 'main';

  // Fetch tree recursively (paginated)
  const treeItems: GitLabTreeItem[] = [];
  for (let page = 1; page <= 5; page++) {
    const items: GitLabTreeItem[] = await fetchJson(
      `https://gitlab.com/api/v4/projects/${encodedPath}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${branch}`,
      headers
    );
    treeItems.push(...items);
    if (items.length < 100) break;
  }

  const fileTree = treeItems
    .filter(item => {
      const parts = item.path.split('/');
      return !parts.some(p => SKIP_DIRS.includes(p));
    })
    .map(item => `${item.type === 'tree' ? 'd' : 'f'} ${item.path}`)
    .join('\n');

  const files = treeItems
    .filter(item => {
      if (item.type !== 'blob') return false;
      const parts = item.path.split('/');
      if (parts.some(p => SKIP_DIRS.includes(p))) return false;
      const ext = item.path.includes('.') ? '.' + item.path.split('.').pop() : '';
      return CODE_EXTS.includes(ext);
    })
    .sort((a, b) => scoreFile(b.path) - scoreFile(a.path))
    .slice(0, MAX_FILES);

  const sections: string[] = [`=== File Tree ===\n${fileTree}\n`];

  for (const file of files) {
    try {
      const encodedFile = encodeURIComponent(file.path);
      const content = await fetchText(
        `https://gitlab.com/api/v4/projects/${encodedPath}/repository/files/${encodedFile}/raw?ref=${branch}`,
        headers
      );
      sections.push(`=== ${file.path} ===\n${content.slice(0, MAX_FILE_SIZE)}`);
    } catch {
      // skip
    }
  }

  return sections.join('\n\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchRepoContext(repoUrl: string, token?: string): Promise<string> {
  const gh = parseGitHubUrl(repoUrl);
  if (gh) return fetchGitHubContext(gh.owner, gh.repo, token);

  const gl = parseGitLabUrl(repoUrl);
  if (gl) return fetchGitLabContext(gl.namespace, gl.project, token);

  throw new Error(`Unsupported repo URL: ${repoUrl}. Supported: github.com, gitlab.com`);
}
