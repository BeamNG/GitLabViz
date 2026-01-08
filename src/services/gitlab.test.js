import axios from 'axios';
import { createGitLabClient, createGitLabGraphqlClient, fetchProjectIssues, fetchIssueLinks } from './gitlab';

vi.mock('axios');

describe('gitlab service', () => {
  const mockToken = 'test-token';
  const mockBaseUrl = 'https://custom.gitlab.com/api/v4';
  const mockProjectId = '123';
  const mockIssueId = '1';

  it('createGitLabClient creates an axios instance with correct config', () => {
    const mockCreate = vi.fn();
    axios.create.mockImplementation(mockCreate);

    createGitLabClient(mockBaseUrl, mockToken);

    expect(mockCreate).toHaveBeenCalledWith({
      baseURL: mockBaseUrl,
      timeout: 30000,
      headers: {
        'PRIVATE-TOKEN': mockToken,
      },
    });
  });

  it('createGitLabClient does not add a default base URL if not provided', () => {
    const mockCreate = vi.fn();
    axios.create.mockImplementation(mockCreate);

    createGitLabClient(undefined, mockToken);

    expect(mockCreate).toHaveBeenCalledWith({
      baseURL: undefined,
      timeout: 30000,
      headers: {
        'PRIVATE-TOKEN': mockToken,
      },
    });
  });

  it('createGitLabGraphqlClient converts /api/v4 to /api/graphql', () => {
    const mockCreate = vi.fn()
    axios.create.mockImplementation(mockCreate)

    createGitLabGraphqlClient(mockBaseUrl, mockToken)

    expect(mockCreate).toHaveBeenCalledWith({
      baseURL: 'https://custom.gitlab.com/api/graphql',
      timeout: 30000,
      headers: {
        'PRIVATE-TOKEN': mockToken,
      },
    })
  })

  it('fetchProjectIssues (GraphQL) posts with correct variables', async () => {
    const mockClient = {
      post: vi.fn().mockImplementation((url, body) => {
        const q = String(body?.query || '')
        // detectFeatures: Issue fields
        if (q.includes('__type(name: "Issue")')) {
          return Promise.resolve({ data: { data: { __type: { fields: [
            { name: 'hidden' },
            { name: 'webPath' },
            { name: 'reference' },
            { name: 'relativePosition' },
            { name: 'type' },
            { name: 'participants' },
            { name: 'userDiscussionsCount' },
            { name: 'subscribed' },
            { name: 'timeEstimate' },
            { name: 'totalTimeSpent' }
          ] } } } })
        }
        // detectProjectIssuesArgs: Project field args
        if (q.includes('__type(name: "Project")')) {
          return Promise.resolve({ data: { data: { __type: { fields: [{
            name: 'issues',
            type: { kind: 'OBJECT', name: 'IssueConnection', ofType: null },
            args: [{ name: 'state', type: { kind: 'ENUM', name: 'IssuableState', ofType: null } }]
          }] } } } })
        }
        // detectProjectIssuesArgs: enum + connection fields
        if (q.includes('query GetCaps')) {
          return Promise.resolve({ data: { data: {
            stateEnum: { enumValues: [{ name: 'opened' }, { name: 'closed' }] },
            conn: { fields: [{ name: 'count' }] }
          } } })
        }
        // detectMilestoneCaps: Milestone fields
        if (q.includes('__type(name: "Milestone")')) {
          return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'webPath' }] } } } })
        }
        // WorkItemWidgetStatus existence check (optional)
        if (q.includes('__type(name: "WorkItemWidgetStatus")')) {
          return Promise.resolve({ data: { data: { __type: null } } })
        }
        // widgets base type + possibleTypes probe (new)
        if (q.includes('possibleTypes') && q.includes('WorkItemWidgetStatus')) {
          return Promise.resolve({ data: { data: { base: { possibleTypes: [] }, st: { name: null } } } })
        }
        // Project fields probe (new)
        if (q.includes('__type(name: "Project")')) {
          return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'issues' }] } } } })
        }

        // issues query
        return Promise.resolve({
          data: {
            data: {
              project: {
                issues: {
                  nodes: [{
                    iid: '1',
                    title: 'x',
                    state: 'opened',
                    labels: { nodes: [] },
                    assignees: { nodes: [] },
                    timeEstimate: 0,
                    totalTimeSpent: 0
                  }],
                  pageInfo: { hasNextPage: false, endCursor: null },
                  count: 1
                }
              }
            }
          }
        })
      }),
    };

    const result = await fetchProjectIssues(mockClient, 'group/project');

    const calls = mockClient.post.mock.calls
    const issuesCall = calls.find(c => c && c[1] && c[1].variables && c[1].variables.fullPath === 'group/project')
    expect(issuesCall).toBeTruthy()
    const [url, body] = issuesCall
    expect(url).toBe('')
    expect(body).toHaveProperty('query')
    expect(body.variables).toEqual(expect.objectContaining({
      fullPath: 'group/project',
      first: 50,
      after: null,
      state: 'opened',
      updatedAfter: null
    }))
    expect(result).toEqual(expect.any(Array))
  });

  it('fetchProjectIssues (GraphQL) handles pagination', async () => {
    const mockClient = {
      post: vi.fn()
        .mockImplementation((url, body) => {
          const q = String(body?.query || '')
          // same schema mocks as above
          if (q.includes('__type(name: "Issue")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [
              { name: 'hidden' },
              { name: 'webPath' },
              { name: 'reference' },
              { name: 'relativePosition' },
              { name: 'type' },
              { name: 'participants' },
              { name: 'userDiscussionsCount' },
              { name: 'subscribed' },
              { name: 'timeEstimate' },
              { name: 'totalTimeSpent' }
            ] } } } })
          }
          if (q.includes('__type(name: "Project")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{
              name: 'issues',
              type: { kind: 'OBJECT', name: 'IssueConnection', ofType: null },
              args: [{ name: 'state', type: { kind: 'ENUM', name: 'IssuableState', ofType: null } }]
            }] } } } })
          }
          if (q.includes('query GetCaps')) {
            return Promise.resolve({ data: { data: {
              stateEnum: { enumValues: [{ name: 'opened' }, { name: 'closed' }] },
              conn: { fields: [{ name: 'count' }] }
            } } })
          }
          if (q.includes('__type(name: "Milestone")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'webPath' }] } } } })
          }
          if (q.includes('__type(name: "WorkItemWidgetStatus")')) {
            return Promise.resolve({ data: { data: { __type: null } } })
          }
          if (q.includes('possibleTypes') && q.includes('WorkItemWidgetStatus')) {
            return Promise.resolve({ data: { data: { base: { possibleTypes: [] }, st: { name: null } } } })
          }
          if (q.includes('__type(name: "Project")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'issues' }] } } } })
          }

          // issues pages
          const after = body?.variables?.after || null
          if (!after) {
            return Promise.resolve({
              data: {
                data: {
                  project: {
                    issues: {
                      nodes: [{
                        iid: '1',
                        title: 'a',
                        state: 'opened',
                        labels: { nodes: [] },
                        assignees: { nodes: [] },
                        timeEstimate: 0,
                        totalTimeSpent: 0
                      }],
                      pageInfo: { hasNextPage: true, endCursor: 'CUR1' },
                      count: 2
                    }
                  }
                }
              }
            })
          }
          return Promise.resolve({
            data: {
              data: {
                project: {
                  issues: {
                    nodes: [{
                      iid: '2',
                      title: 'b',
                      state: 'opened',
                      labels: { nodes: [] },
                      assignees: { nodes: [] },
                      timeEstimate: 0,
                      totalTimeSpent: 0
                    }],
                    pageInfo: { hasNextPage: false, endCursor: null },
                    count: 2
                  }
                }
              }
            }
          })
        }),
    };

    const result = await fetchProjectIssues(mockClient, '123');

    const issueCalls = mockClient.post.mock.calls.filter(c => c && c[1] && c[1].variables && c[1].variables.fullPath === '123')
    expect(issueCalls.length).toBe(2)
    expect(issueCalls[0][1].variables.after).toBe(null)
    expect(issueCalls[1][1].variables.after).toBe('CUR1')
    expect(result.length).toBe(2)
  });

  it('fetchProjectIssues throws error on failure', async () => {
    const mockClient = {
      post: vi.fn().mockRejectedValue(new Error('API Error')),
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(fetchProjectIssues(mockClient, mockProjectId)).rejects.toThrow('API Error');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('fetchIssueLinks calls get with correct url', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ data: [{ id: 2 }] }),
    };

    const encodedProjectId = encodeURIComponent('group/project');
    const result = await fetchIssueLinks(mockClient, 'group/project', mockIssueId);

    expect(mockClient.get).toHaveBeenCalledWith(`/projects/${encodedProjectId}/issues/${mockIssueId}/links`, {});
    expect(result).toEqual([{ id: 2 }]);
  });

  it('fetchIssueLinks returns empty array on error', async () => {
    const mockClient = {
      get: vi.fn().mockRejectedValue(new Error('Link Error')),
    };
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchIssueLinks(mockClient, mockProjectId, mockIssueId);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('fetchProjectIssues retries on 429 and succeeds', async () => {
    const mockClient = {
      post: vi.fn()
        .mockImplementation((url, body) => {
          const q = String(body?.query || '')
          // schema probes succeed
          if (q.includes('__type(name: "Issue")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'timeEstimate' }, { name: 'totalTimeSpent' }] } } } })
          }
          if (q.includes('__type(name: "Project")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{
              name: 'issues',
              type: { kind: 'OBJECT', name: 'IssueConnection', ofType: null },
              args: [{ name: 'state', type: { kind: 'ENUM', name: 'IssuableState', ofType: null } }]
            }] } } } })
          }
          if (q.includes('query GetCaps')) {
            return Promise.resolve({ data: { data: {
              stateEnum: { enumValues: [{ name: 'opened' }, { name: 'closed' }] },
              conn: { fields: [{ name: 'count' }] }
            } } })
          }
          if (q.includes('__type(name: "Milestone")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'webPath' }] } } } })
          }
          if (q.includes('__type(name: "WorkItemWidgetStatus")')) {
            return Promise.resolve({ data: { data: { __type: null } } })
          }
          if (q.includes('possibleTypes') && q.includes('WorkItemWidgetStatus')) {
            return Promise.resolve({ data: { data: { base: { possibleTypes: [] }, st: { name: null } } } })
          }
          if (q.includes('__type(name: "Project")')) {
            return Promise.resolve({ data: { data: { __type: { fields: [{ name: 'issues' }] } } } })
          }

          // first issues query: 429
          const after = body?.variables?.after || null
          if (after === null && !mockClient.__did429) {
            mockClient.__did429 = true
            return Promise.reject({ response: { status: 429, headers: { 'retry-after': '0' } } })
          }

          // then succeed
          return Promise.resolve({
            data: {
              data: {
                project: {
                  issues: {
                    nodes: [{
                      iid: '1',
                      title: 'x',
                      state: 'opened',
                      labels: { nodes: [] },
                      assignees: { nodes: [] },
                      timeEstimate: 0,
                      totalTimeSpent: 0
                    }],
                    pageInfo: { hasNextPage: false, endCursor: null },
                    count: 1
                  }
                }
              }
            }
          })
        }),
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await fetchProjectIssues(mockClient, mockProjectId, null, { retry: { maxRetries: 2, retryBaseDelayMs: 0 } });

    expect(result.length).toBe(1);
    expect(mockClient.post).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

