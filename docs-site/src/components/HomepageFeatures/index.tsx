import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Beancount Integration',
    Svg: require('@site/static/img/logo.svg').default,
    description: (
      <>
        Seamlessly integrate with Beancount for powerful double-entry bookkeeping.
        Track your finances with precision and generate comprehensive reports.
      </>
    ),
  },
  {
    title: 'Dashboard',
    Svg: require('@site/static/img/Dashboard.svg').default,
    description: (
      <>
        Access balance sheets, transactions, commodities, and journal entries
        all in one place. Visualize your financial data with interactive charts.
      </>
    ),
  },
  {
    title: 'BQL Query Support',
    Svg: require('@site/static/img/BQL.svg').default,
    description: (
      <>
        Run powerful Beancount Query Language (BQL) queries directly in your notes.
        Embed live financial data and reports in your Obsidian vault.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
