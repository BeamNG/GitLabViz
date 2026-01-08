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
        // detectFeatures introspection
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'status' }]
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
                  nodes: [{ iid: '1', title: 'x', state: 'opened', labels: { nodes: [] }, assignees: { nodes: [] }, status: { name: 'To do' } }],
                  pageInfo: { hasNextPage: false, endCursor: null }
                }
              }
            }
          }
        }),
    };

    const result = await fetchProjectIssues(mockClient, 'group/project');

    expect(mockClient.post).toHaveBeenCalledTimes(2)
    const [url, body] = mockClient.post.mock.calls[1]
    expect(url).toBe('')
    expect(body).toHaveProperty('query')
    expect(body.variables).toEqual(expect.objectContaining({
      fullPath: 'group/project',
      first: 100,
      after: null,
      state: 'opened',
      updatedAfter: null
    }))
    expect(result).toEqual(expect.any(Array))
  });

  it('fetchProjectIssues (GraphQL) handles pagination', async () => {
    const mockClient = {
      post: vi.fn()
        // detectFeatures introspection
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'status' }]
              }
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: {
              project: {
                issues: {
                  nodes: [{ iid: '1', title: 'a', state: 'opened', labels: { nodes: [] }, assignees: { nodes: [] }, status: { name: 'To do' } }],
                  pageInfo: { hasNextPage: true, endCursor: 'CUR1' }
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
                  nodes: [{ iid: '2', title: 'b', state: 'opened', labels: { nodes: [] }, assignees: { nodes: [] }, status: { name: 'To do' } }],
                  pageInfo: { hasNextPage: false, endCursor: null }
                }
              }
            }
          }
        }),
    };

    const result = await fetchProjectIssues(mockClient, '123');

    expect(mockClient.post).toHaveBeenCalledTimes(3)
    expect(mockClient.post.mock.calls[1][1].variables.after).toBe(null)
    expect(mockClient.post.mock.calls[2][1].variables.after).toBe('CUR1')
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
        // detectFeatures introspection
        .mockResolvedValueOnce({
          data: {
            data: {
              __type: {
                fields: [{ name: 'status' }]
              }
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: {
              project: {
                issues: {
                  nodes: [{ iid: '1', title: 'x', state: 'opened', labels: { nodes: [] }, assignees: { nodes: [] }, status: { name: 'To do' } }],
                  pageInfo: { hasNextPage: false, endCursor: null }
                }
              }
            }
          }
        }),
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await fetchProjectIssues(mockClient, mockProjectId, null, { retry: { maxRetries: 2, retryBaseDelayMs: 0 } });

    expect(result.length).toBe(1);
    expect(mockClient.post).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

