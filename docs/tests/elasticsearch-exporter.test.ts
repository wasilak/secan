import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Elasticsearch Exporter Documentation', () => {
  let docContent: string;
  
  beforeAll(() => {
    const docPath = path.join(__dirname, '../src/content/docs/monitoring/elasticsearch-exporter.md');
    docContent = fs.readFileSync(docPath, 'utf-8');
  });

  describe('Content Presence', () => {
    it('should contain overview section', () => {
      expect(docContent).toContain('## Overview');
      expect(docContent).toContain('elasticsearch_exporter');
    });

    it('should contain architecture section', () => {
      expect(docContent).toContain('## Architecture');
      expect(docContent).toContain('Component Interaction');
    });

    it('should contain installation section', () => {
      expect(docContent).toContain('## Installation and Setup');
      expect(docContent).toContain('Installing elasticsearch_exporter');
    });

    it('should contain Cerebro configuration section', () => {
      expect(docContent).toContain('## Cerebro Configuration');
      expect(docContent).toContain('metrics:');
    });

    it('should contain metrics reference section', () => {
      expect(docContent).toContain('## Metrics Reference');
    });

    it('should contain troubleshooting section', () => {
      expect(docContent).toContain('## Troubleshooting');
    });
  });

  describe('Required Links', () => {
    it('should link to official elasticsearch_exporter repository', () => {
      expect(docContent).toContain('https://github.com/prometheus-community/elasticsearch_exporter');
    });

    it('should link to Prometheus documentation', () => {
      expect(docContent).toContain('https://prometheus.io/docs/');
    });

    it('should link to Elasticsearch monitoring documentation', () => {
      expect(docContent).toContain('https://www.elastic.co/guide/en/elasticsearch/reference/current/monitor-elasticsearch-cluster.html');
    });
  });

  describe('Architecture Diagram', () => {
    it('should include Mermaid diagram', () => {
      expect(docContent).toContain('```mermaid');
    });

    it('should show all components in diagram', () => {
      expect(docContent).toContain('Elasticsearch');
      expect(docContent).toContain('elasticsearch_exporter');
      expect(docContent).toContain('Prometheus');
      expect(docContent).toContain('Cerebro');
    });

    it('should include port numbers', () => {
      expect(docContent).toContain('9200');
      expect(docContent).toContain('9114');
      expect(docContent).toContain('9090');
      expect(docContent).toContain('9000');
    });
  });

  describe('Code Examples', () => {
    it('should include YAML code blocks', () => {
      expect(docContent).toContain('```yaml');
    });

    it('should include bash code blocks', () => {
      expect(docContent).toContain('```bash');
    });

    it('should include Prometheus scrape configuration', () => {
      expect(docContent).toContain('scrape_configs');
    });

    it('should include Cerebro configuration example', () => {
      expect(docContent).toContain('clusters:');
      expect(docContent).toContain('source: "prometheus"');
    });
  });
});


describe('Required Metrics Documentation', () => {
  const requiredMetrics = [
    'elasticsearch_os_cpu_percent',
    'elasticsearch_os_load1',
    'elasticsearch_os_load5',
    'elasticsearch_os_load15',
    'elasticsearch_os_mem_free_bytes',
    'elasticsearch_os_mem_used_bytes',
    'elasticsearch_os_mem_actual_free_bytes',
    'elasticsearch_os_mem_actual_used_bytes'
  ];

  requiredMetrics.forEach(metric => {
    it(`should document ${metric} metric`, () => {
      expect(docContent).toContain(metric);
    });
  });

  it('should explain difference between actual and regular memory metrics', () => {
    expect(docContent).toContain('actual');
    expect(docContent).toContain('buffers');
    expect(docContent).toContain('cache');
  });

  it('should document metric labels', () => {
    expect(docContent).toContain('cluster');
    expect(docContent).toContain('node');
    expect(docContent).toContain('name');
  });
});


describe('Required Links', () => {
  const requiredLinks = [
    'https://github.com/prometheus-community/elasticsearch_exporter',
    'https://prometheus.io/docs/',
    'https://prometheus.io/docs/prometheus/latest/querying/basics/',
    'https://www.elastic.co/guide/en/elasticsearch/reference/current/monitor-elasticsearch-cluster.html'
  ];

  requiredLinks.forEach(link => {
    it(`should include link to ${link}`, () => {
      expect(docContent).toContain(link);
    });
  });
});


describe('Code Examples', () => {
  it('should include Docker installation example', () => {
    expect(docContent).toContain('docker run');
    expect(docContent).toContain('elasticsearch-exporter');
  });

  it('should include Kubernetes deployment example', () => {
    expect(docContent).toContain('apiVersion: apps/v1');
    expect(docContent).toContain('kind: Deployment');
  });

  it('should include Prometheus scrape config', () => {
    expect(docContent).toContain('scrape_configs');
    expect(docContent).toContain('job_name');
  });

  it('should include Cerebro configuration', () => {
    expect(docContent).toContain('clusters:');
    expect(docContent).toContain('metrics:');
    expect(docContent).toContain('source: "prometheus"');
  });

  it('should include PromQL examples', () => {
    expect(docContent).toContain('elasticsearch_os_cpu_percent');
    expect(docContent).toMatch(/```promql/);
  });

  it('should include curl examples', () => {
    expect(docContent).toContain('curl');
    expect(docContent).toContain('/metrics');
  });
});


describe('Architecture Diagram', () => {
  it('should include Mermaid diagram block', () => {
    expect(docContent).toMatch(/```mermaid[\s\S]*?```/);
  });

  it('should show data flow with arrows', () => {
    expect(docContent).toContain('-->');
  });

  it('should include all four components', () => {
    const diagramSection = docContent.match(/```mermaid[\s\S]*?```/)?.[0] || '';
    expect(diagramSection).toContain('Elasticsearch');
    expect(diagramSection).toContain('elasticsearch_exporter');
    expect(diagramSection).toContain('Prometheus');
    expect(diagramSection).toContain('Cerebro');
  });

  it('should include port information', () => {
    const diagramSection = docContent.match(/```mermaid[\s\S]*?```/)?.[0] || '';
    expect(diagramSection).toContain('9200');
    expect(diagramSection).toContain('9114');
    expect(diagramSection).toContain('9090');
    expect(diagramSection).toContain('9000');
  });
});
