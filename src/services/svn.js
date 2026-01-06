import axios from 'axios';
import { svnCacheGetMeta, svnCacheWriteChunk } from './cache'

// SVN WebDAV interactions are tricky from the browser due to CORS and XML parsing.
// We will assume the server supports OPTIONS/PROPFIND/REPORT or we can fetch the log via custom command if available.
// Standard WebDAV 'REPORT' method is used for log-report.

export const createSvnClient = (baseUrl, username, password) => {
  return axios.create({
    baseURL: baseUrl,
    auth: {
      username,
      password
    },
    // transformResponse: [data => data] // Keep raw XML
  });
};

export const fetchSvnLog = async (client, limit = 100, options = {}) => {
    const maxEntries = (limit && limit > 0) ? limit : null; // null = fetch all
    const pageSize = Math.max(1, Math.min(options.pageSize || 2000, 5000));
    let baseUrl = client.defaults.baseURL;
    if (baseUrl && !String(baseUrl).endsWith('/')) baseUrl = `${baseUrl}/`
    const auth = client.defaults.auth;

    // Helper to make requests (bridged or direct)
    const makeRequest = async (method, url, data, headers = {}) => {
        if (window.electronAPI && window.electronAPI.svnRequest) {
            const result = await window.electronAPI.svnRequest({
                method,
                url,
                username: auth?.username,
                password: auth?.password,
                data,
                headers
            });
            if (!result.success) throw new Error(result.error + (result.details ? ` (${result.details})` : ''));
            return { data: result.data, status: result.status, headers: result.headers };
        } else {
            // Browser Direct (CORS likely an issue)
            const response = await client.request({
                method,
                url,
                data,
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    ...headers
                }
            });
            return response;
        }
    };

    console.log(`[SVN] Starting log fetch for: ${baseUrl}`);

    const parser = new DOMParser();
    const origin = (() => {
        try { return new URL(baseUrl).origin; } catch (e) { console.warn('[svn] Invalid URL:', baseUrl, e); return ''; }
    })();

    const toAbsoluteUrl = (href) => {
        if (!href) return null;
        try {
            // Already absolute?
            return new URL(href).toString();
        } catch {
            if (!origin) return href;
            // Ensure href starts with /
            const path = href.startsWith('/') ? href : `/${href}`;
            return `${origin}${path}`;
        }
    };

    const extractFirstHrefForProp = (xmlDoc, propLocalName) => {
        // Find any element like <D:checked-in> or <D:version-controlled-configuration>
        const all = xmlDoc.getElementsByTagName('*');
        for (let i = 0; i < all.length; i++) {
            const el = all[i];
            if (el.localName === propLocalName) {
                // Look for <D:href> inside
                const children = el.getElementsByTagName('*');
                for (let j = 0; j < children.length; j++) {
                    if (children[j].localName === 'href' && children[j].textContent) {
                        return children[j].textContent.trim();
                    }
                }
            }
        }
        return null;
    };

    const extractFirstTextForLocalName = (xmlDoc, localName) => {
        const all = xmlDoc.getElementsByTagName('*');
        for (let i = 0; i < all.length; i++) {
            const el = all[i];
            if (el.localName === localName && el.textContent) {
                return el.textContent.trim();
            }
        }
        return null;
    };

    // 1) Resolve numeric HEAD revision using DeltaV properties (VCC -> checked-in baseline -> version-name)
    let latestRevision = 'HEAD';
    try {
        // PROPFIND the resource for VCC
        const vccPropfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:version-controlled-configuration/>
  </D:prop>
</D:propfind>`;

        console.log('[SVN] PROPFIND VCC (Depth:0)...');
        const vccResp = await makeRequest('PROPFIND', baseUrl, vccPropfindBody, { Depth: '0' });
        if (vccResp.status === 404) throw new Error(`Resource not found at ${baseUrl}`);

        const vccDoc = parser.parseFromString(vccResp.data, 'text/xml');
        const vccHref = extractFirstHrefForProp(vccDoc, 'version-controlled-configuration');
        const vccUrl = toAbsoluteUrl(vccHref);
        if (!vccUrl) throw new Error('Could not resolve VCC URL from PROPFIND response');
        console.log('[SVN] VCC:', vccUrl);

        // PROPFIND VCC for checked-in baseline
        const checkedInBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:checked-in/>
  </D:prop>
</D:propfind>`;

        console.log('[SVN] PROPFIND checked-in baseline (Depth:0)...');
        const checkedResp = await makeRequest('PROPFIND', vccUrl, checkedInBody, { Depth: '0' });
        const checkedDoc = parser.parseFromString(checkedResp.data, 'text/xml');
        const baselineHref = extractFirstHrefForProp(checkedDoc, 'checked-in');
        const baselineUrl = toAbsoluteUrl(baselineHref);
        if (!baselineUrl) throw new Error('Could not resolve checked-in baseline URL from PROPFIND response');
        console.log('[SVN] Baseline:', baselineUrl);

        // Resolve revision from baseline URL directly (avoids extra PROPFIND that can hang on some servers)
        // Example baseline URL: https://host/repo/!svn/bln/164694
        const m = baselineUrl.match(/\/!svn\/bln\/(\d+)(?:\/)?$/);
        if (m && m[1]) {
            latestRevision = m[1];
            console.log(`[SVN] Resolved HEAD revision from baseline URL: ${latestRevision}`);
        } else {
            // Fallback: PROPFIND baseline for version-name (revision number)
            const versionNameBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:version-name/>
  </D:prop>
</D:propfind>`;

            console.log('[SVN] PROPFIND version-name (Depth:0)...');
            const versionResp = await makeRequest('PROPFIND', baselineUrl, versionNameBody, { Depth: '0' });
            const versionDoc = parser.parseFromString(versionResp.data, 'text/xml');
            const headRev = extractFirstTextForLocalName(versionDoc, 'version-name');
            if (headRev && /^\d+$/.test(headRev)) {
                latestRevision = headRev;
                console.log(`[SVN] Resolved HEAD revision to: ${latestRevision}`);
            } else {
                console.log('[SVN] Could not resolve numeric HEAD revision, falling back to "HEAD"');
            }
        }
    } catch (e) {
        console.warn('[SVN] HEAD resolution failed, falling back to "HEAD":', e.message);
    }

    // 2) REPORT in pages to avoid huge single responses
    const requestedHead = latestRevision;
    let startRev = /^\d+$/.test(String(latestRevision)) ? Number(latestRevision) : null;
    const seenRevs = new Set();
    const onPage = typeof options.onPage === 'function' ? options.onPage : null;
    const shouldWriteCache = !!(options.cacheRepoUrl && window.electronAPI && window.electronAPI.svnCacheWriteChunk);
    const cachedMeta = shouldWriteCache ? await svnCacheGetMeta(options.cacheRepoUrl) : null;
    const stopAtRevision = Number.isFinite(Number(options.stopAtRevision)) ? Number(options.stopAtRevision)
      : (cachedMeta && Number.isFinite(Number(cachedMeta.newestRev)) ? Number(cachedMeta.newestRev) : null);

    const reportPage = async (startRevision, pageLimit) => {
        const reportBody = `<?xml version="1.0" encoding="utf-8"?>
<S:log-report xmlns:S="svn:" xmlns:D="DAV:">
<S:start-revision>${startRevision}</S:start-revision>
<S:end-revision>0</S:end-revision>
<S:limit>${pageLimit}</S:limit>
<S:discover-changed-paths/>
</S:log-report>`;

        // Remove Depth header entirely for REPORT as per SVN specs
        const headers = {};
        const response = await makeRequest('REPORT', baseUrl, reportBody, headers);
        if (options.debug) {
            console.log(`[SVN] REPORT status: ${response.status}`);
            console.log('SVN Raw Response:', String(response.data).substring(0, 500) + '...');
        }
        return parseSvnXml(response.data);
    };

    try {
        // If we couldn't resolve numeric HEAD, fall back to string HEAD but still page via limit
        if (startRev === null) startRev = requestedHead;

        let page = 0;
        let total = 0;
        while (true) {
            page++;
            if (options.onProgress) {
                options.onProgress(`SVN: fetching page ${page} (${total}${maxEntries ? ` / ${maxEntries}` : ''})`);
            }

            const pageLimit = maxEntries ? Math.min(pageSize, maxEntries - total) : pageSize;
            if (pageLimit <= 0) break;

            console.log(`[SVN] REPORT page ${page}: ${startRev} -> 0 (limit ${pageLimit})`);
            const pageCommitsRaw = await reportPage(startRev, pageLimit);
            const pageCommits = [];
            let hitStop = false;
            for (const c of (pageCommitsRaw || [])) {
                const revNum = c && c.revision != null ? Number(c.revision) : NaN;
                if (!Number.isFinite(revNum)) continue;
                if (stopAtRevision != null && revNum <= stopAtRevision) {
                    hitStop = true;
                    continue;
                }
                const revKey = String(revNum);
                if (seenRevs.has(revKey)) continue;
                seenRevs.add(revKey);
                pageCommits.push(c);
            }
            if (!pageCommits || pageCommits.length === 0) break;

            total += pageCommits.length;

            if (shouldWriteCache) {
                const first = pageCommits[0];
                const last = pageCommits[pageCommits.length - 1];
                const chunk = {
                    startRev: Number(first.revision),
                    endRev: Number(last.revision),
                    commits: pageCommits
                };
                await svnCacheWriteChunk(options.cacheRepoUrl, chunk);
            }

            if (onPage) await onPage(pageCommits);

            if (maxEntries && total >= maxEntries) break;
            if (hitStop) break;

            const oldest = pageCommitsRaw && pageCommitsRaw.length ? pageCommitsRaw[pageCommitsRaw.length - 1] : null;
            const oldestRev = oldest && oldest.revision != null ? Number(oldest.revision) : NaN;
            if (!Number.isFinite(oldestRev) || oldestRev <= 0) break;
            startRev = oldestRev - 1;
        }

        if (options.onProgress) {
            options.onProgress(`SVN: done (${total} revisions)`);
        }
        return { total, stopAtRevision: stopAtRevision || null };
    } catch (error) {
        console.error('SVN Fetch Error:', error);
        throw new Error(`Failed to fetch SVN log: ${error.message}`);
    }
};

const parseSvnXml = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    // Debug: Log XML structure
    // console.log('Parsed XML:', xmlDoc);

    // Try finding log entries with various namespace approaches
    let entries = xmlDoc.getElementsByTagName("log-entry");
    if (entries.length === 0) entries = xmlDoc.getElementsByTagName("S:log-entry");
    if (entries.length === 0) entries = xmlDoc.getElementsByTagName("D:log-entry");
    if (entries.length === 0) entries = xmlDoc.getElementsByTagName("S:log-item"); // Fallback for log-item
    if (entries.length === 0) entries = xmlDoc.getElementsByTagName("log-item"); // Fallback for log-item

    // Fallback: iterate all elements and check localName (namespace agnostic)
    if (entries.length === 0) {
        const allElements = xmlDoc.getElementsByTagName("*");
        const found = [];
        for (let i = 0; i < allElements.length; i++) {
            if (allElements[i].localName === 'log-entry' || allElements[i].localName === 'log-item') {
                found.push(allElements[i]);
            }
        }
        entries = found;
    }
    
    console.log(`Found ${entries.length} SVN log entries`);
    
    const commits = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        let revision = entry.getAttribute("revision");

        // Helper to find child by local name
        const getChildText = (parent, localName) => {
            for (let j = 0; j < parent.childNodes.length; j++) {
                const node = parent.childNodes[j];
                // Check both localName and nodeName to be safe
                if (node.nodeType === 1 && (node.localName === localName || node.nodeName.endsWith(':' + localName))) { 
                    return node.textContent;
                }
            }
            return null;
        };

        // If revision is not an attribute, it might be a child element <D:version-name> or similar
        if (!revision) {
            revision = getChildText(entry, 'version-name');
        }
        
        const author = getChildText(entry, 'creator-displayname') || getChildText(entry, 'author');
        const date = getChildText(entry, 'date');
        const msg = getChildText(entry, 'comment') || getChildText(entry, 'msg');
        
        // Parse changed paths
        const paths = [];
        // Check for common path containers: <S:added-path>, <S:modified-path>, <S:deleted-path>, or inside <S:changed-paths> or <D:changed-paths> or directly
        // Usually it's structure like:
        // <S:log-item> ... <S:added-path>file.txt</S:added-path> ... </S:log-item>
        // Or in a container
        
        const extractPaths = (parentNode) => {
             for (let j = 0; j < parentNode.childNodes.length; j++) {
                const node = parentNode.childNodes[j];
                if (node.nodeType === 1) {
                    const name = node.localName;
                    if (name.includes('path')) { // heuristic for added-path, modified-path, etc.
                        paths.push({
                            action: name.replace('-path', ''), // simple extraction
                            path: node.textContent,
                            copyFromPath: node.getAttribute('copyfrom-path'),
                            copyFromRev: node.getAttribute('copyfrom-rev')
                        });
                    }
                }
             }
        };
        
        extractPaths(entry); // If paths are direct children
        // Also check if there's a container like 'changed-paths'
        const changedPathsContainer = entry.getElementsByTagName('changed-paths')[0] || entry.getElementsByTagName('S:changed-paths')[0] || entry.getElementsByTagName('D:changed-paths')[0];
        if (changedPathsContainer) {
            extractPaths(changedPathsContainer);
        }

        commits.push({
            revision,
            author: author || 'Unknown',
            date: date || null,
            message: msg || '',
            paths: paths, // Include changed paths
            type: 'svn_commit'
        });
    }
    return commits;
};

