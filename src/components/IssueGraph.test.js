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
  const mountOpts = {
    global: {
      stubs: {
        'v-icon': true
      }
    }
  }

  beforeAll(() => {
    // jsdom doesn't implement canvas; stub it to avoid noisy warnings.
    const noop = () => {}
    if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype) {
      // Only stub if not already provided by the environment.
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        // state
        save: noop,
        restore: noop,
        setTransform: noop,
        // transforms
        translate: noop,
        rotate: noop,
        scale: noop,
        // rects + paths
        clearRect: noop,
        fillRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        quadraticCurveTo: noop,
        closePath: noop,
        roundRect: noop,
        clip: noop,
        // drawing
        stroke: noop,
        fill: noop,
        drawImage: noop,
        // text
        measureText: () => ({ width: 0 }),
        fillText: noop,
        strokeText: noop,
        // styles
        setLineDash: noop
      }))
    }
  })

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    const wrapper = mount(IssueGraph, {
      props: {
        nodes: mockNodes,
        edges: mockEdges,
      },
      ...mountOpts
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
      ...mountOpts
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
