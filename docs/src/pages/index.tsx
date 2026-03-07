import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <img 
          src="/secan/img/sproutling.png" 
          alt="Secan Logo" 
          className={styles.heroLogo}
        />
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/getting-started/about">
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/features/dashboard">
            View Features
          </Link>
        </div>
      </div>
    </header>
  );
}

interface FeatureItem {
  title: string;
  icon: string;
  description: string;
}

function FeatureCard({title, description, icon}: FeatureItem) {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <div className="text--center">
        <div className={styles.featureIcon}>{icon}</div>
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  const features: FeatureItem[] = [
    {
      title: 'Cluster Monitoring',
      icon: '⭐',
      description: 'Real-time health status, node statistics, and index metrics across all your clusters.',
    },
    {
      title: 'Index Management',
      icon: '📄',
      description: 'Create, delete, and modify indices with visual feedback and detailed configurations.',
    },
    {
      title: 'Shard Management',
      icon: '📋',
      description: 'Interactive grid-based shard allocation and relocation with visual representation.',
    },
    {
      title: 'REST Console',
      icon: '🔍',
      description: 'Execute Elasticsearch queries directly from the UI without leaving the application.',
    },
    {
      title: 'Multi-Cluster Support',
      icon: '⚙️',
      description: 'Manage multiple Elasticsearch clusters from a single unified interface.',
    },
    {
      title: 'Multiple Auth Modes',
      icon: '✅',
      description: 'Open mode, local users with bcrypt, and OIDC integration for enterprise deployments.',
    },
  ];

  return (
    <section className={styles.features}>
      <div className="container">
        <h2 className="text--center">Key Features</h2>
        <div className="row">
          {features.map((props, idx) => (
            <FeatureCard key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} Documentation`}
      description="Modern Elasticsearch cluster management tool">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
