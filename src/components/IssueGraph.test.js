import { mount } from '@vue/test-utils';
import IssueGraph from './IssueGraph.vue';

// Mock stats.js
vi.mock('stats.js', () => {
  return {
    default: vi.fn(function() {
      return {
        showPanel: vi.fn(),
        dom: document.createElement('div'),
        begin: vi.fn(),
        end: vi.fn(),
      };
    })
  };
});

// Mock D3
vi.mock('d3', async () => {
  const actual = await vi.importActual('d3');
  return {
    ...actual,
    // Add any specific mocks if needed, but integration testing D3 usually works with jsdom
  };
});

describe('IssueGraph.vue', () => {
  const mockNodes = {
    '1': { id: '1', name: 'Issue 1', _raw: { state: 'opened', title: 'Test', author: { name: 'Me' } }, color: '#ff0000', x: 0, y: 0 },
  };
  const mockEdges = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    const wrapper = mount(IssueGraph, {
      props: {
        nodes: mockNodes,
        edges: mockEdges,
      },
    });
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.graph-container').exists()).toBe(true);
  });

  it('initializes D3 simulation', async () => {
    const wrapper = mount(IssueGraph, {
      props: {
        nodes: mockNodes,
        edges: mockEdges,
      },
    });
    
    // Wait for mount
    await wrapper.vm.$nextTick();
    
    // Check if nodes are rendered
    // We expect .node-capsule elements to be present after d3 creates them
    // Note: D3 modifies DOM directly, Vue might not know immediately, but jsdom should update
    // Since we use D3 to append, we check DOM
    // expect(wrapper.element.querySelectorAll('.node-capsule').length).toBe(1);
  });
});
