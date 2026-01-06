import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { createGitLabClient, fetchProjectIssues, fetchIssueLinks } from './gitlab';

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
      headers: {
        'PRIVATE-TOKEN': mockToken,
      },
    });
  });

  it('fetchProjectIssues calls get with correct params', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({ 
        data: [{ id: 1 }],
        headers: { 'x-total-pages': '1' } 
      }),
    };

    // Test with special characters needing encoding
    const encodedProjectId = encodeURIComponent('group/project');
    const result = await fetchProjectIssues(mockClient, 'group/project');

    expect(mockClient.get).toHaveBeenCalledWith(`/projects/${encodedProjectId}/issues`, {
      params: {
        per_page: 100,
        state: 'opened',
        page: 1
      },
    });
    expect(result).toEqual([{ id: 1 }]);
  });

  it('fetchProjectIssues handles pagination', async () => {
    const mockClient = {
      get: vi.fn()
        .mockResolvedValueOnce({ 
          data: [{ id: 1 }], 
          headers: { 'x-total-pages': '2', 'x-next-page': '2' } 
        })
        .mockResolvedValueOnce({ 
          data: [{ id: 2 }], 
          headers: { 'x-total-pages': '2', 'x-next-page': '' } 
        }),
    };

    const result = await fetchProjectIssues(mockClient, '123');

    expect(mockClient.get).toHaveBeenCalledTimes(2);
    expect(mockClient.get).toHaveBeenNthCalledWith(1, '/projects/123/issues', expect.objectContaining({ params: { per_page: 100, state: 'opened', page: 1 } }));
    expect(mockClient.get).toHaveBeenNthCalledWith(2, '/projects/123/issues', expect.objectContaining({ params: { per_page: 100, state: 'opened', page: 2 } }));
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('fetchProjectIssues throws error on failure', async () => {
    const mockClient = {
      get: vi.fn().mockRejectedValue(new Error('API Error')),
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

    expect(mockClient.get).toHaveBeenCalledWith(`/projects/${encodedProjectId}/issues/${mockIssueId}/links`);
    expect(result).toEqual([{ id: 2 }]);
  });

  it('fetchIssueLinks returns empty array on error', async () => {
    const mockClient = {
      get: vi.fn().mockRejectedValue(new Error('Link Error')),
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchIssueLinks(mockClient, mockProjectId, mockIssueId);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

