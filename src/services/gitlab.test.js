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
      post: vi.fn()
        // detectFeatures introspection (Issue fields)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'status' }, { name: 'timeEstimate' }, { name: 'totalTimeSpent' }]
              }
            }
          }
        })
        // detectProjectIssuesArgs introspection (Project.issues args)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{
                  name: 'issues',
                  type: { kind: 'OBJECT', name: 'IssueConnection', ofType: null },
                  args: [{
                    name: 'state',
                    type: { kind: 'ENUM', name: 'IssuableState', ofType: null }
                  }]
                }]
              }
            }
          }
        })
        // enum values for IssuableState + IssueConnection fields
        .mockResolvedValueOnce({
          data: {
            data: {
              stateEnum: { enumValues: [{ name: 'opened' }, { name: 'closed' }] },
              conn: { fields: [{ name: 'count' }] }
            }
          }
        })
        // detectMilestoneCaps introspection (Milestone fields)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'webPath' }]
              }
            }
          }
        })
        // issues query
        .mockResolvedValueOnce({
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
                    status: { name: 'To do' },
                    timeEstimate: 0,
                    totalTimeSpent: 0
                  }],
                  pageInfo: { hasNextPage: false, endCursor: null },
                  count: 1
                }
              }
            }
          }
        }),
    };

    const result = await fetchProjectIssues(mockClient, 'group/project');

    expect(mockClient.post).toHaveBeenCalledTimes(5)
    const [url, body] = mockClient.post.mock.calls[4]
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
        // detectFeatures introspection (Issue fields)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'status' }, { name: 'timeEstimate' }, { name: 'totalTimeSpent' }]
              }
            }
          }
        })
        // detectProjectIssuesArgs introspection (Project.issues args)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{
                  name: 'issues',
                  type: { kind: 'OBJECT', name: 'IssueConnection', ofType: null },
                  args: [{
                    name: 'state',
                    type: { kind: 'ENUM', name: 'IssuableState', ofType: null }
                  }]
                }]
              }
            }
          }
        })
        // enum values for IssuableState + IssueConnection fields
        .mockResolvedValueOnce({
          data: {
            data: {
              stateEnum: { enumValues: [{ name: 'opened' }, { name: 'closed' }] },
              conn: { fields: [{ name: 'count' }] }
            }
          }
        })
        // detectMilestoneCaps introspection (Milestone fields)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'webPath' }]
              }
            }
          }
        })
        .mockResolvedValueOnce({
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
                    status: { name: 'To do' },
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
        .mockResolvedValueOnce({
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
                    status: { name: 'To do' },
                    timeEstimate: 0,
                    totalTimeSpent: 0
                  }],
                  pageInfo: { hasNextPage: false, endCursor: null },
                  count: 2
                }
              }
            }
          }
        }),
    };

    const result = await fetchProjectIssues(mockClient, '123');

    expect(mockClient.post).toHaveBeenCalledTimes(6)
    expect(mockClient.post.mock.calls[4][1].variables.after).toBe(null)
    expect(mockClient.post.mock.calls[5][1].variables.after).toBe('CUR1')
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
        .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '0' } } })
        // detectFeatures introspection (Issue fields)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'status' }, { name: 'timeEstimate' }, { name: 'totalTimeSpent' }]
              }
            }
          }
        })
        // detectProjectIssuesArgs introspection (Project.issues args)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{
                  name: 'issues',
                  type: { kind: 'OBJECT', name: 'IssueConnection', ofType: null },
                  args: [{
                    name: 'state',
                    type: { kind: 'ENUM', name: 'IssuableState', ofType: null }
                  }]
                }]
              }
            }
          }
        })
        // enum values for IssuableState + IssueConnection fields
        .mockResolvedValueOnce({
          data: {
            data: {
              stateEnum: { enumValues: [{ name: 'opened' }, { name: 'closed' }] },
              conn: { fields: [{ name: 'count' }] }
            }
          }
        })
        // detectMilestoneCaps introspection (Milestone fields)
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'webPath' }]
              }
            }
          }
        })
        .mockResolvedValueOnce({
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
                    status: { name: 'To do' },
                    timeEstimate: 0,
                    totalTimeSpent: 0
                  }],
                  pageInfo: { hasNextPage: false, endCursor: null },
                  count: 1
                }
              }
            }
          }
        }),
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await fetchProjectIssues(mockClient, mockProjectId, null, { retry: { maxRetries: 2, retryBaseDelayMs: 0 } });

    expect(result.length).toBe(1);
    expect(mockClient.post).toHaveBeenCalledTimes(6);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

